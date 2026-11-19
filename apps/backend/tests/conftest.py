"""Fixtures compartidas.

Las pruebas que usan la base de datos corren contra una base separada (por defecto
``evacuaciones_test`` en el mismo servidor que ``DATABASE_URL``; se puede fijar otra con
``TEST_DATABASE_URL``). Al iniciar la sesión de pruebas se recrea el esquema ``public``, se aplican
las migraciones y se cargan los seeds. Si no hay base disponible, esas pruebas se omiten.
"""

import base64
import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest

# Variables de entorno deterministas, antes de importar la aplicación.
os.environ["JWT_SECRET"] = "secreto-jwt-solo-para-pruebas-0123456789abcdef"
os.environ["FIELD_ENCRYPTION_KEY"] = base64.b64encode(b"k" * 32).decode("ascii")
os.environ["DEMO_PASSWORD"] = "ClaveDemoPruebas2026"
os.environ["COOKIE_SECURE"] = "false"
os.environ["SEED_DEMO"] = "true"
os.environ["RATE_LIMIT_ACTIVO"] = "false"
os.environ["LOGIN_MAX_INTENTOS"] = "5"
os.environ["CANAL_HMAC_SECRET"] = "secreto-canales-solo-para-pruebas"

from app.config.settings import get_settings  # noqa: E402

get_settings.cache_clear()
_URL_ORIGINAL = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not _URL_ORIGINAL:
    _URL_ORIGINAL = get_settings().database_url


def _url_de_prueba() -> str:
    if os.environ.get("TEST_DATABASE_URL"):
        return os.environ["TEST_DATABASE_URL"]
    partes = urlsplit(_URL_ORIGINAL)
    return urlunsplit(partes._replace(path="/evacuaciones_test"))


URL_PRUEBA = _url_de_prueba()
os.environ["DATABASE_URL"] = URL_PRUEBA
get_settings.cache_clear()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]


def _preparar_base() -> None:
    partes = urlsplit(URL_PRUEBA)
    nombre = partes.path.lstrip("/")
    admin_url = urlunsplit(partes._replace(path="/postgres"))
    with psycopg.connect(admin_url, autocommit=True, connect_timeout=3) as conn:
        existe = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (nombre,)).fetchone()
        if not existe:
            conn.execute(f'CREATE DATABASE "{nombre}"')
    with psycopg.connect(URL_PRUEBA, autocommit=True, connect_timeout=3) as conn:
        conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
        conn.execute("CREATE SCHEMA public")
        conn.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        conn.execute("CREATE EXTENSION IF NOT EXISTS pgrouting")

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    command.upgrade(cfg, "head")

    from app.db.seed import sembrar_todo
    from app.db.sesion import get_sessionmaker

    with get_sessionmaker()() as db:
        sembrar_todo(db)


@pytest.fixture(scope="session")
def base_de_datos():
    try:
        _preparar_base()
    except psycopg.OperationalError as exc:
        pytest.skip(f"Base de datos de pruebas no disponible: {exc}")
    return URL_PRUEBA


@pytest.fixture
def db(base_de_datos):
    from app.db.sesion import get_sessionmaker

    with get_sessionmaker()() as sesion:
        yield sesion


@pytest.fixture
def client(base_de_datos):
    with TestClient(app) as c:
        yield c


def correo_unico(prefijo: str = "u") -> str:
    return f"{prefijo}-{uuid.uuid4().hex[:10]}@pruebas.evacuaciones.invalid"


PASSWORD_VALIDA = "ClaveSegura-2026!"


def datos_ciudadano(**extra) -> dict:
    base = {
        "email": correo_unico("ciu"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Ciudadano de Prueba",
        "consentimiento": True,
    }
    base.update(extra)
    return base


def iniciar_sesion(client: TestClient, email: str, password: str, movil: bool = True):
    cabeceras = {"X-Cliente": "movil"} if movil else {}
    return client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers=cabeceras
    )


def clave_demo(clave: str) -> str:
    """Contraseña de un usuario de demostración: el admin usa DEMO_ADMIN_PASSWORD si está definida."""
    if clave == "admin":
        return os.environ.get("DEMO_ADMIN_PASSWORD") or os.environ["DEMO_PASSWORD"]
    return os.environ["DEMO_PASSWORD"]


@pytest.fixture
def token_admin(client):
    r = iniciar_sesion(client, "admin@demo.evacuaciones.invalid", clave_demo("admin"))
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


DEMO = {
    "admin": "admin@demo.evacuaciones.invalid",
    "decisor": "decisor@demo.evacuaciones.invalid",
    "operador": "operador@demo.evacuaciones.invalid",
    "cuadrilla": "cuadrilla@demo.evacuaciones.invalid",
    "ciudadano1": "ciudadano1@demo.evacuaciones.invalid",
    "ciudadano2": "ciudadano2@demo.evacuaciones.invalid",
    "productor1": "productor1@demo.evacuaciones.invalid",
    "productor2": "productor2@demo.evacuaciones.invalid",
}


def cabecera_demo(client: TestClient, clave: str) -> dict:
    """Authorization de un usuario de demostración (ver ``DEMO``)."""
    r = iniciar_sesion(client, DEMO[clave], clave_demo(clave))
    assert r.status_code == 200, r.text
    return bearer(r.json()["access_token"])


@pytest.fixture
def como(client):
    """``como("operador")`` devuelve la cabecera Authorization de ese usuario de demostración."""
    cache: dict[str, dict] = {}

    def _como(clave: str) -> dict:
        if clave not in cache:
            cache[clave] = cabecera_demo(client, clave)
        return cache[clave]

    return _como
