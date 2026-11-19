"""Constancias de evacuación y confirmaciones del evacuado (CLAUDE.md §8.6, §8.7).

Reúne la lógica con acceso a la base que comparten la API, los canales simulados y el seed:

- ``cerrar_tarea``: crea la constancia, cierra la tarea y pide la confirmación al solicitante.
- ``registrar_confirmacion``: guarda la respuesta del evacuado (app o SMS) y avisa de discrepancias.
- ``listar``: evacuaciones con su estado derivado (ver ``app.domain.evacuaciones``).
- ``bloque_panel``: el bloque ``evacuaciones`` de ``GET /panel/resumen``.

Los métodos que cambian datos no hacen commit ni publican eventos: devuelven los eventos para que el
llamador los publique después de confirmar la transacción.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from fastapi import HTTPException
from geoalchemy2 import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.core.tiempo import hoy_ar
from app.db.base import SRID, ahora
from app.db.modelos import (
    CentroRecepcion,
    ConfirmacionEvacuado,
    ConstanciaTarea,
    Cuadrilla,
    Notificacion,
    Sector,
    SolicitudAsistencia,
    Tarea,
    Usuario,
)
from app.domain import evacuaciones as dom
from app.domain.ruteo import haversine_m
from app.servicios import ordenes as srv_ordenes

CATEGORIA = "SIMULADO"
FUENTE = "Constancias de cuadrilla y confirmaciones de evacuados (SIMULADO)"
TIPO_CONFIRMACION = "confirmacion_evacuacion"
TIPO_DISCREPANCIA = "discrepancia"
PROTOTIPO = "[PROTOTIPO: no es una herramienta oficial]"
TEXTO_MOTIVO = {
    dom.MOTIVO_NO: "el evacuado dice que no llegó",
    dom.MOTIVO_PROBLEMA: "el evacuado reportó un problema",
    dom.MOTIVO_LEJOS: "el destino registrado queda lejos del centro elegido",
}

# Respuestas fijas por SMS (texto plano, sin datos personales).
RESPUESTA_SMS = {
    "si": f"Gracias por confirmar. Registramos que llegaste a destino. {PROTOTIPO}",
    "no": (
        "Registramos que no llegaste a destino y avisamos al operador. "
        f"Si estás en peligro, llamá al 103. {PROTOTIPO}"
    ),
    "problema": (
        "Registramos el problema que nos contás y avisamos al operador. "
        f"Si estás en peligro, llamá al 103. {PROTOTIPO}"
    ),
}
RESPUESTA_SMS_CODIGO_INVALIDO = (
    "No encontramos ese código. Revisá el mensaje que recibiste y escribí SI o NO seguido del "
    f"código. Si estás en peligro, llamá al 103. {PROTOTIPO}"
)
RESPUESTA_SMS_REPETIDA = f"Ya registramos tu respuesta para este traslado. Gracias. {PROTOTIPO}"


def distancia_max_m() -> float:
    return float(supuesto("distancia_max_destino_m"))


@dataclass
class Resultado:
    """Efecto de una operación: eventos a publicar tras el commit."""

    estado: str | None = None
    motivos: list[str] = field(default_factory=list)
    eventos: list[tuple[str, dict]] = field(default_factory=list)
    confirmacion_solicitada: bool = False


# ---- lectura ----------------------------------------------


def _constancia_a_dict(
    c: ConstanciaTarea, centro_nombre: str | None, lon: float | None, lat: float | None
) -> dict:
    return {
        "id": c.id,
        "tarea_id": c.tarea_id,
        "rol_operativo": c.rol_operativo,
        "destino": {
            "lat": lat,
            "lon": lon,
            "centro_id": c.centro_id,
            "centro_nombre": centro_nombre,
            "distancia_a_centro_m": (
                None if c.distancia_a_centro_m is None else round(c.distancia_a_centro_m)
            ),
        },
        "personas_trasladadas": c.personas_trasladadas,
        "animales_trasladados": c.animales_trasladados or {},
        "nota": c.nota,
        "adjuntos": [
            {"n": a["n"], "mime": a["mime"], "bytes": a["bytes"]} for a in (c.adjuntos or [])
        ],
        "creada_en": c.creada_en.isoformat(),
        "categoria": c.categoria,
    }


def _confirmacion_a_dict(k: ConfirmacionEvacuado) -> dict:
    return {
        "respuesta": k.respuesta,
        "canal": k.canal,
        "comentario": k.comentario,
        "solicitada_en": k.creada_en.isoformat(),
        "respondida_en": k.respondida_en.isoformat() if k.respondida_en else None,
    }


def _centroides_sectores(db: Session) -> dict[str, tuple[float, float]]:
    filas = db.execute(
        select(
            Sector.id,
            func.ST_X(func.ST_Centroid(Sector.geom)),
            func.ST_Y(func.ST_Centroid(Sector.geom)),
        )
    ).all()
    return {sid: (x, y) for sid, x, y in filas}


def listar(
    db: Session,
    *,
    estado: str | None = None,
    sector_id: str | None = None,
    tarea_id: int | None = None,
) -> list[dict]:
    """Evacuaciones (tareas no canceladas) con su estado derivado, de la más nueva a la más vieja."""
    consulta = (
        select(
            Tarea,
            ConstanciaTarea,
            ConfirmacionEvacuado,
            SolicitudAsistencia,
            CentroRecepcion.nombre,
            Cuadrilla.nombre,
            func.ST_X(ConstanciaTarea.geom_destino),
            func.ST_Y(ConstanciaTarea.geom_destino),
            func.ST_X(SolicitudAsistencia.geom),
            func.ST_Y(SolicitudAsistencia.geom),
        )
        .outerjoin(ConstanciaTarea, ConstanciaTarea.tarea_id == Tarea.id)
        .outerjoin(ConfirmacionEvacuado, ConfirmacionEvacuado.tarea_id == Tarea.id)
        .outerjoin(SolicitudAsistencia, SolicitudAsistencia.id == Tarea.solicitud_id)
        .outerjoin(CentroRecepcion, CentroRecepcion.id == ConstanciaTarea.centro_id)
        .outerjoin(Cuadrilla, Cuadrilla.id == Tarea.cuadrilla_id)
        .where(Tarea.estado != "cancelada")
        .order_by(Tarea.id.desc())
    )
    if tarea_id is not None:
        consulta = consulta.where(Tarea.id == tarea_id)
    if sector_id:
        consulta = consulta.where(Tarea.sector_id == sector_id)
    centroides = _centroides_sectores(db)
    maximo = distancia_max_m()
    items: list[dict] = []
    for t, c, k, s, centro, cuadrilla, dx, dy, sx, sy in db.execute(consulta).all():
        est, motivos = dom.estado_evacuacion(
            t.estado,
            k.respuesta if k else None,
            c.distancia_a_centro_m if c else None,
            maximo,
        )
        if est is None or (estado and est != estado):
            continue
        origen = None
        if s is not None and sx is not None and not s.ubicacion_aproximada:
            origen = {"lat": sy, "lon": sx, "tipo": "solicitud"}
        elif t.sector_id in centroides:
            lon, lat = centroides[t.sector_id]
            origen = {"lat": lat, "lon": lon, "tipo": "sector"}
        items.append(
            {
                "tarea_id": t.id,
                "tarea_estado": t.estado,
                "estado": est,
                "titulo": t.titulo,
                "sector_id": t.sector_id,
                "cuadrilla_id": t.cuadrilla_id,
                "cuadrilla_nombre": cuadrilla,
                "solicitud_id": t.solicitud_id,
                "orden_id": t.orden_id,
                "origen": origen,
                "constancia": _constancia_a_dict(c, centro, dx, dy) if c else None,
                "confirmacion": _confirmacion_a_dict(k) if k else None,
                "discrepancia": {"motivos": motivos} if motivos else None,
                "actualizado_en": t.actualizado_en.isoformat(),
                "categoria": CATEGORIA,
                "fuente": FUENTE,
            }
        )
    return items


def bloque_panel(db: Session) -> dict:
    """Bloque ``evacuaciones`` de ``GET /panel/resumen`` (agregados, sin ubicaciones)."""
    items = listar(db)
    por_estado = {e: 0 for e in dom.ESTADOS}
    por_sector: dict[str, dict[str, int]] = {}
    animales: Counter = Counter()
    personas = 0
    for i in items:
        por_estado[i["estado"]] += 1
        sector = por_sector.setdefault(i["sector_id"] or "sin_sector", {e: 0 for e in dom.ESTADOS})
        sector[i["estado"]] += 1
        c = i["constancia"]
        if c:
            personas += c["personas_trasladadas"]
            animales.update(c["animales_trasladados"])
    cerradas = sum(por_estado[e] for e in ("cerrada_cuadrilla", "verificada", "con_discrepancia"))
    return {
        "categoria": CATEGORIA,
        "fuente": FUENTE,
        "fecha_dato": hoy_ar().isoformat(),
        "total": len(items),
        "por_estado": por_estado,
        "por_sector": por_sector,
        # Sobre las evacuaciones que la cuadrilla ya cerró: cuántas confirmó también el evacuado.
        "verificadas_pct": (
            round(100 * por_estado["verificada"] / cerradas, 1) if cerradas else None
        ),
        "discrepancias_abiertas": por_estado["con_discrepancia"],
        "personas_trasladadas": personas,
        "animales_trasladados": dict(animales),
        "animales_trasladados_total": sum(animales.values()),
        "distancia_max_destino_m": distancia_max_m(),
    }


# ---- avisos ----------------------------------------------


def _avisar_discrepancia(db: Session, tarea: Tarea, motivos: list[str]) -> list[tuple[str, dict]]:
    """Aviso a los operadores y evento ``discrepancia`` (solo ids, sin ubicaciones)."""
    texto = "; ".join(TEXTO_MOTIVO[m] for m in motivos)
    mensaje = (
        f"Revisar la evacuación de la tarea #{tarea.id}"
        f"{'' if not tarea.sector_id else f' ({tarea.sector_id})'}: {texto}. "
        f"Es una marca para revisar, no una acusación. {PROTOTIPO}"
    )
    operadores = db.execute(
        select(Usuario.id).where(Usuario.rol == "operador", Usuario.estado == "activo")
    ).scalars()
    for uid in operadores:
        db.add(
            Notificacion(
                usuario_id=uid,
                tipo=TIPO_DISCREPANCIA,
                mensaje=mensaje,
                datos={"tarea_id": tarea.id, "sector_id": tarea.sector_id, "motivos": motivos},
            )
        )
    return [
        (
            "discrepancia",
            {"tarea_id": tarea.id, "sector_id": tarea.sector_id, "motivos": motivos},
        )
    ]


def _codigo_nuevo(db: Session) -> str:
    while True:
        codigo = dom.generar_codigo()
        if not db.execute(
            select(ConfirmacionEvacuado.id).where(ConfirmacionEvacuado.codigo == codigo)
        ).first():
            return codigo


# ---- cierre con constancia ----------------------------------------------


def cerrar_tarea(
    db: Session,
    tarea: Tarea,
    usuario: Usuario,
    rol_operativo: str | None,
    *,
    lon: float,
    lat: float,
    centro_id: int | None,
    personas: int,
    animales: dict[str, int],
    nota: str | None,
    clave: str | None,
) -> tuple[ConstanciaTarea, Resultado]:
    """Crea la constancia y cierra la tarea. No hace commit (lo hace el llamador)."""
    distancia = None
    if centro_id is not None:
        centro = db.execute(
            select(
                CentroRecepcion.id, func.ST_X(CentroRecepcion.geom), func.ST_Y(CentroRecepcion.geom)
            ).where(CentroRecepcion.id == centro_id)
        ).first()
        if centro is None:
            raise HTTPException(422, "centro_id inexistente")
        distancia = haversine_m(lon, lat, centro[1], centro[2])
    constancia = ConstanciaTarea(
        tarea_id=tarea.id,
        cerrada_por=usuario.id,
        rol_operativo=rol_operativo,
        geom_destino=WKTElement(f"POINT({lon} {lat})", srid=SRID),
        centro_id=centro_id,
        distancia_a_centro_m=distancia,
        personas_trasladadas=personas,
        animales_trasladados={k: v for k, v in animales.items() if v > 0},
        nota=nota,
        adjuntos=[],
        idempotency_key=clave,
        categoria=CATEGORIA,
    )
    db.add(constancia)
    tarea.estado = "completada"
    tarea.actualizado_en = ahora()
    db.flush()
    srv_ordenes.liberar_si_sin_tareas(db, tarea.cuadrilla_id)

    solicitud = db.get(SolicitudAsistencia, tarea.solicitud_id) if tarea.solicitud_id else None
    confirmacion_solicitada = False
    if solicitud is not None and solicitud.solicitante_id is not None:
        centro_nombre = (
            db.execute(
                select(CentroRecepcion.nombre).where(CentroRecepcion.id == centro_id)
            ).scalar_one_or_none()
            if centro_id
            else None
        )
        codigo = _codigo_nuevo(db)
        db.add(ConfirmacionEvacuado(tarea_id=tarea.id, solicitud_id=solicitud.id, codigo=codigo))
        destino = centro_nombre or "el destino indicado por la cuadrilla"
        db.add(
            Notificacion(
                usuario_id=solicitud.solicitante_id,
                tipo=TIPO_CONFIRMACION,
                mensaje=(
                    f"¿Llegaste a {destino}? La cuadrilla registró tu traslado (pedido "
                    f"#{solicitud.id}). Respondé en la app o por SMS: SI {codigo}, NO {codigo} o "
                    f"PROBLEMA {codigo} y el detalle. {PROTOTIPO}"
                ),
                datos={
                    "tarea_id": tarea.id,
                    "solicitud_id": solicitud.id,
                    "codigo": codigo,
                    "centro_nombre": centro_nombre,
                    "respuestas": list(dom.RESPUESTAS),
                },
            )
        )
        confirmacion_solicitada = True
    db.flush()

    estado, motivos = dom.estado_evacuacion("completada", None, distancia, distancia_max_m())
    r = Resultado(estado=estado, motivos=motivos, confirmacion_solicitada=confirmacion_solicitada)
    r.eventos.append(
        (
            "constancia",
            {
                "tarea_id": tarea.id,
                "sector_id": tarea.sector_id,
                "estado": estado,
                "personas_trasladadas": personas,
                "motivo": "cierre",
            },
        )
    )
    if motivos:
        r.eventos += _avisar_discrepancia(db, tarea, motivos)
    r.eventos.append(
        ("tarea", {"id": tarea.id, "estado": tarea.estado, "cuadrilla_id": tarea.cuadrilla_id})
    )
    return constancia, r


# ---- confirmación del evacuado ----------------------------------------------


def registrar_confirmacion(
    db: Session,
    confirmacion_id: int,
    respuesta: str,
    comentario: str | None,
    canal: str,
    usuario_id: int | None,
) -> tuple[str, ConfirmacionEvacuado, Resultado]:
    """Guarda la respuesta. Devuelve ``(resultado, confirmación, efectos)``.

    ``resultado``: ``registrada``, ``repetida`` (misma respuesta) o ``conflicto`` (ya respondió
    otra cosa: la respuesta es una sola y no se pisa, para conservar la traza).
    """
    k = db.execute(
        select(ConfirmacionEvacuado)
        .where(ConfirmacionEvacuado.id == confirmacion_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one()
    if k.respuesta is not None:
        return ("repetida" if k.respuesta == respuesta else "conflicto"), k, Resultado()
    tarea = db.get(Tarea, k.tarea_id)
    constancia = db.execute(
        select(ConstanciaTarea).where(ConstanciaTarea.tarea_id == k.tarea_id)
    ).scalar_one_or_none()
    distancia = constancia.distancia_a_centro_m if constancia else None
    maximo = distancia_max_m()
    antes, _ = dom.estado_evacuacion(tarea.estado, None, distancia, maximo)
    k.respuesta = respuesta
    k.comentario = comentario
    k.canal = canal
    k.usuario_id = usuario_id
    k.respondida_en = ahora()
    db.flush()
    despues, motivos = dom.estado_evacuacion(tarea.estado, respuesta, distancia, maximo)
    r = Resultado(estado=despues, motivos=motivos)
    r.eventos.append(
        (
            "constancia",
            {
                "tarea_id": tarea.id,
                "sector_id": tarea.sector_id,
                "estado": despues,
                "motivo": "confirmacion",
            },
        )
    )
    if despues == "con_discrepancia" and antes != "con_discrepancia":
        r.eventos += _avisar_discrepancia(db, tarea, motivos)
    return "registrada", k, r


def procesar_respuesta_sms(db: Session, texto: str, canal: str, eventos: list) -> dict | None:
    """Procesa ``SI|NO|PROBLEMA <código>``. ``None`` si el texto no tiene ese formato."""
    parsed = dom.parsear_respuesta_sms(texto)
    if parsed is None:
        return None
    k = db.execute(
        select(ConfirmacionEvacuado).where(ConfirmacionEvacuado.codigo == parsed.codigo)
    ).scalar_one_or_none()
    if k is None:
        return {
            "tipo": "confirmacion",
            "estado": "codigo_invalido",
            "respuesta": RESPUESTA_SMS_CODIGO_INVALIDO,
        }
    resultado, k, efectos = registrar_confirmacion(
        db, k.id, parsed.respuesta, parsed.comentario, canal, None
    )
    eventos.extend(efectos.eventos)
    if resultado == "registrada":
        return {
            "tipo": "confirmacion",
            "estado": "creado",
            "tarea_id": k.tarea_id,
            "respuesta": RESPUESTA_SMS[parsed.respuesta],
        }
    return {
        "tipo": "confirmacion",
        "estado": "duplicado",
        "tarea_id": k.tarea_id,
        "respuesta": RESPUESTA_SMS_REPETIDA,
    }
