"""Operación: cuadrillas, tareas y órdenes (CLAUDE.md §8.6, §8.7, §9 · Operación)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import auditoria
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.db.base import ahora
from app.db.modelos import (
    Cuadrilla,
    IntegranteCuadrilla,
    Orden,
    RolOperativo,
    Tarea,
    Usuario,
)
from app.db.sesion import get_db
from app.domain import cuadrillas as dom
from app.servicios import contexto
from app.servicios import ordenes as srv_ordenes
from app.servicios.mi import sectores_de_usuario

router = APIRouter(tags=["operacion"])
_MANDOS = ("operador", "decisor", "admin")


# ---- cuadrillas ---------------------------------------------------------------------------------


class IntegranteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rol_operativo: str = Field(min_length=2, max_length=60)
    usuario_id: int | None = None


class CuadrillaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str = Field(min_length=2, max_length=120)
    tipo_incidente: Literal["humana", "ganadera", "apicola"]
    integrantes: list[IntegranteIn] = Field(default_factory=list, max_length=30)


def _cuadrilla_a_dict(db: Session, c: Cuadrilla) -> dict:
    integrantes = (
        db.execute(select(IntegranteCuadrilla).where(IntegranteCuadrilla.cuadrilla_id == c.id))
        .scalars()
        .all()
    )
    roles = [i.rol_operativo for i in integrantes]
    return {
        "id": c.id,
        "nombre": c.nombre,
        "tipo_incidente": c.tipo_incidente,
        "estado": c.estado,
        "integrantes": [
            {"rol_operativo": i.rol_operativo, "usuario_id": i.usuario_id} for i in integrantes
        ],
        "plantilla_sugerida": dom.plantilla(c.tipo_incidente),
        "roles_faltantes": dom.roles_faltantes(c.tipo_incidente, roles),
        "categoria": "SIMULADO",
    }


@router.get("/cuadrillas")
def listar_cuadrillas(
    _: Usuario = Depends(requiere_rol(*_MANDOS)), db: Session = Depends(get_db)
) -> dict:
    filas = db.execute(select(Cuadrilla).order_by(Cuadrilla.id)).scalars().all()
    return {
        "cuadrillas": [_cuadrilla_a_dict(db, c) for c in filas],
        "plantillas": dom.PLANTILLAS,
    }


@router.post("/cuadrillas", status_code=201)
def crear_cuadrilla(
    datos: CuadrillaIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    for i in datos.integrantes:
        if db.get(RolOperativo, i.rol_operativo) is None:
            raise HTTPException(422, f"rol_operativo desconocido: {i.rol_operativo}")
        if i.usuario_id is not None and db.get(Usuario, i.usuario_id) is None:
            raise HTTPException(422, f"usuario_id inexistente: {i.usuario_id}")
    cuadrilla = Cuadrilla(nombre=datos.nombre, tipo_incidente=datos.tipo_incidente)
    db.add(cuadrilla)
    db.flush()
    for i in datos.integrantes:
        db.add(
            IntegranteCuadrilla(
                cuadrilla_id=cuadrilla.id, usuario_id=i.usuario_id, rol_operativo=i.rol_operativo
            )
        )
    auditoria.registrar(
        db, "cuadrilla_creada", f"cuadrillas/{cuadrilla.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    return _cuadrilla_a_dict(db, cuadrilla)


# ---- tareas -------------------------------------------------------------------------------------

ESTADOS_TAREA = ("pendiente", "en_curso", "completada", "cancelada")
SIGUIENTE_TAREA = {"pendiente": {"en_curso", "cancelada"}, "en_curso": {"completada", "cancelada"}}


def _tarea_a_dict(t: Tarea) -> dict:
    return {
        "id": t.id,
        "cuadrilla_id": t.cuadrilla_id,
        "solicitud_id": t.solicitud_id,
        "orden_id": t.orden_id,
        "sector_id": t.sector_id,
        "titulo": t.titulo,
        "descripcion": t.descripcion,
        "estado": t.estado,
        "checklist": t.checklist,
        "creado_en": t.creado_en.isoformat(),
        "actualizado_en": t.actualizado_en.isoformat(),
    }


def _cuadrillas_de(db: Session, usuario: Usuario) -> list[int]:
    return list(
        db.execute(
            select(IntegranteCuadrilla.cuadrilla_id).where(
                IntegranteCuadrilla.usuario_id == usuario.id
            )
        ).scalars()
    )


@router.get("/tareas")
def listar_tareas(
    estado: str | None = Query(default=None, max_length=20),
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    consulta = select(Tarea).order_by(Tarea.id.desc()).limit(500)
    if usuario.rol == "cuadrilla":
        consulta = consulta.where(Tarea.cuadrilla_id.in_(_cuadrillas_de(db, usuario) or [-1]))
    if estado:
        consulta = consulta.where(Tarea.estado == estado)
    return {"tareas": [_tarea_a_dict(t) for t in db.execute(consulta).scalars()]}


class TareaPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: Literal["pendiente", "en_curso", "completada", "cancelada"] | None = None
    checklist: list[dict] | None = Field(default=None, max_length=50)
    cuadrilla_id: int | None = None


@router.patch("/tareas/{tarea_id}")
def actualizar_tarea(
    tarea_id: int,
    datos: TareaPatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    tarea = db.get(Tarea, tarea_id)
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    if usuario.rol == "cuadrilla":
        if tarea.cuadrilla_id not in _cuadrillas_de(db, usuario):
            raise HTTPException(404, "Tarea no encontrada")
        if datos.cuadrilla_id is not None:
            raise HTTPException(403, "Solo un operador reasigna tareas")
    if datos.estado and datos.estado != tarea.estado:
        if datos.estado not in SIGUIENTE_TAREA.get(tarea.estado, set()):
            raise HTTPException(409, f"Transición inválida: {tarea.estado} → {datos.estado}")
        tarea.estado = datos.estado
    if datos.checklist is not None:
        for item in datos.checklist:
            if set(item) - {"item", "hecho"} or not isinstance(item.get("hecho"), bool):
                raise HTTPException(422, "Cada ítem del checklist es {item: texto, hecho: boolean}")
        tarea.checklist = datos.checklist
    if datos.cuadrilla_id is not None:
        if db.get(Cuadrilla, datos.cuadrilla_id) is None:
            raise HTTPException(422, "Cuadrilla inexistente")
        tarea.cuadrilla_id = datos.cuadrilla_id
    tarea.actualizado_en = ahora()
    auditoria.registrar(
        db, "tarea_actualizada", f"tareas/{tarea.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    difusor.publicar(
        "tarea", {"id": tarea.id, "estado": tarea.estado, "cuadrilla_id": tarea.cuadrilla_id}
    )
    return _tarea_a_dict(tarea)


# ---- órdenes ------------------------------------------------------------------------------------


class OrdenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["alerta", "evacuacion_preventiva", "evacuacion"]
    sectores: list[str] = Field(min_length=1, max_length=10)
    fundamento: str = Field(min_length=10, max_length=2000)
    fecha_simulada: date | None = None


def _orden_a_dict(o: Orden) -> dict:
    return {
        "id": o.id,
        "tipo": o.tipo,
        "sectores": o.sectores,
        "emitida_por_rol": o.rol_operativo,
        "fundamento": o.fundamento,
        "creada_en": o.creada_en.isoformat(),
        "categoria": "SIMULADO",
    }


@router.post("/ordenes", status_code=201)
def emitir(
    datos: OrdenIn,
    request: Request,
    decisor: Usuario = Depends(requiere_rol("decisor")),
    db: Session = Depends(get_db),
) -> dict:
    conocidos = {s.id for s in contexto.cargar_sectores(db)}
    desconocidos = sorted(set(datos.sectores) - conocidos)
    if desconocidos:
        raise HTTPException(422, f"Sector desconocido: {', '.join(desconocidos)}")
    sectores = sorted(set(datos.sectores))
    orden, efectos = srv_ordenes.emitir_orden(
        db,
        decisor,
        datos.tipo,
        sectores,
        datos.fundamento.strip(),
        datos.fecha_simulada or date.today(),
    )
    auditoria.registrar(
        db,
        "orden_emitida",
        f"ordenes/{orden.id}",
        decisor.id,
        ip_cliente(request),
        f"{datos.tipo}:{','.join(sectores)}",
    )
    db.commit()
    difusor.publicar("orden", {"id": orden.id, "tipo": orden.tipo, "sectores": orden.sectores})
    if efectos["tareas_creadas"]:
        difusor.publicar(
            "tarea", {"motivo": "orden", "orden_id": orden.id, "creadas": efectos["tareas_creadas"]}
        )
    return {
        **_orden_a_dict(orden),
        **efectos,
        "nota": "La orden quedó registrada con su emisor (rol) y su borrador de bitácora.",
    }


@router.get("/ordenes")
def listar_ordenes(
    usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)
) -> dict:
    ordenes = db.execute(select(Orden).order_by(Orden.id.desc()).limit(200)).scalars().all()
    if usuario.rol in (*_MANDOS, "cuadrilla"):
        visibles = ordenes
    else:
        propios = sectores_de_usuario(db, usuario.id)
        visibles = [o for o in ordenes if propios & set(o.sectores)]
    return {"ordenes": [_orden_a_dict(o) for o in visibles]}
