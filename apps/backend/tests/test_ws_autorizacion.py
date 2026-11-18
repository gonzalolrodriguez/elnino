"""WebSocket: la conexión no sobrevive al token ni a un cambio de contraseña, estado o rol."""

import time
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from starlette.websockets import WebSocketDisconnect

from app.config.settings import get_settings
from app.core.eventos import difusor
from tests.conftest import bearer, correo_unico, iniciar_sesion

PASSWORD = "ClaveInstitucional2026!"


def _crear_cuadrilla(client, token_admin) -> dict:
    r = client.post(
        "/api/v1/usuarios",
        headers=bearer(token_admin),
        json={
            "email": correo_unico("cuad"),
            "password": PASSWORD,
            "nombre_visible": "Cuadrilla de Prueba",
            "rol": "cuadrilla",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _token(client, email) -> str:
    r = iniciar_sesion(client, email, PASSWORD)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_conexion_con_token_vencido_se_cierra_con_1008(client, token_admin):
    usuario = _crear_cuadrilla(client, token_admin)
    ahora = datetime.now(UTC)
    corto = jwt.encode(
        {
            "sub": str(usuario["id"]),
            "type": "access",
            "rol": "cuadrilla",
            "iat": ahora,
            "exp": ahora + timedelta(seconds=2),
        },
        get_settings().secreto_jwt(),
        algorithm="HS256",
    )
    inicio = time.monotonic()
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"token": corto})
            assert ws.receive_json()["tipo"] == "conectado"
            ws.receive_json()  # se bloquea hasta que el servidor cierra al vencer el token
    assert exc.value.code == 1008
    assert time.monotonic() - inicio < 10


def test_difusor_cierra_conexion_con_token_vencido_antes_de_enviar(client, token_admin):
    usuario = _crear_cuadrilla(client, token_admin)
    token = _token(client, usuario["email"])
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"token": token})
            assert ws.receive_json()["tipo"] == "conectado"
            with difusor._lock:  # se adelanta el vencimiento sin esperar al temporizador
                for c in difusor._conexiones:
                    if c.usuario_id == usuario["id"]:
                        c.exp = time.time() - 1
            difusor.publicar("escenario", {"x": 1})
            ws.receive_json()
    assert exc.value.code == 1008


@pytest.mark.parametrize(
    "cambio",
    [{"rol": "operador"}, {"estado": "inactivo"}, {"password": "OtraClaveNueva2026!"}],
    ids=["rol", "estado", "password"],
)
def test_cambiar_rol_estado_o_password_desconecta_sus_sockets(client, token_admin, cambio):
    usuario = _crear_cuadrilla(client, token_admin)
    token = _token(client, usuario["email"])
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"token": token})
            assert ws.receive_json()["tipo"] == "conectado"
            r = client.patch(
                f"/api/v1/usuarios/{usuario['id']}", json=cambio, headers=bearer(token_admin)
            )
            assert r.status_code == 200, r.text
            ws.receive_json()
    assert exc.value.code == 1008


def test_un_cambio_ajeno_a_la_autorizacion_no_desconecta(client, token_admin):
    usuario = _crear_cuadrilla(client, token_admin)
    token = _token(client, usuario["email"])
    with client.websocket_connect("/api/v1/ws") as ws:
        ws.send_json({"token": token})
        assert ws.receive_json()["tipo"] == "conectado"
        r = client.patch(
            f"/api/v1/usuarios/{usuario['id']}",
            json={"nombre_visible": "Nombre Nuevo"},
            headers=bearer(token_admin),
        )
        assert r.status_code == 200
        difusor.publicar("escenario", {"x": 1})
        assert ws.receive_json()["tipo"] == "escenario"
