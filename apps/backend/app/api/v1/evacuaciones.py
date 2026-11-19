"""Constancias de evacuación y confirmación del evacuado (CLAUDE.md §8.6, §8.7, §9).

- Cierre de una tarea con constancia (destino GPS, centro, personas y animales, nota y fotos):
  cuadrilla de la tarea u operador. Idempotente (``Idempotency-Key``), para la cola offline.
- Confirmación del evacuado por la app (``POST /mi/confirmaciones``) o por SMS con código.
- Tablero: ``GET /evacuaciones`` para los mandos.

Privacidad (Ley 25.326): el destino y el origen de una evacuación solo los ven los roles operativos
y la cuadrilla de la tarea; cada lectura queda en la bitácora de accesos. El evacuado solo ve su
propia consulta y el nombre del centro, nunca ubicaciones.
"""

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
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.operacion import _cuadrillas_de, _tarea_a_dict
from app.api.v1.solicitudes import TIPOS_IMAGEN, tipo_por_firma
from app.config.settings import get_settings
from app.core import auditoria
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol
from app.core.tiempo import hoy_ar
from app.db.base import ahora
from app.db.modelos import (
    CentroRecepcion,
    ConfirmacionEvacuado,
    ConstanciaTarea,
    IntegranteCuadrilla,
    SolicitudAsistencia,
    Tarea,
    Usuario,
)
from app.db.sesion import get_db
from app.servicios import evacuaciones as srv

router = APIRouter(tags=["evacuaciones"])
_MANDOS = ("operador", "decisor", "admin")
ESTADOS_CERRABLES = ("pendiente", "en_curso")


def _publicar(eventos: list[tuple[str, dict]]) -> None:
    for tipo, datos in eventos:
        difusor.publicar(tipo, datos)


# ---- cierre con constancia ----------------------------------------------


class CierreIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=-90, le=90, description="Destino tomado por GPS")
    lon: float = Field(ge=-180, le=180, description="Destino tomado por GPS")
    centro_id: int | None = Field(default=None, ge=1, description="Centro de recepción elegido")
    personas_trasladadas: int = Field(default=0, ge=0, le=5000)
    animales_trasladados: dict[str, int] = Field(default_factory=dict, max_length=20)
    nota: str | None = Field(default=None, max_length=1000)

    @field_validator("animales_trasladados")
    @classmethod
    def animales_validos(cls, v: dict[str, int]) -> dict[str, int]:
        limpio: dict[str, int] = {}
        for especie, cantidad in v.items():
            clave = especie.strip().lower()
            if not 1 <= len(clave) <= 40:
                raise ValueError("La especie debe tener entre 1 y 40 caracteres")
            if not 0 <= cantidad <= 100000:
                raise ValueError("La cantidad de animales debe estar entre 0 y 100000")
            limpio[clave] = limpio.get(clave, 0) + cantidad
        return limpio

    @field_validator("nota")
    @classmethod
    def nota_limpia(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @model_validator(mode="after")
    def con_contenido(self):
        if self.personas_trasladadas == 0 and not any(self.animales_trasladados.values()):
            if not self.nota:
                raise ValueError("Si no se trasladaron personas ni animales, explicalo en la nota")
        return self


def _tarea_autorizada(
    db: Session, tarea_id: int, usuario: Usuario, bloquear: bool = False
) -> Tarea:
    """Tarea a la que el usuario puede acceder: 404 si no existe, 403 si es de otra cuadrilla."""
    tarea = (
        db.execute(
            select(Tarea)
            .where(Tarea.id == tarea_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).scalar_one_or_none()
        if bloquear
        else db.get(Tarea, tarea_id)
    )
    if tarea is None:
        raise HTTPException(404, "Tarea no encontrada")
    if usuario.rol == "cuadrilla" and tarea.cuadrilla_id not in _cuadrillas_de(db, usuario):
        raise HTTPException(403, "La tarea es de otra cuadrilla")
    return tarea


def _rol_firmante(db: Session, usuario: Usuario, tarea: Tarea) -> str | None:
    if tarea.cuadrilla_id is not None:
        rol = (
            db.execute(
                select(IntegranteCuadrilla.rol_operativo).where(
                    IntegranteCuadrilla.cuadrilla_id == tarea.cuadrilla_id,
                    IntegranteCuadrilla.usuario_id == usuario.id,
                )
            )
            .scalars()
            .first()
        )
        if rol:
            return rol
    return usuario.rol_operativo or usuario.rol


def _por_clave(db: Session, usuario_id: int, clave: str) -> ConstanciaTarea | None:
    return db.execute(
        select(ConstanciaTarea).where(
            ConstanciaTarea.cerrada_por == usuario_id, ConstanciaTarea.idempotency_key == clave
        )
    ).scalar_one_or_none()


def _respuesta_cierre(db: Session, tarea_id: int, repetida: bool) -> dict:
    item = srv.listar(db, tarea_id=tarea_id)[0]
    tarea = db.get(Tarea, tarea_id)
    solicitada = (
        db.execute(
            select(ConfirmacionEvacuado.id).where(ConfirmacionEvacuado.tarea_id == tarea_id)
        ).first()
        is not None
    )
    return {
        "constancia": item["constancia"],
        "tarea": _tarea_a_dict(tarea),
        "evacuacion": {
            "estado": item["estado"],
            "motivos_discrepancia": (item["discrepancia"] or {}).get("motivos", []),
            "confirmacion_solicitada": solicitada,
        },
        "repetida": repetida,
        "categoria": srv.CATEGORIA,
    }


@router.post("/tareas/{tarea_id}/cierre", status_code=201)
def cerrar_con_constancia(
    tarea_id: int,
    datos: CierreIn,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    usuario: Usuario = Depends(requiere_rol("cuadrilla", "operador")),
    db: Session = Depends(get_db),
) -> dict:
    if idempotency_key is None:
        raise HTTPException(422, "Falta la cabecera Idempotency-Key (un UUID por cierre)")
    try:
        clave = str(uuid.UUID(idempotency_key))
    except ValueError:
        raise HTTPException(422, "Idempotency-Key debe ser un UUID") from None
    # Fila bloqueada: dos cierres simultáneos de la misma tarea se serializan.
    tarea = _tarea_autorizada(db, tarea_id, usuario, bloquear=True)
    previa = _por_clave(db, usuario.id, clave)
    if previa is not None:
        if previa.tarea_id != tarea.id:
            raise HTTPException(409, "Esa Idempotency-Key ya se usó para cerrar otra tarea")
        response.status_code = 200
        return _respuesta_cierre(db, tarea.id, repetida=True)
    if db.execute(select(ConstanciaTarea.id).where(ConstanciaTarea.tarea_id == tarea.id)).first():
        raise HTTPException(409, "La tarea ya fue cerrada con una constancia")
    if tarea.estado not in ESTADOS_CERRABLES:
        raise HTTPException(409, f"No se puede cerrar una tarea en estado {tarea.estado}")
    try:
        _, efectos = srv.cerrar_tarea(
            db,
            tarea,
            usuario,
            _rol_firmante(db, usuario, tarea),
            lon=datos.lon,
            lat=datos.lat,
            centro_id=datos.centro_id,
            personas=datos.personas_trasladadas,
            animales=datos.animales_trasladados,
            nota=datos.nota,
            clave=clave,
        )
        auditoria.registrar(
            db,
            "tarea_cerrada_con_constancia",
            f"tareas/{tarea.id}/constancia",
            usuario.id,
            ip_cliente(request),
        )
        db.commit()
    except IntegrityError:  # dos envíos simultáneos con la misma clave: gana uno solo
        db.rollback()
        previa = _por_clave(db, usuario.id, clave)
        if previa is None or previa.tarea_id != tarea_id:
            raise HTTPException(409, "La tarea ya fue cerrada con una constancia") from None
        response.status_code = 200
        return _respuesta_cierre(db, tarea_id, repetida=True)
    _publicar(efectos.eventos)
    return _respuesta_cierre(db, tarea_id, repetida=False)


# ---- fotos de la constancia ----------------------------------------------


def _constancia_de(db: Session, tarea_id: int, bloquear: bool = False) -> ConstanciaTarea:
    consulta = select(ConstanciaTarea).where(ConstanciaTarea.tarea_id == tarea_id)
    if bloquear:
        consulta = consulta.with_for_update().execution_options(populate_existing=True)
    constancia = db.execute(consulta).scalar_one_or_none()
    if constancia is None:
        raise HTTPException(404, "La tarea todavía no tiene constancia")
    return constancia


@router.post("/tareas/{tarea_id}/cierre/adjuntos", status_code=201)
def subir_foto_constancia(
    tarea_id: int,
    request: Request,
    response: Response,
    archivo: UploadFile = File(
        ..., description="Imagen JPEG, PNG o WebP del lugar o el transporte"
    ),
    usuario: Usuario = Depends(requiere_rol("cuadrilla", "operador")),
    db: Session = Depends(get_db),
) -> dict:
    cfg = get_settings()
    tarea = _tarea_autorizada(db, tarea_id, usuario)
    constancia = _constancia_de(db, tarea.id, bloquear=True)
    if (archivo.content_type or "").lower() not in TIPOS_IMAGEN:
        raise HTTPException(
            415, "Tipo de archivo no permitido: solo image/jpeg, image/png o image/webp"
        )
    contenido = archivo.file.read(cfg.adjunto_max_bytes + 1)
    if len(contenido) > cfg.adjunto_max_bytes:
        raise HTTPException(413, f"El archivo supera el máximo de {cfg.adjunto_max_bytes} bytes")
    if not contenido:
        raise HTTPException(422, "El archivo está vacío")
    mime = tipo_por_firma(contenido)
    if mime is None:
        raise HTTPException(415, "El contenido no es una imagen JPEG, PNG o WebP válida")
    existentes = list(constancia.adjuntos or [])
    huella = hashlib.sha256(contenido).hexdigest()
    repetido = next((a for a in existentes if a.get("sha256") == huella), None)
    if repetido is not None:  # la misma foto reenviada (reintento de la cola offline)
        response.status_code = 200
        return {
            "n": repetido["n"],
            "mime": repetido["mime"],
            "bytes": repetido["bytes"],
            "tarea_id": tarea.id,
            "duplicado": True,
        }
    if len(existentes) >= cfg.adjuntos_max_por_solicitud:
        raise HTTPException(409, f"Máximo de {cfg.adjuntos_max_por_solicitud} fotos por constancia")
    n = max((a["n"] for a in existentes), default=0) + 1
    nombre = f"{n}.{TIPOS_IMAGEN[mime]}"
    carpeta = cfg.adjuntos_ruta / "constancias" / str(tarea.id)
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_bytes(contenido)
    constancia.adjuntos = [
        *existentes,
        {
            "n": n,
            "mime": mime,
            "bytes": len(contenido),
            "sha256": huella,
            "archivo": nombre,
            "subido_por": usuario.id,
            "subido_en": ahora().isoformat(),
        },
    ]
    auditoria.registrar(
        db,
        "adjunto_subido",
        f"tareas/{tarea.id}/constancia/adjuntos/{n}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return {"n": n, "mime": mime, "bytes": len(contenido), "tarea_id": tarea.id}


@router.get("/tareas/{tarea_id}/cierre/adjuntos/{n}")
def descargar_foto_constancia(
    tarea_id: int,
    n: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> Response:
    tarea = _tarea_autorizada(db, tarea_id, usuario)
    constancia = _constancia_de(db, tarea.id)
    meta = next((a for a in (constancia.adjuntos or []) if a["n"] == n), None)
    ruta = (
        get_settings().adjuntos_ruta / "constancias" / str(tarea.id) / meta["archivo"]
        if meta
        else None
    )
    if meta is None or ruta is None or not ruta.is_file():
        raise HTTPException(404, "Adjunto no encontrado")
    auditoria.registrar(
        db,
        "lectura_datos_personales",
        f"tareas/{tarea.id}/constancia/adjuntos/{n}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return Response(
        ruta.read_bytes(),
        media_type=meta["mime"],
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


# ---- lectura para los mandos ----------------------------------------------


@router.get("/tareas/{tarea_id}/constancia")
def obtener_constancia(
    tarea_id: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    tarea = _tarea_autorizada(db, tarea_id, usuario)
    _constancia_de(db, tarea.id)
    auditoria.registrar(
        db,
        "lectura_datos_personales",
        f"tareas/{tarea.id}/constancia",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return srv.listar(db, tarea_id=tarea.id)[0]


@router.get("/evacuaciones")
def listar_evacuaciones(
    request: Request,
    estado: Literal["pendiente", "en_curso", "cerrada_cuadrilla", "verificada", "con_discrepancia"]
    | None = Query(default=None),
    sector_id: str | None = Query(default=None, max_length=10),
    limite: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100000),
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    items = srv.listar(db, estado=estado, sector_id=sector_id)
    auditoria.registrar(
        db, "lectura_datos_personales", "evacuaciones", usuario.id, ip_cliente(request)
    )
    db.commit()
    return {
        "evacuaciones": items[offset : offset + limite],
        "total": len(items),
        "limite": limite,
        "offset": offset,
        "categoria": srv.CATEGORIA,
        "fuente": srv.FUENTE,
        "fecha_dato": hoy_ar().isoformat(),
    }


class ReaperturaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    motivo: str | None = Field(default=None, max_length=200)


@router.post("/evacuaciones/{tarea_id}/confirmacion/reabrir")
def reabrir_confirmacion(
    tarea_id: int,
    request: Request,
    datos: ReaperturaIn | None = None,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    """Un operador reabre una confirmación respondida para que el evacuado la corrija."""
    k, previa, efectos = srv.reabrir_confirmacion(db, tarea_id)
    motivo = ((datos.motivo if datos else None) or "").strip()
    auditoria.registrar(
        db,
        "confirmacion_reabierta",
        f"tareas/{tarea_id}/confirmacion",
        usuario.id,
        ip_cliente(request),
        f"respuesta_previa={previa}" + (f"; motivo={motivo}" if motivo else ""),
    )
    db.commit()
    _publicar(efectos.eventos)
    return {
        "tarea_id": tarea_id,
        "estado": efectos.estado,
        "respuesta_previa": previa,
        "reabierta": True,
        "nota": "El evacuado recibió una consulta nueva con un código nuevo.",
    }


# ---- confirmación del evacuado ----------------------------------------------


class ConfirmacionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    solicitud_id: int | None = Field(default=None, ge=1)
    codigo: str | None = Field(default=None, min_length=1, max_length=8)
    respuesta: Literal["si", "no", "problema"]
    comentario: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def uno_solo(self):
        if (self.solicitud_id is None) == (self.codigo is None):
            raise ValueError("Indicar solicitud_id o codigo (uno de los dos)")
        return self


def _confirmacion_propia(
    db: Session, usuario: Usuario, datos: ConfirmacionIn
) -> ConfirmacionEvacuado:
    """Consulta de confirmación del usuario; 404 si no existe o es de otra persona."""
    if datos.codigo is not None:
        consulta = select(ConfirmacionEvacuado).where(
            ConfirmacionEvacuado.codigo == datos.codigo.strip().upper()
        )
    else:
        consulta = (
            select(ConfirmacionEvacuado)
            .where(ConfirmacionEvacuado.solicitud_id == datos.solicitud_id)
            .order_by(ConfirmacionEvacuado.id.desc())
            .limit(1)
        )
    k = db.execute(consulta).scalar_one_or_none()
    s = db.get(SolicitudAsistencia, k.solicitud_id) if k and k.solicitud_id else None
    if k is None or s is None or s.solicitante_id != usuario.id:
        raise HTTPException(404, "No encontramos una consulta de confirmación para ese dato")
    return k


@router.post("/mi/confirmaciones", status_code=201)
def confirmar(
    datos: ConfirmacionIn,
    request: Request,
    response: Response,
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor")),
    db: Session = Depends(get_db),
) -> dict:
    k = _confirmacion_propia(db, usuario, datos)
    comentario = (datos.comentario or "").strip() or None
    resultado, k, efectos = srv.registrar_confirmacion(
        db, k.id, datos.respuesta, comentario, "app", usuario.id
    )
    if resultado == "conflicto":
        raise HTTPException(
            409,
            "Ya respondiste esta consulta con otra opción. Si hubo un error, avisá al operador.",
        )
    if resultado == "registrada":
        auditoria.registrar(
            db,
            "confirmacion_evacuado",
            f"tareas/{k.tarea_id}/confirmacion",
            usuario.id,
            ip_cliente(request),
            datos.respuesta,
        )
    db.commit()
    if resultado == "repetida":
        response.status_code = 200
    else:
        _publicar(efectos.eventos)
    return {
        "id": k.id,
        "tarea_id": k.tarea_id,
        "solicitud_id": k.solicitud_id,
        "respuesta": k.respuesta,
        "comentario": k.comentario,
        "canal": k.canal,
        "respondida_en": k.respondida_en.isoformat() if k.respondida_en else None,
        "repetida": resultado == "repetida",
        "nota": "Gracias. Tu respuesta ayuda a verificar el traslado; no es una acusación.",
    }


@router.get("/mi/confirmaciones")
def mis_confirmaciones(
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor")),
    db: Session = Depends(get_db),
) -> dict:
    """Consultas de confirmación propias (sin ubicaciones; solo el nombre del centro)."""
    filas = db.execute(
        select(ConfirmacionEvacuado, CentroRecepcion.nombre)
        .join(SolicitudAsistencia, SolicitudAsistencia.id == ConfirmacionEvacuado.solicitud_id)
        .outerjoin(ConstanciaTarea, ConstanciaTarea.tarea_id == ConfirmacionEvacuado.tarea_id)
        .outerjoin(CentroRecepcion, CentroRecepcion.id == ConstanciaTarea.centro_id)
        .where(SolicitudAsistencia.solicitante_id == usuario.id)
        .order_by(ConfirmacionEvacuado.id.desc())
        .limit(100)
    ).all()
    items = [
        {
            "id": k.id,
            "tarea_id": k.tarea_id,
            "solicitud_id": k.solicitud_id,
            "codigo": k.codigo,
            "centro_nombre": centro,
            "respondida": k.respuesta is not None,
            "respuesta": k.respuesta,
            "comentario": k.comentario,
            "solicitada_en": k.creada_en.isoformat(),
            "respondida_en": k.respondida_en.isoformat() if k.respondida_en else None,
        }
        for k, centro in filas
    ]
    return {
        "confirmaciones": items,
        "pendientes": sum(1 for i in items if not i["respondida"]),
        "categoria": srv.CATEGORIA,
    }
