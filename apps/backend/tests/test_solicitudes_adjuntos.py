"""Adjuntos de solicitudes, idempotencia de POST /solicitudes y geometría en /mi/sector."""

from __future__ import annotations

import uuid

import pytest

from app.config.settings import get_settings
from tests.test_operacion import S4, _usuario_nuevo

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 60
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 40
CUERPO = {"tipo": "asistencia", "personas": 3, **S4, "texto": "Sin salida por el camino de tierra"}


@pytest.fixture(autouse=True)
def carpeta_adjuntos(tmp_path, monkeypatch):
    monkeypatch.setenv("ADJUNTOS_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


def _crear(client, h, **extra):
    r = client.post("/api/v1/solicitudes", json=CUERPO, headers={**h, **extra})
    return r


def _subir(client, h, sid, contenido, tipo="image/jpeg"):
    return client.post(
        f"/api/v1/solicitudes/{sid}/adjuntos",
        files={"archivo": ("foto", contenido, tipo)},
        headers=h,
    )


def test_subir_y_descargar_adjunto_del_dueno(client, como, carpeta_adjuntos):
    _, h = _usuario_nuevo(client)
    sid = _crear(client, h).json()["id"]
    r = _subir(client, h, sid, JPEG)
    assert r.status_code == 201 and r.json()["n"] == 1 and r.json()["mime"] == "image/jpeg"
    assert (carpeta_adjuntos / "solicitudes" / str(sid) / "1.jpg").read_bytes() == JPEG
    assert _subir(client, h, sid, PNG, "image/png").json()["n"] == 2
    assert _subir(client, h, sid, WEBP, "image/webp").json()["mime"] == "image/webp"
    # El detalle muestra solo metadatos (sin rutas del servidor).
    adj = client.get(f"/api/v1/solicitudes/{sid}", headers=h).json()["adjuntos"]
    assert [a["n"] for a in adj] == [1, 2, 3] and set(adj[0]) == {"n", "mime", "bytes"}
    g = client.get(f"/api/v1/solicitudes/{sid}/adjuntos/1", headers=h)
    assert g.status_code == 200 and g.content == JPEG and g.headers["content-type"] == "image/jpeg"
    assert g.headers["x-content-type-options"] == "nosniff"
    # Un operador también puede leerlo.
    assert (
        client.get(f"/api/v1/solicitudes/{sid}/adjuntos/2", headers=como("operador")).content == PNG
    )


def test_adjuntos_de_otro_usuario_dan_404(client, como):
    _, h1 = _usuario_nuevo(client)
    _, h2 = _usuario_nuevo(client)
    sid = _crear(client, h1).json()["id"]
    assert _subir(client, h2, sid, JPEG).status_code == 404
    _subir(client, h1, sid, JPEG)
    assert client.get(f"/api/v1/solicitudes/{sid}/adjuntos/1", headers=h2).status_code == 404
    assert client.get(f"/api/v1/solicitudes/{sid}/adjuntos/9", headers=h1).status_code == 404
    assert client.get(f"/api/v1/solicitudes/{sid}/adjuntos/1").status_code == 401


def test_se_valida_el_contenido_y_no_solo_el_content_type(client):
    _, h = _usuario_nuevo(client)
    sid = _crear(client, h).json()["id"]
    # Declara imagen pero es un ejecutable / HTML.
    assert _subir(client, h, sid, b"MZ\x90\x00" + b"\x00" * 50).status_code == 415
    assert (
        _subir(client, h, sid, b"<html><script>1</script></html>", "image/png").status_code == 415
    )
    # Contenido válido pero Content-Type no permitido.
    assert _subir(client, h, sid, JPEG, "application/pdf").status_code == 415
    assert _subir(client, h, sid, b"", "image/jpeg").status_code == 422


def test_limite_de_tamano_y_de_cantidad(client, monkeypatch):
    monkeypatch.setenv("ADJUNTO_MAX_BYTES", "100")
    monkeypatch.setenv("ADJUNTOS_MAX_POR_SOLICITUD", "2")
    get_settings.cache_clear()
    _, h = _usuario_nuevo(client)
    sid = _crear(client, h).json()["id"]
    assert _subir(client, h, sid, JPEG + b"\x00" * 100).status_code == 413
    assert _subir(client, h, sid, JPEG).status_code == 201
    assert _subir(client, h, sid, JPEG + b"").status_code == 201
    assert _subir(client, h, sid, JPEG + b"").status_code == 409


def test_idempotency_key_devuelve_la_original_sin_duplicar(client):
    _, h = _usuario_nuevo(client)
    clave = str(uuid.uuid4())
    a = _crear(client, h, **{"Idempotency-Key": clave})
    b = _crear(client, h, **{"Idempotency-Key": clave})
    assert a.status_code == 201 and b.status_code == 200 and a.json()["id"] == b.json()["id"]
    assert "idempotency_key" not in str(b.json())
    assert len(client.get("/api/v1/solicitudes", headers=h).json()["solicitudes"]) == 1
    # Otra clave crea otra solicitud; sin clave siempre crea.
    assert _crear(client, h, **{"Idempotency-Key": str(uuid.uuid4())}).status_code == 201
    assert _crear(client, h).status_code == 201
    # La clave es por usuario.
    _, h2 = _usuario_nuevo(client)
    assert _crear(client, h2, **{"Idempotency-Key": clave}).status_code == 201


def test_idempotency_key_invalida_es_422(client):
    _, h = _usuario_nuevo(client)
    assert _crear(client, h, **{"Idempotency-Key": "no-es-uuid"}).status_code == 422


def test_mi_sector_incluye_geometria_y_coordenadas_del_centro(client, como):
    r = client.get("/api/v1/mi/sector", headers=como("productor1")).json()
    geo = r["sectores"][0]["geometria"]
    assert geo["type"] == "Polygon" and len(geo["coordinates"][0]) >= 4
    centro = r["centro_asignado"]["animales"]
    assert -90 <= centro["lat"] <= 90 and -180 <= centro["lon"] <= 180
