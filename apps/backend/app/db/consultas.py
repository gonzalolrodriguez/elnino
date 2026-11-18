"""Consultas espaciales reutilizables."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.base import SRID
from app.db.modelos import Sector


def sector_de_punto(db: Session, lon: float, lat: float) -> str | None:
    """Sector K10 que contiene el punto (``None`` si cae fuera de todos)."""
    return db.execute(
        select(Sector.id)
        .where(func.ST_Intersects(Sector.geom, func.ST_SetSRID(func.ST_MakePoint(lon, lat), SRID)))
        .order_by(Sector.id)
        .limit(1)
    ).scalar_one_or_none()
