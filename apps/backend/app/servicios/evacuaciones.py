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
from datetime import timedelta

from fastapi import HTTPException
from geoalchemy2 import WKTElement
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.core import auditoria, cifrado
from app.core.tiempo import hoy_ar
from app.db.base import SRID, ahora
from app.db.modelos import (
    AuditoriaAcceso,
    CentroRecepcion,
    ConfirmacionEvacuado,
    ConstanciaTarea,
    Cuadrilla,
    GrupoFamiliar,
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
    dom.MOTIVO_PARCIAL: "el evacuado dice que la asistencia fue parcial",
    dom.MOTIVO_NO_ENCONTRARON: "el evacuado dice que la cuadrilla no lo encontró",
    dom.MOTIVO_LEJOS: "el destino registrado queda lejos del centro elegido",
}

# Respuesta única por SMS: es la misma exista o no el código, coincida o no el teléfono, esté o no
# vencido o bloqueado el remitente. Así el canal no revela qué códigos existen.
RESPUESTA_SMS_GENERICA = (
    "Recibimos tu respuesta. Si corresponde a un pedido tuyo, la vamos a registrar. "
    f"Si estás en peligro, llamá al 103. {PROTOTIPO}"
)
ACCION_SMS_INVALIDA = "confirmacion_sms_invalida"
ACCION_SMS_BLOQUEADA = "confirmacion_sms_bloqueada"
ACCION_SMS_DESCONOCIDA = "confirmacion_sms_desconocida"
ACCION_SMS_CODIGO_INVALIDADO = "confirmacion_sms_codigo_invalidado"


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


def _notificar_confirmacion(
    db: Session, solicitud: SolicitudAsistencia, tarea_id: int, codigo: str, centro_id: int | None
) -> None:
    """Notificación al solicitante con el código para confirmar (app o SMS)."""
    centro_nombre = (
        db.execute(
            select(CentroRecepcion.nombre).where(CentroRecepcion.id == centro_id)
        ).scalar_one_or_none()
        if centro_id
        else None
    )
    destino = centro_nombre or "el destino indicado por la cuadrilla"
    db.add(
        Notificacion(
            usuario_id=solicitud.solicitante_id,
            tipo=TIPO_CONFIRMACION,
            mensaje=(
                f"¿Llegaste a {destino}? La cuadrilla registró tu traslado (pedido "
                f"#{solicitud.id}). Respondé en la app o por SMS desde tu teléfono registrado: "
                f"SI {codigo}, PARCIAL {codigo}, NO {codigo} o PROBLEMA {codigo} y el detalle. {PROTOTIPO}"
            ),
            datos={
                "tarea_id": tarea_id,
                "solicitud_id": solicitud.id,
                "codigo": codigo,
                "centro_nombre": centro_nombre,
                "respuestas": list(dom.RESPUESTAS),
            },
        )
    )


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
        codigo = _codigo_nuevo(db)
        db.add(ConfirmacionEvacuado(tarea_id=tarea.id, solicitud_id=solicitud.id, codigo=codigo))
        _notificar_confirmacion(db, solicitud, tarea.id, codigo, centro_id)
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
    respuesta = dom.normalizar_respuesta(respuesta) or respuesta
    if k.respuesta is not None:
        previa = dom.normalizar_respuesta(k.respuesta)
        return ("repetida" if previa == respuesta else "conflicto"), k, Resultado()
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


def _telefono_del_solicitante(db: Session, usuario_id: int | None) -> str | None:
    """Teléfono registrado en el grupo familiar (cifrado en la base), o ``None``."""
    if usuario_id is None:
        return None
    valor = db.execute(
        select(GrupoFamiliar.telefono_cifrado).where(GrupoFamiliar.usuario_id == usuario_id)
    ).scalar_one_or_none()
    if not valor:
        return None
    return cifrado.descifrar(valor, "grupos_familiares.telefono")


def _clave_remitente(remitente: str | None) -> str:
    """Pseudónimo (HMAC con clave del servidor) de la forma canónica del teléfono del remitente.

    Nunca se registra el número. Los remitentes sin teléfono válido comparten una clave.
    """
    return cifrado.pseudonimo(dom.clave_telefono(remitente) or "sin_remitente", "sms-remitente")


def _clave_codigo(codigo: str) -> str:
    return cifrado.pseudonimo(codigo, "sms-codigo")


def _bloquear(db: Session, clave: str) -> None:
    """Candado de transacción sobre ``clave``: los conteos y las altas de fallos se serializan."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": clave})


def _contar(db: Session, accion: str, recurso: str | None = None, patron: str | None = None) -> int:
    desde = ahora() - timedelta(hours=1)
    consulta = (
        select(func.count())
        .select_from(AuditoriaAcceso)
        .where(AuditoriaAcceso.accion == accion, AuditoriaAcceso.fecha >= desde)
    )
    if recurso is not None:
        consulta = consulta.where(AuditoriaAcceso.recurso == recurso)
    if patron is not None:
        consulta = consulta.where(AuditoriaAcceso.recurso.like(patron))
    return db.execute(consulta).scalar_one()


def _bloqueo_una_vez(db: Session, recurso: str, detalle: str) -> None:
    if _contar(db, ACCION_SMS_BLOQUEADA, recurso) == 0:
        auditoria.registrar(db, ACCION_SMS_BLOQUEADA, recurso, None, None, detalle)


def procesar_respuesta_sms(
    db: Session, texto: str, canal: str, remitente: str | None, eventos: list
) -> dict | None:
    """Procesa ``SI|NO|PROBLEMA <código>``. ``None`` si el texto no tiene ese formato.

    La respuesta solo tiene efecto si el código existe, no venció ni fue invalidado y el remitente
    es el teléfono registrado del solicitante. En **todos** los casos se devuelve el mismo texto,
    para no revelar qué códigos existen. Los fallos se limitan sin bloquear a quien presenta un
    código válido desde su teléfono:

    - contra un código **existente**: tope por (remitente, código) y tope por código sumando a todos
      los remitentes (superado, el código queda invalidado para SMS);
    - contra códigos **inexistentes**: tope grueso por remitente (que nunca frena un código válido).

    Los conteos se hacen bajo un candado de transacción por clave (``pg_advisory_xact_lock``), de
    modo que fallos simultáneos no superan los topes. Cada fallo queda en la bitácora de accesos con
    remitente y código seudonimizados (HMAC).
    """
    parsed = dom.parsear_respuesta_sms(texto)
    if parsed is None:
        return None
    resultado = {"tipo": "confirmacion", "estado": "recibido", "respuesta": RESPUESTA_SMS_GENERICA}
    sender = _clave_remitente(remitente)
    code = _clave_codigo(parsed.codigo)
    # Orden fijo de candados (remitente, luego código): sin interbloqueos.
    _bloquear(db, f"sms:r:{sender}")
    _bloquear(db, f"sms:c:{code}")

    k = db.execute(
        select(ConfirmacionEvacuado).where(ConfirmacionEvacuado.codigo == parsed.codigo)
    ).scalar_one_or_none()
    solicitud = db.get(SolicitudAsistencia, k.solicitud_id) if k and k.solicitud_id else None

    if k is None or solicitud is None or k.codigo_invalidado_en is not None:
        # Código inexistente (o invalidado): solo cuenta contra el remitente, con un tope grueso.
        recurso = f"canales/sms/{sender}"
        tope = int(supuesto("confirmacion_sms_desconocidos_por_hora"))
        if _contar(db, ACCION_SMS_DESCONOCIDA, recurso) >= tope:
            _bloqueo_una_vez(db, recurso, f"más de {tope} códigos inexistentes en 1 h")
        else:
            auditoria.registrar(
                db, ACCION_SMS_DESCONOCIDA, recurso, None, None, "codigo_desconocido"
            )
        return resultado

    vencido = ahora() > k.creada_en + timedelta(hours=float(supuesto("vigencia_codigo_horas")))
    coincide = dom.telefonos_coinciden(
        remitente, _telefono_del_solicitante(db, solicitud.solicitante_id)
    )
    if not vencido and coincide:
        estado, k, efectos = registrar_confirmacion(
            db, k.id, parsed.respuesta, parsed.comentario, canal, solicitud.solicitante_id
        )
        if estado == "registrada":
            auditoria.registrar(
                db,
                "confirmacion_evacuado",
                f"tareas/{k.tarea_id}/confirmacion",
                solicitud.solicitante_id,
                None,
                f"{parsed.respuesta}:{canal}",
            )
            eventos.extend(efectos.eventos)
        return resultado

    # Fallo contra un código existente: vencido o teléfono distinto.
    recurso_par = f"canales/sms/{sender}/{code}"
    if _contar(db, ACCION_SMS_INVALIDA, recurso_par) >= int(
        supuesto("confirmacion_sms_invalidos_por_hora")
    ):
        _bloqueo_una_vez(db, recurso_par, "tope de intentos de este remitente contra este código")
        return resultado
    auditoria.registrar(
        db,
        ACCION_SMS_INVALIDA,
        recurso_par,
        None,
        None,
        "codigo_vencido" if vencido else "remitente_no_coincide",
    )
    if _contar(db, ACCION_SMS_INVALIDA, patron=f"canales/sms/%/{code}") >= int(
        supuesto("confirmacion_sms_fallos_por_codigo")
    ):
        k.codigo_invalidado_en = ahora()
        auditoria.registrar(
            db,
            ACCION_SMS_CODIGO_INVALIDADO,
            f"tareas/{k.tarea_id}/confirmacion",
            None,
            None,
            "demasiados intentos fallidos por SMS",
        )
    return resultado


def reabrir_confirmacion(
    db: Session, tarea_id: int
) -> tuple[ConfirmacionEvacuado, str | None, Resultado]:
    """Reabre una confirmación respondida (la corrige un operador).

    Borra la respuesta, genera un código nuevo con vigencia renovada y se lo notifica de nuevo al
    solicitante. Devuelve ``(confirmación, respuesta_previa, efectos)``.
    """
    k = db.execute(
        select(ConfirmacionEvacuado)
        .where(ConfirmacionEvacuado.tarea_id == tarea_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if k is None:
        raise HTTPException(404, "La evacuación no tiene una confirmación para reabrir")
    if k.respuesta is None and k.codigo_invalidado_en is None:
        raise HTTPException(409, "La confirmación todavía no fue respondida")
    previa = k.respuesta
    k.respuesta = k.comentario = k.canal = k.usuario_id = k.respondida_en = None
    k.codigo = _codigo_nuevo(db)
    k.creada_en = ahora()
    k.codigo_invalidado_en = None
    db.flush()
    tarea = db.get(Tarea, tarea_id)
    constancia = db.execute(
        select(ConstanciaTarea).where(ConstanciaTarea.tarea_id == tarea_id)
    ).scalar_one_or_none()
    solicitud = db.get(SolicitudAsistencia, k.solicitud_id) if k.solicitud_id else None
    if solicitud is not None and solicitud.solicitante_id is not None:
        _notificar_confirmacion(
            db, solicitud, tarea_id, k.codigo, constancia.centro_id if constancia else None
        )
    estado, motivos = dom.estado_evacuacion(
        tarea.estado,
        None,
        constancia.distancia_a_centro_m if constancia else None,
        distancia_max_m(),
    )
    r = Resultado(estado=estado, motivos=motivos)
    r.eventos.append(
        (
            "constancia",
            {
                "tarea_id": tarea_id,
                "sector_id": tarea.sector_id,
                "estado": estado,
                "motivo": "reapertura",
            },
        )
    )
    return k, previa, r
