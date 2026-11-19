"""Solicitudes con referencia de ubicación (con o sin coordenadas)."""

from tests.test_operacion import S4, _usuario_nuevo

BASE = {"tipo": "asistencia", "personas": 2}


def test_coordenadas_y_referencia_se_guardan_las_dos(client):
    _, h = _usuario_nuevo(client)
    r = client.post(
        "/api/v1/solicitudes",
        json={**BASE, **S4, "referencia_ubicacion": "  Paraje El Colorado, camino al río  "},
        headers=h,
    )
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["referencia_ubicacion"] == "Paraje El Colorado, camino al río"
    assert j["ubicacion_aproximada"] is False and j["requiere_verificacion"] is False
    assert j["lon"] is not None and j["sector_id"] == "S4"


def test_referencia_sin_coordenadas_queda_a_verificar(client):
    _, h = _usuario_nuevo(client)
    r = client.post(
        "/api/v1/solicitudes",
        json={**BASE, "referencia_ubicacion": "Ruta 11 km 1380"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["ubicacion_aproximada"] is True and j["requiere_verificacion"] is True
    assert j["sector_id"] is None and j["lon"] is None and j["lat"] is None


def test_sin_coordenadas_ni_referencia_da_422(client):
    _, h = _usuario_nuevo(client)
    assert client.post("/api/v1/solicitudes", json=BASE, headers=h).status_code == 422
    r = client.post("/api/v1/solicitudes", json={**BASE, "referencia_ubicacion": "   "}, headers=h)
    assert r.status_code == 422
    # Una sola coordenada tampoco sirve.
    assert (
        client.post("/api/v1/solicitudes", json={**BASE, "lon": -58.1}, headers=h).status_code
        == 422
    )


def test_referencia_demasiado_larga_da_422(client):
    _, h = _usuario_nuevo(client)
    r = client.post(
        "/api/v1/solicitudes",
        json={**BASE, **S4, "referencia_ubicacion": "x" * 201},
        headers=h,
    )
    assert r.status_code == 422
