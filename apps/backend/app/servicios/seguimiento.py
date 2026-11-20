"""Seguimiento de la cuadrilla en camino (CLAUDE.md §8.6, §8.7).

Guarda solo la última posición de cada cuadrilla (``posiciones_cuadrilla``) y solo mientras alguna
de sus tareas está ``en_curso``. La ven únicamente el solicitante de esa tarea y los roles
operativos. Todo es SIMULADO en la demo y la llegada es una estimación con supuestos explícitos.
"""

from __future__ import annotations

from datetime import timedelta

from geoalchemy2 import WKTElement
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.db.base import SRID, ahora
from app.db.modelos import (
    Cuadrilla,
    IntegranteCuadrilla,
    PosicionCuadrilla,
    SolicitudAsistencia,
    Tarea,
)
from app.domain import seguimiento as dom

CATEGORIA = "SIMULADO"
FUENTE = "Posición compartida por la cuadrilla desde la app (SIMULADO en la demo)"
NOTA_ESTIMACION = (
    "Es una estimación: línea recta por un factor de desvío y una velocidad media (SUPUESTO). "
    "No es una promesa de llegada."
)


def supuestos_usados() -> dict:
    return {
        "factor_desvio": supuesto("factor_desvio"),
        "velocidad_cuadrilla_kmh": supuesto("velocidad_cuadrilla_kmh"),
        "posicion_vieja_minutos": supuesto("posicion_vieja_minutos"),
        "fuente": "SUPUESTO (ver supuestos.yaml)",
    }


def cuadrillas_con_tarea_en_curso(db: Session, cuadrillas: list[int]) -> list[int]:
    if not cuadrillas:
        return []
    return sorted(
        db.execute(
            select(Tarea.cuadrilla_id)
            .where(Tarea.cuadrilla_id.in_(cuadrillas), Tarea.estado == "en_curso")
            .distinct()
        ).scalars()
    )


def registrar_posicion(
    db: Session, cuadrilla_id: int, lat: float, lon: float, precision_m: float | None
) -> int | None:
    """Guarda (pisa) la posición de la cuadrilla.

    Devuelve ``None`` si se guardó o los segundos que faltan para poder enviar otra (rate limit por
    cuadrilla). La fila se bloquea para que dos envíos simultáneos no se salteen el límite.
    """
    previa = db.execute(
        select(PosicionCuadrilla)
        .where(PosicionCuadrilla.cuadrilla_id == cuadrilla_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    ahora_ = ahora()
    if previa is not None:
        minimo = timedelta(seconds=float(supuesto("intervalo_min_posicion_s")))
        espera = minimo - (ahora_ - previa.registrada_en)
        if espera > timedelta(0):
            return max(1, int(espera.total_seconds()) + 1)
    punto = WKTElement(f"POINT({lon} {lat})", srid=SRID)
    if previa is None:
        db.add(
            PosicionCuadrilla(
                cuadrilla_id=cuadrilla_id,
                geom=punto,
                precision_m=precision_m,
                registrada_en=ahora_,
                categoria=CATEGORIA,
            )
        )
    else:
        previa.geom = punto
        previa.precision_m = precision_m
        previa.registrada_en = ahora_
    db.flush()
    return None


def purgar_si_sin_en_curso(db: Session, cuadrilla_id: int | None) -> None:
    """Borra la posición cuando la cuadrilla ya no tiene tareas en curso (retención mínima)."""
    if cuadrilla_id is None:
        return
    hay = db.execute(
        select(func.count(Tarea.id)).where(
            Tarea.cuadrilla_id == cuadrilla_id, Tarea.estado == "en_curso"
        )
    ).scalar_one()
    if hay == 0:
        db.execute(delete(PosicionCuadrilla).where(PosicionCuadrilla.cuadrilla_id == cuadrilla_id))


def _roles(db: Session, cuadrilla_id: int) -> list[str]:
    return sorted(
        set(
            db.execute(
                select(IntegranteCuadrilla.rol_operativo).where(
                    IntegranteCuadrilla.cuadrilla_id == cuadrilla_id
                )
            ).scalars()
        )
    )


def _posicion(db: Session, cuadrilla_id: int):
    return db.execute(
        select(
            func.ST_X(PosicionCuadrilla.geom),
            func.ST_Y(PosicionCuadrilla.geom),
            PosicionCuadrilla.precision_m,
            PosicionCuadrilla.registrada_en,
        ).where(PosicionCuadrilla.cuadrilla_id == cuadrilla_id)
    ).first()


def seguimiento_de(db: Session, usuario_id: int) -> list[dict]:
    """Seguimiento de los pedidos propios con una tarea en curso (nunca los de otra persona)."""
    filas = db.execute(
        select(
            Tarea,
            SolicitudAsistencia,
            Cuadrilla.tipo_incidente,
            func.ST_X(SolicitudAsistencia.geom),
            func.ST_Y(SolicitudAsistencia.geom),
        )
        .join(SolicitudAsistencia, SolicitudAsistencia.id == Tarea.solicitud_id)
        .join(Cuadrilla, Cuadrilla.id == Tarea.cuadrilla_id)
        .where(SolicitudAsistencia.solicitante_id == usuario_id, Tarea.estado == "en_curso")
        .order_by(Tarea.id.desc())
    ).all()
    factor = float(supuesto("factor_desvio"))
    velocidad = float(supuesto("velocidad_cuadrilla_kmh"))
    limite = float(supuesto("posicion_vieja_minutos"))
    ahora_ = ahora()
    items = []
    for tarea, solicitud, tipo, plon, plat in filas:
        pos = _posicion(db, tarea.cuadrilla_id)
        item: dict = {
            "solicitud_id": solicitud.id,
            "tarea_id": tarea.id,
            "tipo_cuadrilla": tipo,
            "roles": _roles(db, tarea.cuadrilla_id),
            "estado": "en_camino" if pos else "asignada_sin_posicion",
            "posicion": None,
            "actualizada_en": None,
            "posicion_vieja": None,
            "distancia_m": None,
            "llegada_estimada_min": None,
            "categoria": CATEGORIA,
            "fuente": FUENTE,
            "supuestos": supuestos_usados(),
            "nota": NOTA_ESTIMACION,
        }
        if pos:
            lon, lat, precision, registrada = pos
            item["posicion"] = {"lat": lat, "lon": lon, "precision_m": precision}
            item["actualizada_en"] = registrada.isoformat()
            item["posicion_vieja"] = dom.posicion_vieja(registrada, ahora_, limite)
            if plon is not None and plat is not None:
                est = dom.estimar(lon, lat, plon, plat, factor, velocidad)
                item["distancia_m"] = est.distancia_m
                item["llegada_estimada_min"] = est.llegada_estimada_min
        items.append(item)
    return items


def posiciones_operativas(db: Session) -> list[dict]:
    """Última posición de cada cuadrilla con tarea en curso (solo roles operativos)."""
    filas = db.execute(
        select(
            Cuadrilla.id,
            Cuadrilla.nombre,
            Cuadrilla.tipo_incidente,
            func.ST_X(PosicionCuadrilla.geom),
            func.ST_Y(PosicionCuadrilla.geom),
            PosicionCuadrilla.precision_m,
            PosicionCuadrilla.registrada_en,
        )
        .join(PosicionCuadrilla, PosicionCuadrilla.cuadrilla_id == Cuadrilla.id)
        .where(Cuadrilla.id.in_(select(Tarea.cuadrilla_id).where(Tarea.estado == "en_curso")))
        .order_by(Cuadrilla.id)
    ).all()
    limite = float(supuesto("posicion_vieja_minutos"))
    ahora_ = ahora()
    return [
        {
            "cuadrilla_id": cid,
            "nombre": nombre,
            "tipo_incidente": tipo,
            "roles": _roles(db, cid),
            "lat": lat,
            "lon": lon,
            "precision_m": precision,
            "actualizada_en": registrada.isoformat(),
            "posicion_vieja": dom.posicion_vieja(registrada, ahora_, limite),
            "tareas_en_curso": db.execute(
                select(func.count(Tarea.id)).where(
                    Tarea.cuadrilla_id == cid, Tarea.estado == "en_curso"
                )
            ).scalar_one(),
            "categoria": CATEGORIA,
        }
        for cid, nombre, tipo, lon, lat, precision, registrada in filas
    ]
