"""Pedidos propios con su línea de tiempo (``GET /mi/pedidos``, CLAUDE.md §8.6, §9).

Reúne, para cada solicitud de asistencia de la persona: la línea de tiempo de los cinco estados, la
tarea y la cuadrilla asignadas (por rol y tipo, nunca por nombre de persona), el seguimiento en
vivo, la consulta de confirmación y el centro de recepción registrado en la constancia.

Marcas de tiempo (``en``): solo se informa una hora cuando el sistema la registró de verdad; si el
estado se alcanzó pero no hay registro, ``en`` es ``None`` y ``alcanzado`` es ``True``.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.modelos import (
    AuditoriaAcceso,
    CentroRecepcion,
    ConfirmacionEvacuado,
    ConstanciaTarea,
    Cuadrilla,
    IntegranteCuadrilla,
    SolicitudAsistencia,
    Tarea,
)
from app.servicios import seguimiento as srv_seguimiento

CATEGORIA = "SIMULADO"
ESTADOS = ("recibida", "verificada", "asignada", "en_curso", "resuelta")
ROL_ENCARGADO = "encargado_cuadrilla"
LIMITE = 100


def _iso(valor) -> str | None:
    return valor.isoformat() if valor is not None else None


def _marcas_auditadas(db: Session, solicitud_ids: list[int]) -> dict[int, dict[str, object]]:
    """Primera hora registrada de cada cambio de estado de la solicitud (bitácora de accesos)."""
    if not solicitud_ids:
        return {}
    recursos = {f"solicitudes/{i}": i for i in solicitud_ids}
    filas = db.execute(
        select(AuditoriaAcceso.recurso, AuditoriaAcceso.detalle, AuditoriaAcceso.fecha)
        .where(
            AuditoriaAcceso.accion == "solicitud_actualizada",
            AuditoriaAcceso.recurso.in_(list(recursos)),
        )
        .order_by(AuditoriaAcceso.id)
    ).all()
    marcas: dict[int, dict[str, object]] = {}
    for recurso, estado, fecha in filas:
        marcas.setdefault(recursos[recurso], {}).setdefault(estado, fecha)
    return marcas


def _linea_de_tiempo(
    solicitud: SolicitudAsistencia,
    tarea: Tarea | None,
    constancia: ConstanciaTarea | None,
    auditadas: dict[str, object],
) -> list[dict]:
    indice = ESTADOS.index(solicitud.estado) if solicitud.estado in ESTADOS else 0
    if tarea is not None:  # la tarea puede ir más adelantada que el estado de la solicitud
        indice = max(indice, 2)
        if tarea.estado == "en_curso":
            indice = max(indice, 3)
        elif tarea.estado == "completada":
            indice = max(indice, 4)
    en: dict[str, object] = {
        "recibida": solicitud.creado_en,
        "verificada": auditadas.get("verificada"),
        "asignada": auditadas.get("asignada") or (tarea.creado_en if tarea else None),
        "en_curso": auditadas.get("en_curso")
        or (tarea.actualizado_en if tarea and tarea.estado == "en_curso" else None),
        "resuelta": auditadas.get("resuelta")
        or (constancia.creada_en if constancia else None)
        or (tarea.actualizado_en if tarea and tarea.estado == "completada" else None),
    }
    return [
        {
            "estado": e,
            "en": _iso(en[e]) if i <= indice else None,
            "alcanzado": i <= indice,
        }
        for i, e in enumerate(ESTADOS)
    ]


def pedidos_de(db: Session, usuario_id: int) -> list[dict]:
    """Pedidos de la persona (nunca los de otra), del más nuevo al más viejo."""
    solicitudes = db.execute(
        select(
            SolicitudAsistencia,
            func.ST_X(SolicitudAsistencia.geom),
            func.ST_Y(SolicitudAsistencia.geom),
        )
        .where(SolicitudAsistencia.solicitante_id == usuario_id)
        .order_by(SolicitudAsistencia.creado_en.desc(), SolicitudAsistencia.id.desc())
        .limit(LIMITE)
    ).all()
    if not solicitudes:
        return []
    ids = [s.id for s, _, _ in solicitudes]

    # Tarea vigente de cada pedido: la más nueva que no esté cancelada.
    tareas: dict[int, Tarea] = {}
    for t in db.execute(
        select(Tarea)
        .where(Tarea.solicitud_id.in_(ids), Tarea.estado != "cancelada")
        .order_by(Tarea.id)
    ).scalars():
        tareas[t.solicitud_id] = t  # la última (id mayor) pisa a las anteriores
    tarea_ids = [t.id for t in tareas.values()]
    cuadrilla_ids = {t.cuadrilla_id for t in tareas.values() if t.cuadrilla_id}

    cuadrillas = {
        c.id: c
        for c in db.execute(select(Cuadrilla).where(Cuadrilla.id.in_(cuadrilla_ids))).scalars()
    }
    con_encargado = set(
        db.execute(
            select(IntegranteCuadrilla.cuadrilla_id).where(
                IntegranteCuadrilla.cuadrilla_id.in_(cuadrilla_ids),
                IntegranteCuadrilla.rol_operativo == ROL_ENCARGADO,
            )
        ).scalars()
    )
    constancias: dict[int, tuple[ConstanciaTarea, tuple | None]] = {}
    for c, cid, nombre, lon, lat in db.execute(
        select(
            ConstanciaTarea,
            CentroRecepcion.id,
            CentroRecepcion.nombre,
            func.ST_X(CentroRecepcion.geom),
            func.ST_Y(CentroRecepcion.geom),
        )
        .outerjoin(CentroRecepcion, CentroRecepcion.id == ConstanciaTarea.centro_id)
        .where(ConstanciaTarea.tarea_id.in_(tarea_ids))
    ).all():
        constancias[c.tarea_id] = (c, (cid, nombre, lon, lat) if cid is not None else None)
    confirmaciones: dict[int, ConfirmacionEvacuado] = {}
    for k in db.execute(
        select(ConfirmacionEvacuado)
        .where(ConfirmacionEvacuado.solicitud_id.in_(ids))
        .order_by(ConfirmacionEvacuado.id)
    ).scalars():
        confirmaciones[k.solicitud_id] = k
    auditadas = _marcas_auditadas(db, ids)
    en_vivo = {s["solicitud_id"]: s for s in srv_seguimiento.seguimiento_de(db, usuario_id)}

    items = []
    for s, lon, lat in solicitudes:
        t = tareas.get(s.id)
        constancia, centro = constancias.get(t.id, (None, None)) if t else (None, None)
        k = confirmaciones.get(s.id)
        tarea = None
        if t is not None:
            c = cuadrillas.get(t.cuadrilla_id)
            marca_inicio = auditadas.get(s.id, {}).get("en_curso") or (
                t.actualizado_en if t.estado == "en_curso" else None
            )
            tarea = {
                "id": t.id,
                "estado": t.estado,
                "cuadrilla": (
                    {
                        "id": c.id,
                        "tipo_incidente": c.tipo_incidente,
                        "rol_encargado": ROL_ENCARGADO if c.id in con_encargado else None,
                        "vehiculo": c.vehiculo,
                    }
                    if c
                    else None
                ),
                "iniciada_en": _iso(marca_inicio),
                "cerrada_en": _iso(
                    constancia.creada_en
                    if constancia
                    else (t.actualizado_en if t.estado == "completada" else None)
                ),
            }
        items.append(
            {
                "id": s.id,
                "tipo": s.tipo,
                "personas": s.personas,
                "estado": s.estado,
                "origen": s.origen,
                "creada_en": _iso(s.creado_en),
                "lat": lat,
                "lon": lon,
                "sector_id": s.sector_id,
                "linea_tiempo": _linea_de_tiempo(s, t, constancia, auditadas.get(s.id, {})),
                "tarea": tarea,
                "seguimiento": en_vivo.get(s.id),
                "confirmacion": (
                    {
                        "solicitud_id": s.id,
                        # Código para responder por SMS (SI/PARCIAL/NO/PROBLEMA <código>); ya se
                        # entrega en /mi/confirmaciones y solo a la persona dueña del pedido.
                        "codigo": k.codigo,
                        "respondida": k.respuesta is not None,
                        "respuesta": k.respuesta,
                        "comentario": k.comentario,
                    }
                    if k
                    else None
                ),
                "centro": (
                    {"id": centro[0], "nombre": centro[1], "lat": centro[3], "lon": centro[2]}
                    if centro
                    else None
                ),
            }
        )
    return items
