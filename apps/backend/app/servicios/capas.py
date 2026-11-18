"""Lectura de las capas territoriales oficiales de ``data/geo/`` (solo lectura)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from app.config.settings import DATA_DIR

FUENTE_CURSOS = "IGN, Capas SIG (cursos de agua de Formosa), descarga del 17/11/2026"
FUENTE_LOCALIDADES = "BAHRA / INDEC vía API Georef (centroide del asentamiento)"
NOMBRES_RIOS = ("Paraguay", "Pilcomayo", "Bermejo")


def _leer(ruta: Path) -> dict | None:
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


@lru_cache(maxsize=4)
def cursos_principales(carpeta: str | None = None) -> dict[str, BaseGeometry]:
    """Une las entidades de cada río principal (Paraguay, Pilcomayo, Bermejo) en una geometría."""
    datos = _leer(Path(carpeta or DATA_DIR / "geo") / "cursos_agua.geojson")
    if not datos:
        return {}
    por_nombre: dict[str, list[BaseGeometry]] = {n: [] for n in NOMBRES_RIOS}
    for f in datos.get("features", []):
        nombre = (f.get("properties") or {}).get("nombre")
        if nombre in por_nombre and f.get("geometry"):
            por_nombre[nombre].append(shape(f["geometry"]))
    return {n: unary_union(g) for n, g in por_nombre.items() if g}


@lru_cache(maxsize=4)
def localidad(nombre: str, carpeta: str | None = None) -> Point | None:
    """Punto (centroide BAHRA) de una localidad por nombre exacto; ``None`` si no está."""
    datos = _leer(Path(carpeta or DATA_DIR / "geo") / "localidades_parajes.geojson")
    for f in (datos or {}).get("features", []):
        if (f.get("properties") or {}).get("nombre") == nombre and f.get("geometry"):
            lon, lat = f["geometry"]["coordinates"][:2]
            return Point(lon, lat)
    return None
