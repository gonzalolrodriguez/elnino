"""Escenario de simulación (CLAUDE.md §8.1): lógica pura, sin I/O.

Entradas: altura de Puerto Formosa, lluvia y caminos cerrados por el operador. Salidas: estado del
río frente a los umbrales de K3, estado de cada sector de K10, estado de cada acceso y sectores
aislados. Todos los umbrales de lluvia y el margen de riesgo vienen de ``supuestos.yaml``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from app.domain import isad

COMPROMETIDO = "comprometido"
EN_RIESGO = "en_riesgo"
NORMAL = "normal"

ACCESO_CERRADO_OPERADOR = "cerrado_operador"
ACCESO_INTRANSITABLE_LLUVIA = "intransitable_lluvia"
ACCESO_ANEGADO = "anegado"
ACCESO_TRANSITABLE = "transitable"

RIO_NORMAL = "normal"
RIO_ALERTA = "alerta"
RIO_EVACUACION = "evacuacion"


def _d(valor: float | Decimal | str) -> Decimal:
    """Decimal con dos cifras (las alturas de la escala tienen centímetros): evita errores de
    punto flotante al comparar, p. ej. 8,10 - 0,50 contra 7,60."""
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class SectorEntrada:
    id: str
    nombre: str
    altura_compromiso_m: float
    poblacion_simulada: int


@dataclass(frozen=True)
class AccesoEntrada:
    id: int
    sector_id: str
    nombre: str
    superficie: str  # pavimento | ripio | tierra
    transitable: bool = True  # marca persistente del operador (PATCH /accesos/{id})
    motivo: str | None = None


@dataclass(frozen=True)
class UmbralesRio:
    aguas_bajas_m: float
    alerta_m: float
    evacuacion_m: float


@dataclass(frozen=True)
class Parametros:
    margen_riesgo_m: float
    lluvia_tierra_mm: float
    lluvia_ripio_mm: float


@dataclass
class AccesoEstado:
    id: int
    sector_id: str
    nombre: str
    superficie: str
    estado: str
    motivo: str | None = None


@dataclass
class SectorEstado:
    id: str
    nombre: str
    estado: str
    aislado: bool
    altura_compromiso_m: float
    margen_a_compromiso_m: float  # compromiso - altura (negativo si ya está comprometido)
    poblacion_simulada: int
    accesos: list[AccesoEstado] = field(default_factory=list)
    isad: dict | None = None


@dataclass
class Escenario:
    altura_m: float
    lluvia_mm: float
    rio: dict
    sectores: list[SectorEstado]

    def sector(self, sector_id: str) -> SectorEstado:
        return next(s for s in self.sectores if s.id == sector_id)

    @property
    def resumen(self) -> dict[str, list[str]]:
        return {
            "comprometidos": [s.id for s in self.sectores if s.estado == COMPROMETIDO],
            "en_riesgo": [s.id for s in self.sectores if s.estado == EN_RIESGO],
            "normales": [s.id for s in self.sectores if s.estado == NORMAL],
            "aislados": [s.id for s in self.sectores if s.aislado],
        }


def estado_sector(altura_m: float, compromiso_m: float, margen_riesgo_m: float) -> str:
    """``comprometido`` si altura >= compromiso; ``en_riesgo`` si altura >= compromiso - margen."""
    altura, compromiso, margen = _d(altura_m), _d(compromiso_m), _d(margen_riesgo_m)
    if altura >= compromiso:
        return COMPROMETIDO
    if altura >= compromiso - margen:
        return EN_RIESGO
    return NORMAL


def estado_rio(altura_m: float, umbrales: UmbralesRio) -> dict:
    """Estado frente a K3 y distancia (m de escala) a cada umbral (negativa si ya lo superó)."""
    altura = _d(altura_m)
    if altura >= _d(umbrales.evacuacion_m):
        estado = RIO_EVACUACION
    elif altura >= _d(umbrales.alerta_m):
        estado = RIO_ALERTA
    else:
        estado = RIO_NORMAL
    return {
        "estado": estado,
        "altura_m": float(altura),
        "umbral_alerta_m": umbrales.alerta_m,
        "umbral_evacuacion_m": umbrales.evacuacion_m,
        "distancia_a_alerta_m": float(_d(umbrales.alerta_m) - altura),
        "distancia_a_evacuacion_m": float(_d(umbrales.evacuacion_m) - altura),
    }


def estado_acceso(
    acceso: AccesoEntrada,
    sector_estado: str,
    lluvia_mm: float,
    caminos_cerrados: set[int],
    parametros: Parametros,
) -> tuple[str, str | None]:
    """Estado del acceso y motivo. Prioridad: cierre del operador, lluvia, anegamiento."""
    if acceso.id in caminos_cerrados:
        return ACCESO_CERRADO_OPERADOR, "Cerrado en esta simulación por el operador"
    if not acceso.transitable:
        return ACCESO_CERRADO_OPERADOR, acceso.motivo or "Marcado no transitable por el operador"
    if acceso.superficie == "tierra" and lluvia_mm >= parametros.lluvia_tierra_mm:
        return (
            ACCESO_INTRANSITABLE_LLUVIA,
            f"Camino de tierra con {lluvia_mm:g} mm (umbral {parametros.lluvia_tierra_mm:g} mm)",
        )
    if acceso.superficie == "ripio" and lluvia_mm >= parametros.lluvia_ripio_mm:
        return (
            ACCESO_INTRANSITABLE_LLUVIA,
            f"Camino de ripio con {lluvia_mm:g} mm (umbral {parametros.lluvia_ripio_mm:g} mm)",
        )
    if sector_estado == COMPROMETIDO and acceso.superficie == "tierra":
        return ACCESO_ANEGADO, "Sector comprometido y acceso de tierra"
    return ACCESO_TRANSITABLE, None


def calcular_escenario(
    altura_m: float,
    lluvia_mm: float,
    sectores: list[SectorEntrada],
    accesos: list[AccesoEntrada],
    umbrales: UmbralesRio,
    parametros: Parametros,
    caminos_cerrados: set[int] | None = None,
    humedad_suelo: float | None = None,
) -> Escenario:
    cerrados = caminos_cerrados or set()
    resultado: list[SectorEstado] = []
    for sec in sorted(sectores, key=lambda s: s.id):
        estado = estado_sector(altura_m, sec.altura_compromiso_m, parametros.margen_riesgo_m)
        estados_acceso = []
        for a in (x for x in accesos if x.sector_id == sec.id):
            est, motivo = estado_acceso(a, estado, lluvia_mm, cerrados, parametros)
            estados_acceso.append(
                AccesoEstado(a.id, a.sector_id, a.nombre, a.superficie, est, motivo)
            )
        aislado = bool(estados_acceso) and all(
            a.estado != ACCESO_TRANSITABLE for a in estados_acceso
        )
        resultado.append(
            SectorEstado(
                id=sec.id,
                nombre=sec.nombre,
                estado=estado,
                aislado=aislado,
                altura_compromiso_m=sec.altura_compromiso_m,
                margen_a_compromiso_m=float(_d(sec.altura_compromiso_m) - _d(altura_m)),
                poblacion_simulada=sec.poblacion_simulada,
                accesos=estados_acceso,
                isad=isad.calcular(
                    sec.id,
                    altura_m=altura_m,
                    compromiso_m=sec.altura_compromiso_m,
                    aguas_bajas_m=umbrales.aguas_bajas_m,
                    lluvia_mm=lluvia_mm,
                    humedad_suelo=humedad_suelo,
                ),
            )
        )
    return Escenario(
        altura_m=float(_d(altura_m)),
        lluvia_mm=lluvia_mm,
        rio=estado_rio(altura_m, umbrales),
        sectores=resultado,
    )
