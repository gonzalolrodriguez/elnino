"""Partes de las cuadrillas sobre sus tareas (avance, dificultad, resultado). CLAUDE.md §8.6.

Reglas de estado (la tarea se cierra con un parte ``resultado``):

- ``completa``: la tarea queda ``completada`` (las evacuaciones se cierran con constancia).
- ``parcial``, ``no_realizada`` y ``reprogramada``: la tarea vuelve a ``pendiente`` y queda marcada
  con ``requiere_atencion`` hasta que un operador la reasigna o la actualiza.
- ``avance`` y ``dificultad``: no cambian el estado de la tarea.

Privacidad: el autor figura por su rol operativo, nunca por nombre, y el texto de la observación
no sale por WebSocket ni llega a la ciudadanía.
"""

from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.base import ahora
from app.db.modelos import (
    Cuadrilla,
    IntegranteCuadrilla,
    ParteTarea,
    SolicitudAsistencia,
    Tarea,
    Usuario,
)
from app.servicios import ordenes as srv_ordenes
from app.servicios.adjuntos_parte import adjunto_publico

CATEGORIA = "SIMULADO"
ROL_ENCARGADO = "encargado_cuadrilla"
RESULTADOS = ("completa", "parcial", "no_realizada", "reprogramada")
RESULTADOS_NO_COMPLETOS = ("parcial", "no_realizada", "reprogramada")
ESTADOS_CERRADOS = ("completada", "cancelada")
TIPOS_QUE_EXIGEN_CONSTANCIA = ("evacuacion", "ganado")
MENSAJE_CONSTANCIA = "Cerrá la tarea con constancia"


def parte_a_dict(p: ParteTarea) -> dict:
    return {
        "id": p.id,
        "tarea_id": p.tarea_id,
        "cuadrilla_id": p.cuadrilla_id,
        "tipo": p.tipo,
        "resultado": p.resultado,
        "observacion": p.observacion,
        "autor_rol": p.autor_rol,
        "creado_en": p.creado_en.isoformat(),
        "resuelta": p.resuelta,
        "adjuntos": [adjunto_publico(a) for a in (p.adjuntos or [])],
    }


def exige_constancia(db: Session, tarea: Tarea) -> bool:
    """Las tareas de evacuación (por orden o por pedido de evacuación/ganado) se cierran con constancia."""
    if tarea.orden_id is not None:
        return True
    if tarea.solicitud_id is None:
        return False
    tipo = db.execute(
        select(SolicitudAsistencia.tipo).where(SolicitudAsistencia.id == tarea.solicitud_id)
    ).scalar_one_or_none()
    return tipo in TIPOS_QUE_EXIGEN_CONSTANCIA


def rol_del_autor(db: Session, usuario: Usuario, cuadrilla_id: int | None) -> str | None:
    """Rol operativo con el que firma: el que tiene en la cuadrilla, o el de su cuenta."""
    if cuadrilla_id is not None:
        rol = (
            db.execute(
                select(IntegranteCuadrilla.rol_operativo).where(
                    IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
                    IntegranteCuadrilla.usuario_id == usuario.id,
                )
            )
            .scalars()
            .first()
        )
        if rol:
            return rol
    return usuario.rol_operativo or usuario.rol


def registrar_parte(
    db: Session,
    tarea: Tarea,
    usuario: Usuario,
    tipo: str,
    resultado: str | None,
    observacion: str | None,
    clave: str | None = None,
) -> ParteTarea:
    """Crea el parte y aplica sus efectos sobre la tarea. No hace commit (lo hace el llamador).

    Las validaciones de acceso y de estado (403/404/409) las hace el llamador.
    """
    parte = ParteTarea(
        tarea_id=tarea.id,
        cuadrilla_id=tarea.cuadrilla_id,
        tipo=tipo,
        resultado=resultado,
        observacion=observacion,
        autor_id=usuario.id,
        autor_rol=rol_del_autor(db, usuario, tarea.cuadrilla_id),
        resuelta=False if tipo == "dificultad" else None,
        idempotency_key=clave,
        categoria=CATEGORIA,
        creado_en=ahora(),
    )
    db.add(parte)
    if tipo == "resultado":
        tarea.actualizado_en = ahora()
        if resultado == "completa":
            tarea.estado = "completada"
            tarea.requiere_atencion = False
        else:
            tarea.estado = "pendiente"
            tarea.requiere_atencion = True
            _devolver_solicitud(db, tarea)
        db.flush()
        if tarea.estado == "completada":
            srv_ordenes.liberar_si_sin_tareas(db, tarea.cuadrilla_id)
        else:
            srv_ordenes.marcar_ocupada(db, tarea.cuadrilla_id)
    db.flush()
    return parte


def _devolver_solicitud(db: Session, tarea: Tarea) -> None:
    """Si el pedido figuraba en curso o resuelto, vuelve a ``asignada``: la tarea sigue abierta."""
    if tarea.solicitud_id is None:
        return
    solicitud = db.get(SolicitudAsistencia, tarea.solicitud_id)
    if solicitud is not None and solicitud.estado in ("en_curso", "resuelta"):
        solicitud.estado = "asignada"
        solicitud.actualizado_en = ahora()


def ultimos_partes(db: Session, tarea_ids: list[int]) -> dict[int, dict]:
    """Último parte de cada tarea (una sola consulta)."""
    if not tarea_ids:
        return {}
    ultimos = (
        select(func.max(ParteTarea.id))
        .where(ParteTarea.tarea_id.in_(tarea_ids))
        .group_by(ParteTarea.tarea_id)
    )
    filas = db.execute(select(ParteTarea).where(ParteTarea.id.in_(ultimos))).scalars()
    return {p.tarea_id: parte_a_dict(p) for p in filas}


def prioridad_recientes():
    """Orden de ``/partes/recientes``: lo que necesita atención primero, luego por fecha."""
    pendiente_de_atender = case(
        (ParteTarea.tipo == "dificultad", case((ParteTarea.resuelta.is_(False), 0), else_=1)),
        (
            (ParteTarea.tipo == "resultado")
            & ParteTarea.resultado.in_(RESULTADOS_NO_COMPLETOS)
            & Tarea.requiere_atencion.is_(True),
            0,
        ),
        else_=1,
    )
    return pendiente_de_atender


def recientes(db: Session, limite: int) -> list[dict]:
    filas = db.execute(
        select(ParteTarea, Tarea.sector_id, Tarea.solicitud_id, Tarea.estado, Cuadrilla.nombre)
        .join(Tarea, Tarea.id == ParteTarea.tarea_id)
        .outerjoin(Cuadrilla, Cuadrilla.id == ParteTarea.cuadrilla_id)
        .order_by(prioridad_recientes(), ParteTarea.creado_en.desc(), ParteTarea.id.desc())
        .limit(limite)
    ).all()
    return [
        {
            **parte_a_dict(p),
            "sector_id": sector,
            "solicitud_id": solicitud,
            "cuadrilla_nombre": nombre,
            "tarea_estado": estado,
        }
        for p, sector, solicitud, estado, nombre in filas
    ]


def novedades_de_tareas(db: Session, tareas: list[Tarea]) -> dict[int, dict]:
    """Última novedad relevante por tarea, sin el texto de la observación.

    Cuenta una dificultad sin resolver, o un resultado parcial / no realizado / reprogramado mientras
    la tarea siga marcada ``requiere_atencion``. Los avances no se informan.
    """
    ids = [t.id for t in tareas]
    if not ids:
        return {}
    atencion = {t.id for t in tareas if t.requiere_atencion}
    novedades: dict[int, dict] = {}
    for p in db.execute(
        select(ParteTarea)
        .where(ParteTarea.tarea_id.in_(ids), ParteTarea.tipo.in_(("dificultad", "resultado")))
        .order_by(ParteTarea.creado_en, ParteTarea.id)
    ).scalars():
        if p.tipo == "dificultad":
            relevante = p.resuelta is False
            tipo = "dificultad"
        else:
            relevante = p.resultado in RESULTADOS_NO_COMPLETOS and p.tarea_id in atencion
            tipo = p.resultado
        if relevante:
            novedades[p.tarea_id] = {"tipo": tipo, "en": p.creado_en.isoformat()}  # la última gana
    return novedades


def resumen_cuadrillas(db: Session) -> list[dict]:
    """Cada cuadrilla con sus designados (por rol), su tarea actual y su último parte."""
    cuadrillas = (
        db.execute(select(Cuadrilla).where(Cuadrilla.estado != "baja").order_by(Cuadrilla.id))
        .scalars()
        .all()
    )
    if not cuadrillas:
        return []
    ids = [c.id for c in cuadrillas]
    integrantes: dict[int, list[dict]] = {i: [] for i in ids}
    for i in db.execute(
        select(IntegranteCuadrilla)
        .where(IntegranteCuadrilla.cuadrilla_id.in_(ids))
        .order_by(IntegranteCuadrilla.id)
    ).scalars():
        integrantes[i.cuadrilla_id].append(
            {
                "usuario_id": i.usuario_id,
                "rol_operativo": i.rol_operativo,
                "es_encargado": i.es_encargado,
            }
        )
    # Tarea actual: la abierta más relevante (en curso, luego las que piden atención, luego la última).
    actuales: dict[int, Tarea] = {}
    prioridad = case(
        (Tarea.estado == "en_curso", 0), (Tarea.requiere_atencion.is_(True), 1), else_=2
    )
    for t in db.execute(
        select(Tarea)
        .where(Tarea.cuadrilla_id.in_(ids), Tarea.estado.in_(srv_ordenes.ESTADOS_TAREA_ABIERTA))
        .order_by(Tarea.cuadrilla_id, prioridad.desc(), Tarea.id.asc())
    ).scalars():
        actuales[t.cuadrilla_id] = t  # la última fila de la cuadrilla (mejor prioridad) gana
    ultimos: dict[int, dict] = {}
    ultimo_id = (
        select(func.max(ParteTarea.id))
        .where(ParteTarea.cuadrilla_id.in_(ids))
        .group_by(ParteTarea.cuadrilla_id)
    )
    for p in db.execute(select(ParteTarea).where(ParteTarea.id.in_(ultimo_id))).scalars():
        ultimos[p.cuadrilla_id] = parte_a_dict(p)
    abiertas = dict(
        db.execute(
            select(ParteTarea.cuadrilla_id, func.count())
            .where(ParteTarea.cuadrilla_id.in_(ids), ParteTarea.resuelta.is_(False))
            .group_by(ParteTarea.cuadrilla_id)
        ).all()
    )
    return [
        resumen_item(
            c, integrantes[c.id], actuales.get(c.id), ultimos.get(c.id), abiertas.get(c.id, 0)
        )
        for c in cuadrillas
    ]


def resumen_item(
    c: Cuadrilla, integrantes: list[dict], tarea: Tarea | None, ultimo: dict | None, abiertas: int
) -> dict:
    return {
        "id": c.id,
        "nombre": c.nombre,
        "tipo_incidente": c.tipo_incidente,
        "vehiculo": c.vehiculo,
        "estado": c.estado,
        "integrantes": integrantes,
        "tarea_actual": (
            {
                "id": tarea.id,
                "estado": tarea.estado,
                "solicitud_id": tarea.solicitud_id,
                "sector_id": tarea.sector_id,
                "requiere_atencion": tarea.requiere_atencion,
            }
            if tarea
            else None
        ),
        "ultimo_parte": ultimo,
        "dificultades_abiertas": abiertas,
    }
