"""Endpoints de salud y metadatos."""

import psycopg
from fastapi import APIRouter

from app.config.settings import get_settings
from app.core import constantes

router = APIRouter()


def _base_de_datos_disponible() -> bool:
    try:
        with psycopg.connect(get_settings().database_url, connect_timeout=2) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


@router.get("/salud")
def salud() -> dict:
    return {
        "estado": "ok",
        "servicio": "backend",
        "version": constantes.VERSION,
        "base_de_datos": "ok" if _base_de_datos_disponible() else "no_disponible",
    }


@router.get("/meta")
def meta() -> dict:
    return {
        "leyenda": constantes.LEYENDA,
        "categorias": constantes.CATEGORIAS,
        "limites": constantes.LIMITES,
        "fecha_corte": constantes.FECHA_CORTE,
        "flags": {"permitir_datos_post_corte": get_settings().permitir_datos_post_corte},
    }
