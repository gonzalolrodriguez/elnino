"""Difusión de eventos en tiempo real por WebSocket (``/api/v1/ws``).

Eventos: ``escenario``, ``solicitud``, ``orden`` y ``tarea``. Los endpoints son síncronos (corren en
un hilo) y llaman a ``publicar``, que entrega el mensaje al bucle de eventos del servidor. Cada
conexión recibe solo lo que su rol puede ver:

- ``mandos`` (operador, decisor, admin, cuadrilla): todos los eventos.
- ``orden``: también ciudadanía y productores (es la alerta que deben recibir).
- ``solicitud``: además, el propio solicitante.

Autorización vigente: cada conexión guarda el vencimiento (``exp``) del token de acceso con el que
se autenticó. Al vencer se cierra con 1008 (lo hace el temporizador de ``ws.py`` y, por si el
temporizador aún no corrió, también se comprueba antes de cada envío).
Además, ``desconectar_usuario`` cierra todas las conexiones de un usuario cuando cambia su
contraseña, su estado o su rol.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass

from fastapi import WebSocket

ROLES_MANDOS = ("operador", "decisor", "admin", "cuadrilla")


@dataclass
class _Conexion:
    ws: WebSocket
    usuario_id: int
    rol: str
    exp: float  # vencimiento del token de acceso (segundos epoch)


class Difusor:
    def __init__(self) -> None:
        self._conexiones: list[_Conexion] = []
        self._bucle: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    async def conectar(self, ws: WebSocket, usuario_id: int, rol: str, exp: float) -> None:
        with self._lock:
            self._bucle = asyncio.get_running_loop()
            self._conexiones.append(_Conexion(ws, usuario_id, rol, exp))

    def desconectar(self, ws: WebSocket) -> None:
        with self._lock:
            self._conexiones = [c for c in self._conexiones if c.ws is not ws]

    @staticmethod
    async def _cerrar(conexiones: list[_Conexion], codigo: int = 1008) -> None:
        for c in conexiones:
            try:
                await c.ws.close(code=codigo)
            except Exception:  # ya cerrada o desconectada
                pass

    def desconectar_usuario(self, usuario_id: int) -> int:
        """Cierra (1008) todas las conexiones del usuario. Se puede llamar desde un hilo.

        Se usa al cambiar su contraseña, estado o rol y al detectar reutilización de un refresh:
        la autorización con la que se conectó dejó de ser válida. Devuelve cuántas cerró.
        """
        with self._lock:
            objetivo = [c for c in self._conexiones if c.usuario_id == usuario_id]
            self._conexiones = [c for c in self._conexiones if c.usuario_id != usuario_id]
            bucle = self._bucle
        if objetivo and bucle is not None and not bucle.is_closed():
            try:
                asyncio.run_coroutine_threadsafe(self._cerrar(objetivo), bucle)
            except RuntimeError:
                pass
        return len(objetivo)

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
            if c.exp <= time.time():  # token vencido: no se le entrega nada y se cierra
                self.desconectar(c.ws)
                await self._cerrar([c])
                continue
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
