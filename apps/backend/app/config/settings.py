"""Configuración leída desde variables de entorno (ver .env.example)."""

import base64
import os
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

_RUTA = Path(__file__).resolve()
# En el repositorio: <raíz>/apps/backend/app/config/settings.py. En el contenedor la ruta es
# más corta (/srv/app/config/settings.py) y no hay raíz de repositorio: se usa DATA_DIR.
RAIZ_REPO = _RUTA.parents[4] if len(_RUTA.parents) > 4 else _RUTA.parents[-1]
# Carpeta `data/` (kit, processed, simulado, geo). Configurable con DATA_DIR para Docker.
DATA_DIR = Path(os.environ.get("DATA_DIR") or RAIZ_REPO / "data")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(RAIZ_REPO / ".env", ".env"), extra="ignore")

    database_url: str = "postgresql://evacuaciones:evacuaciones@localhost:5432/evacuaciones"
    cors_origins: str = "http://localhost:5173,http://localhost:8081"
    permitir_datos_post_corte: bool = False

    # Seguridad: los secretos no tienen valor por defecto utilizable.
    jwt_secret: str = ""
    field_encryption_key: str = ""
    access_token_minutos: int = 15
    refresh_token_dias: int = 7
    password_min_longitud: int = 10
    login_max_intentos: int = 5
    login_bloqueo_minutos: int = 15
    rate_limit_activo: bool = True
    rate_limit_login: str = "20/minute"
    rate_limit_registro: str = "10/minute"
    cookie_secure: bool = True

    # Secreto compartido para firmar (HMAC SHA-256) los webhooks de los canales simulados.
    canal_hmac_secret: str = ""

    # Contraseñas de los usuarios de demostración (solo para `python -m app.db.seed`).
    demo_password: str = ""
    demo_admin_password: str = ""

    @property
    def cors_origins_lista(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """URL con el driver psycopg 3 para SQLAlchemy."""
        url = self.database_url
        if url.startswith("postgresql://"):
            return "postgresql+psycopg://" + url[len("postgresql://") :]
        return url

    def secreto_canales(self) -> str:
        if len(self.canal_hmac_secret) < 16 or self.canal_hmac_secret.startswith("CAMBIAR"):
            raise RuntimeError("CANAL_HMAC_SECRET no configurado (mínimo 16 caracteres)")
        return self.canal_hmac_secret

    def secreto_jwt(self) -> str:
        if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("CAMBIAR"):
            raise RuntimeError("JWT_SECRET no configurado (mínimo 32 caracteres; ver .env.example)")
        return self.jwt_secret

    def clave_cifrado(self) -> bytes:
        try:
            clave = base64.b64decode(self.field_encryption_key, validate=True)
        except Exception as exc:
            raise RuntimeError("FIELD_ENCRYPTION_KEY debe ser base64 válido") from exc
        if len(clave) != 32:
            raise RuntimeError("FIELD_ENCRYPTION_KEY debe decodificar a exactamente 32 bytes")
        return clave


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def cargar_supuestos() -> dict:
    ruta = Path(__file__).with_name("supuestos.yaml")
    return yaml.safe_load(ruta.read_text(encoding="utf-8"))


def supuesto(nombre: str):
    """Valor de un supuesto de ``supuestos.yaml`` (cada entrada tiene ``valor`` y ``fuente``)."""
    return cargar_supuestos()[nombre]["valor"]
