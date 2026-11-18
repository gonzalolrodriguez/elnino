"""Difusión de eventos en tiempo real por WebSocket (``/api/v1/ws``).

Eventos: ``escenario``, ``solicitud``, ``orden`` y ``tarea``. Los endpoints son síncronos (corren en
un hilo) y llaman a ``publicar``, que entrega el mensaje al bucle de eventos del servidor. Cada
conexión recibe solo lo que su rol puede ver:

- ``mandos`` (operador, decisor, admin, cuadrilla): todos los eventos.
- ``orden``: también ciudadanía y productores (es la alerta que deben recibir).
- ``solicitud``: además, el propio solicitante.
"""

from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass

from fastapi import WebSocket

ROLES_MANDOS = ("operador", "decisor", "admin", "cuadrilla")


@dataclass
class _Conexion:
    ws: WebSocket
    usuario_id: int
    rol: str


class Difusor:
    def __init__(self) -> None:
        self._conexiones: list[_Conexion] = []
        self._bucle: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    async def conectar(self, ws: WebSocket, usuario_id: int, rol: str) -> None:
        with self._lock:
            self._bucle = asyncio.get_running_loop()
            self._conexiones.append(_Conexion(ws, usuario_id, rol))

    def desconectar(self, ws: WebSocket) -> None:
        with self._lock:
            self._conexiones = [c for c in self._conexiones if c.ws is not ws]

    def _destinatarios(self, tipo: str, usuario_id: int | None) -> list[_Conexion]:
        with self._lock:
            conexiones = list(self._conexiones)
        elegidos = []
        for c in conexiones:
            if (
                c.rol in ROLES_MANDOS
                or tipo == "orden"
                or (tipo == "solicitud" and usuario_id is not None and c.usuario_id == usuario_id)
            ):
                elegidos.append(c)
        return elegidos

    async def _enviar(self, tipo: str, datos: dict, usuario_id: int | None) -> None:
        for c in self._destinatarios(tipo, usuario_id):
            try:
                await c.ws.send_json({"tipo": tipo, "datos": datos})
            except Exception:
                self.desconectar(c.ws)

    def publicar(self, tipo: str, datos: dict, usuario_id: int | None = None) -> None:
        """Encola el evento (no bloquea ni falla si no hay conexiones ni bucle)."""
        with self._lock:
            bucle = self._bucle
            hay = bool(self._conexiones)
        if bucle is None or not hay or bucle.is_closed():
            return
        try:
            asyncio.run_coroutine_threadsafe(self._enviar(tipo, datos, usuario_id), bucle)
        except RuntimeError:
            pass


difusor = Difusor()
