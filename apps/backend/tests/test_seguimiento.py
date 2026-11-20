"""Seguimiento de la cuadrilla: posición compartida, "Cuadrilla en camino" y panel operativo."""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.db.base import ahora
from app.db.modelos import AuditoriaAcceso, PosicionCuadrilla
from app.domain import seguimiento as dom
from tests.test_evacuaciones import _cuadrilla_demo_id, _pedido_con_tarea
from tests.test_operacion import S4, _usuario_nuevo

POS = {"lat": -26.18, "lon": -58.14, "precision_m": 12.5}


def _poner_en_curso(client, como, tarea_id: int) -> None:
    r = client.patch(
        f"/api/v1/tareas/{tarea_id}", json={"estado": "en_curso"}, headers=como("cuadrilla")
    )
    assert r.status_code == 200, r.text


def _envejecer(db, cuadrilla_id: int, segundos: int) -> None:
    db.execute(
        update(PosicionCuadrilla)
        .where(PosicionCuadrilla.cuadrilla_id == cuadrilla_id)
        .values(registrada_en=ahora() - timedelta(seconds=segundos))
    )
    db.commit()


@pytest.fixture
def pedido_en_curso(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    _poner_en_curso(client, como, p["tarea_id"])
    p["cuadrilla_id"] = _cuadrilla_demo_id(db)
    return p


# ---- dominio -----------------------------------------------------------------------------------


def test_estimar_distancia_y_llegada():
    # ~1 grado de latitud = 111,2 km; con factor 1,3 y 40 km/h
    e = dom.estimar(-58.0, -26.0, -58.0, -26.1, 1.3, 40.0)
    assert e.distancia_m == pytest.approx(11119 * 1.3, abs=30)
    assert e.llegada_estimada_min == 22  # 14,45 km / 40 km/h = 21,7 min -> 22
    assert dom.estimar(-58.0, -26.0, -58.0, -26.0, 1.3, 40.0).llegada_estimada_min == 0
    with pytest.raises(ValueError):
        dom.estimar(-58.0, -26.0, -58.0, -26.1, 1.3, 0)


def test_posicion_vieja():
    t = ahora()
    assert dom.posicion_vieja(t - timedelta(minutes=6), t, 5) is True
    assert dom.posicion_vieja(t - timedelta(minutes=4), t, 5) is False


# ---- POST /cuadrillas/mi-posicion ---------------------------------------------------------------


def test_posicion_feliz_y_seguimiento_del_solicitante(client, como, db, pedido_en_curso):
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    assert r.status_code == 200, r.text
    assert pedido_en_curso["cuadrilla_id"] in r.json()["cuadrillas"]

    s = client.get("/api/v1/mi/seguimiento", headers=pedido_en_curso["h"]).json()
    assert s["categoria"] == "SIMULADO"
    item = next(
        i for i in s["seguimientos"] if i["solicitud_id"] == pedido_en_curso["solicitud_id"]
    )
    assert item["estado"] == "en_camino" and item["tipo_cuadrilla"] == "humana"
    assert item["posicion_vieja"] is False
    assert item["distancia_m"] > 0 and item["llegada_estimada_min"] >= 1
    assert item["categoria"] == "SIMULADO"
    assert item["supuestos"]["factor_desvio"] == 1.3
    assert item["supuestos"]["velocidad_cuadrilla_kmh"] == 40
    assert all("@" not in rol for rol in item["roles"])  # roles del catálogo, no personas


def test_seguimiento_sin_posicion_todavia(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    _poner_en_curso(client, como, p["tarea_id"])
    db.execute(select(PosicionCuadrilla))  # la fila previa de otras pruebas no debe filtrarse
    db.execute(
        PosicionCuadrilla.__table__.delete().where(
            PosicionCuadrilla.cuadrilla_id == _cuadrilla_demo_id(db)
        )
    )
    db.commit()
    s = client.get("/api/v1/mi/seguimiento", headers=p["h"]).json()
    item = next(i for i in s["seguimientos"] if i["solicitud_id"] == p["solicitud_id"])
    assert item["estado"] == "asignada_sin_posicion"
    assert item["posicion"] is None and item["llegada_estimada_min"] is None


def test_posicion_vieja_se_avisa(client, como, db, pedido_en_curso):
    client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    _envejecer(db, pedido_en_curso["cuadrilla_id"], 6 * 60)
    s = client.get("/api/v1/mi/seguimiento", headers=pedido_en_curso["h"]).json()
    item = next(
        i for i in s["seguimientos"] if i["solicitud_id"] == pedido_en_curso["solicitud_id"]
    )
    assert item["posicion_vieja"] is True


def test_posicion_sin_tarea_en_curso_409(client, como, db):
    # Nadie del demo tiene la tarea en curso: se cierran todas las abiertas de la cuadrilla demo.
    cid = _cuadrilla_demo_id(db)
    from app.db.modelos import Tarea

    db.execute(
        update(Tarea)
        .where(Tarea.cuadrilla_id == cid, Tarea.estado == "en_curso")
        .values(estado="cancelada")
    )
    db.commit()
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    assert r.status_code == 409 and "tarea en curso" in r.json()["error"]["mensaje"]


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"lat": 91, "lon": -58.1},
        {"lat": -26.1, "lon": -181},
        {"lat": -26.1, "lon": -58.1, "precision_m": -1},
        {"lat": "x", "lon": -58.1},
        {"lat": -26.1},
    ],
)
def test_posicion_coordenadas_invalidas_422(client, como, cuerpo):
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=cuerpo, headers=como("cuadrilla"))
    assert r.status_code == 422


@pytest.mark.parametrize("quien", ["ciudadano1", "productor1", "operador", "decisor", "admin"])
def test_posicion_solo_cuadrilla_403(client, como, quien):
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como(quien))
    assert r.status_code == 403


def test_posicion_sin_sesion_401(client):
    assert client.post("/api/v1/cuadrillas/mi-posicion", json=POS).status_code == 401


def test_posicion_rate_limit_429(client, como, db, pedido_en_curso):
    cid = pedido_en_curso["cuadrilla_id"]
    db.execute(PosicionCuadrilla.__table__.delete().where(PosicionCuadrilla.cuadrilla_id == cid))
    db.commit()
    assert (
        client.post(
            "/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla")
        ).status_code
        == 200
    )
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    assert r.status_code == 429 and "Retry-After" in r.headers
    _envejecer(db, cid, 11)
    assert (
        client.post(
            "/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla")
        ).status_code
        == 200
    )


def test_solo_se_guarda_la_ultima_posicion(client, como, db, pedido_en_curso):
    cid = pedido_en_curso["cuadrilla_id"]
    client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    _envejecer(db, cid, 11)
    client.post(
        "/api/v1/cuadrillas/mi-posicion",
        json={"lat": -26.2, "lon": -58.2},
        headers=como("cuadrilla"),
    )
    db.expire_all()
    filas = db.execute(select(PosicionCuadrilla).where(PosicionCuadrilla.cuadrilla_id == cid)).all()
    assert len(filas) == 1


def test_la_posicion_se_borra_al_cerrar_la_ultima_tarea_en_curso(client, como, db):
    cid = _cuadrilla_demo_id(db)
    from app.db.modelos import Tarea

    db.execute(
        update(Tarea)
        .where(Tarea.cuadrilla_id == cid, Tarea.estado == "en_curso")
        .values(estado="cancelada")
    )
    db.commit()
    p = _pedido_con_tarea(client, como, db)
    _poner_en_curso(client, como, p["tarea_id"])
    db.execute(PosicionCuadrilla.__table__.delete().where(PosicionCuadrilla.cuadrilla_id == cid))
    db.commit()
    assert (
        client.post(
            "/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla")
        ).status_code
        == 200
    )
    r = client.patch(
        f"/api/v1/tareas/{p['tarea_id']}", json={"estado": "cancelada"}, headers=como("cuadrilla")
    )
    assert r.status_code == 200
    db.expire_all()
    assert db.get(PosicionCuadrilla, cid) is None
    assert client.get("/api/v1/mi/seguimiento", headers=p["h"]).json()["seguimientos"] == []


# ---- aislamiento y roles de lectura -----------------------------------------------------------


def test_otro_ciudadano_no_ve_el_seguimiento(client, como, pedido_en_curso):
    client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    _, otro = _usuario_nuevo(client, "ciudadano", lon=S4["lon"], lat=S4["lat"])
    assert client.get("/api/v1/mi/seguimiento", headers=otro).json()["seguimientos"] == []
    # y la persona con el pedido sí
    assert client.get("/api/v1/mi/seguimiento", headers=pedido_en_curso["h"]).json()["seguimientos"]


@pytest.mark.parametrize("quien", ["cuadrilla", "operador", "decisor", "admin"])
def test_seguimiento_personal_es_de_ciudadania_y_productores(client, como, quien):
    assert client.get("/api/v1/mi/seguimiento", headers=como(quien)).status_code == 403


@pytest.mark.parametrize("quien", ["ciudadano1", "productor1", "cuadrilla"])
def test_posiciones_solo_mandos_403(client, como, quien):
    assert client.get("/api/v1/cuadrillas/posiciones", headers=como(quien)).status_code == 403


def test_posiciones_operativas_y_auditoria(client, como, db, pedido_en_curso):
    client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    antes = (
        db.execute(select(AuditoriaAcceso.id).order_by(AuditoriaAcceso.id.desc())).scalars().first()
    )
    r = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador"))
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    p = next(
        p for p in cuerpo["posiciones"] if p["cuadrilla_id"] == pedido_en_curso["cuadrilla_id"]
    )
    assert p["lat"] == pytest.approx(POS["lat"]) and p["lon"] == pytest.approx(POS["lon"])
    assert p["categoria"] == "SIMULADO" and p["tareas_en_curso"] >= 1
    assert cuerpo["supuestos"]["posicion_vieja_minutos"] == 5
    db.expire_all()
    acc = (
        db.execute(select(AuditoriaAcceso.accion).where(AuditoriaAcceso.id > (antes or 0)))
        .scalars()
        .all()
    )
    assert "lectura_ubicacion_cuadrillas" in acc
