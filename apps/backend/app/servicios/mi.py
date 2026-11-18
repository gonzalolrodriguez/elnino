"""Consultas del área personal (``/mi/*``): sector propio y centro sugerido."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.modelos import Establecimiento, GrupoFamiliar, Sector


def sectores_de_usuario(db: Session, usuario_id: int) -> set[str]:
    """Sectores K10 donde está el domicilio o algún establecimiento del usuario."""
    domicilio = db.execute(
        select(Sector.id)
        .join(GrupoFamiliar, func.ST_Intersects(Sector.geom, GrupoFamiliar.domicilio))
        .where(GrupoFamiliar.usuario_id == usuario_id)
    ).scalars()
    campos = db.execute(
        select(Sector.id)
        .join(Establecimiento, func.ST_Intersects(Sector.geom, Establecimiento.geom_tranquera))
        .where(Establecimiento.productor_id == usuario_id)
    ).scalars()
    return set(domicilio) | set(campos)
