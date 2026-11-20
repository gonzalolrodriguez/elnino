"""Ruta de la cuadrilla hacia el pedido y modo demostración (CLAUDE.md §8.3, §8.6).

``ruta_hacia`` reutiliza el ruteo existente (``app.servicios.ruteo.resolver_ruta``: pgRouting sobre
``red_vial`` excluyendo caminos cerrados y anegados del escenario vigente) y devuelve el trazado como
coordenadas ``[lon, lat]``. Sin red vial (o sin ruta) usa la recta por el factor de desvío
(``metodo: aproximado``); la lancha va siempre en línea recta porque el río no está en la red.

Modo demostración (``seguimiento_demo`` en ``supuestos.yaml``, SIMULADO): con la tarea en curso y sin
posición real, el vehículo se ubica sobre la ruta desde una base SIMULADA según el tiempo
transcurrido y la velocidad supuesta. Una posición real siempre gana sobre la simulada.
"""

from __future__ import annotations

import json
import logging
import math
import threading
import time
from dataclasses import dataclass
from datetime import datetime

from shapely.geometry import LineString
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.db.base import ahora
from app.db.modelos import LecturaHidrometrica
from app.domain import ruteo as dom
from app.servicios import contexto
from app.servicios import ruteo as srv_ruteo

log = logging.getLogger(__name__)

MAX_PUNTOS = 300
TTL_CACHE_S = 60.0
CELDA_CACHE_GRADOS = 0.00045  # ~50 m: el origen se redondea a esta celda para reusar la ruta
_MAX_CACHE = 500

Punto = tuple[float, float]  # (lon, lat)


@dataclass(frozen=True)
class Ruta:
    coordenadas: list[list[float]]  # [[lon, lat], ...] (<= MAX_PUNTOS)
    distancia_m: float  # por la red (o aproximada), la que se usa para la llegada
    metodo: str  # red_vial | aproximado
    velocidad_kmh: float
    calculada_en: datetime

    @property
    def distancia_km(self) -> float:
        return round(self.distancia_m / 1000, 2)

    @property
    def llegada_estimada_min(self) -> int:
        return minutos(self.distancia_m, self.velocidad_kmh)

    def a_dict(self, progreso: float = 0.0, simulada: bool = False) -> dict:
        """Forma pública (contrato del recorrido animado); ``distancia_km`` y la llegada son lo que
        falta por recorrer."""
        restante = self.distancia_m * (1 - progreso)
        return {
            "coordenadas": self.coordenadas,
            "distancia_km": round(restante / 1000, 2),
            "llegada_estimada_min": minutos(restante, self.velocidad_kmh),
            "metodo": self.metodo,
            "simulada": simulada,
            "progreso": round(progreso, 4),
            "velocidad_kmh": self.velocidad_kmh,
            "calculada_en": self.calculada_en.isoformat(),
        }


def minutos(distancia_m: float, velocidad_kmh: float) -> int:
    if distancia_m <= 0:
        return 0
    return math.ceil(distancia_m / (velocidad_kmh * 1000 / 60))


# ---- geometría ----------------------------------------------------------------------------------


def _d(a: Punto | list[float], b: Punto | list[float]) -> float:
    return dom.haversine_m(a[0], a[1], b[0], b[1])


def _largo_m(coords: list[list[float]]) -> float:
    return sum(_d(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def _encadenar(origen: Punto, aristas: list[list[list[float]]]) -> list[list[float]]:
    """Une las aristas en el orden de la ruta orientando cada una en el sentido del viaje.

    ``ST_LineMerge`` no garantiza el sentido de recorrido, así que se vuelve a armar acá: cada arista
    se da vuelta si su inicio queda más lejos del fin de la anterior que su fin.
    """
    resultado: list[list[float]] = []
    for i, pts in enumerate(aristas):
        if i == 0:
            if len(aristas) > 1:
                sig = [aristas[1][0], aristas[1][-1]]
                if min(_d(pts[0], e) for e in sig) < min(_d(pts[-1], e) for e in sig):
                    pts = pts[::-1]
            elif _d(pts[0], origen) > _d(pts[-1], origen):
                pts = pts[::-1]
        elif _d(pts[0], resultado[-1]) > _d(pts[-1], resultado[-1]):
            pts = pts[::-1]
        resultado.extend(p for p in pts if not resultado or p != resultado[-1])
    return resultado


def _simplificar(coords: list[list[float]]) -> list[list[float]]:
    """Douglas-Peucker con tolerancia creciente hasta quedar en ``MAX_PUNTOS`` o menos."""
    if len(coords) <= MAX_PUNTOS:
        return coords
    linea = LineString(coords)
    tolerancia = 1e-6
    while tolerancia < 1:
        simple = list(linea.simplify(tolerancia, preserve_topology=False).coords)
        if len(simple) <= MAX_PUNTOS:
            return [[x, y] for x, y in simple]
        tolerancia *= 2
    return [coords[0], coords[-1]]  # inalcanzable en la práctica


def punto_en(coords: list[list[float]], fraccion: float) -> Punto:
    """Punto a ``fraccion`` (0..1) del largo de la línea."""
    if fraccion <= 0 or len(coords) == 1:
        return coords[0][0], coords[0][1]
    if fraccion >= 1:
        return coords[-1][0], coords[-1][1]
    objetivo = _largo_m(coords) * fraccion
    recorrido = 0.0
    for a, b in zip(coords, coords[1:], strict=False):
        tramo = _d(a, b)
        if tramo > 0 and recorrido + tramo >= objetivo:
            t = (objetivo - recorrido) / tramo
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        recorrido += tramo
    return coords[-1][0], coords[-1][1]


# ---- cálculo de la ruta -----------------------------------------------------------------------


def _perfil(vehiculo: str | None) -> str | None:
    """Perfil de ruteo del vehículo; ``None`` = sin red (la lancha va por el río)."""
    if vehiculo == "lancha":
        return None
    return dom.CAMION_JAULA if vehiculo == "camion_jaula" else dom.VEHICULAR


def _velocidad(vehiculo: str | None) -> float:
    if vehiculo == "lancha":
        return float(supuesto("velocidad_lancha_kmh"))
    return float(supuesto("velocidad_cuadrilla_kmh"))


def _altura_observada(db: Session) -> float | None:
    """Última lectura válida de Puerto Formosa (el estado observado; sin lluvia ni cierres propios)."""
    valor = db.execute(
        select(LecturaHidrometrica.valor_m)
        .where(
            LecturaHidrometrica.estacion_codigo == contexto.ESTACION_FORMOSA,
            LecturaHidrometrica.calidad == "valido",
        )
        .order_by(LecturaHidrometrica.timestart.desc())
        .limit(1)
    ).scalar_one_or_none()
    return None if valor is None else float(valor)


def _aristas(db: Session, ids: list[int]) -> list[list[list[float]]]:
    filas = {
        int(i): json.loads(g)
        for i, g in db.execute(
            text("SELECT id, ST_AsGeoJSON(geom) FROM red_vial WHERE id = ANY(CAST(:ids AS int[]))"),
            {"ids": ids},
        ).all()
    }
    salida = []
    for i in ids:
        geo = filas.get(i)
        if geo is None:
            continue
        partes = geo["coordinates"] if geo["type"] == "MultiLineString" else [geo["coordinates"]]
        salida.append([[p[0], p[1]] for parte in partes for p in parte])
    return salida


def _por_red(
    db: Session, perfil: str, origen: Punto, destino: Punto, escenario: dict | None
) -> tuple[list[list[float]], float] | None:
    escenario = escenario or {}
    altura = escenario.get("altura_m")
    if altura is None:
        altura = _altura_observada(db)
    r = srv_ruteo.resolver_ruta(
        db,
        perfil,
        origen,
        destino,
        altura_m=altura,
        lluvia_mm=float(escenario.get("lluvia_mm", 0.0)),
        caminos_cerrados=set(escenario.get("caminos_cerrados", ())),
    )
    if not r["encontrada"] or r["metodo"] != "pgrouting":
        return None
    aristas = _aristas(db, [t["arista_id"] for t in r["tramos"]])
    coords = [[origen[0], origen[1]], *_encadenar(origen, aristas), [destino[0], destino[1]]]
    return coords, float(r["distancia_m"])


def calcular_ruta(
    db: Session,
    origen: Punto,
    destino: Punto,
    vehiculo: str | None = None,
    escenario: dict | None = None,
) -> Ruta:
    """Ruta por la red vial o, si no hay, la recta por el factor de desvío (``aproximado``)."""
    perfil = _perfil(vehiculo)
    resultado = None
    if perfil is not None:
        try:
            with db.begin_nested():  # un fallo de la consulta no deja la transacción abortada
                resultado = _por_red(db, perfil, origen, destino, escenario)
        except Exception:  # noqa: BLE001 - la ruta es accesoria: nunca debe romper la pantalla
            log.exception("No se pudo calcular la ruta por la red vial; se usa la aproximada")
    if resultado is not None:
        coords, distancia = resultado
        metodo = "red_vial"
    else:
        recta = _d(origen, destino)
        factor = 1.0 if perfil is None else float(supuesto("factor_desvio"))
        coords = [[origen[0], origen[1]], [destino[0], destino[1]]]
        distancia, metodo = recta * factor, "aproximado"
    coords = [[round(x, 6), round(y, 6)] for x, y in coords]
    return Ruta(_simplificar(coords), distancia, metodo, _velocidad(vehiculo), ahora())


_cache: dict[tuple, tuple[float, Ruta]] = {}
_candado = threading.Lock()


def limpiar_cache() -> None:
    with _candado:
        _cache.clear()


def ruta_hacia(
    db: Session,
    origen: Punto,
    destino: Punto,
    escenario: dict | None = None,
    *,
    vehiculo: str | None = None,
    clave: object = None,
) -> Ruta:
    """Ruta con caché de ~60 s por (``clave``, origen redondeado a ~50 m, destino, vehículo).

    ``escenario`` (opcional): ``{"altura_m", "lluvia_mm", "caminos_cerrados"}``; sin él se usa el
    estado observado (última altura de Puerto Formosa, sin lluvia, con los caminos que el operador
    tiene marcados como no transitables).
    """
    k = (
        clave,
        round(origen[0] / CELDA_CACHE_GRADOS),
        round(origen[1] / CELDA_CACHE_GRADOS),
        round(destino[0], 5),
        round(destino[1], 5),
        vehiculo,
    )
    ahora_m = time.monotonic()
    with _candado:
        hit = _cache.get(k)
        if hit is not None and ahora_m - hit[0] < TTL_CACHE_S:
            return hit[1]
    ruta = calcular_ruta(db, origen, destino, vehiculo, escenario)
    with _candado:
        if len(_cache) >= _MAX_CACHE:
            _cache.clear()
        _cache[k] = (ahora_m, ruta)
    return ruta


# ---- modo demostración ------------------------------------------------------------------------


def demo_activo() -> bool:
    return bool(supuesto("seguimiento_demo"))


def base_simulada() -> Punto:
    b = supuesto("base_cuadrillas_simulada")
    return float(b["lon"]), float(b["lat"])


@dataclass(frozen=True)
class Simulacion:
    ruta: Ruta
    progreso: float
    lon: float
    lat: float

    @property
    def distancia_restante_m(self) -> float:
        return self.ruta.distancia_m * (1 - self.progreso)


def simular(
    db: Session,
    destino: Punto,
    vehiculo: str | None,
    inicio: datetime,
    ahora_: datetime,
    clave: object,
    origen: Punto | None = None,
) -> Simulacion:
    """Posición simulada: la ruta desde la base y lo recorrido a la velocidad supuesta (tope: llegada).

    ``origen``: base propia de la cuadrilla (``cuadrillas.base``); sin ella, la base simulada global.
    """
    ruta = ruta_hacia(
        db, origen or base_simulada(), destino, vehiculo=vehiculo, clave=("demo", clave)
    )
    segundos = max(0.0, (ahora_ - inicio).total_seconds())
    recorrido_m = segundos * ruta.velocidad_kmh * 1000 / 3600
    progreso = 1.0 if ruta.distancia_m <= 0 else min(1.0, recorrido_m / ruta.distancia_m)
    lon, lat = punto_en(ruta.coordenadas, progreso)
    return Simulacion(ruta, progreso, lon, lat)
