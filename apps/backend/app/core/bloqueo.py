"""Bloqueo por intentos fallidos de login, por par (cuenta, IP).

Compromiso de diseño (ver ``docs/seguridad.md``): el contador y el bloqueo se llevan por cuenta
**e IP**. Quien adivina contraseñas desde su IP se bloquea a sí mismo, pero no deja afuera a la
persona titular que entra desde otra IP (con un bloqueo solo por cuenta, bastaba con fallar a
propósito cinco veces para dejar a la víctima sin acceso). A cambio, un atacante con muchas IPs
obtiene ``LOGIN_MAX_INTENTOS`` intentos por IP; lo acotan el costo de Argon2, el rate limit por IP
y la bitácora de accesos (eventos ``cuenta_bloqueada``) para detectarlo.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.base import ahora
from app.db.modelos import IntentoLogin


def _ip(ip: str | None) -> str:
    return (ip or "desconocida")[:64]


def esta_bloqueado(db: Session, usuario_id: int, ip: str | None) -> bool:
    hasta = db.execute(
        select(IntentoLogin.bloqueado_hasta).where(
            IntentoLogin.usuario_id == usuario_id, IntentoLogin.ip == _ip(ip)
        )
    ).scalar_one_or_none()
    return hasta is not None and hasta > ahora()


def registrar_fallo(db: Session, usuario_id: int, ip: str | None) -> tuple[int, bool]:
    """Suma un intento fallido. Devuelve ``(intentos del par, bloqueado ahora)``.

    El incremento es atómico (``INSERT ... ON CONFLICT DO UPDATE``).
    """
    s = get_settings()
    stmt = insert(IntentoLogin).values(
        usuario_id=usuario_id, ip=_ip(ip), intentos=1, actualizado_en=ahora()
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_intentos_usuario_ip",
        set_={"intentos": IntentoLogin.intentos + 1, "actualizado_en": ahora()},
    ).returning(IntentoLogin.id, IntentoLogin.intentos)
    fila_id, intentos = db.execute(stmt).one()
    if intentos >= s.login_max_intentos:
        fila = db.get(IntentoLogin, fila_id)
        fila.bloqueado_hasta = ahora() + timedelta(minutes=s.login_bloqueo_minutos)
        fila.intentos = 0
        return intentos, True
    return intentos, False


def limpiar(db: Session, usuario_id: int, ip: str | None) -> None:
    db.execute(
        delete(IntentoLogin).where(
            IntentoLogin.usuario_id == usuario_id, IntentoLogin.ip == _ip(ip)
        )
    )
