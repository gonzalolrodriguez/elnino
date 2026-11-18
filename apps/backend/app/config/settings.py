"""Configuración leída desde variables de entorno (ver .env.example)."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ_REPO = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(RAIZ_REPO / ".env", ".env"), extra="ignore"
    )

    database_url: str = "postgresql://evacuaciones:evacuaciones@localhost:5432/evacuaciones"
    cors_origins: str = "http://localhost:5173,http://localhost:8081"
    permitir_datos_post_corte: bool = False

    @property
    def cors_origins_lista(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def cargar_supuestos() -> dict:
    ruta = Path(__file__).with_name("supuestos.yaml")
    return yaml.safe_load(ruta.read_text(encoding="utf-8"))
