"""Lluvia: lecturas, importación y exportación de la planilla (CLAUDE.md §8.8, §9 · Datos)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import auditoria
from app.core.rbac import ip_cliente, requiere_rol
from app.db.modelos import LecturaLluvia, PuestoPluviometrico, Usuario
from app.db.sesion import get_db
from app.servicios import lluvia as srv

router = APIRouter(prefix="/lluvia", tags=["lluvia"])
_MANDOS = ("operador", "decisor", "admin")
NOTA = (
    "El kit no incluye lluvia observada: las lecturas son de partes cargados o de demostración, "
    "siempre con su origen."
)


def _a_http(exc: srv.ErrorLluvia) -> HTTPException:
    return HTTPException(exc.estado, exc.mensaje)


class LecturaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    puesto: str = Field(min_length=2, max_length=40, description="Código del puesto")
    fecha: date
    turno: Literal["07", "17"]
    mm: float | None = Field(
        default=None, description="mm de lluvia; null = sin medición (no es 0)"
    )
    origen: Literal["parte_policial", "carga_manual", "simulado"] = "carga_manual"


def _lectura_a_dict(lec: LecturaLluvia, p: PuestoPluviometrico) -> dict:
    return {
        "id": lec.id,
        "puesto": p.codigo,
        "puesto_nombre": p.nombre,
        "zona": p.zona,
        "fecha": lec.fecha.isoformat(),
        "turno": lec.turno,
        "mm": None if lec.mm is None else float(lec.mm),
        "origen": lec.origen,
        "categoria": lec.categoria,
        "fuente": lec.fuente,
        "fecha_dato": lec.fecha.isoformat(),
    }


@router.get("")
def listar(
    desde: date | None = None,
    hasta: date | None = None,
    puesto: str | None = Query(default=None, max_length=40),
    origen: str | None = Query(default=None, max_length=20),
    limite: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> dict:
    consulta = (
        select(LecturaLluvia, PuestoPluviometrico)
        .join(PuestoPluviometrico, PuestoPluviometrico.id == LecturaLluvia.puesto_id)
        .order_by(LecturaLluvia.fecha.desc(), LecturaLluvia.turno.desc(), LecturaLluvia.id.desc())
        .limit(limite)
    )
    if desde:
        consulta = consulta.where(LecturaLluvia.fecha >= desde)
    if hasta:
        consulta = consulta.where(LecturaLluvia.fecha <= hasta)
    if puesto:
        consulta = consulta.where(PuestoPluviometrico.codigo == puesto.upper())
    if origen:
        consulta = consulta.where(LecturaLluvia.origen == origen)
    lecturas = [_lectura_a_dict(lec, p) for lec, p in db.execute(consulta).all()]
    return {
        "lecturas": lecturas,
        "n": len(lecturas),
        "sin_dato_observado": not any(x["categoria"] != "SIMULADO" for x in lecturas),
        "nota": NOTA,
    }


@router.get("/puestos")
def puestos(db: Session = Depends(get_db)) -> dict:
    filas = db.execute(select(PuestoPluviometrico).order_by(PuestoPluviometrico.codigo)).scalars()
    return {
        "puestos": [
            {
                "codigo": p.codigo,
                "nombre": p.nombre,
                "zona": p.zona,
                "lon": to_shape(p.geom).x,
                "lat": to_shape(p.geom).y,
                "categoria": p.categoria,
                "fuente": p.fuente,
                "fecha_dato": p.fecha_dato.isoformat() if p.fecha_dato else None,
            }
            for p in filas
        ]
    }


@router.post("", status_code=201)
def cargar(
    datos: LecturaIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    try:
        lectura, advertencias = srv.registrar_lectura(
            db, datos.puesto, datos.fecha, datos.turno, datos.mm, datos.origen
        )
    except srv.ErrorLluvia as exc:
        db.rollback()
        raise _a_http(exc) from exc
    auditoria.registrar(
        db, "lluvia_cargada", f"lecturas_lluvia/{lectura.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    p = srv.buscar_puesto(db, datos.puesto)
    return {**_lectura_a_dict(lectura, p), "advertencias": advertencias}


@router.post("/importar-planilla")
def importar(
    request: Request,
    archivo: UploadFile = File(..., description="Planilla_Precipitaciones_Formosa.xlsx"),
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    contenido = archivo.file.read(srv.MAX_BYTES_PLANILLA + 1)
    try:
        resultado = srv.importar_planilla(db, contenido)
    except srv.ErrorLluvia as exc:
        db.rollback()
        raise _a_http(exc) from exc
    auditoria.registrar(
        db,
        "lluvia_planilla_importada",
        "lecturas_lluvia",
        usuario.id,
        ip_cliente(request),
        f"insertadas={resultado['insertadas']}",
    )
    db.commit()
    return resultado


@router.get("/exportar")
def exportar(
    anio_hidrologico: int = Query(
        default=2026, ge=2000, le=2100, description="Año en que empieza (sep)"
    ),
    departamento: str | None = Query(default=None, max_length=60),
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> Response:
    datos = srv.exportar_planilla(db, anio_hidrologico, departamento)
    return Response(
        content=datos,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="lluvia_{anio_hidrologico}-{anio_hidrologico + 1}.xlsx"'
        },
    )
