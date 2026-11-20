"""``GET /mi/pedidos``, respuestas de confirmación de cinco opciones y vehículo de la cuadrilla."""

from __future__ import annotations

import json

import pytest
from sqlalchemy import inspect

from app.domain import evacuaciones as dom
from tests.test_evacuaciones import (
    _cerrar,
    _codigo,
    _estado,
    _pedido_con_tarea,
    _sms,
)
from tests.test_operacion import S4, _usuario_nuevo

PASOS = ["recibida", "verificada", "asignada", "en_curso", "resuelta"]


def _confirmar(client, p, respuesta: str):
    return client.post(
        "/api/v1/mi/confirmaciones",
        json={"solicitud_id": p["solicitud_id"], "respuesta": respuesta},
        headers=p["h"],
    )


def _pedidos(client, h) -> list[dict]:
    r = client.get("/api/v1/mi/pedidos", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["categoria"] == "SIMULADO"
    return r.json()["items"]


# ---- GET /mi/pedidos ------------------------------------------------------------------------------


def test_pedidos_flujo_completo_con_linea_de_tiempo(client, como, db):
    p, _ = _cerrar(client, como, db)
    assert _confirmar(client, p, "parcial").status_code == 201
    item = next(i for i in _pedidos(client, p["h"]) if i["id"] == p["solicitud_id"])

    assert item["tipo"] == "evacuacion" and item["personas"] == 3 and item["origen"] == "web"
    assert item["lat"] is not None and item["lon"] is not None and item["sector_id"] == "S4"
    assert [t["estado"] for t in item["linea_tiempo"]] == PASOS
    por_estado = {t["estado"]: t for t in item["linea_tiempo"]}
    # Hasta "asignada" el operador pasó por la API (bitácora); la cuadrilla cerró con constancia.
    assert all(por_estado[e]["alcanzado"] and por_estado[e]["en"] for e in PASOS[:3])
    assert por_estado["resuelta"]["alcanzado"] and por_estado["resuelta"]["en"]
    # "en curso" se alcanzó (la tarea se completó) pero nadie registró la hora.
    assert por_estado["en_curso"]["alcanzado"] is True
    assert item["tarea"]["estado"] == "completada" and item["tarea"]["cerrada_en"]
    cuadrilla = item["tarea"]["cuadrilla"]
    assert cuadrilla["tipo_incidente"] == "humana" and cuadrilla["vehiculo"] == "4x4"
    assert cuadrilla["rol_encargado"] == "encargado_cuadrilla"
    assert item["confirmacion"] == {
        "solicitud_id": p["solicitud_id"],
        "respondida": True,
        "respuesta": "parcial",
        "comentario": None,
    }
    assert item["centro"]["nombre"] and item["centro"]["lat"] and item["centro"]["lon"]
    assert item["seguimiento"] is None  # la tarea ya no está en curso
    assert "@" not in json.dumps(item)  # sin datos de personas


def test_pedidos_tarea_en_curso_trae_seguimiento(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    r = client.patch(
        f"/api/v1/tareas/{p['tarea_id']}", json={"estado": "en_curso"}, headers=como("cuadrilla")
    )
    assert r.status_code == 200
    item = next(i for i in _pedidos(client, p["h"]) if i["id"] == p["solicitud_id"])
    assert item["tarea"]["estado"] == "en_curso" and item["tarea"]["iniciada_en"]
    assert item["tarea"]["cerrada_en"] is None
    assert item["seguimiento"]["solicitud_id"] == p["solicitud_id"]
    pasos = {t["estado"]: t for t in item["linea_tiempo"]}
    assert pasos["en_curso"]["alcanzado"] and pasos["en_curso"]["en"]
    assert pasos["resuelta"] == {"estado": "resuelta", "en": None, "alcanzado": False}
    assert item["confirmacion"] is None and item["centro"] is None


def test_pedido_recien_creado_solo_tiene_recibida(client):
    _, h = _usuario_nuevo(client)
    s = client.post(
        "/api/v1/solicitudes", json={"tipo": "evacuacion", "personas": 2, **S4}, headers=h
    ).json()
    (item,) = _pedidos(client, h)
    assert item["id"] == s["id"] and item["tarea"] is None and item["seguimiento"] is None
    assert item["linea_tiempo"][0]["alcanzado"] and item["linea_tiempo"][0]["en"]
    assert not any(t["alcanzado"] or t["en"] for t in item["linea_tiempo"][1:])


def test_pedidos_mas_nuevo_primero(client):
    _, h = _usuario_nuevo(client)
    for personas in (1, 2):
        assert (
            client.post(
                "/api/v1/solicitudes",
                json={"tipo": "evacuacion", "personas": personas, **S4},
                headers=h,
            ).status_code
            == 201
        )
    assert [i["personas"] for i in _pedidos(client, h)] == [2, 1]


def test_ciudadano_no_ve_pedidos_ajenos(client, como, db):
    p, _ = _cerrar(client, como, db)
    _, otro = _usuario_nuevo(client)
    assert _pedidos(client, otro) == []
    assert p["solicitud_id"] in [i["id"] for i in _pedidos(client, p["h"])]


@pytest.mark.parametrize("rol", ["operador", "decisor", "cuadrilla"])
def test_pedidos_roles_no_permitidos_403(client, como, rol):
    assert client.get("/api/v1/mi/pedidos", headers=como(rol)).status_code == 403


def test_pedidos_sin_sesion_401(client):
    assert client.get("/api/v1/mi/pedidos").status_code == 401


def test_productor_tambien_ve_sus_pedidos(client, como):
    assert isinstance(_pedidos(client, como("productor1")), list)


# ---- respuestas de confirmación -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("respuesta", "estado", "motivo"),
    [
        ("completa", "verificada", None),
        ("parcial", "con_discrepancia", dom.MOTIVO_PARCIAL),
        ("no_encontraron", "con_discrepancia", dom.MOTIVO_NO_ENCONTRARON),
        ("no_vinieron", "con_discrepancia", dom.MOTIVO_NO),
        ("otro_problema", "con_discrepancia", dom.MOTIVO_PROBLEMA),
    ],
)
def test_respuestas_nuevas(client, como, db, respuesta, estado, motivo):
    p, _ = _cerrar(client, como, db)
    r = _confirmar(client, p, respuesta)
    assert r.status_code == 201, r.text
    assert r.json()["respuesta"] == respuesta
    e = _estado(client, como, p["tarea_id"])
    assert e["estado"] == estado and e["confirmacion"]["respuesta"] == respuesta
    assert (e["discrepancia"] or {}).get("motivos") == ([motivo] if motivo else None)


@pytest.mark.parametrize(
    ("legado", "canonica"),
    [("si", "completa"), ("no", "no_vinieron"), ("problema", "otro_problema")],
)
def test_respuestas_legadas_se_normalizan(client, como, db, legado, canonica):
    p, _ = _cerrar(client, como, db)
    r = _confirmar(client, p, legado)
    assert r.status_code == 201, r.text
    assert r.json()["respuesta"] == canonica  # lo guardado y lo devuelto es el canónico
    assert client.get("/api/v1/mi/confirmaciones", headers=p["h"]).json()["confirmaciones"][0][
        "respuesta"
    ] == canonica


def test_conflicto_compara_valores_canonicos(client, como, db):
    p, _ = _cerrar(client, como, db)
    assert _confirmar(client, p, "si").status_code == 201
    assert _confirmar(client, p, "completa").status_code == 200  # misma respuesta, otro alias
    assert _confirmar(client, p, "parcial").status_code == 409


def test_respuesta_invalida_422(client, como, db):
    p, _ = _cerrar(client, como, db)
    assert _confirmar(client, p, "quizas").status_code == 422


def test_sms_acepta_legado_y_parcial(client, como, db):
    assert dom.parsear_respuesta_sms("SI K7M2QXV4").respuesta == "completa"
    assert dom.parsear_respuesta_sms("NO K7M2QXV4").respuesta == "no_vinieron"
    assert dom.parsear_respuesta_sms("PROBLEMA K7M2QXV4 falta agua").respuesta == "otro_problema"
    assert dom.parsear_respuesta_sms("PARCIAL K7M2QXV4").respuesta == "parcial"
    p, _ = _cerrar(client, como, db)
    r = _sms(client, f"PARCIAL {_codigo(client, p['h'])}", p["tel"])
    assert r.status_code == 201, r.text
    e = _estado(client, como, p["tarea_id"])
    assert e["confirmacion"]["respuesta"] == "parcial" and e["estado"] == "con_discrepancia"


# ---- vehículo de la cuadrilla ---------------------------------------------------------------------


def test_cuadrilla_vehiculo_alta_valida_e_invalida(client, como):
    h = como("operador")
    cuerpo = {"nombre": "Cuadrilla de prueba SIMULADA", "tipo_incidente": "ganadera"}
    ok = client.post("/api/v1/cuadrillas", json={**cuerpo, "vehiculo": "camion_jaula"}, headers=h)
    assert ok.status_code == 201 and ok.json()["vehiculo"] == "camion_jaula"
    sin = client.post("/api/v1/cuadrillas", json=cuerpo, headers=h)
    assert sin.status_code == 201 and sin.json()["vehiculo"] is None
    mal = client.post("/api/v1/cuadrillas", json={**cuerpo, "vehiculo": "helicoptero"}, headers=h)
    assert mal.status_code == 422
    lista = client.get("/api/v1/cuadrillas", headers=h).json()["cuadrillas"]
    assert {c["tipo_incidente"]: c["vehiculo"] for c in lista if "SIMULADA 1" in c["nombre"]} == {
        "humana": "4x4",
        "ganadera": "camion_jaula",
    }


def test_migracion_0009_aplicada(db):
    ins = inspect(db.get_bind())
    cols = {c["name"]: c for c in ins.get_columns("cuadrillas")}
    assert "vehiculo" in cols and cols["vehiculo"]["nullable"] is True
    resp = next(c for c in ins.get_columns("confirmaciones_evacuado") if c["name"] == "respuesta")
    assert resp["type"].length == 20
