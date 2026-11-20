"""Motor de evacuación (odd/tasks/motor-evacuacion.md): reparto óptimo, factibilidad, centros
descartados, flota por tipo de vehículo y ventana seca."""

import pytest
from geoalchemy2.elements import WKTElement
from sqlalchemy import delete

from app.db.modelos import CentroRecepcion
from app.domain import asignacion, factibilidad
from app.domain import escenario as esc
from app.servicios import recomendacion
from app.servicios.contexto import CentroGeo

ESCENARIO = {"altura_formosa_m": 7.6, "lluvia_mm": 40, "caminos_cerrados": []}


def _recomendar(client, h, **extra):
    r = client.post("/api/v1/simulacion/recomendacion", json={**ESCENARIO, **extra}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def _sector(cuerpo, sid):
    return next(s for s in cuerpo["recomendacion"]["sectores"] if s["id"] == sid)


# ------------------------------------------------------------------ reparto por costo mínimo


def test_costo_minimo_mejora_al_voraz_sin_romper_la_prioridad():
    # A (prioridad 0) está a 10 min de ambos centros; B (prioridad 1) solo llega rápido al centro 1.
    demandas = [asignacion.Demanda("A", 50, 0), asignacion.Demanda("B", 50, 1)]
    centros = [asignacion.Capacidad(1, "c1", 50), asignacion.Capacidad(2, "c2", 50)]
    costos = {("A", 1): 10, ("A", 2): 10, ("B", 1): 10, ("B", 2): 100}
    voraz = asignacion.asignar(demandas, centros, costos)
    optimo = asignacion.asignar_costo_minimo(demandas, centros, costos)

    def costo(r):
        return sum(costos[(a.demanda_id, a.centro_id)] * a.cantidad for a in r.asignaciones)

    assert voraz.total_asignado == optimo.total_asignado == 100
    assert costo(optimo) == 1000 < costo(voraz) == 5500
    assert optimo.asignado_a("B") == 50 and optimo.sin_lugar == {}


def test_costo_minimo_con_cupo_escaso_atiende_primero_la_mayor_prioridad():
    # Aunque B queda más cerca, con 60 lugares A (prioridad 0) entra entero.
    demandas = [asignacion.Demanda("A", 50, 0), asignacion.Demanda("B", 50, 1)]
    centros = [asignacion.Capacidad(1, "c1", 60)]
    costos = {("A", 1): 900, ("B", 1): 1}
    r = asignacion.asignar_costo_minimo(demandas, centros, costos)
    assert r.asignado_a("A") == 50 and r.asignado_a("B") == 10
    assert r.sin_lugar == {"B": 40} and r.cupos_restantes == {1: 0}


def test_costo_minimo_respeta_pares_inalcanzables():
    demandas = [asignacion.Demanda("A", 30, 0)]
    centros = [asignacion.Capacidad(1, "lejos", 100), asignacion.Capacidad(2, "cerca", 10)]
    r = asignacion.asignar_costo_minimo(demandas, centros, {("A", 2): 5})  # al 1 no se llega
    assert r.asignado_a("A") == 10 and r.sin_lugar == {"A": 20}
    assert all(a.centro_id == 2 for a in r.asignaciones)


# ------------------------------------------------------------------ factibilidad (lógica pura)


def test_plazo_efectivo_gana_el_menor():
    rio = factibilidad.plazo_efectivo(48, 120, None)
    assert (rio.minimo_h, rio.maximo_h, rio.limitante) == (48, 120, "rio")
    seco = factibilidad.plazo_efectivo(48, 120, 6)
    assert (seco.minimo_h, seco.maximo_h, seco.limitante) == (6, 6, "ventana_seca")
    medio = factibilidad.plazo_efectivo(48, 120, 72)
    assert (medio.minimo_h, medio.maximo_h, medio.limitante) == (48, 72, "rio")
    assert factibilidad.plazo_efectivo(None, None, None).minimo_h is None


@pytest.mark.parametrize(
    ("tiempo_h", "esperado"),
    [
        (10, "alcanza"),
        (36, "alcanza"),
        (40, "justo"),
        (100, "justo"),
        (130, "no_alcanza"),
        (None, "sin_estimacion"),
    ],
)
def test_veredictos(tiempo_h, esperado):
    plazo = factibilidad.Plazo(48, 120, "rio")
    assert factibilidad.evaluar(plazo, tiempo_h, 0.25).veredicto == esperado


def test_ya_comprometido_y_anticipacion_del_ganado():
    plazo = factibilidad.Plazo(48, 120, "rio")
    assert factibilidad.evaluar(plazo, 1, 0.25, ya_comprometido=True).veredicto == "ya_comprometido"
    # 10 h alcanza para personas, pero el ganado debe llegar 48 h antes: el plazo queda en 0 a 72 h
    ganado = factibilidad.evaluar(plazo, 10, 0.25, anticipacion_h=48)
    assert ganado.plazo.minimo_h == 0 and ganado.plazo.maximo_h == 72
    assert ganado.veredicto == "justo" and ganado.iniciar_antes_de_h == -10


# ------------------------------------------------------------------ centros descartados


def test_descartar_centros_dentro_de_sectores_comprometidos_o_en_riesgo():
    sectores = [
        esc.SectorEstado("S1", "n", esc.EN_RIESGO, False, 8.1, 0.5, 1),
        esc.SectorEstado("S2", "n", esc.COMPROMETIDO, False, 8.6, -0.1, 1),
        esc.SectorEstado("S3", "n", esc.NORMAL, False, 7.9, 1, 1),
    ]
    escenario = esc.Escenario(7.6, 0, {}, sectores)
    centros = [CentroGeo(i, f"c{i}", "x", 0, 0, 10, 0, 0) for i in (1, 2, 3, 4)]
    en = {1: "S1", 2: "S2", 3: "S3", 4: None}
    conservador = recomendacion.descartar_centros(centros, en, escenario, True)
    assert set(conservador) == {1, 2} and "comprometido" in conservador[2]
    assert set(recomendacion.descartar_centros(centros, en, escenario, False)) == {2}


def test_centro_dentro_de_un_sector_comprometido_no_recibe_evacuados(client, como, db):
    # Centro de prueba SIMULADO en el centro de S2 (comprometido con 8,60 m).
    c = CentroRecepcion(
        nombre="Centro de prueba dentro de S2",
        tipo="escuela",
        geom=WKTElement("POINT(-58.180 -26.185)", srid=4326),
        capacidad_personas=10_000,
        categoria="SIMULADO",
        fuente="prueba",
    )
    db.add(c)
    db.commit()
    try:
        r = _recomendar(client, como("operador"), altura_formosa_m=8.6, lluvia_mm=0)
        plan = r["recomendacion"]
        descartados = {d["id"]: d for d in plan["centros_descartados"]}
        assert c.id in descartados and "S2" in descartados[c.id]["motivo"]
        usados = {a["centro_id"] for s in plan["sectores"] for a in s["asignacion_personas"]}
        assert c.id not in usados
    finally:
        db.execute(delete(CentroRecepcion).where(CentroRecepcion.id == c.id))
        db.commit()


# ------------------------------------------------------------------ recomendación por API


def test_cada_sector_trae_su_factibilidad(client, como):
    r = _recomendar(client, como("operador"))
    for s in r["recomendacion"]["sectores"]:
        f = s["factibilidad"]["personas"]
        assert f["veredicto"] in {"alcanza", "justo", "no_alcanza", "ya_comprometido"}
        assert f["explicacion"]
    assert _sector(r, "S4")["factibilidad"]["personas"]["veredicto"] == "ya_comprometido"
    s1 = _sector(r, "S1")["factibilidad"]["personas"]
    assert s1["limitante"] == "rio" and s1["plazo_minimo_h"] < s1["plazo_maximo_h"]
    m = r["recomendacion"]["metricas"]
    assert m["sectores_ya_comprometidos"] == 1 and "veredictos" in m
    assert any("factibilidad" in x for x in r["limites"])


def test_tipos_de_vehiculo_distintos_trabajan_en_paralelo(client, como):
    r = _recomendar(client, como("operador"))
    s4, s3, s1 = (_sector(r, s)["traslado_personas"] for s in ("S4", "S3", "S1"))
    assert s4["vehiculo"] == "lancha" and s3["vehiculo"] == s1["vehiculo"] == "colectivo"
    # S3 no espera a la lancha de S4; S1 sí espera a los colectivos de S3
    assert s3["tiempo_inicio_min"] == 0
    assert s1["tiempo_inicio_min"] == s3["tiempo_acumulado_min"]
    m = r["recomendacion"]["metricas"]
    assert m["tiempo_total_min"] == max(s4["tiempo_acumulado_min"], s1["tiempo_acumulado_min"])


def test_lluvia_prevista_que_corta_el_acceso_fija_el_plazo(client, como):
    h = como("operador")
    # S1 tiene un único acceso de ripio: 100 mm más lo cierran (umbral 80 mm).
    r = _recomendar(client, h, lluvia_mm=0, pronostico_lluvia={"mm": 100, "horas": 0.1})
    s1 = _sector(r, "S1")["factibilidad"]
    assert s1["personas"]["limitante"] == "ventana_seca"
    assert s1["personas"]["plazo_minimo_h"] == 0.1
    assert s1["personas"]["veredicto"] == "no_alcanza"
    assert s1["pronostico_lluvia"]["categoria"] == "SIMULADO"
    assert r["entrada"]["pronostico_lluvia"]["mm"] == 100
    # Una lluvia que no cierra el ripio no cambia el plazo del río
    poca = _recomendar(client, h, lluvia_mm=0, pronostico_lluvia={"mm": 20, "horas": 0.1})
    assert _sector(poca, "S1")["factibilidad"]["personas"]["limitante"] == "rio"


def test_pronostico_invalido_da_422(client, como):
    h = como("operador")
    for malo in (
        {"mm": -5, "horas": 3},
        {"mm": 10, "horas": 0},
        {"mm": 10},
        {"mm": 1, "horas": 1, "x": 1},
    ):
        r = client.post(
            "/api/v1/simulacion/recomendacion",
            json={**ESCENARIO, "pronostico_lluvia": malo},
            headers=h,
        )
        assert r.status_code == 422, malo


def test_alternativas_comparan_factibilidad_y_personas_minuto(client, como):
    r = client.post(
        "/api/v1/simulacion/alternativas",
        json={**ESCENARIO, "pronostico_lluvia": {"mm": 100, "horas": 2}},
        headers=como("operador"),
    )
    assert r.status_code == 200, r.text
    metricas = {f["metrica"] for f in r.json()["comparacion"]}
    assert {"sectores_no_alcanzan", "sectores_justos", "personas_minuto"} <= metricas
    assert r.json()["escenario"]["entrada"]["pronostico_lluvia"] == {"mm": 100.0, "horas": 2.0}


# ------------------------------------------------------------------ familias indivisibles (M7)


def _personas_por_centro(r, demanda):
    return {a.centro_id: a.cantidad for a in r.asignaciones if a.demanda_id == demanda}


def test_una_familia_nunca_se_reparte_entre_centros():
    # 6 personas y dos centros de 5: el costo mínimo las partiría 5 + 1; con familia, no entra.
    demandas = [asignacion.Demanda("A", 6, 0)]
    familias = [asignacion.Familia("f1", "A", 6)]
    centros = [asignacion.Capacidad(1, "c1", 5), asignacion.Capacidad(2, "c2", 5)]
    costos = {("A", 1): 1, ("A", 2): 2}
    sin = asignacion.asignar_costo_minimo(demandas, centros, costos)
    assert len(_personas_por_centro(sin, "A")) == 2  # sin la regla, la familia se separaba
    r = asignacion.asignar_con_familias(demandas, familias, centros, costos)
    assert r.asignaciones == [] and [f.id for f in r.familias_sin_lugar] == ["f1"]
    assert r.sin_lugar == {"A": 6} and r.cupos_restantes == {1: 5, 2: 5}


def test_la_familia_va_entera_aunque_el_cupo_optimo_este_fragmentado():
    # Cupos del flujo: 4 en c1 (rápido) y 4 en c2. La familia de 6 va entera a c2 con lugar libre
    # y las 2 personas sin familia declarada van a c1.
    demandas = [asignacion.Demanda("A", 8, 0)]
    familias = [asignacion.Familia("f1", "A", 6)]
    centros = [asignacion.Capacidad(1, "c1", 4), asignacion.Capacidad(2, "c2", 10)]
    costos = {("A", 1): 1, ("A", 2): 5}
    r = asignacion.asignar_con_familias(demandas, familias, centros, costos)
    assert r.familias_ubicadas == {"f1": 2} and r.sin_lugar == {}
    assert _personas_por_centro(r, "A") == {1: 2, 2: 6}


def test_primero_las_familias_con_menores_o_mayores():
    demandas = [asignacion.Demanda("A", 8, 0)]
    familias = [
        asignacion.Familia("grande", "A", 4),
        asignacion.Familia("vulnerable", "A", 4, True),
    ]
    r = asignacion.asignar_con_familias(
        demandas, familias, [asignacion.Capacidad(1, "c1", 4)], {("A", 1): 1}
    )
    assert r.familias_ubicadas == {"vulnerable": 1}
    assert [f.id for f in r.familias_sin_lugar] == ["grande"]


def test_las_familias_de_menor_prioridad_no_quitan_lugar():
    demandas = [asignacion.Demanda("A", 5, 0), asignacion.Demanda("B", 3, 1)]
    familias = [asignacion.Familia("fb", "B", 3)]
    r = asignacion.asignar_con_familias(
        demandas,
        familias,
        [asignacion.Capacidad(1, "c1", 6)],
        {("A", 1): 9, ("B", 1): 1},
    )
    assert r.asignado_a("A") == 5 and r.asignado_a("B") == 0
    assert [f.id for f in r.familias_sin_lugar] == ["fb"] and r.cupos_restantes == {1: 1}


@pytest.mark.parametrize(
    ("familias", "resto", "capacidad", "viajes"),
    [
        ([3, 3], 0, 5, 2),
        ([3, 3, 3], 0, 5, 3),  # en total entran 9 en 2 vehículos, pero partiría una familia
        ([7], 0, 5, 2),  # más grande que el vehículo: convoy de 2
        ([4], 3, 5, 2),  # 1 lugar libre + 2 personas sin familia en otro vehículo
        ([], 12, 5, 3),
        ([2, 2], 1, 5, 1),
    ],
)
def test_viajes_sin_partir_familias(familias, resto, capacidad, viajes):
    assert asignacion.viajes_sin_partir(familias, resto, capacidad) == viajes


def test_set_separado_de_hogares_suma_la_poblacion_de_k10_y_es_reproducible():
    from app.ingest import hogares_simulados

    generado = hogares_simulados.generar()
    for sid, poblacion in hogares_simulados.poblacion_k10().items():
        s = generado["sectores"][sid]
        assert sum(s["tamanos"]) == poblacion == s["poblacion_k10"]
        assert all(1 <= t <= 8 for t in s["tamanos"])
    assert generado["categoria"] == "SIMULADO"
    assert hogares_simulados.cargar() == {
        sid: s["tamanos"] for sid, s in generado["sectores"].items()
    }


def test_recomendacion_con_hogares_de_k10_no_separa_familias(client, como):
    h = como("operador")
    agregado = _recomendar(client, h)
    hogares = _recomendar(client, h, poblacion_k10_en_hogares=True)
    assert hogares["entrada"]["poblacion_k10_en_hogares"] is True
    m = hogares["recomendacion"]["metricas"]
    assert m["familias_juntas"] > 300
    for s in hogares["recomendacion"]["sectores"]:
        f = s["familias"]
        assert f["juntas"] + f["sin_lugar_entero"] == f["registradas"] + f["hogares_simulados"]
        asignadas = sum(a["cantidad"] for a in s["asignacion_personas"])
        assert asignadas + s["personas_sin_lugar"] == s["poblacion"]["total_estimada"]
    # Sin el set separado, K10 sigue como total y no hay hogares simulados
    assert all(
        s["familias"]["hogares_simulados"] == 0 for s in agregado["recomendacion"]["sectores"]
    )
    assert any("se reparte como total" in x for x in agregado["limites"])


def test_con_cupo_escaso_las_familias_sin_lugar_entero_se_informan(client, como):
    r = _recomendar(
        client, como("operador"), altura_formosa_m=9.0, lluvia_mm=0, poblacion_k10_en_hogares=True
    )
    m = r["recomendacion"]["metricas"]
    assert m["familias_sin_lugar_entero"] > 0 and m["personas_en_familias_sin_lugar"] > 0
    assert m["personas_evacuadas"] + m["personas_sin_lugar"] == m["personas_a_evacuar"]
    avisos = [a for s in r["recomendacion"]["sectores"] for a in s["advertencias"]]
    assert any("no entran enteras" in a and "no las separa" in a for a in avisos)


def test_familia_registrada_cuenta_como_unidad(client, como):
    from tests.conftest import PASSWORD_VALIDA, correo_unico

    h = como("operador")
    antes = _sector(_recomendar(client, h), "S1")["familias"]["registradas"]
    fam = {
        "email": correo_unico("famS1"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Familia S1",
        "consentimiento": True,
        "integrantes": 5,
        "menores": 2,
        "mayores": 0,
        "lon": -58.1875,
        "lat": -26.156,
    }
    assert client.post("/api/v1/auth/registro/ciudadano", json=fam).status_code == 201
    s1 = _sector(_recomendar(client, h), "S1")
    assert s1["familias"]["registradas"] == antes + 1
    assert s1["familias"]["sin_lugar_entero"] == 0
