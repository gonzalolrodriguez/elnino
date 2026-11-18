"""Límites de intentos fallidos de login: por par (cuenta, red) y por cuenta.

Compromiso de diseño (ver ``docs/seguridad.md``), dos capas:

1. **Par (cuenta, red)**: el contador y el bloqueo se llevan por cuenta **y red** (IPv4 completa;
   IPv6 agrupada por /64). Quien adivina contraseñas desde su red se bloquea a sí mismo, pero no
   deja afuera a la persona titular que entra desde otra red.
2. **Cuenta (ventana deslizante, todas las redes)**: un atacante con muchas IP obtendría
   ``LOGIN_MAX_INTENTOS`` intentos por IP. Por eso, si la cuenta acumula ``LOGIN_CUENTA_MAX_FALLOS``
   fallos en ``LOGIN_CUENTA_VENTANA_MINUTOS`` (sumando todas las redes), se responde 429 a todo
   intento desde una red **sin un login correcto previo** de esa cuenta en los últimos
   ``LOGIN_IP_CONOCIDA_DIAS`` días (sin importar si la contraseña es correcta, para no dar un
   oráculo). Las redes con historial siguen entrando, de modo que fallar a propósito no deja
   afuera a la persona titular en su red habitual. El bloqueo cede solo cuando los fallos salen
   de la ventana.

Los fallos y los logins correctos se leen de la bitácora de accesos (``auditoria_accesos``): no hay
una tabla nueva, solo un índice (migración 0003).
"""

from __future__ import annotations

import ipaddress
from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.base import ahora
from app.db.modelos import AuditoriaAcceso, IntentoLogin

ACCIONES_FALLO = ("login_fallido", "cuenta_bloqueada")


def clave_ip(ip: str | None) -> str:
    """Clave de red para los contadores: IPv4 tal cual, IPv6 agrupada por /64.

    Una persona con IPv6 recibe un /64 completo y puede rotar de dirección dentro de él a voluntad;
    contar por dirección exacta permitiría eludir el bloqueo del par. Las direcciones IPv4
    mapeadas (``::ffff:a.b.c.d``) se reducen a IPv4. Un valor que no sea una IP se usa tal cual.
    """
    if not ip:
        return "desconocida"
    try:
        direccion = ipaddress.ip_address(ip.split("%", 1)[0])
    except ValueError:
        return ip[:64]
    if isinstance(direccion, ipaddress.IPv6Address):
        if direccion.ipv4_mapped is not None:
            return str(direccion.ipv4_mapped)
        return str(ipaddress.ip_network((direccion, 64), strict=False))
    return str(direccion)


_ip = clave_ip  # alias interno


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


def cuenta_saturada(db: Session, usuario_id: int) -> bool:
    """``True`` si la cuenta acumuló demasiados fallos en la ventana, sumando todas las redes."""
    s = get_settings()
    desde = ahora() - timedelta(minutes=s.login_cuenta_ventana_minutos)
    fallos = db.execute(
        select(func.count())
        .select_from(AuditoriaAcceso)
        .where(
            AuditoriaAcceso.usuario_id == usuario_id,
            AuditoriaAcceso.accion.in_(ACCIONES_FALLO),
            AuditoriaAcceso.fecha >= desde,
        )
    ).scalar_one()
    return fallos >= s.login_cuenta_max_fallos


def red_conocida(db: Session, usuario_id: int, ip: str | None) -> bool:
    """``True`` si la cuenta tuvo un login correcto desde esa red en los últimos N días."""
    s = get_settings()
    desde = ahora() - timedelta(days=s.login_ip_conocida_dias)
    previas = db.execute(
        select(AuditoriaAcceso.ip)
        .where(
            AuditoriaAcceso.usuario_id == usuario_id,
            AuditoriaAcceso.accion == "login_ok",
            AuditoriaAcceso.fecha >= desde,
        )
        .distinct()
    ).scalars()
    clave = clave_ip(ip)
    return any(clave_ip(previa) == clave for previa in previas)
