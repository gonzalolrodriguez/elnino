"""Escenario (§8.1), ISAD y endpoints de datos, con los casos inválidos de §9."""

import pytest

from app.domain import escenario as esc
from app.domain import isad

UMBRALES = esc.UmbralesRio(1.6, 7.8, 8.3)
PARAMS = esc.Parametros(0.5, 30, 80)


# ---------------------------------------------------------------- lógica pura


def test_estado_sector_sin_errores_de_punto_flotante():
    # 8,10 - 0,50 = 7,60: con floats puros esta igualdad es frágil.
    assert esc.estado_sector(7.6, 8.1, 0.5) == esc.EN_RIESGO
    assert esc.estado_sector(7.59, 8.1, 0.5) == esc.NORMAL
    assert esc.estado_sector(8.1, 8.1, 0.5) == esc.COMPROMETIDO


def test_estado_rio_distancias_a_los_umbrales():
    r = esc.estado_rio(7.6, UMBRALES)
    assert r["estado"] == "normal"
    assert r["distancia_a_alerta_m"] == pytest.approx(0.2)
    assert r["distancia_a_evacuacion_m"] == pytest.approx(0.7)
    assert esc.estado_rio(7.8, UMBRALES)["estado"] == "alerta"
    assert esc.estado_rio(8.3, UMBRALES)["estado"] == "evacuacion"


def test_acceso_cerrado_por_operador_tiene_prioridad():
    a = esc.AccesoEntrada(1, "S4", "x", "tierra")
    estado, _ = esc.estado_acceso(a, esc.NORMAL, 100, {1}, PARAMS)
    assert estado == esc.ACCESO_CERRADO_OPERADOR
    marcado = esc.AccesoEntrada(1, "S4", "x", "pavimento", transitable=False, motivo="Puente")
    assert esc.estado_acceso(marcado, esc.NORMAL, 0, set(), PARAMS) == (
        esc.ACCESO_CERRADO_OPERADOR,
        "Puente",
    )


def test_umbrales_de_lluvia_por_superficie():
    tierra = esc.AccesoEntrada(1, "S4", "t", "tierra")
    ripio = esc.AccesoEntrada(2, "S1", "r", "ripio")
    pav = esc.AccesoEntrada(3, "S2", "p", "pavimento")
    assert esc.estado_acceso(tierra, esc.NORMAL, 29.9, set(), PARAMS)[0] == "transitable"
    assert esc.estado_acceso(tierra, esc.NORMAL, 30, set(), PARAMS)[0] == "intransitable_lluvia"
    assert esc.estado_acceso(ripio, esc.NORMAL, 79, set(), PARAMS)[0] == "transitable"
    assert esc.estado_acceso(ripio, esc.NORMAL, 80, set(), PARAMS)[0] == "intransitable_lluvia"
    assert esc.estado_acceso(pav, esc.NORMAL, 500, set(), PARAMS)[0] == "transitable"
    assert esc.estado_acceso(tierra, esc.COMPROMETIDO, 0, set(), PARAMS)[0] == "anegado"


def test_isad_es_relativo_acotado_y_simulado():
    r = isad.calcular("S4", 7.6, 7.5, 1.6, 40)
    assert 0 <= r["valor"] <= 1 and r["categoria"] == "SIMULADO"
    assert set(r["componentes"]) == {"lluvia_antecedente", "humedad_suelo", "concavidad", "rio"}
    sin_lluvia = isad.calcular("S4", 7.6, 7.5, 1.6, 0)["valor"]
    assert r["valor"] > sin_lluvia
    # Aumentar solo la lluvia a 1000 mm no puede pasar de 1.
    assert isad.calcular("S4", 20, 7.5, 1.6, 1000, 1.0)["valor"] <= 1


# ---------------------------------------------------------------- API


def test_ejemplo_de_la_seccion_8_1(client, como):
    r = client.post(
        "/api/v1/simulacion/escenario",
        json={"altura_formosa_m": 7.6, "lluvia_mm": 40, "caminos_cerrados": []},
        headers=como("operador"),
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    sectores = {s["id"]: s for s in cuerpo["sectores"]}
    assert sectores["S4"]["estado"] == "comprometido"
    assert sectores["S4"]["accesos"][0]["estado"] == "intransitable_lluvia"
    assert sectores["S4"]["aislado"] is True
    assert sectores["S3"]["estado"] == "en_riesgo"
    assert sectores["S1"]["estado"] == "en_riesgo"
    assert sectores["S2"]["estado"] == "normal"
    assert not any(s["aislado"] for s in cuerpo["sectores"] if s["id"] != "S4")
    assert cuerpo["rio"]["estado"] == "normal"
    assert cuerpo["rio"]["distancia_a_alerta_m"] == pytest.approx(0.2)
    assert cuerpo["resumen"]["aislados"] == ["S4"]
    assert cuerpo["categoria"] == "SIMULADO" and cuerpo["fuente"] and cuerpo["fecha_dato"]
    assert cuerpo["lluvia"]["origen"] == "simulado"
    assert sectores["S4"]["isad"]["categoria"] == "SIMULADO"


def test_caminos_cerrados_aislan_un_sector(client, como):
    accesos = client.get("/api/v1/accesos", headers=como("operador")).json()["features"]
    s2 = [a["properties"]["id"] for a in accesos if a["properties"]["sector_id"] == "S2"]
    r = client.post(
        "/api/v1/simulacion/escenario",
        json={"altura_formosa_m": 5.6, "caminos_cerrados": s2},
        headers=como("operador"),
    )
    s = {x["id"]: x for x in r.json()["sectores"]}
    assert s["S2"]["aislado"] is True and s["S2"]["estado"] == "normal"


@pytest.mark.parametrize("altura", [-0.1, 12.01])
def test_altura_fuera_de_rango_422(client, como, altura):
    r = client.post(
        "/api/v1/simulacion/escenario", json={"altura_formosa_m": altura}, headers=como("operador")
    )
    assert r.status_code == 422
    assert r.json()["error"]["codigo"] == "validacion"


def test_lluvia_negativa_422(client, como):
    r = client.post(
        "/api/v1/simulacion/escenario",
        json={"altura_formosa_m": 7, "lluvia_mm": -1},
        headers=como("operador"),
    )
    assert r.status_code == 422


def test_acceso_inexistente_404(client, como):
    r = client.post(
        "/api/v1/simulacion/escenario",
        json={"altura_formosa_m": 7, "caminos_cerrados": [999999]},
        headers=como("operador"),
    )
    assert r.status_code == 404
    assert r.json()["error"]["codigo"] == "no_encontrado"


def test_escenario_exige_rol_de_mando(client, como):
    r = client.post(
        "/api/v1/simulacion/escenario", json={"altura_formosa_m": 7}, headers=como("ciudadano1")
    )
    assert r.status_code == 403
    assert (
        client.post("/api/v1/simulacion/escenario", json={"altura_formosa_m": 7}).status_code == 401
    )


# ---------------------------------------------------------------- datos


def test_estaciones_y_sectores_son_publicos_y_rotulados(client):
    e = client.get("/api/v1/estaciones").json()
    assert e["categoria"] == "DATO OBSERVADO" and len(e["estaciones"]) == 2
    formosa = next(x for x in e["estaciones"] if x["codigo"] == 57)
    assert (formosa["alerta_m"], formosa["evacuacion_m"]) == (7.8, 8.3)
    s = client.get("/api/v1/sectores").json()
    assert s["type"] == "FeatureCollection" and len(s["features"]) == 4
    assert s["metadata"]["categoria"] == "SIMULADO"
    assert {f["properties"]["id"] for f in s["features"]} == {"S1", "S2", "S3", "S4"}


def test_accesos_y_centros_requieren_sesion(client, como):
    assert client.get("/api/v1/accesos").status_code == 401
    assert client.get("/api/v1/centros").status_code == 401
    c = client.get("/api/v1/centros", headers=como("ciudadano1")).json()
    assert c["categoria"] == "SIMULADO" and len(c["centros"]) >= 4
    assert all(x["categoria"] == "SIMULADO" for x in c["centros"])


def test_marcar_acceso_no_transitable_y_restaurar(client, como):
    accesos = client.get("/api/v1/accesos", headers=como("operador")).json()["features"]
    objetivo = next(a for a in accesos if a["properties"]["sector_id"] == "S1")
    aid = objetivo["properties"]["id"]
    try:
        r = client.patch(
            f"/api/v1/accesos/{aid}",
            json={"transitable": False, "motivo": "Alcantarilla rota (prueba)"},
            headers=como("operador"),
        )
        assert r.status_code == 200
        assert r.json()["properties"]["transitable"] is False
        assert r.json()["properties"]["actualizado_por_rol"] == "coordinador_sector"
        esc_r = client.post(
            "/api/v1/simulacion/escenario",
            json={"altura_formosa_m": 5.6},
            headers=como("operador"),
        ).json()
        s1 = next(s for s in esc_r["sectores"] if s["id"] == "S1")
        assert s1["aislado"] is True
        assert s1["accesos"][0]["estado"] == "cerrado_operador"
        # un ciudadano no puede marcar caminos
        assert (
            client.patch(
                f"/api/v1/accesos/{aid}", json={"transitable": True}, headers=como("ciudadano1")
            ).status_code
            == 403
        )
    finally:
        client.patch(f"/api/v1/accesos/{aid}", json={"transitable": True}, headers=como("operador"))
    assert (
        client.patch(
            "/api/v1/accesos/999999", json={"transitable": True}, headers=como("operador")
        ).status_code
        == 404
    )


def test_serie_formosa_con_umbrales_y_picos(client):
    r = client.get("/api/v1/serie/formosa").json()
    assert r["categoria"] == "DATO OBSERVADO" and r["n"] > 7000
    assert r["umbrales"]["alerta_m"] == 7.8
    assert r["maximo"]["altura_m"] == 9.81 and r["maximo"]["fecha"] == "2016-01-05"
    picos = {p["anio"]: p for p in r["picos"]}
    assert picos[2019]["altura_m"] == 9.72
    assert r["ultima"] == {"fecha": "2026-10-31", "altura_m": 5.6}
    # sin valores en cuarentena (98,1) y sin fechas posteriores al corte
    assert max(p["altura_max_m"] for p in r["puntos"]) < 15
    assert r["puntos"][-1]["fecha"] == "2026-10-31"
    corto = client.get("/api/v1/serie/formosa?desde=2026-10-25").json()
    assert corto["n"] == 7


def test_serie_ascenso_incluye_supuesto_rango_y_tiempo_restante(client):
    r = client.get("/api/v1/serie/ascenso").json()
    periodos = {p["periodo"]: p for p in r["periodos"]}
    assert periodos["2015-16"]["mayor_suba_1d"]["metros"] == pytest.approx(0.29)
    assert periodos["2019"]["mayor_suba_7d"]["metros"] == pytest.approx(1.37)
    assert periodos["oct-2026"]["mayor_suba_7d"]["fecha"] == "2026-10-17"
    assert "SUPUESTO" in r["supuesto"] and r["categoria_proyeccion"] == "SIMULADO"
    assert r["horizonte_pronostico_oficial_dias"] == 15
    assert r["altura_actual_m"] == 5.6
    alerta = next(t for t in r["tiempo_restante"] if t["objetivo"].startswith("Alerta"))
    assert alerta["dias_minimo"] < alerta["dias_maximo"]
    # 2,2 m de diferencia: con 0,36 m/día son ~6,1 días; con 0,1077 m/día ~20,4 días
    assert alerta["dias_minimo"] == pytest.approx(2.2 / 0.36, abs=0.2)
    assert alerta["dias_maximo"] == pytest.approx(2.2 / 0.1077, abs=0.3)
    ya = client.get("/api/v1/serie/ascenso?altura_actual_m=9").json()
    assert next(t for t in ya["tiempo_restante"] if t["objetivo"].startswith("Alerta"))[
        "ya_alcanzado"
    ]
    assert client.get("/api/v1/serie/ascenso?altura_actual_m=13").status_code == 422
