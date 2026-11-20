"""Gestión completa de cuadrillas (CLAUDE.md §8.6): serialización, plantillas y avisos.

Privacidad: las cuadrillas se identifican por rol operativo y profesión. El ``nombre_visible`` de un
integrante vinculado a una cuenta institucional solo sale en las respuestas para operador, decisor y
admin; nunca en endpoints de la ciudadanía (``/mi/*``).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.db.modelos import AvisoCuadrilla, Cuadrilla, IntegranteCuadrilla, Usuario
from app.domain import cuadrillas as dom

CATEGORIA = "SIMULADO"
FUENTE_PLANTILLAS = "SUPUESTO (ver supuestos.yaml): el operador confirma la composición real"
VEHICULOS = ("4x4", "camion_jaula", "colectivo", "lancha", "moto")


def plantillas() -> dict:
    """Equipamiento y profesiones sugeridos por tipo operativo (SUPUESTO)."""
    return {
        "plantillas": {
            tipo: {"equipamiento": list(p["equipamiento"]), "profesiones": list(p["profesiones"])}
            for tipo, p in supuesto("cuadrillas_plantillas").items()
        },
        "tipos_operativos": list(dom.TIPOS_OPERATIVOS),
        "profesiones": list(dom.PROFESIONES),
        "vehiculos": list(VEHICULOS),
        "categoria": CATEGORIA,
        "fuente": FUENTE_PLANTILLAS,
    }


def _base(lon: float | None, lat: float | None) -> dict | None:
    if lon is None or lat is None:
        return None
    return {"lat": round(lat, 6), "lon": round(lon, 6)}


def integrante_a_dict(i: IntegranteCuadrilla, nombre_visible: str | None) -> dict:
    return {
        "id": i.id,
        "usuario_id": i.usuario_id,
        "rol_operativo": i.rol_operativo,
        "profesion": i.profesion,
        "es_encargado": i.es_encargado,
        "nombre_visible": nombre_visible if i.usuario_id is not None else None,
    }


def integrantes_de(db: Session, cuadrilla_ids: list[int]) -> dict[int, list[dict]]:
    """Integrantes de cada cuadrilla (el encargado primero), con ``nombre_visible`` si hay cuenta."""
    resultado: dict[int, list[dict]] = {i: [] for i in cuadrilla_ids}
    if not cuadrilla_ids:
        return resultado
    filas = db.execute(
        select(IntegranteCuadrilla, Usuario.nombre_visible)
        .outerjoin(Usuario, Usuario.id == IntegranteCuadrilla.usuario_id)
        .where(IntegranteCuadrilla.cuadrilla_id.in_(cuadrilla_ids))
        .order_by(IntegranteCuadrilla.es_encargado.desc(), IntegranteCuadrilla.id)
    ).all()
    for integrante, nombre in filas:
        resultado[integrante.cuadrilla_id].append(integrante_a_dict(integrante, nombre))
    return resultado


def _avisos_sin_leer(db: Session, cuadrilla_ids: list[int]) -> dict[int, int]:
    if not cuadrilla_ids:
        return {}
    return dict(
        db.execute(
            select(AvisoCuadrilla.cuadrilla_id, func.count())
            .where(
                AvisoCuadrilla.cuadrilla_id.in_(cuadrilla_ids), AvisoCuadrilla.leido_en.is_(None)
            )
            .group_by(AvisoCuadrilla.cuadrilla_id)
        ).all()
    )


def cuadrilla_a_dict(
    c: Cuadrilla,
    integrantes: list[dict],
    base: dict | None,
    sin_leer: int = 0,
) -> dict:
    roles = [i["rol_operativo"] for i in integrantes]
    return {
        "id": c.id,
        "nombre": c.nombre,
        "tipo_operativo": c.tipo_operativo,
        "tipo_incidente": c.tipo_incidente,
        "cantidad_integrantes": c.cantidad_integrantes,
        "vehiculo": c.vehiculo,
        "equipamiento": list(c.equipamiento or []),
        "estado": c.estado,
        "base": base,
        "notas": c.notas,
        "integrantes": integrantes,
        "creado_en": c.creado_en.isoformat(),
        "avisos_sin_leer": sin_leer,
        "plantilla_sugerida": dom.plantilla(c.tipo_incidente),
        "roles_faltantes": dom.roles_faltantes(c.tipo_incidente, roles),
        "categoria": CATEGORIA,
    }


def detalles(
    db: Session,
    incluir_bajas: bool = False,
    ids: list[int] | None = None,
    con_nombres: bool = True,
) -> list[dict]:
    """Cuadrillas completas (con integrantes) en pocas consultas."""
    consulta = select(Cuadrilla, func.ST_X(Cuadrilla.base), func.ST_Y(Cuadrilla.base)).order_by(
        Cuadrilla.id
    )
    if ids is not None:
        consulta = consulta.where(Cuadrilla.id.in_(ids))
    if not incluir_bajas:
        consulta = consulta.where(Cuadrilla.estado != "baja")
    filas = db.execute(consulta).all()
    cuadrilla_ids = [c.id for c, *_ in filas]
    integrantes = integrantes_de(db, cuadrilla_ids)
    sin_leer = _avisos_sin_leer(db, cuadrilla_ids)
    if not con_nombres:  # la propia cuadrilla ve a sus integrantes por rol y profesión
        for lista in integrantes.values():
            for i in lista:
                i["nombre_visible"] = None
    return [
        cuadrilla_a_dict(c, integrantes[c.id], _base(lon, lat), sin_leer.get(c.id, 0))
        for c, lon, lat in filas
    ]


def detalle(db: Session, cuadrilla_id: int, con_nombres: bool = True) -> dict | None:
    """Una cuadrilla completa (también si está dada de baja)."""
    items = detalles(db, incluir_bajas=True, ids=[cuadrilla_id], con_nombres=con_nombres)
    return items[0] if items else None


# ---- avisos --------------------------------------------------------------------------------------


def aviso_a_dict(a: AvisoCuadrilla) -> dict:
    return {
        "id": a.id,
        "cuadrilla_id": a.cuadrilla_id,
        "tarea_id": a.tarea_id,
        "tipo": a.tipo,
        "texto": a.texto,
        "items": list(a.items or []),
        "geometria": a.geometria,
        "creado_en": a.creado_en.isoformat(),
        "creado_por_rol": a.creado_por_rol,
        "leido_en": a.leido_en.isoformat() if a.leido_en else None,
        "leido_por_rol": a.leido_por_rol,
        "categoria": a.categoria,
    }


def usuarios_de(db: Session, cuadrilla_id: int) -> set[int]:
    """Usuarios con cuenta que integran la cuadrilla (destinatarios de sus avisos)."""
    return set(
        db.execute(
            select(IntegranteCuadrilla.usuario_id).where(
                IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
                IntegranteCuadrilla.usuario_id.is_not(None),
            )
        ).scalars()
    )
