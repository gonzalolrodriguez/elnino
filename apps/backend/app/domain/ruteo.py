"""Ruteo bimodal (CLAUDE.md §8.3): perfiles, costos y estimación aproximada. Lógica pura.

El cálculo con red (pgRouting) vive en ``app.db.ruteo``; acá están las reglas de cada perfil y la
alternativa cuando no hay red cargada: distancia hasta el mejor acceso transitable más la línea
recta al destino multiplicada por el factor de desvío (SUPUESTO 1,3).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.config.settings import supuesto

VEHICULAR = "vehicular"
CAMION_JAULA = "camion_jaula"
ARREO = "arreo"
PERFILES = (VEHICULAR, CAMION_JAULA, ARREO)

LIMITACION_APROXIMADA = (
    "No hay red vial cargada (o no alcanza al origen y al destino): la distancia es la del acceso "
    "más cercano transitable más la línea recta × factor de desvío {factor:g} (SUPUESTO). "
    "No es un recorrido real; no usar para trazar rutas."
)

_RADIO_TIERRA_M = 6_371_000.0


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _RADIO_TIERRA_M * math.asin(math.sqrt(a))


def velocidades(perfil: str) -> dict[str, float]:
    """Velocidad media (km/h) por superficie para el perfil; sin la superficie = no se usa."""
    todas: dict[str, dict[str, float]] = supuesto("velocidad_kmh")
    if perfil not in todas:
        raise ValueError(f"Perfil desconocido: {perfil}")
    return dict(todas[perfil])


def tiempo_min(distancia_m: float, velocidad_kmh: float) -> float:
    return round(distancia_m / (velocidad_kmh * 1000 / 60), 1)


@dataclass(frozen=True)
class AccesoCandidato:
    id: int
    nombre: str
    superficie: str
    distancia_origen_m: float  # desde el origen hasta el acceso


@dataclass(frozen=True)
class Aproximacion:
    distancia_m: float
    tiempo_min: float
    acceso: AccesoCandidato | None
    linea_recta_m: float
    factor_desvio: float
    limitacion: str


def estimar_aproximado(
    perfil: str,
    linea_recta_m: float,
    accesos_transitables: list[AccesoCandidato] | None,
) -> Aproximacion | None:
    """Estimación sin red.

    ``accesos_transitables`` son los accesos del sector de origen que siguen transitables. ``None``
    significa que el origen no está en ningún sector (no hay acceso que respetar): se usa la
    velocidad de ripio del perfil. Una lista vacía o sin superficie utilizable para el perfil
    significa sector aislado y devuelve ``None``.
    """
    vel = velocidades(perfil)
    factor = float(supuesto("factor_desvio"))
    if accesos_transitables is None:
        distancia = linea_recta_m * factor
        return Aproximacion(
            distancia_m=round(distancia, 1),
            tiempo_min=tiempo_min(distancia, vel["ripio"]),
            acceso=None,
            linea_recta_m=round(linea_recta_m, 1),
            factor_desvio=factor,
            limitacion=LIMITACION_APROXIMADA.format(factor=factor),
        )
    utilizables = [a for a in accesos_transitables if a.superficie in vel]
    if not utilizables:
        return None
    mejor = min(utilizables, key=lambda a: (a.distancia_origen_m, a.id))
    distancia = mejor.distancia_origen_m + linea_recta_m * factor
    return Aproximacion(
        distancia_m=round(distancia, 1),
        tiempo_min=tiempo_min(distancia, vel[mejor.superficie]),
        acceso=mejor,
        linea_recta_m=round(linea_recta_m, 1),
        factor_desvio=factor,
        limitacion=LIMITACION_APROXIMADA.format(factor=factor),
    )
