"""Limpieza de K1: los conteos se reproducen desde el CSV original del kit."""

import csv
from datetime import date

import pytest

from app.ingest import limpieza_k1 as k1


@pytest.fixture(scope="module")
def resultado():
    return k1.limpiar(k1.leer_original())


def test_normalizar_fecha_acepta_los_tres_formatos():
    assert k1.normalizar_fecha("2014-02-14 04:00:00") == ("2014-02-14 04:00:00", None)
    assert k1.normalizar_fecha("14/02/2014 04:00:00") == ("2014-02-14 04:00:00", "fecha_ddmmaaaa")
    assert k1.normalizar_fecha("2014/02/14 04:00:00") == ("2014-02-14 04:00:00", "fecha_aaaammdd")


def test_normalizar_valor_coma_y_centimetros():
    assert k1.normalizar_valor("7,95", "m") == (7.95, ["coma_decimal"])
    assert k1.normalizar_valor("584.00", "cm") == (5.84, ["cm_a_m"])
    assert k1.normalizar_valor("3.4", "m") == (3.4, [])
    with pytest.raises(ValueError):
        k1.normalizar_valor("3.4", "ft")


def test_conteos_de_limpieza(resultado):
    limpias, r = resultado
    assert r.filas_originales == 8347
    assert r.duplicados_identicos == 12
    assert r.obs_id_repetidos_distintos == 0
    assert (r.fechas_ddmmaaaa, r.fechas_aaaammdd) == (20, 20)
    assert r.coma_decimal == 3
    assert r.unidad_cm == 7
    assert len(r.cuarentena) == 1
    assert r.negativos == 141
    assert r.dias_con_varias_mediciones == 432
    assert r.filas_finales == len(limpias) == 8335
    assert r.filas_validas == 8334


def test_obs_id_unicos_tras_limpiar(resultado):
    limpias, _ = resultado
    assert len({f["obs_id"] for f in limpias}) == len(limpias)


def test_valor_imposible_en_cuarentena_sin_reemplazar(resultado):
    limpias, r = resultado
    q = r.cuarentena[0]
    assert q["timestart"].startswith("2012-07-15")
    assert q["valor_m"] == "98.1"  # se conserva el valor original
    assert q["calidad"] == k1.CALIDAD_CUARENTENA
    assert all(f["calidad"] == k1.CALIDAD_VALIDO for f in limpias if f is not q)


def test_centimetros_convertidos_en_marzo_2011(resultado):
    limpias, _ = resultado
    cm = [f for f in limpias if f["unidad_original"] == "cm"]
    assert len(cm) == 7
    assert {f["timestart"][:10] for f in cm} == {f"2011-03-{d}" for d in range(10, 17)}
    assert all(5.8 <= float(f["valor_m"]) <= 5.97 for f in cm)
    assert all("cm_a_m" in f["transformacion"] for f in cm)


def test_valores_de_control(resultado):
    limpias, r = resultado
    assert r.maximo_m == 9.81
    assert {f[:10] for f in r.maximo_fechas} == {"2016-01-05", "2016-01-06"}
    assert r.pico_2019_m == 9.72
    assert r.pico_2019_fecha.startswith("2019-06-02")
    assert r.valor_2026_10_01 == 2.37
    assert r.valor_2026_10_31 == 5.6


def test_se_conservan_mediciones_del_mismo_dia_a_distinta_hora(resultado):
    limpias, _ = resultado
    del_dia = [f for f in limpias if f["timestart"].startswith("2016-01-05")]
    assert len(del_dia) >= 2
    assert len({f["timestart"] for f in del_dia}) == len(del_dia)


def test_2018_sin_interpolacion(resultado, tmp_path):
    limpias, r = resultado
    assert len(r.dias_sin_dato_2018) == 25
    k1.escribir_diario(limpias, tmp_path / "diario.csv")
    with (tmp_path / "diario.csv").open(encoding="utf-8", newline="") as f:
        filas = list(csv.DictReader(f))
    por_fecha = {fila["fecha"]: fila for fila in filas}
    for dia in r.dias_sin_dato_2018:
        assert por_fecha[dia.isoformat()]["altura_max_m"] == ""
        assert por_fecha[dia.isoformat()]["n_mediciones"] == ""


def test_diario_cubre_todo_el_periodo(resultado, tmp_path):
    limpias, _ = resultado
    k1.escribir_diario(limpias, tmp_path / "diario.csv")
    with (tmp_path / "diario.csv").open(encoding="utf-8", newline="") as f:
        filas = list(csv.DictReader(f))
    esperado = (date(2026, 10, 31) - date(2006, 1, 1)).days + 1
    assert len(filas) == esperado
    assert filas[0]["fecha"] == "2006-01-01"
    assert filas[-1]["fecha"] == "2026-10-31"
    assert float(filas[-1]["altura_max_m"]) == 5.6


def test_diario_toma_el_maximo_del_dia(resultado):
    limpias, _ = resultado
    diario = k1.serie_diaria(limpias)
    valores_dia = [float(f["valor_m"]) for f in limpias if f["timestart"].startswith("2016-01-05")]
    assert diario[date(2016, 1, 5)][0] == max(valores_dia)
    assert diario[date(2016, 1, 5)][1] == len(valores_dia)


def test_registro_markdown_contiene_la_comprobacion_final(resultado):
    _, r = resultado
    md = k1.generar_registro_markdown(r)
    assert "Registro de limpieza de K1" in md
    assert "9,81 m" in md
    assert "8335" in md
    assert "no es una herramienta oficial" in md


def test_escribir_limpio_tiene_las_columnas_esperadas(resultado, tmp_path):
    limpias, _ = resultado
    k1.escribir_limpio(limpias, tmp_path / "limpio.csv")
    with (tmp_path / "limpio.csv").open(encoding="utf-8", newline="") as f:
        lector = csv.DictReader(f)
        assert lector.fieldnames == k1.COLUMNAS_LIMPIO
        assert sum(1 for _ in lector) == 8335
