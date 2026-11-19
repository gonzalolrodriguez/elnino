"""Canales simulados: WhatsApp, SMS e IVR (CLAUDE.md §8.10, §9 · Canales).

Cada endpoint recibe el mismo formato que usaría el proveedor real y verifica la firma HMAC SHA-256
del cuerpo crudo en ``X-Hub-Signature-256: sha256=<hex>`` (el esquema de la Meta Cloud API). El
secreto sale de ``CANAL_HMAC_SECRET``. Los mensajes pasan por ``parser_mensajes`` y crean una
``solicitud_asistencia`` (``SOS-FSA|...``) o una ``lectura_lluvia`` (``LLUVIA <PUESTO> <MM>``).
También resuelven la confirmación del evacuado: ``SI <codigo>``, ``NO <codigo>`` o
``PROBLEMA <codigo> <texto>`` (el código llega en la notificación de la app) con una respuesta fija.

Cómo se conectaría la Meta Cloud API real: se registra ``POST /api/v1/canales/whatsapp-sim`` (con el
nombre definitivo) como URL de webhook de la app de Meta; Meta firma cada notificación con el
secreto de la app (``X-Hub-Signature-256``) y se configura ese secreto en ``CANAL_HMAC_SECRET``; la
verificación inicial del webhook (``hub.challenge``) es un ``GET`` que se agrega al desplegar. El
payload de ``whatsapp-sim`` es el de Meta (``entry[].changes[].value.messages[]``).
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from geoalchemy2 import WKTElement
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.core.eventos import difusor
from app.core.tiempo import ARGENTINA
from app.db.base import SRID, ahora
from app.db.consultas import sector_de_punto
from app.db.modelos import SolicitudAsistencia
from app.db.sesion import get_db
from app.domain import evacuaciones as dom_evac
from app.domain import normalizador as norm
from app.domain import parser_mensajes as pm
from app.servicios import evacuaciones as srv_evac
from app.servicios import lluvia as srv

router = APIRouter(prefix="/canales", tags=["canales"])

MAX_CUERPO = 64 * 1024


async def _leer_con_tope(request: Request) -> bytes:
    """Lee el cuerpo con tope ``MAX_CUERPO`` (mira ``Content-Length`` y corta al excederse)."""
    declarado = request.headers.get("content-length")
    if declarado is not None and declarado.isdigit() and int(declarado) > MAX_CUERPO:
        raise HTTPException(413, "Cuerpo demasiado grande")
    partes: list[bytes] = []
    total = 0
    async for trozo in request.stream():
        total += len(trozo)
        if total > MAX_CUERPO:
            raise HTTPException(413, "Cuerpo demasiado grande")
        partes.append(trozo)
    return b"".join(partes)


async def cuerpo_firmado(request: Request) -> bytes:
    """Lee el cuerpo crudo y exige una firma HMAC válida (401 si falta o no coincide)."""
    try:
        secreto = get_settings().secreto_canales()
    except RuntimeError as exc:
        raise HTTPException(503, "Canales simulados no configurados (CANAL_HMAC_SECRET)") from exc
    cuerpo = await _leer_con_tope(request)
    # La firma llega de afuera y puede traer cualquier carácter: se compara como bytes (con un
    # ``str`` no ASCII ``compare_digest`` lanzaría TypeError y daría 500 en vez de 401).
    firma = request.headers.get("X-Hub-Signature-256", "").encode("utf-8", "replace")
    esperado = firmar(cuerpo, secreto).encode("ascii")
    if not hmac.compare_digest(firma, esperado):
        raise HTTPException(401, "Firma inválida o ausente")
    return cuerpo


def firmar(cuerpo: bytes, secreto: str) -> str:
    """Valor de ``X-Hub-Signature-256`` para ``cuerpo`` (lo usan las pruebas y los ejemplos)."""
    return "sha256=" + hmac.new(secreto.encode(), cuerpo, hashlib.sha256).hexdigest()


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _TextoWA(_Base):
    body: str = Field(max_length=1000)


class _MensajeWA(_Base):
    id: str | None = None
    timestamp: str | None = None
    type: str = "text"
    text: _TextoWA | None = None


class _ValorWA(_Base):
    messages: list[_MensajeWA] = Field(default_factory=list, max_length=50)


class _CambioWA(_Base):
    field: str = "messages"
    value: _ValorWA


class _EntradaWA(_Base):
    changes: list[_CambioWA] = Field(default_factory=list, max_length=20)


class WhatsAppIn(_Base):
    object: str = "whatsapp_business_account"
    entry: list[_EntradaWA] = Field(max_length=20)


class SMSIn(_Base):
    remitente: str = Field(max_length=40)
    texto: str = Field(max_length=1000)
    recibido_en: datetime | None = None
    mensaje_id: str | None = Field(default=None, max_length=100)


class IVRIn(_Base):
    """Llamada del IVR ya transcripta. ``turnos`` permite un guion (una línea por turno)."""

    llamada_id: str = Field(max_length=60)
    transcripcion: str | None = Field(default=None, max_length=1000)
    turnos: list[str] | None = Field(default=None, max_length=30)
    recibido_en: datetime | None = None

    @model_validator(mode="after")
    def con_texto(self):
        if not (self.transcripcion or "").strip() and not any(
            (t or "").strip() for t in self.turnos or []
        ):
            raise ValueError("Indicar transcripcion o turnos")
        return self

    def texto(self) -> str:
        partes = [self.transcripcion or "", *(self.turnos or [])]
        return " ".join(p.strip() for p in partes if p and p.strip())[:1000]


def _momento(valor: str | datetime | None) -> datetime:
    """Momento del mensaje en hora de Argentina; 422 si el valor no es una fecha válida.

    Un ``timestamp`` de WhatsApp es epoch en segundos; un datetime sin zona horaria se interpreta
    como hora de Argentina (UTC-3).
    """
    try:
        if isinstance(valor, str) and valor.strip().isdigit():
            return datetime.fromtimestamp(int(valor), UTC).astimezone(ARGENTINA)
        if isinstance(valor, datetime):
            return (valor if valor.tzinfo else valor.replace(tzinfo=ARGENTINA)).astimezone(
                ARGENTINA
            )
        if isinstance(valor, str) and valor.strip():
            raise ValueError("formato")
    except (OverflowError, OSError, ValueError) as exc:
        raise HTTPException(422, "Fecha y hora del mensaje inválidas") from exc
    return datetime.now(ARGENTINA)


def _turno(momento: datetime) -> str:
    return "07" if momento.hour < 12 else "17"


@dataclass
class _Mensaje:
    texto: str
    momento: datetime
    mensaje_id: str | None = None


def _clasificar(texto: str) -> str:
    inicio = texto.strip().upper()
    if inicio.startswith("LLUVIA"):
        return "lluvia"
    if inicio.startswith("SOS-FSA"):
        return "sos"
    if dom_evac.parsear_respuesta_sms(texto) is not None:
        return "confirmacion"
    if norm.palabra_clave(texto):
        return "menu"
    return "libre"


def _solicitud_existente(db: Session, canal: str, mensaje_id: str) -> int | None:
    return db.execute(
        select(SolicitudAsistencia.id).where(
            SolicitudAsistencia.origen == canal,
            SolicitudAsistencia.mensaje_externo_id == mensaje_id,
        )
    ).scalar_one_or_none()


def _insertar_solicitud(db: Session, canal: str, mensaje_id: str | None, **valores) -> int | None:
    """Inserta con ON CONFLICT sobre (origen, mensaje_externo_id); ``None`` si ya existía."""
    stmt = insert(SolicitudAsistencia).values(
        origen=canal,
        mensaje_externo_id=mensaje_id,
        estado="recibida",
        creado_en=ahora(),
        actualizado_en=ahora(),
        **valores,
    )
    if mensaje_id is not None:
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["origen", "mensaje_externo_id"],
            index_where=text("mensaje_externo_id IS NOT NULL"),
        )
    return db.execute(stmt.returning(SolicitudAsistencia.id)).scalar_one_or_none()


def _procesar_uno(db: Session, m: _Mensaje, canal: str, eventos: list) -> dict:
    """Procesa un mensaje dentro de un savepoint: un error o duplicado no afecta a los demás."""
    tipo = _clasificar(m.texto)
    if tipo == "confirmacion":  # SI|NO|PROBLEMA <código> del evacuado
        return srv_evac.procesar_respuesta_sms(db, m.texto, canal, eventos)
    if tipo == "menu":
        palabra = norm.palabra_clave(m.texto)
        return {
            "tipo": "menu",
            "estado": "respuesta",
            "palabra": palabra,
            "respuesta": norm.RESPUESTAS_MENU[palabra],
            "categoria_respuesta": "DOCUMENTO DE REFERENCIA",
            "fuente_respuesta": f"{norm.FUENTE_EMERGENCIAS} (consultado el {norm.FECHA_CONSULTA_EMERGENCIAS})",
        }
    if tipo == "lluvia":
        datos = pm.parsear_lluvia(m.texto)
        try:
            with db.begin_nested():
                lectura, advertencias = srv.registrar_lectura(
                    db,
                    datos.codigo_puesto,
                    m.momento.date(),
                    _turno(m.momento),
                    datos.mm,
                    "simulado",
                )
        except srv.ErrorLluvia as exc:
            if exc.estado == 409:  # lectura repetida (reintento del canal): no es un error
                return {"tipo": "lluvia", "estado": "duplicado", "detalle": exc.mensaje}
            # Puesto desconocido o dato inválido en el mensaje: es un problema del mensaje.
            raise pm.ErrorParseo(exc.mensaje) from exc
        return {
            "tipo": "lluvia",
            "estado": "creado",
            "id": lectura.id,
            "advertencias": advertencias,
        }

    if tipo == "sos":
        datos = pm.parsear_sos(m.texto)
        with db.begin_nested():
            nuevo_id = _insertar_solicitud(
                db,
                canal,
                m.mensaje_id,
                tipo=f"sos_{datos.perfil}",
                personas=datos.familiares,
                animales=datos.bovinos,
                texto=datos.texto,
                geom=WKTElement(f"POINT({datos.lon} {datos.lat})", srid=SRID),
                sector_id=sector_de_punto(db, datos.lon, datos.lat),
                detalle={
                    "perfil": datos.perfil,
                    "detalle_bovinos": datos.detalle_bovinos,
                    "acceso": datos.acceso,
                    "canal": canal,
                },
            )
        if nuevo_id is None:
            return {
                "tipo": "solicitud",
                "estado": "duplicado",
                "id": _solicitud_existente(db, canal, m.mensaje_id),
            }
        sol = db.get(SolicitudAsistencia, nuevo_id)
        eventos.append(("solicitud", {"id": sol.id, "estado": "recibida", "origen": canal}))
        return {"tipo": "solicitud", "estado": "creado", "id": sol.id, "sector_id": sol.sector_id}

    # Texto libre: se extrae lo que el mensaje dice y se marca "a verificar por el operador".
    libre = norm.normalizar(m.texto)
    if not libre.util:
        return {
            "tipo": "no_entendido",
            "estado": "respuesta",
            "respuesta": norm.RESPUESTA_NO_ENTENDIDO,
        }
    detalle = {
        "canal": canal,
        "normalizador": {
            "especie": libre.especie,
            "acceso": libre.acceso,
            "faltantes": libre.faltantes,
        },
        "a_verificar": "A verificar por operador: texto libre sin coordenadas",
    }
    with db.begin_nested():
        nuevo_id = _insertar_solicitud(
            db,
            canal,
            m.mensaje_id,
            tipo="sos_texto",
            personas=libre.personas or 0,
            animales=libre.animales or 0,
            texto=libre.texto,
            geom=None,
            sector_id=None,
            ubicacion_aproximada=True,
            referencia_ubicacion=libre.referencia_ubicacion,
            requiere_verificacion=True,
            detalle=detalle,
        )
    if nuevo_id is None:
        return {
            "tipo": "solicitud",
            "estado": "duplicado",
            "id": _solicitud_existente(db, canal, m.mensaje_id),
        }
    eventos.append(("solicitud", {"id": nuevo_id, "estado": "recibida", "origen": canal}))
    return {
        "tipo": "solicitud",
        "estado": "creado",
        "id": nuevo_id,
        "sector_id": None,
        "ubicacion_aproximada": True,
        "requiere_verificacion": True,
        "extraido": {
            "personas": libre.personas,
            "animales": libre.animales,
            "especie": libre.especie,
            "acceso": libre.acceso,
            "referencia_ubicacion": libre.referencia_ubicacion,
            "faltantes": libre.faltantes,
        },
        "respuesta": (
            f"Recibimos tu mensaje (pedido #{nuevo_id}). Un operador lo va a verificar. "
            "Si hay peligro inmediato, llamá al 103."
        ),
    }


def _procesar(db: Session, mensajes: list[_Mensaje], canal: str) -> dict:
    """Procesa cada mensaje por separado (savepoint): uno inválido o repetido no tira a los demás.

    Si ningún mensaje se pudo procesar y hubo errores, responde 422 con el primero (así un SMS mal
    formado sigue dando 422); si hubo al menos un mensaje válido, responde 201 con el detalle de
    cada uno (``estado``: ``creado``, ``duplicado``, ``respuesta`` o ``error``).
    """
    if not mensajes:
        raise HTTPException(422, "No hay mensajes de texto para procesar")
    resultados: list[dict] = []
    eventos: list[tuple[str, dict]] = []
    errores: list[str] = []
    for m in mensajes:
        try:
            resultados.append(_procesar_uno(db, m, canal, eventos))
        except pm.ErrorParseo as exc:
            errores.append(str(exc))
            resultados.append({"tipo": "error", "estado": "error", "mensaje": str(exc)})
    if len(errores) == len(mensajes):
        db.rollback()
        raise HTTPException(422, f"Mensaje inválido: {errores[0]}")
    db.commit()
    for tipo, datos in eventos:
        difusor.publicar(tipo, datos)
    return {"canal": canal, "categoria": "SIMULADO", "resultados": resultados}


@router.post("/whatsapp-sim", status_code=201)
def whatsapp(cuerpo: bytes = Depends(cuerpo_firmado), db: Session = Depends(get_db)) -> dict:
    try:
        datos = WhatsAppIn.model_validate(json.loads(cuerpo))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Payload con formato de WhatsApp inválido") from exc
    mensajes = [
        _Mensaje(m.text.body, _momento(m.timestamp), m.id)
        for e in datos.entry
        for c in e.changes
        for m in c.value.messages
        if m.type == "text" and m.text is not None
    ]
    return _procesar(db, mensajes, "whatsapp_sim")


@router.post("/sms-sim", status_code=201)
def sms(cuerpo: bytes = Depends(cuerpo_firmado), db: Session = Depends(get_db)) -> dict:
    try:
        datos = SMSIn.model_validate(json.loads(cuerpo))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Payload SMS inválido") from exc
    momento = _momento(datos.recibido_en)
    mid = datos.mensaje_id
    if mid is None and datos.recibido_en is not None:  # mismo remitente, texto y hora = reintento
        mid = (
            "h-"
            + hashlib.sha256(
                f"{datos.remitente}|{datos.texto}|{datos.recibido_en.isoformat()}".encode()
            ).hexdigest()[:40]
        )
    return _procesar(db, [_Mensaje(datos.texto, momento, mid)], "sms_sim")


@router.post("/ivr-sim", status_code=201)
def ivr(cuerpo: bytes = Depends(cuerpo_firmado), db: Session = Depends(get_db)) -> dict:
    try:
        datos = IVRIn.model_validate(json.loads(cuerpo))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Payload IVR inválido") from exc
    return _procesar(
        db, [_Mensaje(datos.texto(), _momento(datos.recibido_en), datos.llamada_id)], "ivr_sim"
    )
