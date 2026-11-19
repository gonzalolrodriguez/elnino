"""Solicitudes de asistencia (CLAUDE.md §9 · Solicitudes).

Estados: recibida → verificada → asignada → en_curso → resuelta (solo hacia adelante, de a uno).
La ciudadanía y los productores ven únicamente sus propias solicitudes.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import timedelta
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
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.core import auditoria
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.db.base import SRID, ahora
from app.db.consultas import sector_de_punto
from app.db.modelos import Cuadrilla, SolicitudAsistencia, Tarea, Usuario
from app.db.sesion import get_db
from app.domain import cuadrillas
from app.servicios import ordenes as srv_ordenes

router = APIRouter(prefix="/solicitudes", tags=["solicitudes"])
_MANDOS = ("operador", "decisor", "admin")
ESTADOS = ("recibida", "verificada", "asignada", "en_curso", "resuelta")
TIPOS = ("evacuacion", "asistencia", "ganado", "logistica", "otro")


class SolicitudIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["evacuacion", "asistencia", "ganado", "logistica", "otro"]
    personas: int = Field(default=0, ge=0, le=500)
    animales: int = Field(default=0, ge=0, le=100000)
    lon: float | None = Field(default=None, ge=-180, le=180)
    lat: float | None = Field(default=None, ge=-90, le=90)
    texto: str | None = Field(default=None, max_length=500)
    referencia_ubicacion: str | None = Field(
        default=None, max_length=200, description="Paraje, camino o ruta (si no hay coordenadas)"
    )
    origen: Literal["app", "web"] = "web"

    @field_validator("referencia_ubicacion")
    @classmethod
    def referencia_limpia(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @model_validator(mode="after")
    def ubicacion(self):
        if (self.lon is None) != (self.lat is None):
            raise ValueError("Indicar lon y lat juntas")
        if self.lon is None and self.referencia_ubicacion is None:
            raise ValueError("Indicar coordenadas (lon y lat) o una referencia de ubicación")
        return self


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
        "detalle": {k: v for k, v in (s.detalle or {}).items() if k != "idempotency_key"} or None,
        "adjuntos": [
            {"n": a["n"], "mime": a["mime"], "bytes": a["bytes"]} for a in (s.adjuntos or [])
        ],
        "ubicacion_aproximada": bool(s.ubicacion_aproximada),
        "referencia_ubicacion": s.referencia_ubicacion,
        "requiere_verificacion": bool(s.requiere_verificacion),
        "creado_en": s.creado_en.isoformat(),
        "actualizado_en": s.actualizado_en.isoformat(),
        "categoria": "SIMULADO",
    }


def _por_clave(db: Session, usuario_id: int, clave: str) -> SolicitudAsistencia | None:
    return db.execute(
        select(SolicitudAsistencia).where(
            SolicitudAsistencia.solicitante_id == usuario_id,
            SolicitudAsistencia.idempotency_key == clave,
        )
    ).scalar_one_or_none()


def _aplicar_cuota(db: Session, usuario: Usuario) -> None:
    """Cuota blanda por persona (``SOLICITUDES_MAX_POR_HORA``): frena abusos sin trabar a nadie.

    Una familia en emergencia rara vez manda más de unas pocas solicitudes; el tope es holgado y el
    mensaje dice cuándo reintentar. Los mandos operativos no tienen cuota.
    """
    if usuario.rol not in ("ciudadano", "productor"):
        return
    maximo = get_settings().solicitudes_max_por_hora
    desde = ahora() - timedelta(hours=1)
    recientes = (
        db.execute(
            select(SolicitudAsistencia.creado_en)
            .where(
                SolicitudAsistencia.solicitante_id == usuario.id,
                SolicitudAsistencia.creado_en >= desde,
            )
            .order_by(SolicitudAsistencia.creado_en)
        )
        .scalars()
        .all()
    )
    if len(recientes) >= maximo:
        libera = recientes[len(recientes) - maximo] + timedelta(hours=1)
        espera = max(int((libera - ahora()).total_seconds()) + 1, 1)
        raise HTTPException(
            429,
            f"Ya enviaste {maximo} pedidos en la última hora. Si es una urgencia, llamá al 103; "
            f"podés volver a enviar en unos {max(espera // 60, 1)} minutos.",
            headers={"Retry-After": str(espera)},
        )


@router.post("", status_code=201)
def crear(
    datos: SolicitudIn,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
) -> dict:
    if datos.personas == 0 and datos.animales == 0 and not datos.texto:
        raise HTTPException(422, "Indicar personas, animales o un texto")
    clave = None
    if idempotency_key is not None:
        try:
            clave = str(uuid.UUID(idempotency_key))
        except ValueError:
            raise HTTPException(422, "Idempotency-Key debe ser un UUID") from None
        previa = _por_clave(db, usuario.id, clave)
        if previa is not None:
            response.status_code = 200
            return solicitud_a_dict(previa)
    _aplicar_cuota(db, usuario)
    sin_coordenadas = datos.lon is None
    valores = {
        "solicitante_id": usuario.id,
        "origen": datos.origen,
        "tipo": datos.tipo,
        "personas": datos.personas,
        "animales": datos.animales,
        "texto": datos.texto,
        "geom": None
        if sin_coordenadas
        else WKTElement(f"POINT({datos.lon} {datos.lat})", srid=SRID),
        "sector_id": None if sin_coordenadas else sector_de_punto(db, datos.lon, datos.lat),
        "referencia_ubicacion": datos.referencia_ubicacion,
        # Sin coordenadas: ubicación por referencia, a verificar por el operador.
        "ubicacion_aproximada": sin_coordenadas,
        "requiere_verificacion": sin_coordenadas,
        "estado": "recibida",
        "idempotency_key": clave,
        "creado_en": ahora(),
        "actualizado_en": ahora(),
    }
    # ON CONFLICT sobre el índice único parcial (solicitante, clave): dos envíos simultáneos con la
    # misma clave crean una sola solicitud, sin importar cuánto tiempo pasó entre ellos.
    nuevo_id = db.execute(
        insert(SolicitudAsistencia)
        .values(**valores)
        .on_conflict_do_nothing(
            index_elements=["solicitante_id", "idempotency_key"],
            index_where=text("idempotency_key IS NOT NULL"),
        )
        .returning(SolicitudAsistencia.id)
    ).scalar_one_or_none()
    if nuevo_id is None:  # perdió la carrera contra otro envío con la misma clave
        db.rollback()
        previa = _por_clave(db, usuario.id, clave)
        response.status_code = 200
        return solicitud_a_dict(previa)
    solicitud = db.get(SolicitudAsistencia, nuevo_id)
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
    offset: int = Query(default=0, ge=0, le=100000),
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    consulta = select(SolicitudAsistencia)
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
    total = db.execute(select(func.count()).select_from(consulta.subquery())).scalar_one()
    filas = (
        db.execute(consulta.order_by(SolicitudAsistencia.id.desc()).limit(limite).offset(offset))
        .scalars()
        .all()
    )
    return {
        "solicitudes": [solicitud_a_dict(s) for s in filas],
        "total": total,
        "limite": limite,
        "offset": offset,
    }


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


# ---- adjuntos -----------------------------------------------------------------------------------

TIPOS_IMAGEN = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def tipo_por_firma(datos: bytes) -> str | None:
    """Tipo MIME según los primeros bytes (no se confía en el Content-Type declarado)."""
    if datos.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if datos.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "image/webp"
    return None


def _solicitud_visible(
    db: Session, solicitud_id: int, usuario: Usuario, bloquear: bool = False
) -> SolicitudAsistencia:
    s = (
        db.execute(
            select(SolicitudAsistencia)
            .where(SolicitudAsistencia.id == solicitud_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).scalar_one_or_none()
        if bloquear
        else db.get(SolicitudAsistencia, solicitud_id)
    )
    if s is None or (usuario.rol in ("ciudadano", "productor") and s.solicitante_id != usuario.id):
        raise HTTPException(404, "Solicitud no encontrada")
    return s


def _aplicar_tope_almacenamiento(db: Session, usuario: Usuario, nuevos: int) -> None:
    """Tope de bytes de adjuntos por persona (``ADJUNTOS_MAX_BYTES_POR_USUARIO``)."""
    usado = db.execute(
        text(
            "SELECT COALESCE(SUM((a->>'bytes')::bigint), 0) FROM solicitudes_asistencia s, "
            "jsonb_array_elements(COALESCE(s.adjuntos, '[]'::jsonb)) a "
            "WHERE (a->>'subido_por')::int = :u"
        ),
        {"u": usuario.id},
    ).scalar_one()
    tope = get_settings().adjuntos_max_bytes_por_usuario
    if int(usado) + nuevos > tope:
        raise HTTPException(
            413,
            f"Alcanzaste el máximo de {tope // (1024 * 1024)} MB de fotos adjuntas. "
            "Si necesitás enviar más, avisá por texto o por teléfono.",
        )


@router.post("/{solicitud_id}/adjuntos", status_code=201)
def subir_adjunto(
    solicitud_id: int,
    request: Request,
    response: Response,
    archivo: UploadFile = File(..., description="Imagen JPEG, PNG o WebP"),
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    cfg = get_settings()
    # Se bloquea la fila: dos subidas simultáneas no pueden tomar el mismo número de adjunto.
    s = _solicitud_visible(db, solicitud_id, usuario, bloquear=True)
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
    existentes = list(s.adjuntos or [])
    huella = hashlib.sha256(contenido).hexdigest()
    repetido = next((a for a in existentes if a.get("sha256") == huella), None)
    if repetido is not None:  # la misma foto reenviada (reintento de la cola offline)
        response.status_code = 200
        return {
            "n": repetido["n"],
            "mime": repetido["mime"],
            "bytes": repetido["bytes"],
            "solicitud_id": s.id,
            "duplicado": True,
        }
    _aplicar_tope_almacenamiento(db, usuario, len(contenido))
    if len(existentes) >= cfg.adjuntos_max_por_solicitud:
        raise HTTPException(
            409, f"Máximo de {cfg.adjuntos_max_por_solicitud} adjuntos por solicitud"
        )
    n = max((a["n"] for a in existentes), default=0) + 1
    nombre = f"{n}.{TIPOS_IMAGEN[mime]}"
    carpeta = cfg.adjuntos_ruta / "solicitudes" / str(s.id)
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / nombre).write_bytes(contenido)
    s.adjuntos = [
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
    s.actualizado_en = ahora()
    auditoria.registrar(
        db, "adjunto_subido", f"solicitudes/{s.id}/adjuntos/{n}", usuario.id, ip_cliente(request)
    )
    db.commit()
    return {"n": n, "mime": mime, "bytes": len(contenido), "solicitud_id": s.id}


@router.get("/{solicitud_id}/adjuntos/{n}")
def descargar_adjunto(
    solicitud_id: int,
    n: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor", *_MANDOS)),
    db: Session = Depends(get_db),
) -> Response:
    s = _solicitud_visible(db, solicitud_id, usuario)
    meta = next((a for a in (s.adjuntos or []) if a["n"] == n), None)
    ruta = (
        get_settings().adjuntos_ruta / "solicitudes" / str(s.id) / meta["archivo"] if meta else None
    )
    if meta is None or ruta is None or not ruta.is_file():
        raise HTTPException(404, "Adjunto no encontrado")
    auditoria.registrar(
        db,
        "lectura_datos_personales",
        f"solicitudes/{s.id}/adjuntos/{n}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return Response(
        ruta.read_bytes(),
        media_type=meta["mime"],
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.patch("/{solicitud_id}")
def actualizar(
    solicitud_id: int,
    datos: SolicitudPatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    # Fila bloqueada: dos operadores que avanzan el estado a la vez se serializan (el segundo ve el
    # estado nuevo y recibe 409 si la transición ya no corresponde).
    s = db.execute(
        select(SolicitudAsistencia)
        .where(SolicitudAsistencia.id == solicitud_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
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
        if cuadrilla is None:  # sin cuadrilla indicada: la del tipo con menos carga
            cid = srv_ordenes.cuadrilla_menos_cargada(db, tipo)
            cuadrilla = db.get(Cuadrilla, cid) if cid else None
        srv_ordenes.marcar_ocupada(db, cuadrilla.id if cuadrilla else None)
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
