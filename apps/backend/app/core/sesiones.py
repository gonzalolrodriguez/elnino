"""Emisión, rotación y revocación de refresh tokens (guardados solo como hash)."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config.settings import get_settings
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


def en_gracia(db: Session, sesion: SesionRefresh) -> bool:
    """``True`` si un token ya rotado se reutiliza dentro de la ventana de gracia.

    Cubre reintentos de red y varias pestañas que refrescan casi a la vez con el mismo token. Solo
    vale si el token fue **rotado** (tiene sucesor, no cerrado por logout o por reutilización) hace
    menos de ``REFRESH_GRACIA_SEGUNDOS`` y la familia sigue teniendo una sesión activa: después de
    un logout o de una revocación nadie puede reabrirla por esta vía.
    """
    gracia = get_settings().refresh_gracia_segundos
    if gracia <= 0 or sesion.revocado_en is None or sesion.reemplazado_por is None:
        return False
    if ahora() - sesion.revocado_en > timedelta(seconds=gracia):
        return False
    activa = db.execute(
        select(SesionRefresh.id)
        .where(
            SesionRefresh.familia == sesion.familia,
            SesionRefresh.revocado_en.is_(None),
            SesionRefresh.expira_en > ahora(),
        )
        .limit(1)
    ).first()
    return activa is not None
