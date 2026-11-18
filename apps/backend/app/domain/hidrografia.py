"""Relaciones hidrográficas medidas sobre la capa de cursos de agua del IGN (lógica pura, sin I/O).

Sirve al verificador de K7: las geometrías se reciben ya cargadas. Las distancias son aproximadas
(proyección equirrectangular local); alcanzan para decidir si dos cursos se tocan.
"""

from __future__ import annotations

import math

from shapely.geometry import Point
from shapely.geometry.base import BaseGeometry
from shapely.ops import nearest_points

LATITUD_REFERENCIA = -26.0
KM_POR_GRADO_LAT = 110.57
KM_POR_GRADO_LON = 111.32 * math.cos(math.radians(LATITUD_REFERENCIA))


def _km_entre(a: Point, b: Point) -> float:
    return math.hypot((a.x - b.x) * KM_POR_GRADO_LON, (a.y - b.y) * KM_POR_GRADO_LAT)


def distancia_km(a: BaseGeometry, b: BaseGeometry) -> tuple[float, Point, Point]:
    """Distancia mínima entre dos geometrías (km) y los puntos más cercanos de cada una."""
    pa, pb = nearest_points(a, b)
    return _km_entre(pa, pb), pa, pb


def analizar(
    cursos: dict[str, BaseGeometry],
    clorinda: Point | None,
) -> dict | None:
    """Mide las relaciones que K7 afirma. ``cursos``: geometrías por nombre (Paraguay, etc.).

    Devuelve ``None`` si falta alguno de los tres cursos (la capa no alcanza para contrastar).
    """
    if not all(n in cursos for n in ("Paraguay", "Pilcomayo", "Bermejo")):
        return None
    paraguay, pilcomayo, bermejo = cursos["Paraguay"], cursos["Pilcomayo"], cursos["Bermejo"]
    pil_bermejo, _, _ = distancia_km(pilcomayo, bermejo)
    pil_paraguay, pil_punto, _ = distancia_km(pilcomayo, paraguay)
    ber_paraguay, ber_punto, _ = distancia_km(bermejo, paraguay)
    resultado: dict = {
        "pilcomayo_a_bermejo_km": round(pil_bermejo, 1),
        "pilcomayo_a_paraguay_km": round(pil_paraguay, 1),
        "pilcomayo_extremo_lat": round(pil_punto.y, 3),
        "bermejo_a_paraguay_km": round(ber_paraguay, 1),
        "bermejo_desembocadura_lat": round(ber_punto.y, 3),
        "bermejo_desembocadura_lon": round(ber_punto.x, 3),
        "clorinda_a_pilcomayo_km": None,
        "clorinda_a_paraguay_km": None,
    }
    if clorinda is not None:
        resultado["clorinda_a_pilcomayo_km"] = round(distancia_km(clorinda, pilcomayo)[0], 1)
        resultado["clorinda_a_paraguay_km"] = round(distancia_km(clorinda, paraguay)[0], 1)
    return resultado
