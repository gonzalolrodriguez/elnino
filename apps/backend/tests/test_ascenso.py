from datetime import date, timedelta

import pytest

from app.domain import ascenso
from app.ingest import limpieza_k1 as k1


def _serie(valores: dict[int, float], inicio=date(2020, 1, 1)) -> dict[date, float]:
    return {inicio + timedelta(days=i): v for i, v in valores.items()}


def test_mayor_suba_1d_y_7d_en_serie_sintetica():
    serie = _serie({0: 1.0, 1: 1.1, 2: 1.5, 3: 1.6, 7: 2.0, 8: 2.2})
    una = ascenso.mayor_suba(serie, 1, date(2020, 1, 1), date(2020, 1, 31))
    assert una is not None and una.metros == pytest.approx(0.4)
    assert una.fecha_fin == date(2020, 1, 3)
    siete = ascenso.mayor_suba(serie, 7, date(2020, 1, 1), date(2020, 1, 31))
    assert siete is not None and siete.metros == pytest.approx(1.1)
    assert siete.fecha_fin == date(2020, 1, 9)


def test_mayor_suba_no_cruza_huecos():
    serie = _serie({0: 1.0, 3: 5.0})  # faltan los días 1 y 2: no se interpola
    assert ascenso.mayor_suba(serie, 1, date(2020, 1, 1), date(2020, 1, 31)) is None


def test_primer_cruce_y_umbral_no_alcanzado():
    serie = _serie({0: 7.4, 1: 7.6, 2: 7.9})
    assert ascenso.primer_cruce(serie, 7.5, date(2020, 1, 1), date(2020, 1, 31)) == date(2020, 1, 2)
    assert ascenso.primer_cruce(serie, 8.3, date(2020, 1, 1), date(2020, 1, 31)) is None


@pytest.fixture(scope="module")
def serie_real():
    limpias, _ = k1.limpiar(k1.leer_original())
    return {d: v for d, (v, _n) in k1.serie_diaria(limpias).items()}


def test_velocidades_coinciden_con_la_tabla_preliminar(serie_real):
    r1516 = ascenso.resumen_periodo(serie_real, "2015-16")
    assert (r1516.mayor_suba_1d.metros, r1516.mayor_suba_1d.fecha_fin) == (0.29, date(2015, 12, 5))
    assert (r1516.mayor_suba_7d.metros, r1516.mayor_suba_7d.fecha_fin) == (1.25, date(2015, 12, 10))
    assert r1516.cruces == {
        7.5: date(2015, 6, 18),
        7.8: date(2015, 8, 1),
        8.3: date(2015, 12, 18),
    }

    r2019 = ascenso.resumen_periodo(serie_real, "2019")
    assert (r2019.mayor_suba_1d.metros, r2019.mayor_suba_1d.fecha_fin) == (0.36, date(2019, 3, 20))
    assert (r2019.mayor_suba_7d.metros, r2019.mayor_suba_7d.fecha_fin) == (1.37, date(2019, 3, 25))
    assert r2019.cruces == {
        7.5: date(2019, 4, 14),
        7.8: date(2019, 4, 17),
        8.3: date(2019, 4, 27),
    }

    r2026 = ascenso.resumen_periodo(serie_real, "oct-2026")
    assert (r2026.mayor_suba_1d.metros, r2026.mayor_suba_1d.fecha_fin) == (0.28, date(2026, 10, 12))
    assert (r2026.mayor_suba_7d.metros, r2026.mayor_suba_7d.fecha_fin) == (1.53, date(2026, 10, 17))
    assert all(v is None for v in r2026.cruces.values())
