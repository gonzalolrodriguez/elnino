"""Operación: cuadrillas, tareas y órdenes (CLAUDE.md §8.6, §8.7, §9 · Operación)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import auditoria
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.core.tiempo import hoy_ar
from app.db.base import ahora
from app.db.modelos import (
    BitacoraDecision,
    Cuadrilla,
    IntegranteCuadrilla,
    Notificacion,
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
    limite: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    consulta = select(Tarea)
    if usuario.rol == "cuadrilla":
        consulta = consulta.where(Tarea.cuadrilla_id.in_(_cuadrillas_de(db, usuario) or [-1]))
    if estado:
        consulta = consulta.where(Tarea.estado == estado)
    total = db.execute(select(func.count()).select_from(consulta.subquery())).scalar_one()
    filas = db.execute(consulta.order_by(Tarea.id.desc()).limit(limite).offset(offset)).scalars()
    return {
        "tareas": [_tarea_a_dict(t) for t in filas],
        "total": total,
        "limite": limite,
        "offset": offset,
    }


class ItemChecklist(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item: str = Field(min_length=1, max_length=200)
    hecho: bool


class TareaPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: Literal["pendiente", "en_curso", "completada", "cancelada"] | None = None
    checklist: list[ItemChecklist] | None = Field(default=None, max_length=50)
    cuadrilla_id: int | None = None


@router.patch("/tareas/{tarea_id}")
def actualizar_tarea(
    tarea_id: int,
    datos: TareaPatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    # Fila bloqueada: dos actualizaciones simultáneas de la misma tarea se serializan y la segunda
    # valida la transición contra el estado ya cambiado.
    tarea = db.execute(
        select(Tarea)
        .where(Tarea.id == tarea_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    cuadrilla_previa = tarea.cuadrilla_id
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
        tarea.checklist = [i.model_dump() for i in datos.checklist]
    if datos.cuadrilla_id is not None:
        if db.get(Cuadrilla, datos.cuadrilla_id) is None:
            raise HTTPException(422, "Cuadrilla inexistente")
        tarea.cuadrilla_id = datos.cuadrilla_id
    tarea.actualizado_en = ahora()
    db.flush()
    # La cuadrilla queda ocupada mientras tenga tareas abiertas y se libera al cerrar la última.
    if tarea.estado in srv_ordenes.ESTADOS_TAREA_ABIERTA:
        srv_ordenes.marcar_ocupada(db, tarea.cuadrilla_id)
    srv_ordenes.liberar_si_sin_tareas(db, tarea.cuadrilla_id)
    if cuadrilla_previa != tarea.cuadrilla_id:
        srv_ordenes.liberar_si_sin_tareas(db, cuadrilla_previa)
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


def _efectos_de(db: Session, orden: Orden) -> dict:
    """Efectos ya guardados de una orden (para devolverla de nuevo en un reintento)."""
    return {
        "notificaciones_creadas": db.execute(
            select(func.count(Notificacion.id)).where(Notificacion.orden_id == orden.id)
        ).scalar_one(),
        "tareas_creadas": db.execute(
            select(func.count(Tarea.id)).where(Tarea.orden_id == orden.id)
        ).scalar_one(),
        "bitacora_borrador_id": db.execute(
            select(BitacoraDecision.id).where(BitacoraDecision.orden_id == orden.id).limit(1)
        ).scalar_one_or_none(),
    }


def _orden_previa(db: Session, decisor_id: int, clave: str) -> Orden | None:
    return db.execute(
        select(Orden).where(Orden.emitida_por == decisor_id, Orden.idempotency_key == clave)
    ).scalar_one_or_none()


@router.post("/ordenes", status_code=201)
def emitir(
    datos: OrdenIn,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    decisor: Usuario = Depends(requiere_rol("decisor")),
    db: Session = Depends(get_db),
) -> dict:
    clave = None
    if idempotency_key is not None:
        try:
            clave = str(uuid.UUID(idempotency_key))
        except ValueError:
            raise HTTPException(422, "Idempotency-Key debe ser un UUID") from None
        previa = _orden_previa(db, decisor.id, clave)
        if previa is not None:  # reintento: no se duplica ni se notifica
            response.status_code = 200
            return {**_orden_a_dict(previa), **_efectos_de(db, previa), "repetida": True}
    conocidos = {s.id for s in contexto.cargar_sectores(db)}
    desconocidos = sorted(set(datos.sectores) - conocidos)
    if desconocidos:
        raise HTTPException(422, f"Sector desconocido: {', '.join(desconocidos)}")
    sectores = sorted(set(datos.sectores))
    try:
        orden, efectos = srv_ordenes.emitir_orden(
            db,
            decisor,
            datos.tipo,
            sectores,
            datos.fundamento.strip(),
            datos.fecha_simulada or hoy_ar(),
            clave,
        )
    except IntegrityError:  # dos envíos simultáneos con la misma clave: gana uno solo
        db.rollback()
        previa = _orden_previa(db, decisor.id, clave) if clave else None
        if previa is None:
            raise
        response.status_code = 200
        return {**_orden_a_dict(previa), **_efectos_de(db, previa), "repetida": True}
    destinatarios = efectos.pop("destinatarios")
    auditoria.registrar(
        db,
        "orden_emitida",
        f"ordenes/{orden.id}",
        decisor.id,
        ip_cliente(request),
        f"{datos.tipo}:{','.join(sectores)}",
    )
    db.commit()
    # La alerta llega a los mandos y solo a quienes viven o producen en los sectores alcanzados.
    difusor.publicar(
        "orden",
        {"id": orden.id, "tipo": orden.tipo, "sectores": orden.sectores},
        destinatarios=destinatarios,
    )
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
