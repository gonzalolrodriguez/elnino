"""Motor y sesión de SQLAlchemy (perezosos, para poder cambiar DATABASE_URL en pruebas)."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config.settings import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().sqlalchemy_url, pool_pre_ping=True)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por solicitud."""
    with get_sessionmaker()() as db:
        yield db
