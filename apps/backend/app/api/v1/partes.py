"""Partes de las cuadrillas y panel de cuadrillas (CLAUDE.md §8.6, §9 · Operación)."""

from __future__ import annotations

import hashlib
import uuid
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.operacion import _cuadrillas_de
from app.config.settings import get_settings
from app.core import auditoria
from app.core.eventos import difusor
from app.core.limitador import limite_por_usuario, limite_usuario
from app.core.rbac import ip_cliente, requiere_rol
from app.db.base import ahora
from app.db.modelos import ParteTarea, Tarea, Usuario
from app.db.sesion import get_db
from app.servicios import adjuntos_parte as adj
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


# ---- evidencia multimedia de un parte -----------------------------------------------------------


@router.post("/tareas/{tarea_id}/partes/{parte_id}/adjuntos", status_code=201)
def subir_adjunto_parte(
    tarea_id: int,
    parte_id: int,
    request: Request,
    response: Response,
    archivo: UploadFile = File(..., description="Foto JPEG, PNG o WebP (5 MB) o video MP4 (20 MB)"),
    usuario: Usuario = Depends(requiere_rol("cuadrilla")),
    db: Session = Depends(get_db),
) -> dict:
    tarea = db.get(Tarea, tarea_id)
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    if not _es_integrante(db, usuario, tarea):
        raise HTTPException(403, "La tarea es de otra cuadrilla")
    # Fila bloqueada: dos subidas simultáneas no pueden tomar el mismo número de adjunto.
    parte = db.execute(
        select(ParteTarea)
        .where(ParteTarea.id == parte_id, ParteTarea.tarea_id == tarea.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if parte is None:
        raise HTTPException(404, "Parte no encontrado")
    declarado = (archivo.content_type or "").lower()
    if declarado not in adj.TIPOS:
        raise HTTPException(
            415, "Tipo de archivo no permitido: image/jpeg, image/png, image/webp o video/mp4"
        )
    contenido = archivo.file.read(adj.VIDEO_MAX_BYTES + 1)
    if len(contenido) > adj.VIDEO_MAX_BYTES:
        raise HTTPException(413, f"El archivo supera el máximo de {adj.VIDEO_MAX_BYTES} bytes")
    if not contenido:
        raise HTTPException(422, "El archivo está vacío")
    mime = adj.tipo_por_firma(contenido)
    if mime is None or adj.TIPOS[mime][1] != adj.TIPOS[declarado][1]:
        raise HTTPException(
            415, "El contenido no es una foto JPEG, PNG o WebP ni un video MP4 válido"
        )
    extension, tipo = adj.TIPOS[mime]
    if tipo == "imagen" and len(contenido) > adj.IMAGEN_MAX_BYTES:
        raise HTTPException(413, f"La foto supera el máximo de {adj.IMAGEN_MAX_BYTES} bytes")
    existentes = list(parte.adjuntos or [])
    huella = hashlib.sha256(contenido).hexdigest()
    repetido = next((a for a in existentes if a.get("sha256") == huella), None)
    if repetido is not None:  # el mismo archivo reenviado (reintento de la cola sin señal)
        response.status_code = 200
        return {**adj.adjunto_publico(repetido), "parte_id": parte.id, "duplicado": True}
    if len(existentes) >= adj.MAX_POR_PARTE:
        raise HTTPException(409, f"Máximo de {adj.MAX_POR_PARTE} adjuntos por parte")
    n = max((a["n"] for a in existentes), default=0) + 1
    nombre = f"{n}.{extension}"  # nombre generado por el servidor
    carpeta = get_settings().adjuntos_ruta / "partes" / str(tarea.id) / str(parte.id)
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_bytes(contenido)
    nuevo = {
        "n": n,
        "tipo": tipo,
        "mime": mime,
        "bytes": len(contenido),
        "sha256": huella,
        "archivo": nombre,
        "subido_por": usuario.id,
        "subido_en": ahora().isoformat(),
    }
    parte.adjuntos = [*existentes, nuevo]
    auditoria.registrar(
        db,
        "adjunto_subido",
        f"tareas/{tarea.id}/partes/{parte.id}/adjuntos/{n}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return {**adj.adjunto_publico(nuevo), "parte_id": parte.id}


@router.get("/tareas/{tarea_id}/partes/{parte_id}/adjuntos/{n}")
def descargar_adjunto_parte(
    tarea_id: int,
    parte_id: int,
    n: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> FileResponse:
    tarea = db.get(Tarea, tarea_id)
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    if usuario.rol == "cuadrilla" and not _es_integrante(db, usuario, tarea):
        raise HTTPException(403, "La tarea es de otra cuadrilla")
    parte = db.execute(
        select(ParteTarea).where(ParteTarea.id == parte_id, ParteTarea.tarea_id == tarea.id)
    ).scalar_one_or_none()
    meta = next((a for a in ((parte.adjuntos if parte else None) or []) if a["n"] == n), None)
    if parte is None or meta is None:
        raise HTTPException(404, "Adjunto no encontrado")
    ruta = (
        get_settings().adjuntos_ruta / "partes" / str(tarea.id) / str(parte.id) / meta["archivo"]
    )
    if not ruta.is_file():
        raise HTTPException(404, "Adjunto no encontrado")
    auditoria.registrar(
        db,
        "lectura_datos_personales",
        f"tareas/{tarea.id}/partes/{parte.id}/adjuntos/{n}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return FileResponse(
        ruta,
        media_type=meta["mime"],
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
