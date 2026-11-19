"""Pruebas unitarias de las funciones puras de ``scripts/descargar_satelite.py`` (sin red)."""

from __future__ import annotations

import importlib.util
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pytest

RUTA = Path(__file__).resolve().parents[1] / "scripts" / "descargar_satelite.py"
spec = importlib.util.spec_from_file_location("descargar_satelite", RUTA)
sat = importlib.util.module_from_spec(spec)
sys.modules["descargar_satelite"] = sat
spec.loader.exec_module(sat)


def test_otsu_separa_dos_poblaciones():
    rng = np.random.default_rng(1)
    v = np.concatenate([rng.normal(-0.5, 0.05, 5000), rng.normal(0.5, 0.05, 5000)])
    assert -0.4 < sat.umbral_otsu(v, -1, 1) < 0.4  # cualquier corte entre las dos modas


def test_otsu_sin_valores_falla():
    with pytest.raises(ValueError):
        sat.umbral_otsu(np.array([np.nan]), -1, 1)


def test_acotar_umbral():
    assert sat.acotar_umbral(0.5, (-0.15, 0.15)) == (0.15, True)
    assert sat.acotar_umbral(0.05, (-0.15, 0.15)) == (0.05, False)


def test_mndwi_agua_y_suelo():
    r = sat.mndwi(np.array([0.10, 0.10, 0.0]), np.array([0.02, 0.30, 0.0]))
    assert r[0] > 0.5  # agua: verde > SWIR
    assert r[1] < 0  # suelo/vegetacion
    assert np.isnan(r[2])  # suma no positiva


def test_reflectancia_offset_por_baseline():
    dn = np.array([2000, 0], dtype=np.uint16)
    nuevo = sat.reflectancia_s2(dn, 5.0)
    viejo = sat.reflectancia_s2(dn, 2.5)
    assert nuevo[0] == pytest.approx(0.1)
    assert viejo[0] == pytest.approx(0.2)
    assert np.isnan(nuevo[1])


def test_a_db():
    r = sat.a_db(np.array([0.1, 0.0], dtype=np.float32))
    assert r[0] == pytest.approx(-10.0, abs=1e-4)
    assert np.isnan(r[1])


def test_mediana_quita_moteado_y_conserva_nan():
    a = np.full((20, 20), -20.0, dtype=np.float32)
    a[10, 10] = 0.0
    a[0, 0] = np.nan
    m = sat.mediana_3x3(a, bloque=7)
    assert m[10, 10] == pytest.approx(-20.0)
    assert np.isnan(m[0, 0])


def test_k1_mas_cercano():
    serie = {date(2019, 10, 7): 2.1, date(2019, 10, 12): 2.0}
    assert sat.k1_mas_cercano(serie, date(2019, 10, 7)) == (date(2019, 10, 7), 2.1)
    assert sat.k1_mas_cercano(serie, date(2019, 10, 9)) == (date(2019, 10, 7), 2.1)
    assert sat.k1_mas_cercano(serie, date(2019, 10, 10)) == (date(2019, 10, 12), 2.0)
    assert sat.k1_mas_cercano(serie, date(2020, 1, 1)) is None


def test_corte_rechaza_fechas_posteriores():
    assert sat.validar_fecha("2026-10-31") == date(2026, 10, 31)
    with pytest.raises(ValueError):
        sat.validar_fecha("2026-11-01")
    with pytest.raises(ValueError):
        sat.validar_fecha(date(2026, 11, 17))


def test_escenas_configuradas_respetan_el_corte():
    for e in sat.ESCENAS:
        sat.validar_fecha(e["fecha"])


def test_erosionar_valido_quita_borde_de_la_franja():
    v = np.zeros((30, 30), dtype=bool)
    v[:, 10:] = True  # franja valida a la derecha; el borde de la rejilla no se erosiona
    e = sat.erosionar_valido(v, 3)
    assert not e[15, 10:13].any()
    assert e[15, 13:].all()
    assert e[0, 20]
