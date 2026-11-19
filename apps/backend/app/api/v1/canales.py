"""Canales simulados: WhatsApp, SMS e IVR (CLAUDE.md §8.10, §9 · Canales).

Cada endpoint recibe el mismo formato que usaría el proveedor real y verifica la firma HMAC SHA-256
del cuerpo crudo en ``X-Hub-Signature-256: sha256=<hex>`` (el esquema de la Meta Cloud API). El
secreto sale de ``CANAL_HMAC_SECRET``. Los mensajes pasan por ``parser_mensajes`` y crean una
``solicitud_asistencia`` (``SOS-FSA|...``) o una ``lectura_lluvia`` (``LLUVIA <PUESTO> <MM>``).

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
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from geoalchemy2 import WKTElement
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.core.eventos import difusor
from app.core.tiempo import ARGENTINA
from app.db.base import SRID
from app.db.consultas import sector_de_punto
from app.db.modelos import SolicitudAsistencia
from app.db.sesion import get_db
from app.domain import parser_mensajes as pm
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


class IVRIn(_Base):
    llamada_id: str = Field(max_length=60)
    transcripcion: str = Field(max_length=1000)
    recibido_en: datetime | None = None


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


def _procesar(db: Session, mensajes: list[tuple[str, datetime]], canal: str) -> dict:
    """Valida todos los mensajes primero (422 si alguno está mal formado) y recién ahí guarda."""
    analizados = []
    for texto, momento in mensajes:
        try:
            tipo = pm.clasificar(texto)
            analizados.append(
                (
                    tipo,
                    pm.parsear_lluvia(texto) if tipo == "lluvia" else pm.parsear_sos(texto),
                    momento,
                )
            )
        except pm.ErrorParseo as exc:
            raise HTTPException(422, f"Mensaje inválido: {exc}") from exc
    if not analizados:
        raise HTTPException(422, "No hay mensajes de texto para procesar")

    resultados: list[dict] = []
    eventos: list[tuple[str, dict, int | None]] = []
    for tipo, datos, momento in analizados:
        if tipo == "lluvia":
            try:
                lectura, advertencias = srv.registrar_lectura(
                    db, datos.codigo_puesto, momento.date(), _turno(momento), datos.mm, "simulado"
                )
            except srv.ErrorLluvia as exc:
                db.rollback()
                # Puesto desconocido o dato inválido en el mensaje: es un problema del mensaje.
                raise HTTPException(422 if exc.estado == 404 else exc.estado, exc.mensaje) from exc
            resultados.append({"tipo": "lluvia", "id": lectura.id, "advertencias": advertencias})
        else:
            solicitud = SolicitudAsistencia(
                origen=canal,
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
            db.add(solicitud)
            db.flush()
            resultados.append(
                {"tipo": "solicitud", "id": solicitud.id, "sector_id": solicitud.sector_id}
            )
            eventos.append(
                ("solicitud", {"id": solicitud.id, "estado": "recibida", "origen": canal}, None)
            )
    db.commit()
    for tipo, datos, usuario_id in eventos:
        difusor.publicar(tipo, datos, usuario_id)
    return {"canal": canal, "categoria": "SIMULADO", "resultados": resultados}


@router.post("/whatsapp-sim", status_code=201)
def whatsapp(cuerpo: bytes = Depends(cuerpo_firmado), db: Session = Depends(get_db)) -> dict:
    try:
        datos = WhatsAppIn.model_validate(json.loads(cuerpo))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Payload con formato de WhatsApp inválido") from exc
    mensajes = [
        (m.text.body, _momento(m.timestamp))
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
    return _procesar(db, [(datos.texto, _momento(datos.recibido_en))], "sms_sim")


@router.post("/ivr-sim", status_code=201)
def ivr(cuerpo: bytes = Depends(cuerpo_firmado), db: Session = Depends(get_db)) -> dict:
    try:
        datos = IVRIn.model_validate(json.loads(cuerpo))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Payload IVR inválido") from exc
    return _procesar(db, [(datos.transcripcion, _momento(datos.recibido_en))], "ivr_sim")
