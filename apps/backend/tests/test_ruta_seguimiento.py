"""Ruta de la cuadrilla al pedido y modo demostración (SIMULADO): ``servicios/ruta_seguimiento``."""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import text

from app.db.base import ahora
from app.db.modelos import PosicionCuadrilla
from app.domain import ruteo as dom
from app.servicios import ruta_seguimiento as rs
from app.servicios import seguimiento as srv_seguimiento
from tests.test_evacuaciones import _cuadrilla_demo_id
from tests.test_operacion import _usuario_nuevo
from tests.test_ruteo import (  # noqa: F401 (fixtures de la red sintética)
    P1,
    P3,
    S2,
    S4,
    red,
    sin_red,
)
from tests.test_seguimiento import POS, _poner_en_curso, pedido_en_curso  # noqa: F401, F811

BASE = (-58.176, -26.200)


@pytest.fixture(autouse=True)
def _limpiar_posiciones(db):
    """Las posiciones compartidas por estas pruebas no deben afectar el límite de frecuencia de otras."""
    yield
    db.rollback()
    db.execute(PosicionCuadrilla.__table__.delete())
    db.commit()


def _pasa_por(ruta: rs.Ruta, punto, tol_m: float = 5.0) -> bool:
    return any(dom.haversine_m(c[0], c[1], punto[0], punto[1]) < tol_m for c in ruta.coordenadas)


# ---- ruta por la red ----------------------------------------------------------------------------


def test_la_ruta_sigue_la_red_en_el_sentido_del_viaje(red):  # noqa: F811
    ruta = rs.calcular_ruta(red, S4, S2, "4x4")
    assert ruta.metodo == "red_vial"
    assert ruta.coordenadas[0] == [S4[0], S4[1]] and ruta.coordenadas[-1] == [S2[0], S2[1]]
    assert _pasa_por(ruta, P3)  # ripio + ripio (40 km/h): más rápido que tierra + pavimento
    # sin saltos: cada tramo entre puntos consecutivos es corto frente al recorrido total
    largo = rs._largo_m(ruta.coordenadas)
    assert max(rs._d(a, b) for a, b in zip(ruta.coordenadas, ruta.coordenadas[1:], strict=False)) < largo
    assert ruta.distancia_m == pytest.approx(largo, rel=0.01)
    d = ruta.a_dict()
    assert d["metodo"] == "red_vial" and d["simulada"] is False and d["progreso"] == 0
    assert d["distancia_km"] == pytest.approx(ruta.distancia_m / 1000, abs=0.01)
    assert d["velocidad_kmh"] == 40 and d["llegada_estimada_min"] >= 1


def test_la_ruta_evita_un_tramo_bloqueado(red):  # noqa: F811
    red.execute(text("UPDATE red_vial SET bloqueada = true WHERE nombre = 'e3 ripio'"))
    red.commit()
    ruta = rs.calcular_ruta(red, S4, S2, "4x4")
    assert ruta.metodo == "red_vial"
    assert _pasa_por(ruta, P1) and not _pasa_por(ruta, P3)


def test_el_camion_jaula_no_usa_tierra(red):  # noqa: F811
    ruta = rs.calcular_ruta(red, S4, S2, "camion_jaula")
    assert ruta.metodo == "red_vial" and _pasa_por(ruta, P3) and not _pasa_por(ruta, P1)


def test_un_acceso_cerrado_por_el_escenario_corta_el_camino(red, db):  # noqa: F811
    """Escenario vigente: la lluvia cierra la tierra y la ruta rodea por el ripio."""
    ruta = rs.calcular_ruta(red, S4, S2, "4x4", escenario={"lluvia_mm": 40})
    assert ruta.metodo == "red_vial" and _pasa_por(ruta, P3) and not _pasa_por(ruta, P1)


def test_sin_red_usa_la_recta_por_el_factor_de_desvio(sin_red, db):  # noqa: F811
    ruta = rs.calcular_ruta(db, S4, S2, "4x4")
    assert ruta.metodo == "aproximado" and len(ruta.coordenadas) == 2
    assert ruta.distancia_m == pytest.approx(dom.haversine_m(*S4, *S2) * 1.3, rel=1e-6)


def test_la_lancha_va_en_linea_recta_aun_con_red(red):  # noqa: F811
    ruta = rs.calcular_ruta(red, S4, S2, "lancha")
    assert ruta.metodo == "aproximado" and len(ruta.coordenadas) == 2
    assert ruta.velocidad_kmh == 15
    assert ruta.distancia_m == pytest.approx(dom.haversine_m(*S4, *S2), rel=1e-6)


def test_la_ruta_se_simplifica_a_300_puntos_o_menos():
    coords = [[-58.2 + i * 1e-5, -26.2 + (i % 7) * 1e-5 + i * 2e-5] for i in range(2000)]
    simple = rs._simplificar(coords)
    assert 2 <= len(simple) <= rs.MAX_PUNTOS
    assert simple[0] == coords[0] and simple[-1] == coords[-1]


def test_la_ruta_se_cachea_por_origen_redondeado(sin_red, db, monkeypatch):  # noqa: F811
    llamadas = []
    original = rs.calcular_ruta
    monkeypatch.setattr(rs, "calcular_ruta", lambda *a, **k: llamadas.append(1) or original(*a, **k))
    rs.ruta_hacia(db, S4, S2, vehiculo="4x4", clave=1)
    rs.ruta_hacia(db, (S4[0] + 0.00005, S4[1]), S2, vehiculo="4x4", clave=1)  # ~5 m: misma celda
    assert len(llamadas) == 1
    rs.ruta_hacia(db, (S4[0] + 0.01, S4[1]), S2, vehiculo="4x4", clave=1)  # ~1 km: otra celda
    assert len(llamadas) == 2


# ---- modo demostración (unidad) -------------------------------------------------------------------


def test_la_simulacion_avanza_con_el_tiempo_y_topa_en_la_llegada(sin_red, db, monkeypatch):  # noqa: F811
    monkeypatch.setattr(rs, "base_simulada", lambda: BASE)
    inicio = ahora()
    s0 = rs.simular(db, S4, "4x4", inicio, inicio, 1)
    s3 = rs.simular(db, S4, "4x4", inicio, inicio + timedelta(minutes=3), 1)
    s6 = rs.simular(db, S4, "4x4", inicio, inicio + timedelta(minutes=6), 1)
    assert s0.progreso == 0 and (s0.lon, s0.lat) == pytest.approx(BASE)
    assert 0 < s3.progreso < s6.progreso <= 1
    # 3 min a 40 km/h = 2 km del total de la ruta
    assert s3.progreso == pytest.approx(2000 / s3.ruta.distancia_m, rel=1e-3)
    llegada = rs.simular(db, S4, "4x4", inicio, inicio + timedelta(hours=5), 1)
    assert llegada.progreso == 1 and llegada.distancia_restante_m == 0
    assert (llegada.lon, llegada.lat) == pytest.approx(S4)
    assert llegada.ruta.a_dict(1.0, True)["llegada_estimada_min"] == 0


# ---- API -------------------------------------------------------------------------------------------


def _item(client, h, solicitud_id):
    r = client.get("/api/v1/mi/pedidos", headers=h)
    assert r.status_code == 200, r.text
    return next(i for i in r.json()["items"] if i["id"] == solicitud_id)


def _sin_posicion_real(db) -> None:
    db.execute(PosicionCuadrilla.__table__.delete())
    db.commit()


def test_demo_ubica_al_movil_sobre_la_ruta_y_avanza(client, db, pedido_en_curso, monkeypatch, sin_red):  # noqa: F811
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    monkeypatch.setattr(rs, "base_simulada", lambda: BASE)
    _sin_posicion_real(db)
    p = pedido_en_curso
    a = _item(client, p["h"], p["solicitud_id"])["seguimiento"]
    assert a["simulada"] is True and a["estado"] == "en_camino"
    assert a["ruta"]["simulada"] is True and a["ruta"]["metodo"] == "aproximado"
    assert 0 <= a["ruta"]["progreso"] < 1 and a["categoria"] == "SIMULADO"
    assert a["posicion"]["lat"] and a["posicion_vieja"] is False
    # con 5 minutos más, el móvil está más cerca y falta menos
    monkeypatch.setattr(srv_seguimiento, "ahora", lambda: ahora() + timedelta(minutes=5))
    b = _item(client, p["h"], p["solicitud_id"])["seguimiento"]
    assert b["ruta"]["progreso"] > a["ruta"]["progreso"]
    assert b["distancia_m"] < a["distancia_m"]
    assert b["ruta"]["distancia_km"] < a["ruta"]["distancia_km"]
    # mucho después: llegó (progreso 1, falta 0)
    monkeypatch.setattr(srv_seguimiento, "ahora", lambda: ahora() + timedelta(hours=8))
    c = _item(client, p["h"], p["solicitud_id"])["seguimiento"]
    assert c["ruta"]["progreso"] == 1 and c["llegada_estimada_min"] == 0 and c["distancia_m"] == 0


def test_la_posicion_real_gana_sobre_la_simulada(client, como, db, pedido_en_curso, monkeypatch, sin_red):  # noqa: F811
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    _sin_posicion_real(db)
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    assert r.status_code == 200, r.text
    p = pedido_en_curso
    s = _item(client, p["h"], p["solicitud_id"])["seguimiento"]
    assert s["simulada"] is False and s["ruta"]["simulada"] is False
    assert s["posicion"]["lat"] == POS["lat"] and s["posicion"]["lon"] == POS["lon"]
    assert s["ruta"]["coordenadas"][0] == [POS["lon"], POS["lat"]]
    assert s["ruta"]["progreso"] == 0 and s["distancia_m"] > 0 and s["llegada_estimada_min"] >= 1


def test_sin_demo_y_sin_posicion_no_hay_ruta(client, db, pedido_en_curso):  # noqa: F811
    _sin_posicion_real(db)
    p = pedido_en_curso
    s = _item(client, p["h"], p["solicitud_id"])["seguimiento"]
    assert s["estado"] == "asignada_sin_posicion" and s["ruta"] is None and s["simulada"] is False


def test_la_ruta_solo_la_ve_quien_hizo_el_pedido(client, como, db, pedido_en_curso, monkeypatch, sin_red):  # noqa: F811
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    _sin_posicion_real(db)
    p = pedido_en_curso
    assert _item(client, p["h"], p["solicitud_id"])["seguimiento"]["ruta"] is not None
    _, otro = _usuario_nuevo(client, "ciudadano", lon=S4[0], lat=S4[1])
    assert client.get("/api/v1/mi/pedidos", headers=otro).json()["items"] == []
    assert client.get("/api/v1/mi/seguimiento", headers=otro).json()["seguimientos"] == []


def test_el_panel_ve_la_posicion_simulada_solo_marcada(client, como, db, pedido_en_curso, monkeypatch, sin_red):  # noqa: F811
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    _sin_posicion_real(db)
    items = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador")).json()["posiciones"]
    mia = next(i for i in items if i["cuadrilla_id"] == _cuadrilla_demo_id(db))
    assert mia["simulada"] is True and mia["categoria"] == "SIMULADO"
    # con una posición real, la real gana y no está marcada
    client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    items = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador")).json()["posiciones"]
    mia = next(i for i in items if i["cuadrilla_id"] == _cuadrilla_demo_id(db))
    assert mia["simulada"] is False and mia["lat"] == POS["lat"]


def test_el_seed_deja_un_pedido_de_demo_en_camino(client, db, como, monkeypatch):
    from app.db.seed import sembrar_recorrido_demo

    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    assert sembrar_recorrido_demo(db) == 0  # ya sembrado por la base de pruebas: idempotente
    db.commit()
    h = como("productor2")
    items = client.get("/api/v1/mi/pedidos", headers=h).json()["items"]
    en_camino = [i for i in items if i["seguimiento"] and i["seguimiento"]["simulada"]]
    assert len(en_camino) == 1
    assert en_camino[0]["seguimiento"]["ruta"]["coordenadas"]
