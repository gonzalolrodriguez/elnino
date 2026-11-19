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
    # Límite por cuenta (todas las redes): umbral más alto que `login_max_intentos`.
    login_cuenta_max_fallos: int = 20
    login_cuenta_ventana_minutos: int = 15
    login_ip_conocida_dias: int = 30
    rate_limit_activo: bool = True
    rate_limit_login: str = "20/minute"
    rate_limit_registro: str = "10/minute"
    cookie_secure: bool = True

    # Entorno: "produccion" oculta /docs y /openapi.json y fuerza la cookie Secure.
    entorno: str = "desarrollo"
    # Usuarios de demostración (``python -m app.db.seed``): apagado por defecto (producción);
    # el docker-compose del demo lo enciende con SEED_DEMO=true.
    seed_demo: bool = False

    # Gracia de rotación del refresh (<= 30 s): un token recién rotado puede reutilizarse UNA vez,
    # desde el mismo cliente y la misma red, por un reintento tras perder la respuesta.
    refresh_gracia_segundos: int = 30
    # Cuota blanda de baja fricción para solicitudes de asistencia por persona usuaria.
    solicitudes_max_por_hora: int = 20
    adjuntos_max_bytes_por_usuario: int = 25 * 1024 * 1024
    # Tope global del cuerpo de cualquier solicitud (salvo subida de adjuntos y planilla).
    cuerpo_max_bytes: int = 1024 * 1024

    # Secreto compartido para firmar (HMAC SHA-256) los webhooks de los canales simulados.
    canal_hmac_secret: str = ""

    # Adjuntos de solicitudes (fotos): carpeta fuera de data/ (por defecto <raíz>/uploads, ignorada)
    # y límites de tamaño y cantidad.
    adjuntos_dir: str = ""
    adjunto_max_bytes: int = 2 * 1024 * 1024
    adjuntos_max_por_solicitud: int = 5

    # Contraseñas de los usuarios de demostración (solo para `python -m app.db.seed`).
    demo_password: str = ""
    demo_admin_password: str = ""

    @property
    def es_produccion(self) -> bool:
        return self.entorno.strip().lower() in ("produccion", "producción", "production", "prod")

    @property
    def cookie_segura(self) -> bool:
        """En producción la cookie del refresh siempre es Secure."""
        return True if self.es_produccion else self.cookie_secure

    @property
    def adjuntos_ruta(self) -> Path:
        return Path(self.adjuntos_dir) if self.adjuntos_dir else RAIZ_REPO / "uploads"

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
