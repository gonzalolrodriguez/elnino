"""Seguimiento de la cuadrilla: distancia y llegada estimada (lógica pura, sin I/O).

La distancia es la recta entre la cuadrilla y el pedido multiplicada por el factor de desvío, y la
llegada estimada es esa distancia dividida por una velocidad media. Todo es una **estimación** con
supuestos explícitos (``supuestos.yaml``), nunca una promesa de llegada.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from app.domain.ruteo import haversine_m


@dataclass(frozen=True)
class Estimacion:
    distancia_m: int
    llegada_estimada_min: int


def estimar(
    lon_cuadrilla: float,
    lat_cuadrilla: float,
    lon_pedido: float,
    lat_pedido: float,
    factor_desvio: float,
    velocidad_kmh: float,
) -> Estimacion:
    """Distancia por calle estimada (m) y minutos de llegada (se redondean hacia arriba)."""
    if velocidad_kmh <= 0 or factor_desvio < 1:
        raise ValueError("Velocidad y factor de desvío inválidos")
    recta = haversine_m(lon_cuadrilla, lat_cuadrilla, lon_pedido, lat_pedido)
    distancia = recta * factor_desvio
    minutos = distancia / (velocidad_kmh * 1000 / 60)
    return Estimacion(distancia_m=round(distancia), llegada_estimada_min=math.ceil(minutos))


def posicion_vieja(registrada_en: datetime, ahora: datetime, limite_min: float) -> bool:
    """Verdadero si pasaron más de ``limite_min`` minutos desde la última posición."""
    return (ahora - registrada_en).total_seconds() > limite_min * 60
