"""Emisión de órdenes y alertas (CLAUDE.md §8.7).

Una orden la emite una persona con rol ``decisor`` y queda registrada. Al emitirla se crean:
notificaciones para quienes viven o producen dentro de los sectores, tareas para las cuadrillas
(salvo en una simple alerta) y un borrador de entrada en la bitácora K8 que el decisor completa.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core import constantes
from app.db.modelos import (
    BitacoraDecision,
    Cuadrilla,
    Establecimiento,
    GrupoFamiliar,
    Notificacion,
    Orden,
    Sector,
    Tarea,
    Usuario,
)
from app.domain import cuadrillas
from app.servicios import contexto, recomendacion

TIPOS_ORDEN = ("alerta", "evacuacion_preventiva", "evacuacion")
ROTULO = {
    "alerta": "ALERTA",
    "evacuacion_preventiva": "ORDEN DE EVACUACIÓN PREVENTIVA",
    "evacuacion": "ORDEN DE EVACUACIÓN",
}
PENDIENTE = "PENDIENTE: completar antes de dar por registrada la decisión."


def usuarios_en_sectores(db: Session, sectores: list[str]) -> set[int]:
    """Usuarios con domicilio o establecimiento dentro de los sectores (por ``ST_Intersects``)."""
    familias = db.execute(
        select(GrupoFamiliar.usuario_id)
        .join(Sector, func.ST_Intersects(Sector.geom, GrupoFamiliar.domicilio))
        .where(Sector.id.in_(sectores))
    ).scalars()
    productores = db.execute(
        select(Establecimiento.productor_id)
        .join(Sector, func.ST_Intersects(Sector.geom, Establecimiento.geom_tranquera))
        .where(Sector.id.in_(sectores))
    ).scalars()
    return set(familias) | set(productores)


ESTADOS_TAREA_ABIERTA = ("pendiente", "en_curso")


def cuadrilla_menos_cargada(db: Session, tipo: str) -> int | None:
    """Cuadrilla del tipo con menos tareas abiertas (desempata por id).

    Reparte la carga entre las cuadrillas del mismo tipo en vez de mandar todo a la primera.
    """
    abiertas = func.count(Tarea.id).filter(Tarea.estado.in_(ESTADOS_TAREA_ABIERTA))
    return db.execute(
        select(Cuadrilla.id)
        .outerjoin(Tarea, Tarea.cuadrilla_id == Cuadrilla.id)
        .where(Cuadrilla.tipo_incidente == tipo)
        .group_by(Cuadrilla.id)
        .order_by(abiertas, Cuadrilla.id)
        .limit(1)
    ).scalar_one_or_none()


def marcar_ocupada(db: Session, cuadrilla_id: int | None) -> None:
    if cuadrilla_id is not None:
        db.execute(update(Cuadrilla).where(Cuadrilla.id == cuadrilla_id).values(estado="ocupada"))


def liberar_si_sin_tareas(db: Session, cuadrilla_id: int | None) -> None:
    """Vuelve a ``disponible`` una cuadrilla que ya no tiene tareas abiertas."""
    if cuadrilla_id is None:
        return
    abiertas = db.execute(
        select(func.count(Tarea.id)).where(
            Tarea.cuadrilla_id == cuadrilla_id, Tarea.estado.in_(ESTADOS_TAREA_ABIERTA)
        )
    ).scalar_one()
    if abiertas == 0:
        db.execute(
            update(Cuadrilla).where(Cuadrilla.id == cuadrilla_id).values(estado="disponible")
        )


def emitir_orden(
    db: Session,
    decisor: Usuario,
    tipo: str,
    sectores: list[str],
    fundamento: str,
    fecha_simulada: date,
    idempotency_key: str | None = None,
) -> tuple[Orden, dict]:
    """Crea la orden y sus efectos. No hace commit (lo hace el llamador)."""
    nombres = {s.id: s.nombre for s in contexto.cargar_sectores(db)}
    rol = decisor.rol_operativo or decisor.rol
    orden = Orden(
        tipo=tipo,
        sectores=sectores,
        emitida_por=decisor.id,
        rol_operativo=rol,
        fundamento=fundamento,
        idempotency_key=idempotency_key,
    )
    db.add(orden)
    db.flush()

    lista = ", ".join(f"{s} ({nombres[s]})" for s in sectores)
    mensaje = (
        f"{ROTULO[tipo]} para {lista}. Fundamento: {fundamento} "
        "Seguí las indicaciones de las autoridades. "
        "[PROTOTIPO: no es una herramienta oficial]"
    )
    destinatarios = usuarios_en_sectores(db, sectores)
    for uid in sorted(destinatarios):
        db.add(Notificacion(usuario_id=uid, orden_id=orden.id, mensaje=mensaje))

    tareas = 0
    if tipo != "alerta":
        exposicion = recomendacion.cargar_exposicion(db)
        for sid in sectores:
            exp = exposicion.get(sid, recomendacion.Exposicion())
            entrada = recomendacion.entrada_ganaderia(exp.stock)
            bovinos = sum(entrada.bovinos.values()) + entrada.bovinos_sin_clasificar
            for t in cuadrillas.tipos_necesarios(True, bovinos, entrada.colmenas_vivas):
                cuadrilla_id = cuadrilla_menos_cargada(db, t)
                marcar_ocupada(db, cuadrilla_id)
                db.add(
                    Tarea(
                        cuadrilla_id=cuadrilla_id,
                        orden_id=orden.id,
                        sector_id=sid,
                        titulo=f"{ROTULO[tipo].capitalize()} · {sid} · cuadrilla {t}",
                        descripcion=f"Orden #{orden.id}: {fundamento}",
                        checklist=cuadrillas.checklist(t),
                    )
                )
                db.flush()  # la tarea cuenta como carga para la siguiente elección
                tareas += 1

    # Borrador de bitácora K8: el decisor lo completa (los campos sin dato quedan PENDIENTE).
    serie = contexto.serie_diaria(db)
    ultima = contexto.ultima_lectura_o_none(serie)
    fecha_u, altura = ultima if ultima else (None, None)
    altura_txt = "sin lectura disponible" if altura is None else f"{altura:.2f} m".replace(".", ",")
    compromisos = "; ".join(
        f"{s.id} {s.altura_compromiso_m:.2f} m".replace(".", ",")
        for s in contexto.cargar_sectores(db)
        if s.id in sectores
    )
    borrador = BitacoraDecision(
        decision=f"{ROTULO[tipo].capitalize()} para {lista} (orden #{orden.id}).",
        evidencia=(
            f"Fundamento declarado: {fundamento} Altura de Puerto Formosa"
            f"{'' if fecha_u is None else ' al ' + fecha_u.isoformat()}: "
            f"{altura_txt} (K1, DATO OBSERVADO). Alturas de compromiso (K10, SIMULADO): "
            f"{compromisos}."
        ),
        limites=PENDIENTE,
        riesgos=PENDIENTE,
        gatillos=PENDIENTE,
        responsable_rol=rol,
        fecha_simulada=fecha_simulada,
        estado="borrador",
        orden_id=orden.id,
        creada_por=decisor.id,
        snapshot={
            "tipo": tipo,
            "sectores": sectores,
            "altura_ultima_m": altura,
            "fecha_altura": None if fecha_u is None else fecha_u.isoformat(),
            "leyenda": constantes.LEYENDA,
        },
    )
    db.add(borrador)
    db.flush()
    return orden, {
        "notificaciones_creadas": len(destinatarios),
        "tareas_creadas": tareas,
        "bitacora_borrador_id": borrador.id,
        "destinatarios": destinatarios,
    }
