"""Ruteo con pgRouting sobre una red SINTÉTICA (SIMULADO, creada en la prueba) y alternativa sin red."""

import pytest
from sqlalchemy import text

from app.domain import ruteo as dom
from app.ingest import red_vial
from app.servicios import ruteo as srv

S4 = (-58.139, -26.180)  # tranquera del productor 1, en S4
P1 = (-58.160, -26.183)
S2 = (-58.180, -26.185)  # dentro de S2
P3 = (-58.160, -26.195)


def _linea(a, b, superficie, nombre):
    return {
        "type": "Feature",
        "properties": {"nombre": nombre, "superficie": superficie},
        "geometry": {"type": "LineString", "coordinates": [list(a), list(b)]},
    }


RED_SINTETICA = [
    _linea(S4, P1, "tierra", "e1 tierra"),
    _linea(P1, S2, "pavimento", "e2 pavimento"),
    _linea(S4, P3, "ripio", "e3 ripio"),
    _linea(P3, S2, "ripio", "e4 ripio"),
]


@pytest.fixture
def red(db):
    red_vial.cargar_red(
        db, RED_SINTETICA, "SIMULADO · red sintética de pruebas", categoria="SIMULADO"
    )
    yield db
    db.execute(text("DELETE FROM red_vial"))
    db.execute(text("DELETE FROM red_vial_nodos"))
    db.commit()


@pytest.fixture
def sin_red(db):
    db.execute(text("DELETE FROM red_vial"))
    db.execute(text("DELETE FROM red_vial_nodos"))
    db.commit()


def test_loader_nodea_calcula_longitud_y_superficie(red):
    filas = red.execute(
        text("SELECT nombre, superficie, longitud_m, source, target FROM red_vial ORDER BY id")
    ).all()
    assert len(filas) == 4
    assert all(f.longitud_m > 1000 and f.source != f.target for f in filas)
    assert red.execute(text("SELECT count(*) FROM red_vial_nodos")).scalar_one() == 4


def test_loader_parte_lineas_que_se_cruzan_y_acepta_nodos_de_osm(db):
    cruce = [
        _linea((-58.2, -26.2), (-58.1, -26.2), "pavimento", "este-oeste"),
        _linea((-58.15, -26.25), (-58.15, -26.15), "tierra", "norte-sur"),
    ]
    r = red_vial.cargar_red(db, cruce, "prueba", "SIMULADO")
    assert r["aristas"] == 4 and r["nodos"] == 5
    osm = [
        {
            "type": "Feature",
            "properties": {
                "nodo_ini": 9_000_000_001,
                "nodo_fin": 9_000_000_002,
                "superficie": "desconocida",
            },
            "geometry": {"type": "LineString", "coordinates": [[-58.2, -26.2], [-58.19, -26.2]]},
        },
        {
            "type": "Feature",
            "properties": {
                "nodo_ini": 9_000_000_002,
                "nodo_fin": 9_000_000_003,
                "highway": "primary",
            },
            "geometry": {"type": "LineString", "coordinates": [[-58.19, -26.2], [-58.18, -26.2]]},
        },
    ]
    r = red_vial.cargar_red(db, osm, "OSM prueba", "SIMULADO")
    assert r["aristas"] == 2 and r["nodos"] == 3  # ids de OSM remapeados, sin renodar
    sup = [x[0] for x in db.execute(text("SELECT superficie FROM red_vial ORDER BY id")).all()]
    assert sup == ["desconocida", "pavimento"]
    db.execute(text("DELETE FROM red_vial"))
    db.execute(text("DELETE FROM red_vial_nodos"))
    db.commit()


@pytest.mark.parametrize("sid", ["S1\n", "S1'--", "S1 OR 1=1", "", "S" * 11])
def test_consulta_aristas_rechaza_ids_de_sector_no_canonicos(sid):
    # fullmatch: "S1\n" pasaba con match + "$" (el "$" admite un salto de línea final).
    with pytest.raises(ValueError):
        srv._consulta_aristas("vehicular", [sid], [])


def test_inferir_superficie():
    assert red_vial.inferir_superficie({"surface": "gravel"}) == "ripio"
    assert red_vial.inferir_superficie({"highway": "primary"}) == "pavimento"
    assert red_vial.inferir_superficie({"superficie": "desconocida"}) == "desconocida"
    assert red_vial.inferir_superficie({}) == "desconocida"


def test_ruta_vehicular_por_red_con_pgrouting(red):
    r = srv.resolver_ruta(red, "vehicular", S4, S2)
    assert r["metodo"] == "pgrouting" and r["encontrada"] is True and r["limitacion"] is None
    assert r["categoria"] == "SIMULADO" and r["capas"]
    assert r["distancia_m"] > 3000 and r["tiempo_min"] > 0
    assert r["geometria"]["type"] in ("LineString", "MultiLineString")
    assert len(r["tramos"]) == 2


def test_camion_jaula_no_usa_tierra(red):
    r = srv.resolver_ruta(red, "camion_jaula", S4, S2)
    assert r["metodo"] == "pgrouting"
    assert {t["superficie"] for t in r["tramos"]} <= {"pavimento", "ripio"}
    # con la ruta de ripio bloqueada ya no hay camino para el camión jaula (solo queda tierra)
    red.execute(text("UPDATE red_vial SET bloqueada = true WHERE nombre = 'e3 ripio'"))
    red.commit()
    r = srv.resolver_ruta(red, "camion_jaula", S4, S2)
    assert r["metodo"] == "aproximado"
    assert any("No se encontró ruta" in a for a in r["advertencias"])
    v = srv.resolver_ruta(red, "vehicular", S4, S2)
    assert v["metodo"] == "pgrouting"  # el vehicular sigue por tierra + pavimento
    assert "e1 tierra" in {t["nombre"] for t in v["tramos"]}


def test_superficies_cerradas_por_lluvia_siguen_los_umbrales():
    assert dom.superficies_cerradas_por_lluvia("vehicular", 0) == set()
    assert dom.superficies_cerradas_por_lluvia("vehicular", 29.9) == set()
    assert dom.superficies_cerradas_por_lluvia("vehicular", 30) == {"tierra", "desconocida"}
    assert dom.superficies_cerradas_por_lluvia("camion_jaula", 80) == {
        "tierra",
        "desconocida",
        "ripio",
    }
    assert dom.superficies_cerradas_por_lluvia("arreo", 500) == set()


def test_lluvia_cierra_tramos_de_tierra_de_la_red(red):
    # Con 40 mm el vehicular sigue saliendo, pero solo por ripio y pavimento
    mojado = srv.resolver_ruta(red, "vehicular", S4, S2, lluvia_mm=40)
    assert mojado["metodo"] == "pgrouting"
    assert mojado["superficies_cerradas_por_lluvia"] == ["desconocida", "tierra"]
    assert {t["superficie"] for t in mojado["tramos"]} <= {"pavimento", "ripio"}
    # Si además se bloquea el ripio, en seco queda la tierra, pero con 40 mm ya no hay camino
    red.execute(text("UPDATE red_vial SET bloqueada = true WHERE nombre = 'e3 ripio'"))
    red.commit()
    seco = srv.resolver_ruta(red, "vehicular", S4, S2)
    assert "e1 tierra" in {t["nombre"] for t in seco["tramos"]}
    assert srv.resolver_ruta(red, "vehicular", S4, S2, lluvia_mm=40)["metodo"] == "aproximado"
    red.execute(text("UPDATE red_vial SET bloqueada = false"))
    red.commit()
    # Con 80 mm se cierra también el ripio: no queda camino por la red
    muy_mojado = srv.resolver_ruta(red, "vehicular", S4, S2, lluvia_mm=80)
    assert muy_mojado["metodo"] == "aproximado"
    # El arreo a pie no depende de la lluvia
    arreo = srv.resolver_ruta(red, "arreo", S4, S2, lluvia_mm=80)
    assert arreo["metodo"] == "pgrouting" and arreo["superficies_cerradas_por_lluvia"] == []


def test_arista_bloqueada_se_evita(red):
    red.execute(
        text("UPDATE red_vial SET bloqueada = true WHERE nombre IN ('e2 pavimento', 'e3 ripio')")
    )
    red.commit()
    r = srv.resolver_ruta(red, "vehicular", S4, S2)
    assert r["metodo"] == "aproximado"  # no queda conexión entre S4 y S2


def test_vehicular_excluye_tramos_en_sectores_comprometidos(red):
    # altura 9 m: todos los sectores comprometidos; el destino está en S2, comprometido -> sin ruta
    r = srv.resolver_ruta(red, "vehicular", S4, S2, altura_m=9.0)
    assert set(r["sectores_comprometidos"]) == {"S1", "S2", "S3", "S4"}
    assert r["metodo"] == "aproximado"
    # con 7,6 m solo S4 está comprometido: el origen es de S4, se exime y se advierte
    ok = srv.resolver_ruta(red, "vehicular", S4, S2, altura_m=7.6)
    assert ok["metodo"] == "pgrouting" and ok["sectores_comprometidos"] == ["S4"]
    assert any("sector comprometido" in a for a in ok["advertencias"])


def test_arreo_penaliza_zonas_comprometidas(red):
    normal = srv.resolver_ruta(red, "arreo", S4, S2)
    penal = srv.resolver_ruta(red, "arreo", S4, S2, altura_m=9.0)
    assert normal["metodo"] == penal["metodo"] == "pgrouting"
    assert penal["tiempo_min"] > normal["tiempo_min"]
    assert normal["distancia_m"] == pytest.approx(penal["distancia_m"], rel=0.5)


def test_sin_red_usa_estimacion_con_limitacion_explicita(sin_red, db):
    r = srv.resolver_ruta(db, "vehicular", S4, S2)
    assert r["metodo"] == "aproximado" and r["encontrada"] is True
    assert "No es un recorrido real" in r["limitacion"] and "1.3" in r["limitacion"]
    recta = dom.haversine_m(*S4, *S2)
    esperado = r["acceso_usado"]["distancia_desde_origen_m"] + recta * 1.3
    assert r["distancia_m"] == pytest.approx(esperado, abs=1)
    assert r["acceso_usado"]["superficie"] == "tierra"  # el único acceso de S4
    assert r["geometria"] is None


def test_sin_red_sector_aislado_por_lluvia_no_encuentra_ruta(sin_red, db):
    r = srv.resolver_ruta(db, "vehicular", S4, S2, altura_m=5.6, lluvia_mm=40)
    assert r["encontrada"] is False and "aislado" in r["motivo"]
    cam = srv.resolver_ruta(db, "camion_jaula", S4, S2)
    assert cam["encontrada"] is False  # el camión jaula no usa el único acceso (tierra)


def test_api_ruteo_validaciones(client, como, sin_red):
    h = como("operador")
    cuerpo = {"origen": {"lon": S4[0], "lat": S4[1]}, "destino": {"lon": S2[0], "lat": S2[1]}}
    r = client.post("/api/v1/ruteo", json=cuerpo, headers=h)
    assert r.status_code == 200 and r.json()["metodo"] == "aproximado"
    por_centro = client.post(
        "/api/v1/ruteo", json={"origen": cuerpo["origen"], "centro_id": 1}, headers=h
    )
    assert por_centro.status_code == 200
    assert (
        client.post("/api/v1/ruteo", json={"origen": cuerpo["origen"]}, headers=h).status_code
        == 422
    )
    assert (
        client.post("/api/v1/ruteo", json={**cuerpo, "perfil": "tanque"}, headers=h).status_code
        == 422
    )
    assert (
        client.post("/api/v1/ruteo", json={**cuerpo, "centro_id": 1}, headers=h).status_code == 422
    )
    assert (
        client.post(
            "/api/v1/ruteo", json={"origen": cuerpo["origen"], "centro_id": 99999}, headers=h
        ).status_code
        == 404
    )
    fuera = {"origen": {"lon": 500, "lat": 0}, "destino": cuerpo["destino"]}
    assert client.post("/api/v1/ruteo", json=fuera, headers=h).status_code == 422
    assert client.post("/api/v1/ruteo", json=cuerpo, headers=como("ciudadano1")).status_code == 403
