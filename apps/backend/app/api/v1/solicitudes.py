"""Solicitudes de asistencia (CLAUDE.md §9 · Solicitudes).

Estados: recibida → verificada → asignada → en_curso → resuelta (solo hacia adelante, de a uno).
La ciudadanía y los productores ven únicamente sus propias solicitudes.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import auditoria
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.db.base import SRID, ahora
from app.db.consultas import sector_de_punto
from app.db.modelos import Cuadrilla, SolicitudAsistencia, Tarea, Usuario
from app.db.sesion import get_db
from app.domain import cuadrillas

router = APIRouter(prefix="/solicitudes", tags=["solicitudes"])
_MANDOS = ("operador", "decisor", "admin")
ESTADOS = ("recibida", "verificada", "asignada", "en_curso", "resuelta")
TIPOS = ("evacuacion", "asistencia", "ganado", "logistica", "otro")


class SolicitudIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["evacuacion", "asistencia", "ganado", "logistica", "otro"]
    personas: int = Field(default=0, ge=0, le=500)
    animales: int = Field(default=0, ge=0, le=100000)
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    texto: str | None = Field(default=None, max_length=500)
    origen: Literal["app", "web"] = "web"


class SolicitudPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: Literal["verificada", "asignada", "en_curso", "resuelta"]
    cuadrilla_id: int | None = Field(default=None, description="Al pasar a 'asignada'")


def solicitud_a_dict(s: SolicitudAsistencia, con_ubicacion: bool = True) -> dict:
    punto = to_shape(s.geom) if s.geom is not None else None
    return {
        "id": s.id,
        "origen": s.origen,
        "tipo": s.tipo,
        "personas": s.personas,
        "animales": s.animales,
        "texto": s.texto,
        "estado": s.estado,
        "sector_id": s.sector_id,
        "lon": punto.x if (punto and con_ubicacion) else None,
        "lat": punto.y if (punto and con_ubicacion) else None,
        "detalle": s.detalle,
        "creado_en": s.creado_en.isoformat(),
        "actualizado_en": s.actualizado_en.isoformat(),
        "categoria": "SIMULADO",
    }


@router.post("", status_code=201)
def crear(
    datos: SolicitudIn,
    request: Request,
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
) -> dict:
    if datos.personas == 0 and datos.animales == 0 and not datos.texto:
        raise HTTPException(422, "Indicar personas, animales o un texto")
    solicitud = SolicitudAsistencia(
        solicitante_id=usuario.id,
        origen=datos.origen,
        tipo=datos.tipo,
        personas=datos.personas,
        animales=datos.animales,
        texto=datos.texto,
        geom=WKTElement(f"POINT({datos.lon} {datos.lat})", srid=SRID),
        sector_id=sector_de_punto(db, datos.lon, datos.lat),
    )
    db.add(solicitud)
    db.flush()
    auditoria.registrar(
        db, "solicitud_creada", f"solicitudes/{solicitud.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    difusor.publicar(
        "solicitud",
        {"id": solicitud.id, "estado": solicitud.estado, "sector_id": solicitud.sector_id},
        usuario.id,
    )
    return solicitud_a_dict(solicitud)


@router.get("")
def listar(
    request: Request,
    estado: str | None = Query(default=None, max_length=20),
    sector_id: str | None = Query(default=None, max_length=10),
    limite: int = Query(default=100, ge=1, le=500),
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    consulta = select(SolicitudAsistencia).order_by(SolicitudAsistencia.id.desc()).limit(limite)
    if usuario.rol in ("ciudadano", "productor"):
        consulta = consulta.where(SolicitudAsistencia.solicitante_id == usuario.id)
    else:
        auditoria.registrar(
            db, "lectura_datos_personales", "solicitudes", usuario.id, ip_cliente(request)
        )
        db.commit()
    if estado:
        consulta = consulta.where(SolicitudAsistencia.estado == estado)
    if sector_id:
        consulta = consulta.where(SolicitudAsistencia.sector_id == sector_id)
    filas = db.execute(consulta).scalars().all()
    return {"solicitudes": [solicitud_a_dict(s) for s in filas]}


@router.get("/{solicitud_id}")
def detalle(
    solicitud_id: int,
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    s = db.get(SolicitudAsistencia, solicitud_id)
    if s is None or (usuario.rol in ("ciudadano", "productor") and s.solicitante_id != usuario.id):
        raise HTTPException(404, "Solicitud no encontrada")
    return solicitud_a_dict(s)


@router.patch("/{solicitud_id}")
def actualizar(
    solicitud_id: int,
    datos: SolicitudPatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    s = db.get(SolicitudAsistencia, solicitud_id)
    if s is None:
        raise HTTPException(404, "Solicitud no encontrada")
    esperado = ESTADOS[ESTADOS.index(s.estado) + 1] if s.estado != "resuelta" else None
    if datos.estado != esperado:
        raise HTTPException(
            409,
            f"Transición inválida: {s.estado} → {datos.estado}"
            + (f" (el siguiente estado es {esperado})" if esperado else " (ya está resuelta)"),
        )
    s.estado = datos.estado
    s.actualizado_en = ahora()
    if datos.estado == "asignada":
        cuadrilla = db.get(Cuadrilla, datos.cuadrilla_id) if datos.cuadrilla_id else None
        if datos.cuadrilla_id and cuadrilla is None:
            raise HTTPException(422, "Cuadrilla inexistente")
        tipo = (
            cuadrilla.tipo_incidente
            if cuadrilla
            else ("ganadera" if s.animales and not s.personas else "humana")
        )
        db.add(
            Tarea(
                cuadrilla_id=cuadrilla.id if cuadrilla else None,
                solicitud_id=s.id,
                sector_id=s.sector_id,
                titulo=f"Atender solicitud #{s.id} ({s.tipo})",
                descripcion=s.texto,
                checklist=cuadrillas.checklist(tipo),
            )
        )
    auditoria.registrar(
        db,
        "solicitud_actualizada",
        f"solicitudes/{s.id}",
        usuario.id,
        ip_cliente(request),
        s.estado,
    )
    db.commit()
    difusor.publicar(
        "solicitud", {"id": s.id, "estado": s.estado, "sector_id": s.sector_id}, s.solicitante_id
    )
    if datos.estado == "asignada":
        difusor.publicar("tarea", {"motivo": "solicitud", "solicitud_id": s.id})
    return solicitud_a_dict(s)
