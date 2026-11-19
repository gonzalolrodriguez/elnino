"""WebSocket de eventos en tiempo real: ``WS /api/v1/ws`` (CLAUDE.md §9 · Tiempo real).

Autenticación: el JWT de acceso viaja SOLO en el primer mensaje ``{"token": "<jwt>"}`` (nunca en la
URL, para que no quede en registros de acceso). Sin token válido en 5 segundos se cierra con el
código 1008 (violación de política). Eventos enviados:
``{"tipo": "escenario|solicitud|orden|tarea", "datos": {...}}``.

La conexión no sobrevive al token: al vencer el ``exp`` del token de acceso se cierra con 1008 y el
cliente debe renovar el token (``/auth/refresh``) y reconectar. También se cierra si el servidor
invalida la autorización (cambio de contraseña, estado o rol; ver ``Difusor.desconectar_usuario``).
"""

from __future__ import annotations

import asyncio
import time

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app.core.eventos import difusor
from app.core.seguridad import decodificar_token_acceso
from app.db.modelos import Usuario
from app.db.sesion import get_sessionmaker

router = APIRouter(tags=["tiempo-real"])
ESPERA_TOKEN_S = 5


def _usuario(token: str) -> tuple[int, str, float] | None:
    try:
        claims = decodificar_token_acceso(token)
        with get_sessionmaker()() as db:
            u = db.get(Usuario, int(claims["sub"]))
            if u is None or u.estado != "activo":
                return None
            return u.id, u.rol, float(claims["exp"])
    except (jwt.PyJWTError, ValueError, RuntimeError):
        return None


@router.websocket("/ws")
async def eventos(ws: WebSocket) -> None:
    await ws.accept()
    token = None
    try:
        primero = await asyncio.wait_for(ws.receive_json(), timeout=ESPERA_TOKEN_S)
        token = primero.get("token") if isinstance(primero, dict) else None
    except (TimeoutError, ValueError, KeyError, TypeError, RuntimeError, WebSocketDisconnect):
        token = None  # incluye marcos binarios o mal formados: no tumban el servidor
    identidad = await run_in_threadpool(_usuario, token) if isinstance(token, str) else None
    if identidad is None:
        await ws.close(code=1008)
        return
    exp = identidad[2]
    try:
        # La conexión se registra dentro del try: si algo falla después (p. ej. el cliente se va
        # antes del saludo), el ``finally`` la quita del difusor y no queda un socket fantasma.
        await difusor.conectar(ws, *identidad)
        await ws.send_json({"tipo": "conectado", "datos": {"rol": identidad[1]}})
        while True:
            restante = exp - time.time()
            if restante <= 0:
                break
            try:
                # Se ignora lo que envíe el cliente (texto o binario); el plazo es el vencimiento
                # del token. Solo importa saber si se desconectó.
                mensaje = await asyncio.wait_for(ws.receive(), timeout=restante)
            except TimeoutError:
                break
            if mensaje["type"] == "websocket.disconnect":
                return
        await ws.close(code=1008)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        difusor.desconectar(ws)
