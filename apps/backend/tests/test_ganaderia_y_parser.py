"""Arca Productiva (§8.5), cuadrillas (§8.6), asignación y parser de mensajes (§8.8)."""

import pytest

from app.domain import asignacion, cuadrillas, ganaderia
from app.domain import parser_mensajes as pm

CONTROL = {
    "vaca_prenada": 8,
    "vaca_con_cria": 10,
    "ternero": 10,
    "vaquillona": 1,
    "toro": 1,
}


def test_caso_de_control_de_la_seccion_8_5():
    r = ganaderia.calcular(ganaderia.EntradaGanaderia(bovinos=CONTROL))
    assert r["bovinos_total"] == 30
    assert r["dormidero"]["superficie_necesaria_m2"] == 150
    assert r["dormidero"]["divisiones_internas"] is True
    assert r["transporte"]["camiones_jaula"] == 1
    assert r["transporte"]["camion_con_divisiones"] is True
    assert r["racion_diaria"]["maiz_kg"] == pytest.approx(58.4)
    assert r["racion_diaria"]["pellet_girasol_kg"] == pytest.approx(5.5)
    assert r["categoria"] == "SIMULADO"


def test_lotes_respetan_reglas_del_inta_y_maximo_200():
    r = ganaderia.calcular(ganaderia.EntradaGanaderia(bovinos=CONTROL))
    por_tipo = {lote["tipo"]: lote["cabezas"] for lote in r["lotes_destino"]}
    assert por_tipo == {"vientres_toros": 9, "vaquillonas": 1, "vacas_con_cria_terneros": 20}
    grande = ganaderia.calcular(ganaderia.EntradaGanaderia(bovinos={"vaquillona": 450}))
    cabezas = [lote["cabezas"] for lote in grande["lotes_destino"]]
    assert sum(cabezas) == 450 and max(cabezas) <= 200 and len(cabezas) == 3


def test_albardon_insuficiente_y_camiones_redondean_hacia_arriba():
    r = ganaderia.calcular(
        ganaderia.EntradaGanaderia(bovinos={"vaquillona": 61}, superficie_albardon_m2=200)
    )
    assert r["transporte"]["camiones_jaula"] == 3
    assert r["transporte"]["camion_con_divisiones"] is False  # una sola categoría
    assert r["dormidero"]["alcanza"] is False and r["dormidero"]["faltante_m2"] == 105


def test_animales_menores_y_apicultura():
    r = ganaderia.calcular(
        ganaderia.EntradaGanaderia(
            bovinos={},
            menores={"caprino": 41, "ovino": 10},
            colmenas_vivas=5,
            traslado_colmenas="a_pie",
        )
    )
    assert r["transporte"]["vehiculos_categoria_b"] == {"caprino": 2, "ovino": 1}
    assert r["apicultura"]["traslado"] == "a_pie"
    assert r["transporte"]["camiones_jaula"] == 0


def test_categoria_canonica_ignora_tildes_y_mayusculas():
    assert ganaderia.categoria_canonica("Vaca Preñada") == "vaca_prenada"
    assert ganaderia.categoria_canonica("vaca con cría") == "vaca_con_cria"
    assert ganaderia.categoria_canonica("ternero al pie") == "ternero"
    assert ganaderia.categoria_canonica("dinosaurio") is None


def test_api_ganaderia_calculo_y_categoria_invalida(client, como):
    cuerpo = {
        "bovinos": [
            {"categoria": "vaca preñada", "cantidad": 8},
            {"categoria": "vaca con cría", "cantidad": 10},
            {"categoria": "ternero al pie", "cantidad": 10},
            {"categoria": "vaquillona", "cantidad": 1},
            {"categoria": "toro", "cantidad": 1},
        ]
    }
    r = client.post("/api/v1/ganaderia/calculo", json=cuerpo, headers=como("productor1"))
    assert r.status_code == 200
    assert r.json()["racion_diaria"] == {"maiz_kg": 58.4, "pellet_girasol_kg": 5.5}
    mala = client.post(
        "/api/v1/ganaderia/calculo",
        json={"bovinos": [{"categoria": "dinosaurio", "cantidad": 1}]},
        headers=como("productor1"),
    )
    assert mala.status_code == 422
    neg = client.post(
        "/api/v1/ganaderia/calculo",
        json={"bovinos": [{"categoria": "toro", "cantidad": -1}]},
        headers=como("productor1"),
    )
    assert neg.status_code == 422
    assert client.post("/api/v1/ganaderia/calculo", json=cuerpo).status_code == 401


def test_plantillas_de_cuadrillas_y_roles_faltantes():
    assert "veterinario" in cuadrillas.plantilla("ganadera")
    assert cuadrillas.roles_faltantes("ganadera", ["encargado_cuadrilla", "transporte"]) == [
        "veterinario",
        "policia",
        "senasa",
    ]
    assert cuadrillas.tipos_necesarios(True, 5, 0) == ["humana", "ganadera"]
    with pytest.raises(ValueError):
        cuadrillas.plantilla("marciana")


def test_asignacion_voraz_por_prioridad_informa_sin_lugar():
    res = asignacion.asignar(
        [asignacion.Demanda("A", 100, 1), asignacion.Demanda("B", 50, 0)],
        [asignacion.Capacidad(1, "c1", 80), asignacion.Capacidad(2, "c2", 40)],
    )
    # B tiene prioridad: toma los 50 del centro con más cupo (c1); A se reparte lo que queda
    assert res.asignado_a("B") == 50
    assert res.asignado_a("A") == 70
    assert res.sin_lugar == {"A": 30}
    assert res.cupos_restantes == {1: 0, 2: 0}
    assert res.total_asignado == 120 and res.total_sin_lugar == 30


def test_asignacion_usa_distancias_para_ordenar_centros():
    res = asignacion.asignar(
        [asignacion.Demanda("A", 10)],
        [asignacion.Capacidad(1, "lejos", 100), asignacion.Capacidad(2, "cerca", 100)],
        {("A", 1): 9000.0, ("A", 2): 100.0},
    )
    assert [a.centro_id for a in res.asignaciones] == [2]


# ---------------------------------------------------------------- parser


def test_parser_lluvia_casos_validos():
    m = pm.parsear_lluvia("LLUVIA pluv-sim-a 12,5")
    assert (m.codigo_puesto, m.mm) == ("PLUV-SIM-A", 12.5)
    assert pm.parsear_lluvia("  lluvia PLUV-SIM-B 0 ").mm == 0
    assert pm.parsear_lluvia("LLUVIA PLUV-SIM-B 7.25").mm == 7.25


@pytest.mark.parametrize(
    "texto",
    [
        "LLUVIA",
        "LLUVIA PLUV-SIM-A",
        "LLUVIA PLUV-SIM-A abc",
        "LLUVIA PLUV-SIM-A -5",
        "LLUVIA PLUV-SIM-A 1 2",
        "LLUVIA PLUV SIM-A 5000",
        "LLUVIA PLUV-SIM-A 9999",
        "LLUVIA ;DROP-TABLE 5",
        "RAIN PLUV-SIM-A 5",
    ],
)
def test_parser_lluvia_mal_formado(texto):
    with pytest.raises(pm.ErrorParseo):
        pm.parsear_lluvia(texto)


def test_parser_sos_completo_y_minimo():
    m = pm.parsear_sos(
        "SOS-FSA|-26.18,-58.139|PRODUCTOR|FAM:4|BOV:30(8P,10C,10T,1V,1TO)|ACC:TIERRA|Necesito camión"
    )
    assert (m.lat, m.lon, m.perfil) == (-26.18, -58.139, "productor")
    assert (m.familiares, m.bovinos, m.detalle_bovinos) == (4, 30, "8P,10C,10T,1V,1TO")
    assert m.acceso == "TIERRA" and m.texto == "Necesito camión"
    minimo = pm.parsear_sos("SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:2")
    assert minimo.familiares == 2 and minimo.bovinos == 0 and minimo.texto is None


@pytest.mark.parametrize(
    "texto",
    [
        "SOS-FSA",
        "SOS-FSA|-26.18,-58.139",
        "SOS-FSA|-26.18|CIUDADANO|FAM:2",
        "SOS-FSA|-126.18,-58.139|CIUDADANO|FAM:2",
        "SOS-FSA|-26.18,-58.139|MARCIANO|FAM:2",
        "SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:x",
        "SOS-FSA|-26.18,-58.139|CIUDADANO|BOV:abc",
        "SOS-FSA|-26.18,-58.139|CIUDADANO",
        "HOLA|-26.18,-58.139|CIUDADANO|FAM:2",
    ],
)
def test_parser_sos_mal_formado(texto):
    with pytest.raises(pm.ErrorParseo):
        pm.parsear_sos(texto)


def test_clasificar_mensajes():
    assert pm.clasificar("lluvia X 1") == "lluvia"
    assert pm.clasificar("SOS-FSA|...") == "sos"
    with pytest.raises(pm.ErrorParseo):
        pm.clasificar("hola")
