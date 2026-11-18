"""Bitácora de accesos con hash encadenado (SHA-256).

Cada fila guarda ``hash_anterior`` (el hash de la fila previa; la primera usa 64 ceros) y
``hash = SHA-256(hash_anterior | usuario | acción | recurso | ip | detalle | fecha UTC)``.
Alterar o borrar una fila rompe la cadena y ``verificar_cadena`` lo detecta.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.base import ahora
from app.db.modelos import AuditoriaAcceso

HASH_GENESIS = "0" * 64
_LOCK_ID = 7_300_001  # candado consultivo para serializar escrituras de la cadena


def calcular_hash(
    hash_anterior: str,
    usuario_id: int | None,
    accion: str,
    recurso: str,
    ip: str | None,
    detalle: str | None,
    fecha: datetime,
) -> str:
    partes = [
        hash_anterior,
        "" if usuario_id is None else str(usuario_id),
        accion,
        recurso,
        ip or "",
        detalle or "",
        fecha.astimezone(UTC).isoformat(),
    ]
    return hashlib.sha256("|".join(partes).encode("utf-8")).hexdigest()


def registrar(
    db: Session,
    accion: str,
    recurso: str,
    usuario_id: int | None = None,
    ip: str | None = None,
    detalle: str | None = None,
) -> AuditoriaAcceso:
    """Agrega una fila a la cadena dentro de la transacción actual (el llamador hace commit)."""
    db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": _LOCK_ID})
    ultimo = db.execute(
        select(AuditoriaAcceso.hash).order_by(AuditoriaAcceso.id.desc()).limit(1)
    ).scalar_one_or_none()
    anterior = ultimo or HASH_GENESIS
    fecha = ahora()
    fila = AuditoriaAcceso(
        usuario_id=usuario_id,
        accion=accion,
        recurso=recurso,
        ip=ip,
        detalle=detalle,
        fecha=fecha,
        hash_anterior=anterior,
        hash=calcular_hash(anterior, usuario_id, accion, recurso, ip, detalle, fecha),
    )
    db.add(fila)
    db.flush()
    return fila


def verificar_cadena(db: Session) -> tuple[bool, int | None]:
    """Devuelve (íntegra, id de la primera fila inconsistente)."""
    anterior = HASH_GENESIS
    filas = db.execute(select(AuditoriaAcceso).order_by(AuditoriaAcceso.id)).scalars()
    for f in filas:
        esperado = calcular_hash(
            anterior, f.usuario_id, f.accion, f.recurso, f.ip, f.detalle, f.fecha
        )
        if f.hash_anterior != anterior or f.hash != esperado:
            return False, f.id
        anterior = f.hash
    return True, None
