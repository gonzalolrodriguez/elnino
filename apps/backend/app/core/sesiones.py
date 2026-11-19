"""Emisión, rotación y revocación de refresh tokens (guardados solo como hash)."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.core.bloqueo import clave_ip
from app.core.seguridad import generar_refresh_token, hash_refresh_token
from app.db.base import ahora
from app.db.modelos import SesionRefresh


def emitir_refresh(
    db: Session, usuario_id: int, cliente: str, familia: str | None = None
) -> tuple[str, SesionRefresh]:
    token = generar_refresh_token()
    sesion = SesionRefresh(
        usuario_id=usuario_id,
        familia=familia or uuid.uuid4().hex,
        token_hash=hash_refresh_token(token),
        cliente=cliente,
        expira_en=ahora() + timedelta(days=get_settings().refresh_token_dias),
    )
    db.add(sesion)
    db.flush()
    return token, sesion


def buscar_por_token(db: Session, token: str) -> SesionRefresh | None:
    return db.execute(
        select(SesionRefresh).where(SesionRefresh.token_hash == hash_refresh_token(token))
    ).scalar_one_or_none()


def revocar_familia(db: Session, familia: str) -> int:
    resultado = db.execute(
        update(SesionRefresh)
        .where(SesionRefresh.familia == familia, SesionRefresh.revocado_en.is_(None))
        .values(revocado_en=ahora())
    )
    return resultado.rowcount or 0


def revocar_todas(db: Session, usuario_id: int) -> int:
    """Revoca todas las sesiones activas del usuario (cambio de contraseña, baja)."""
    resultado = db.execute(
        update(SesionRefresh)
        .where(SesionRefresh.usuario_id == usuario_id, SesionRefresh.revocado_en.is_(None))
        .values(revocado_en=ahora())
    )
    return resultado.rowcount or 0


def consumir(db: Session, sesion_id: int) -> bool:
    """Marca la sesión como usada de forma atómica.

    ``UPDATE ... WHERE revocado_en IS NULL`` y ``rowcount``: de dos refresh simultáneos con el mismo
    token solo uno actualiza la fila (el otro espera el bloqueo de fila y luego no coincide), así
    que solo uno obtiene una sesión nueva.
    """
    resultado = db.execute(
        update(SesionRefresh)
        .where(SesionRefresh.id == sesion_id, SesionRefresh.revocado_en.is_(None))
        .values(revocado_en=ahora())
    )
    return resultado.rowcount == 1


def en_gracia(db: Session, sesion: SesionRefresh, ip: str | None, cliente: str) -> bool:
    """Autoriza (y consume) el único reintento de gracia de un token rotado.

    Todas las condiciones deben cumplirse; si falla alguna, es una reutilización (robo):
    1. el propio token no venció;
    2. fue rotado hace menos de ``REFRESH_GRACIA_SEGUNDOS`` (máx. 30);
    3. la reutilización viene del mismo cliente (``X-Cliente``) y de la misma red (IPv4 o /64) que
       la rotación;
    4. su sucesor sigue activo (no hubo logout ni revocación);
    5. la gracia no se usó antes: se marca de forma atómica (``UPDATE ... WHERE gracia_usada_en IS
       NULL``) y solo gana una solicitud; una segunda reutilización dentro de la ventana es robo.
    """
    gracia = min(get_settings().refresh_gracia_segundos, 30)
    ahora_ = ahora()
    if (
        gracia <= 0
        or sesion.revocado_en is None
        or sesion.reemplazado_por is None
        or sesion.expira_en <= ahora_
        or ahora_ - sesion.revocado_en > timedelta(seconds=gracia)
        or sesion.rotada_cliente != cliente
        or sesion.rotada_ip != clave_ip(ip)
    ):
        return False
    sucesor = db.execute(
        select(SesionRefresh).where(SesionRefresh.id == sesion.reemplazado_por).with_for_update()
    ).scalar_one_or_none()
    if sucesor is None or sucesor.revocado_en is not None or sucesor.expira_en <= ahora_:
        return False
    usada = db.execute(
        update(SesionRefresh)
        .where(SesionRefresh.id == sesion.id, SesionRefresh.gracia_usada_en.is_(None))
        .values(gracia_usada_en=ahora_)
    )
    return usada.rowcount == 1


def reemplazar_sucesor(db: Session, sesion: SesionRefresh) -> bool:
    """Revoca el sucesor vigente de ``sesion`` (queda una sola sesión viva por familia).

    Devuelve ``True`` solo si revocó exactamente una fila: si otra solicitud ya lo reemplazó
    (rowcount 0) quien llama debe tratar el pedido como reutilización.
    """
    resultado = db.execute(
        update(SesionRefresh)
        .where(SesionRefresh.id == sesion.reemplazado_por, SesionRefresh.revocado_en.is_(None))
        .values(revocado_en=ahora())
    )
    return resultado.rowcount == 1
