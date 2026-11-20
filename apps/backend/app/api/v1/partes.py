"""Partes de las cuadrillas y panel de cuadrillas (CLAUDE.md §8.6, §9 · Operación)."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.operacion import _cuadrillas_de
from app.core import auditoria
from app.core.eventos import difusor
from app.core.limitador import limite_por_usuario, limite_usuario
from app.core.rbac import ip_cliente, requiere_rol
from app.db.modelos import (
    Cuadrilla,
    IntegranteCuadrilla,
    ParteTarea,
    RolOperativo,
    Tarea,
    Usuario,
)
from app.db.sesion import get_db
from app.servicios import partes as srv

router = APIRouter(
    tags=["partes"],
    dependencies=[Depends(limite_por_usuario("usuario", limite_usuario))],
)
_MANDOS = ("operador", "decisor", "admin")
_GESTION = ("operador", "admin")


class ParteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["avance", "dificultad", "resultado"]
    resultado: Literal["completa", "parcial", "no_realizada", "reprogramada"] | None = None
    observacion: str | None = Field(default=None, max_length=1000)

    @field_validator("observacion")
    @classmethod
    def _limpiar(cls, v: str | None) -> str | None:
        v = v.strip() if v is not None else None
        return v or None

    @model_validator(mode="after")
    def _reglas(self) -> ParteIn:
        if self.tipo == "resultado" and self.resultado is None:
            raise ValueError("Un parte de resultado necesita el campo resultado")
        if self.tipo != "resultado" and self.resultado is not None:
            raise ValueError("El campo resultado solo corresponde al tipo resultado")
        exige = self.tipo == "dificultad" or (
            self.tipo == "resultado" and self.resultado != "completa"
        )
        if exige and (self.observacion is None or len(self.observacion) < 3):
            raise ValueError("La observación es obligatoria (3 a 1000 caracteres) en este parte")
        if self.observacion is not None and len(self.observacion) < 3:
            raise ValueError("La observación debe tener al menos 3 caracteres")
        return self


def _tarea_bloqueada(db: Session, tarea_id: int) -> Tarea:
    tarea = db.execute(
        select(Tarea)
        .where(Tarea.id == tarea_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    return tarea


def _es_integrante(db: Session, usuario: Usuario, tarea: Tarea) -> bool:
    return tarea.cuadrilla_id is not None and tarea.cuadrilla_id in _cuadrillas_de(db, usuario)


@router.post("/tareas/{tarea_id}/partes", status_code=201)
def crear_parte(
    tarea_id: int,
    datos: ParteIn,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    usuario: Usuario = Depends(requiere_rol("cuadrilla")),
    db: Session = Depends(get_db),
) -> dict:
    clave = None
    if idempotency_key is not None:
        try:
            clave = str(uuid.UUID(idempotency_key))
        except ValueError:
            raise HTTPException(422, "Idempotency-Key debe ser un UUID") from None
    tarea = _tarea_bloqueada(db, tarea_id)
    if not _es_integrante(db, usuario, tarea):
        raise HTTPException(403, "La tarea es de otra cuadrilla")
    if clave is not None:  # reintento (cola sin conexión de la app): devuelve el parte original
        previa = _parte_previa(db, usuario.id, clave)
        if previa is not None:
            if previa.tarea_id != tarea.id:
                raise HTTPException(409, "Esa Idempotency-Key ya se usó en otra tarea")
            response.status_code = 200
            return srv.parte_a_dict(previa)
    if tarea.estado in srv.ESTADOS_CERRADOS:
        raise HTTPException(409, f"La tarea ya está {tarea.estado}: no admite más partes")
    if datos.resultado == "completa" and srv.exige_constancia(db, tarea):
        raise HTTPException(409, srv.MENSAJE_CONSTANCIA)
    try:
        parte = srv.registrar_parte(
            db, tarea, usuario, datos.tipo, datos.resultado, datos.observacion, clave
        )
        auditoria.registrar(
            db,
            "parte_tarea_creado",
            f"tareas/{tarea.id}/partes",
            usuario.id,
            ip_cliente(request),
            f"{datos.tipo}:{datos.resultado}" if datos.resultado else datos.tipo,
        )
        db.commit()
    except IntegrityError:  # dos envíos simultáneos con la misma clave: gana uno solo
        db.rollback()
        previa = _parte_previa(db, usuario.id, clave) if clave else None
        if previa is None or previa.tarea_id != tarea_id:
            raise
        response.status_code = 200
        return srv.parte_a_dict(previa)
    _publicar(parte, tarea)
    return srv.parte_a_dict(parte)


def _parte_previa(db: Session, autor_id: int, clave: str) -> ParteTarea | None:
    return db.execute(
        select(ParteTarea).where(
            ParteTarea.autor_id == autor_id, ParteTarea.idempotency_key == clave
        )
    ).scalar_one_or_none()


def _publicar(parte: ParteTarea, tarea: Tarea) -> None:
    """Aviso a los roles operativos: solo ids y tipo, nunca la observación."""
    difusor.publicar(
        "parte_tarea",
        {
            "tarea_id": parte.tarea_id,
            "cuadrilla_id": parte.cuadrilla_id,
            "tipo": parte.tipo,
            "resultado": parte.resultado,
        },
    )
    if parte.tipo == "resultado":
        difusor.publicar(
            "tarea", {"id": tarea.id, "estado": tarea.estado, "cuadrilla_id": tarea.cuadrilla_id}
        )


@router.get("/tareas/{tarea_id}/partes")
def listar_partes(
    tarea_id: int,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    tarea = db.get(Tarea, tarea_id)
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    if usuario.rol == "cuadrilla" and not _es_integrante(db, usuario, tarea):
        raise HTTPException(403, "La tarea es de otra cuadrilla")
    filas = (
        db.execute(
            select(ParteTarea)
            .where(ParteTarea.tarea_id == tarea_id)
            .order_by(ParteTarea.creado_en.desc(), ParteTarea.id.desc())
            .limit(200)
        )
        .scalars()
        .all()
    )
    return {"items": [srv.parte_a_dict(p) for p in filas]}


class ParteResuelta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resuelta: Literal[True]


@router.patch("/partes/{parte_id}")
def resolver_parte(
    parte_id: int,
    datos: ParteResuelta,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    parte = db.execute(
        select(ParteTarea)
        .where(ParteTarea.id == parte_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if parte is None:
        raise HTTPException(404, "Parte no encontrado")
    if parte.tipo != "dificultad":
        raise HTTPException(409, "Solo las dificultades se marcan como resueltas")
    parte.resuelta = True
    auditoria.registrar(
        db, "parte_tarea_resuelto", f"partes/{parte.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    difusor.publicar(
        "parte_tarea",
        {
            "tarea_id": parte.tarea_id,
            "cuadrilla_id": parte.cuadrilla_id,
            "tipo": parte.tipo,
            "resultado": parte.resultado,
        },
    )
    return srv.parte_a_dict(parte)


@router.get("/partes/recientes")
def partes_recientes(
    limite: int = Query(default=20, ge=1, le=100),
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    return {"items": srv.recientes(db, limite)}


# ---- panel de cuadrillas -------------------------------------------------------------------------


@router.get("/cuadrillas/resumen")
def resumen(_: Usuario = Depends(requiere_rol(*_MANDOS)), db: Session = Depends(get_db)) -> dict:
    return {"items": srv.resumen_cuadrillas(db)}


def _item(db: Session, cuadrilla_id: int) -> dict:
    return next(i for i in srv.resumen_cuadrillas(db) if i["id"] == cuadrilla_id)


class IntegranteAlta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    usuario_id: int = Field(ge=1)
    rol_operativo: str = Field(min_length=2, max_length=60)


@router.post("/cuadrillas/{cuadrilla_id}/integrantes", status_code=201)
def agregar_integrante(
    cuadrilla_id: int,
    datos: IntegranteAlta,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    cuadrilla = db.execute(
        select(Cuadrilla).where(Cuadrilla.id == cuadrilla_id).with_for_update()
    ).scalar_one_or_none()
    if cuadrilla is None:
        raise HTTPException(404, "Cuadrilla no encontrada")
    if db.get(RolOperativo, datos.rol_operativo) is None:
        raise HTTPException(422, f"rol_operativo desconocido: {datos.rol_operativo}")
    nuevo = db.get(Usuario, datos.usuario_id)
    if nuevo is None or nuevo.rol != "cuadrilla":
        raise HTTPException(422, "Solo se pueden designar usuarios con rol cuadrilla")
    if nuevo.estado != "activo":
        raise HTTPException(422, "El usuario no está activo")
    ya = db.execute(
        select(IntegranteCuadrilla.id).where(
            IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
            IntegranteCuadrilla.usuario_id == nuevo.id,
        )
    ).first()
    if ya:
        raise HTTPException(409, "El usuario ya integra esta cuadrilla")
    # Una vacante del mismo rol (sin persona designada) se cubre en vez de duplicar el rol.
    vacante = (
        db.execute(
            select(IntegranteCuadrilla)
            .where(
                IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
                IntegranteCuadrilla.rol_operativo == datos.rol_operativo,
                IntegranteCuadrilla.usuario_id.is_(None),
            )
            .order_by(IntegranteCuadrilla.id)
        )
        .scalars()
        .first()
    )
    if vacante is not None:
        vacante.usuario_id = nuevo.id
    else:
        db.add(
            IntegranteCuadrilla(
                cuadrilla_id=cuadrilla_id, usuario_id=nuevo.id, rol_operativo=datos.rol_operativo
            )
        )
    auditoria.registrar(
        db,
        "cuadrilla_integrante_agregado",
        f"cuadrillas/{cuadrilla_id}/integrantes/{nuevo.id}",
        usuario.id,
        ip_cliente(request),
        datos.rol_operativo,
    )
    db.commit()
    return _item(db, cuadrilla_id)


@router.delete("/cuadrillas/{cuadrilla_id}/integrantes/{usuario_id}")
def quitar_integrante(
    cuadrilla_id: int,
    usuario_id: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    if db.get(Cuadrilla, cuadrilla_id) is None:
        raise HTTPException(404, "Cuadrilla no encontrada")
    borrados = db.execute(
        delete(IntegranteCuadrilla).where(
            IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
            IntegranteCuadrilla.usuario_id == usuario_id,
        )
    ).rowcount
    if not borrados:
        raise HTTPException(404, "El usuario no integra esta cuadrilla")
    auditoria.registrar(
        db,
        "cuadrilla_integrante_quitado",
        f"cuadrillas/{cuadrilla_id}/integrantes/{usuario_id}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return _item(db, cuadrilla_id)
