"""Rate limiting (slowapi): por IP en login y registro, y por persona en endpoints autenticados."""

import time
from collections.abc import Callable

import jwt
from fastapi import HTTPException, Request
from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config.settings import get_settings
from app.core.seguridad import decodificar_token_acceso

limiter = Limiter(
    key_func=get_remote_address,
    enabled=get_settings().rate_limit_activo,
    default_limits=[],
)


def limite_login() -> str:
    return get_settings().rate_limit_login


def limite_registro() -> str:
    return get_settings().rate_limit_registro


def limite_usuario() -> str:
    return get_settings().rate_limit_usuario


def limite_simulacion() -> str:
    return get_settings().rate_limit_simulacion


def _usuario_del_token(request: Request) -> str | None:
    """Id de la persona según el access token (``None`` si falta o no es válido).

    Sin token válido no se cuenta nada: la autenticación del endpoint ya responde 401.
    """
    cabecera = request.headers.get("authorization", "")
    if not cabecera.lower().startswith("bearer "):
        return None
    try:
        return str(decodificar_token_acceso(cabecera[7:].strip())["sub"])
    except (jwt.PyJWTError, KeyError, RuntimeError, ValueError):
        return None


def limite_por_usuario(grupo: str, limite: Callable[[], str]) -> Callable[[Request], None]:
    """Dependencia de FastAPI: tope de solicitudes por persona (no por IP) para un grupo de rutas.

    Usa el mismo almacenamiento que ``limiter`` (se apaga con ``RATE_LIMIT_ACTIVO=false`` y se
    limpia con ``limiter.reset()``). Al superarlo responde 429 con ``Retry-After``.
    """

    def dependencia(request: Request) -> None:
        if not limiter.enabled:
            return
        usuario = _usuario_del_token(request)
        if usuario is None:
            return
        item = parse(limite())
        if not limiter.limiter.hit(item, "usuario", grupo, usuario):
            reinicio, _ = limiter.limiter.get_window_stats(item, "usuario", grupo, usuario)
            espera = max(1, int(reinicio - time.time()) + 1)
            raise HTTPException(
                429,
                "Demasiadas solicitudes; esperá un momento e intentá de nuevo",
                headers={"Retry-After": str(espera)},
            )

    return dependencia
