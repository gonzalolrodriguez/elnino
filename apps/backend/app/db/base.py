"""Base declarativa y utilidades comunes de los modelos."""

from datetime import UTC, datetime

from sqlalchemy.orm import DeclarativeBase

SRID = 4326  # WGS84 (EPSG:4326)


class Base(DeclarativeBase):
    pass


def ahora() -> datetime:
    return datetime.now(UTC)
