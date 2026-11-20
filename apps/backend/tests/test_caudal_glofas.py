"""Caudal modelado GloFAS: usa el JSON versionado en data/processed (sin red ni base)."""

from fastapi.testclient import TestClient

from app.config.settings import get_settings
from app.main import app

client = TestClient(app)
URL = "/api/v1/serie/caudal-glofas"


def test_serie_formosa_hasta_el_corte_con_rotulos():
    r = client.get(URL, params={"estacion": "formosa"})
    assert r.status_code == 200
    c = r.json()
    assert c["categoria"] == "DOCUMENTO DE REFERENCIA"
    assert c["unidad"] == "m³/s"
    assert c["fecha_dato"] == "2026-10-31"
    assert c["fechas"][0] == "2006-01-01" and c["fechas"][-1] == "2026-10-31"
    assert len(c["fechas"]) == len(c["caudal_m3s"])
    assert c["ultima"] == {"fecha": "2026-10-31", "caudal_m3s": 2083.49}
    assert [p["anio"] for p in c["picos"]] == [2016, 2019]
    assert c["picos"][0]["caudal_m3s"] > c["picos"][1]["caudal_m3s"] > 0
    assert "licencia" in c and "fuente" in c and c["celda_usada"]["lat"]
    assert any("no se convierte a metros" in n for n in c["notas"])
    assert c["pronostico_emitido_al_corte"] is None


def test_posterior_al_corte_apagado_por_defecto():
    c = client.get(URL).json()
    assert c["posterior_al_corte"] is None
    assert max(c["fechas"]) <= "2026-10-31"


def test_posterior_al_corte_con_flag_se_rotula(monkeypatch):
    monkeypatch.setenv("PERMITIR_DATOS_POST_CORTE", "true")
    get_settings.cache_clear()
    try:
        c = client.get(URL, params={"estacion": "pilcomayo"}).json()
        p = c["posterior_al_corte"]
        assert p["rotulo"].startswith("POSTERIOR AL CORTE")
        assert p["fechas"][0] == "2026-11-01"
        assert len(p["p25"]) == len(p["fechas"]) == p["horizonte_dias"]
        assert "supuesto" in p
        assert max(c["fechas"]) <= "2026-10-31"  # la serie hasta el corte no cambia
    finally:
        monkeypatch.delenv("PERMITIR_DATOS_POST_CORTE")
        get_settings.cache_clear()


def test_estacion_invalida_devuelve_422():
    r = client.get(URL, params={"estacion": "asuncion"})
    assert r.status_code == 422
    assert r.json()["error"]["codigo"] == "validacion"
