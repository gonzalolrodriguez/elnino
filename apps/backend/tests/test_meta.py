from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_salud_devuelve_200_con_campos_esperados():
    r = client.get("/api/v1/salud")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["estado"] == "ok"
    assert cuerpo["servicio"] == "backend"
    assert "version" in cuerpo
    assert cuerpo["base_de_datos"] in ("ok", "no_disponible")


def test_meta_contiene_leyenda_exacta_y_fecha_corte():
    r = client.get("/api/v1/meta")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["leyenda"] == (
        "PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial"
    )
    assert cuerpo["fecha_corte"] == "2026-10-31"
    assert cuerpo["categorias"] == ["DATO OBSERVADO", "DOCUMENTO DE REFERENCIA", "SIMULADO"]
    assert len(cuerpo["limites"]) == 7
    assert cuerpo["flags"]["permitir_datos_post_corte"] is False


def test_ruta_inexistente_devuelve_sobre_de_error_404():
    r = client.get("/api/v1/no-existe")
    assert r.status_code == 404
    error = r.json()["error"]
    assert error["codigo"] == "no_encontrado"
    assert "mensaje" in error and "detalle" in error
