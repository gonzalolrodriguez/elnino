"""Tope global del tamaño del cuerpo de las solicitudes (middleware ASGI).

Corta con 413 las solicitudes cuyo ``Content-Length`` supera el tope y también las que lo superan
al transmitirse por partes (sin ``Content-Length``). Las subidas de archivos conservan su propio
tope: adjuntos de solicitudes y planilla de lluvia.
"""

from __future__ import annotations

import json
import re

from fastapi import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config.settings import get_settings

_ADJUNTO = re.compile(r"^/api/v1/(?:solicitudes/\d+/adjuntos|tareas/\d+/cierre/adjuntos)/?$")
_HOLGURA = 64 * 1024  # encabezados multipart y demás


def tope_para(ruta: str) -> int:
    cfg = get_settings()
    if _ADJUNTO.match(ruta):
        return cfg.adjunto_max_bytes + _HOLGURA
    if ruta.rstrip("/") == "/api/v1/lluvia/importar-planilla":
        from app.servicios.lluvia import MAX_BYTES_PLANILLA

        return MAX_BYTES_PLANILLA + _HOLGURA
    return cfg.cuerpo_max_bytes


class LimiteCuerpo:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        tope = tope_para(scope["path"])
        declarado = dict(scope["headers"]).get(b"content-length")
        if declarado is not None:
            try:
                if int(declarado) > tope:
                    await self._rechazar(send, tope)
                    return
            except ValueError:
                pass
        recibido = 0

        async def receive_limitado() -> Message:
            nonlocal recibido
            mensaje = await receive()
            if mensaje["type"] == "http.request":
                recibido += len(mensaje.get("body", b""))
                if recibido > tope:
                    # FastAPI deja pasar esta excepción (no la convierte en 400) y el manejador de
                    # errores la responde con el sobre JSON estándar.
                    raise HTTPException(413, f"El cuerpo de la solicitud supera {tope} bytes")
            return mensaje

        await self.app(scope, receive_limitado, send)

    @staticmethod
    async def _rechazar(send: Send, tope: int) -> None:
        cuerpo = json.dumps(
            {
                "error": {
                    "codigo": "cuerpo_demasiado_grande",
                    "mensaje": f"El cuerpo de la solicitud supera el máximo de {tope} bytes",
                    "detalle": None,
                }
            }
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(cuerpo)).encode()),
                    (b"connection", b"close"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": cuerpo})
