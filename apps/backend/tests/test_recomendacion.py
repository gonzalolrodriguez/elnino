"""Recomendador (§8.2) y alternativas (§8.4)."""

import pytest

from tests.conftest import PASSWORD_VALIDA, correo_unico

ESCENARIO = {"altura_formosa_m": 7.6, "lluvia_mm": 40, "caminos_cerrados": []}
S4_LON, S4_LAT = -58.139, -26.18


def _recomendar(client, h, **extra):
    r = client.post("/api/v1/simulacion/recomendacion", json={**ESCENARIO, **extra}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def _sector(cuerpo, sid):
    return next(s for s in cuerpo["recomendacion"]["sectores"] if s["id"] == sid)


def test_recomendacion_es_una_recomendacion_y_cubre_sectores_en_riesgo(client, como):
    r = _recomendar(client, como("operador"))
    assert "no es una orden" in r["etiqueta"] and r["categoria"] == "SIMULADO"
    assert r["recomendacion"]["orden_sectores"] == ["S4", "S3", "S1"]
    s4 = _sector(r, "S4")
    assert s4["estado"] == "comprometido" and s4["aislado"] is True
    assert s4["traslado_personas"]["vehiculo"] == "lancha"  # S4 aislado por la lluvia
    assert s4["poblacion"]["simulada_k10"] == 150
    assert s4["ventana"]["dias_hasta_compromiso_minimo"] == 0 or s4["ventana"]["ya_comprometido"]
    assert any("aislado" in a for a in s4["advertencias"])


def test_productor_demo_de_s4_aparece_con_ganaderia_y_cuadrilla_ganadera(client, como):
    s4 = _sector(_recomendar(client, como("operador")), "S4")
    assert s4["produccion"]["bovinos"] >= 30
    assert len(s4["produccion"]["establecimientos"]) >= 1
    g = s4["produccion"]["ganaderia"]
    assert g["transporte"]["camiones_jaula"] >= 1
    assert "inicio_ganado" in s4["ventana"]
    tipos = [c["tipo"] for c in s4["cuadrillas_sugeridas"]]
    assert "ganadera" in tipos and "humana" in tipos
    assert s4["camiones_jaula"] == g["transporte"]["camiones_jaula"]


def test_sin_doble_conteo_con_varias_filas_de_stock(client, como):
    h = como("operador")
    antes = _sector(_recomendar(client, h), "S4")
    # una familia (3 integrantes, 1 menor, 1 mayor) y un productor con 3 filas de stock, en S4
    fam = {
        "email": correo_unico("fam"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Familia S4",
        "consentimiento": True,
        "integrantes": 3,
        "menores": 1,
        "mayores": 1,
        "lon": S4_LON,
        "lat": S4_LAT,
    }
    assert client.post("/api/v1/auth/registro/ciudadano", json=fam).status_code == 201
    prod = {
        "email": correo_unico("prod"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Productor S4",
        "consentimiento": True,
        "establecimiento": {
            "nombre": "Campo de prueba",
            "lon": S4_LON,
            "lat": S4_LAT,
            "stock": [
                {"especie": "bovino", "categoria_animal": "vaquillona", "cantidad": 4},
                {"especie": "bovino", "categoria_animal": "toro", "cantidad": 2},
                {"especie": "caprino", "categoria_animal": "cabra", "cantidad": 7},
            ],
        },
    }
    assert client.post("/api/v1/auth/registro/productor", json=prod).status_code == 201
    despues = _sector(_recomendar(client, h), "S4")
    # +3 personas (no 3 x 3 filas de stock) y +6 bovinos (no x filas) y +1 establecimiento
    assert (
        despues["poblacion"]["personas_registradas"]
        == antes["poblacion"]["personas_registradas"] + 3
    )
    assert (
        despues["poblacion"]["familias_registradas"]
        == antes["poblacion"]["familias_registradas"] + 1
    )
    assert despues["poblacion"]["menores"] == antes["poblacion"]["menores"] + 1
    assert despues["poblacion"]["total_estimada"] == antes["poblacion"]["total_estimada"] + 3
    assert despues["produccion"]["bovinos"] == antes["produccion"]["bovinos"] + 6
    assert despues["produccion"]["animales_menores"].get("caprino", 0) == (
        antes["produccion"]["animales_menores"].get("caprino", 0) + 7
    )
    assert (
        len(despues["produccion"]["establecimientos"])
        == len(antes["produccion"]["establecimientos"]) + 1
    )


def test_orden_por_poblacion_y_filtro_de_sectores(client, como):
    h = como("operador")
    r = _recomendar(client, h, prioridad="poblacion")
    assert r["recomendacion"]["orden_sectores"][0] == "S1"  # 1.200 personas
    solo = _recomendar(client, h, sectores=["S3"])
    assert solo["recomendacion"]["orden_sectores"] == ["S3"]
    mal = client.post(
        "/api/v1/simulacion/recomendacion", json={**ESCENARIO, "sectores": ["S9"]}, headers=h
    )
    assert mal.status_code == 422


def test_sin_sectores_en_riesgo_no_hay_nada_que_evacuar(client, como):
    r = _recomendar(client, como("operador"), altura_formosa_m=5.6, lluvia_mm=0)
    assert r["recomendacion"]["orden_sectores"] == []
    assert r["recomendacion"]["metricas"]["personas_a_evacuar"] == 0


def test_faltante_de_cupo_se_informa(client, como):
    r = _recomendar(client, como("operador"), altura_formosa_m=9.0, lluvia_mm=0)
    m = r["recomendacion"]["metricas"]
    assert m["personas_a_evacuar"] >= 5650
    assert m["personas_evacuadas"] + m["personas_sin_lugar"] == m["personas_a_evacuar"]
    assert m["personas_sin_lugar"] > 0 and m["cupo_personas_total_centros"] == 1250
    assert m["faltantes"]["cupo_personas_en_centros"] == m["personas_sin_lugar"]
    assert "humana" in m["faltantes"]["roles_por_cuadrilla"]  # la cuadrilla de demo es parcial


def test_alternativas_dos_generadas_mas_una_editable_persistidas(client, como, db):
    h = como("operador")
    r = client.post(
        "/api/v1/simulacion/alternativas",
        json={
            **ESCENARIO,
            "editable": {"nombre": "Mi alternativa", "orden_sectores": ["S1", "S4"]},
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    c = r.json()
    alts = c["alternativas"]
    assert [a["tipo"] for a in alts] == ["riesgo", "poblacion", "editable"]
    assert alts[0]["orden_sectores"] == ["S4", "S3", "S1"]
    assert alts[1]["orden_sectores"][0] == "S1"
    assert alts[2]["nombre"] == "Mi alternativa" and alts[2]["orden_sectores"] == ["S1", "S4"]
    assert all(isinstance(a["id"], int) for a in alts)
    for a in alts:
        m = a["metricas"]
        assert m["personas_evacuadas"] + m["personas_sin_lugar"] == m["personas_a_evacuar"]
    # el orden cambia quién se queda sin lugar: comparar lado a lado
    a, b = alts[0]["metricas"], alts[1]["metricas"]
    assert a["personas_a_evacuar"] == b["personas_a_evacuar"]
    sin_lugar_riesgo = {s["id"]: s["personas_sin_lugar"] for s in alts[0]["sectores"]}
    sin_lugar_pob = {s["id"]: s["personas_sin_lugar"] for s in alts[1]["sectores"]}
    assert sin_lugar_riesgo["S4"] == 0 and sin_lugar_pob["S4"] >= 0
    filas = {f["metrica"]: f for f in c["comparacion"]}
    assert len(filas["personas_sin_lugar"]["valores"]) == 3
    assert c["escenario"]["entrada"]["altura_formosa_m"] == 7.6
    # persistencia
    from app.db.modelos import Alternativa

    fila = db.get(Alternativa, alts[0]["id"])
    assert fila.metricas["personas_a_evacuar"] == a["personas_a_evacuar"]
    assert fila.escenario_snapshot["resumen"]["aislados"] == ["S4"]


def test_alternativas_editable_con_centro_excluido(client, como):
    h = como("operador")
    base = client.post("/api/v1/simulacion/alternativas", json=ESCENARIO, headers=h).json()
    centros = client.get("/api/v1/centros", headers=h).json()["centros"]
    grande = max(centros, key=lambda c: c["capacidad_personas"])
    sin = client.post(
        "/api/v1/simulacion/alternativas",
        json={**ESCENARIO, "editable": {"centros_excluidos": [grande["id"]]}},
        headers=h,
    ).json()
    ed_base = base["alternativas"][2]["metricas"]
    ed_sin = sin["alternativas"][2]["metricas"]
    assert ed_sin["personas_evacuadas"] < ed_base["personas_evacuadas"]
    assert ed_sin["personas_sin_lugar"] > ed_base["personas_sin_lugar"]


def test_alternativas_y_recomendacion_invalidas_y_sin_permiso(client, como):
    h = como("operador")
    assert (
        client.post(
            "/api/v1/simulacion/alternativas",
            json={**ESCENARIO, "editable": {"orden_sectores": ["S9"]}},
            headers=h,
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/simulacion/alternativas",
            json={**ESCENARIO, "caminos_cerrados": [999999]},
            headers=h,
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/simulacion/recomendacion", json=ESCENARIO, headers=como("productor1")
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/simulacion/recomendacion",
            json={**ESCENARIO, "altura_formosa_m": 50},
            headers=h,
        ).status_code
        == 422
    )


@pytest.mark.parametrize("ruta", ["/simulacion/recomendacion", "/simulacion/alternativas"])
def test_requieren_autenticacion(client, ruta):
    assert client.post(f"/api/v1{ruta}", json=ESCENARIO).status_code == 401
