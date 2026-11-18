"""Carga desde la base de los datos que necesita el motor y arma el escenario.

Los módulos de ``app.domain`` no hacen I/O: esta capa lee sectores, accesos, estaciones y la serie
K1, y se los entrega. Las respuestas con cifras llevan ``categoria``, ``fuente`` y ``fecha_dato``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from geoalchemy2.shape import to_shape
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.db.modelos import (
    Acceso,
    CentroRecepcion,
    Estacion,
    LecturaHidrometrica,
    RecursoSimulado,
    Sector,
)
from app.domain import escenario as esc

ESTACION_FORMOSA = 57
FUENTE_K10 = "K10 · K10_sectores_simulados.geojson"


@dataclass(frozen=True)
class SectorGeo:
    id: str
    nombre: str
    altura_compromiso_m: float
    poblacion_simulada: int
    lon: float  # centroide
    lat: float


@dataclass(frozen=True)
class CentroGeo:
    id: int
    nombre: str
    tipo: str
    lon: float
    lat: float
    capacidad_personas: int
    capacidad_animales: int
    ocupacion: int

    @property
    def cupo_personas(self) -> int:
        return max(self.capacidad_personas - self.ocupacion, 0)

    @property
    def cupo_animales(self) -> int:
        return self.capacidad_animales


def parametros() -> esc.Parametros:
    return esc.Parametros(
        margen_riesgo_m=float(supuesto("margen_riesgo_m")),
        lluvia_tierra_mm=float(supuesto("umbral_lluvia_camino_tierra_mm")),
        lluvia_ripio_mm=float(supuesto("umbral_lluvia_camino_ripio_mm")),
    )


def estacion_formosa(db: Session) -> Estacion:
    estacion = db.get(Estacion, ESTACION_FORMOSA)
    if estacion is None:
        raise RuntimeError("Falta la estación de Puerto Formosa (K3): correr el seed")
    return estacion


def umbrales_formosa(db: Session) -> esc.UmbralesRio:
    e = estacion_formosa(db)
    return esc.UmbralesRio(float(e.aguas_bajas_m), float(e.alerta_m), float(e.evacuacion_m))


def cargar_sectores(db: Session) -> list[SectorGeo]:
    filas = db.execute(select(Sector).order_by(Sector.id)).scalars().all()
    resultado = []
    for s in filas:
        c = to_shape(s.geom).centroid
        resultado.append(
            SectorGeo(s.id, s.nombre, float(s.altura_compromiso_m), s.poblacion_simulada, c.x, c.y)
        )
    return resultado


def cargar_accesos(db: Session) -> list[esc.AccesoEntrada]:
    filas = db.execute(select(Acceso).order_by(Acceso.id)).scalars().all()
    return [
        esc.AccesoEntrada(a.id, a.sector_id, a.nombre, a.superficie, a.transitable, a.motivo)
        for a in filas
    ]


def accesos_faltantes(db: Session, ids: list[int]) -> list[int]:
    """Ids de ``ids`` que no existen en ``accesos``."""
    if not ids:
        return []
    existentes = set(db.execute(select(Acceso.id).where(Acceso.id.in_(set(ids)))).scalars())
    return sorted(set(ids) - existentes)


def cargar_centros(db: Session) -> list[CentroGeo]:
    filas = db.execute(select(CentroRecepcion).order_by(CentroRecepcion.id)).scalars().all()
    resultado = []
    for c in filas:
        p = to_shape(c.geom)
        resultado.append(
            CentroGeo(
                c.id,
                c.nombre,
                c.tipo,
                p.x,
                p.y,
                c.capacidad_personas,
                c.capacidad_animales,
                c.ocupacion,
            )
        )
    return resultado


def cargar_recursos(db: Session) -> dict[str, dict]:
    filas = db.execute(select(RecursoSimulado)).scalars().all()
    return {
        r.tipo: {"cantidad": r.cantidad, "capacidad_unitaria": r.capacidad_unitaria or 0}
        for r in filas
    }


def serie_diaria(
    db: Session, desde: date | None = None, hasta: date | None = None
) -> dict[date, float]:
    """Máximo diario de las lecturas válidas de Puerto Formosa (sin interpolar huecos)."""
    dia = func.date(LecturaHidrometrica.timestart)
    consulta = (
        select(dia, func.max(LecturaHidrometrica.valor_m))
        .where(
            LecturaHidrometrica.estacion_codigo == ESTACION_FORMOSA,
            LecturaHidrometrica.calidad == "valido",
        )
        .group_by(dia)
        .order_by(dia)
    )
    if desde:
        consulta = consulta.where(dia >= desde)
    if hasta:
        consulta = consulta.where(dia <= hasta)
    return {d: float(v) for d, v in db.execute(consulta).all()}


def ultima_lectura(serie: dict[date, float]) -> tuple[date, float]:
    ultimo = max(serie)
    return ultimo, serie[ultimo]


def calcular_escenario(
    db: Session,
    altura_m: float,
    lluvia_mm: float = 0.0,
    caminos_cerrados: set[int] | None = None,
    humedad_suelo: float | None = None,
) -> esc.Escenario:
    sectores = [
        esc.SectorEntrada(s.id, s.nombre, s.altura_compromiso_m, s.poblacion_simulada)
        for s in cargar_sectores(db)
    ]
    return esc.calcular_escenario(
        altura_m,
        lluvia_mm,
        sectores,
        cargar_accesos(db),
        umbrales_formosa(db),
        parametros(),
        caminos_cerrados,
        humedad_suelo,
    )


def escenario_a_dict(e: esc.Escenario) -> dict:
    """Serialización del escenario (sin los envoltorios de categoría)."""
    return {
        "rio": e.rio,
        "sectores": [
            {
                "id": s.id,
                "nombre": s.nombre,
                "estado": s.estado,
                "aislado": s.aislado,
                "altura_compromiso_m": s.altura_compromiso_m,
                "margen_a_compromiso_m": s.margen_a_compromiso_m,
                "poblacion_simulada": s.poblacion_simulada,
                "accesos": [
                    {
                        "id": a.id,
                        "nombre": a.nombre,
                        "superficie": a.superficie,
                        "estado": a.estado,
                        "motivo": a.motivo,
                    }
                    for a in s.accesos
                ],
                "isad": s.isad,
                "categoria": "SIMULADO",
                "fuente": FUENTE_K10,
            }
            for s in e.sectores
        ],
        "resumen": e.resumen,
    }
