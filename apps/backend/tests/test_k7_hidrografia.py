"""Verificador K7 contrastado con la capa de cursos de agua del IGN (data/geo/)."""

from __future__ import annotations

import pytest
from shapely.geometry import LineString, Point

from app.domain import hidrografia, verificador
from app.servicios import capas

K3 = {
    "formosa": {"lat": -26.183, "lon": -58.183, "alerta_m": 7.8, "evacuacion_m": 8.3},
    "pilcomayo": {"lat": -25.367, "lon": -57.65, "alerta_m": 5.35, "evacuacion_m": 6.0},
}


def _relaciones(medidas):
    return {r["id"]: r for r in verificador.verificar_k7(K3, medidas)}


@pytest.fixture(scope="module")
def medidas_reales():
    cursos = capas.cursos_principales()
    if not cursos:
        pytest.skip("data/geo/cursos_agua.geojson no está disponible")
    return hidrografia.analizar(cursos, capas.localidad("Clorinda"))


def test_capa_real_confirma_las_relaciones_1_2_y_5(medidas_reales):
    rel = _relaciones(medidas_reales)
    assert rel["K7-1"]["veredicto"] == "VERDADERA"
    assert rel["K7-2"]["veredicto"] == "FALSA"
    assert rel["K7-5"]["veredicto"] == "FALSA"
    for n in (1, 2, 5):
        r = rel[f"K7-{n}"]
        assert r["verificado_con"] == "IGN cursos de agua (calculado)"
        assert "capa del IGN" in r["evidencia_cartografica"]
        assert r["categoria"] == "DOCUMENTO DE REFERENCIA"


def test_capa_real_las_medidas_son_coherentes(medidas_reales):
    m = medidas_reales
    # El Pilcomayo no toca al Bermejo (está a más de 100 km) y termina cerca del Paraguay.
    assert m["pilcomayo_a_bermejo_km"] > 100
    assert m["pilcomayo_a_paraguay_km"] < 20
    # El Bermejo llega al Paraguay al sur de Puerto Formosa (aguas abajo).
    assert m["bermejo_desembocadura_lat"] < K3["formosa"]["lat"]
    assert m["clorinda_a_pilcomayo_km"] < 15 and m["clorinda_a_paraguay_km"] < 20


def test_paraguay_y_corrientes_quedan_no_verificables_con_la_capa(medidas_reales):
    rel = _relaciones(medidas_reales)
    for n in (4, 7):
        r = rel[f"K7-{n}"]
        assert r["veredicto"] == "NO VERIFICABLE CON LA CAPA DISPONIBLE"
        assert r["verificado_con"] == "no verificable con la capa disponible"
        assert "a confirmar" in r["correccion"]


def test_relaciones_3_y_6_siguen_calculadas_con_k3(medidas_reales):
    rel = _relaciones(medidas_reales)
    assert rel["K7-3"]["veredicto"] == "FALSA" and rel["K7-3"]["verificado_con"] == "K3 (calculado)"
    assert rel["K7-6"]["veredicto"] == "VERDADERA"


def test_sin_capa_todo_lo_cartografico_queda_no_verificable():
    rel = _relaciones(None)
    for n in (1, 2, 4, 5, 7):
        assert rel[f"K7-{n}"]["veredicto"] == "NO VERIFICABLE CON LA CAPA DISPONIBLE"
    assert rel["K7-3"]["veredicto"] == "FALSA"


def test_si_los_cursos_se_tocan_no_se_refuta_la_relacion_2():
    # Pilcomayo que termina sobre el Bermejo, lejos del Paraguay: la capa no permite refutarlo.
    cursos = {
        "Paraguay": LineString([(-58.0, -25.0), (-58.0, -27.0)]),
        "Pilcomayo": LineString([(-61.0, -25.5), (-60.0, -26.0)]),
        "Bermejo": LineString([(-60.0, -26.0), (-59.0, -26.5)]),
    }
    medidas = hidrografia.analizar(cursos, Point(-60.0, -26.0))
    assert medidas["pilcomayo_a_bermejo_km"] == 0
    assert _relaciones(medidas)["K7-2"]["veredicto"] == "NO VERIFICABLE CON LA CAPA DISPONIBLE"


def test_analizar_sin_alguno_de_los_rios_devuelve_none():
    assert hidrografia.analizar({"Paraguay": LineString([(0, 0), (1, 1)])}, None) is None


def test_endpoint_k7_publica_evidencia_cartografica(client):
    r = client.get("/api/v1/verificador/k7")
    assert r.status_code == 200
    rel = {x["id"]: x for x in r.json()["relaciones"]}
    assert len(rel) == 7
    if capas.cursos_principales():
        assert rel["K7-2"]["veredicto"] == "FALSA"
        assert rel["K7-2"]["evidencia_cartografica"]
    assert "Paraná" in r.json()["nota"]
