"""Gestión completa de cuadrillas (CLAUDE.md §8.6, §9 · Operación).

- ``GET/POST /cuadrillas`` · ``GET /cuadrillas/plantillas`` · ``GET/PATCH/DELETE /cuadrillas/{id}``
- ``POST/PATCH/DELETE /cuadrillas/{id}/integrantes[/{integrante_id}]``: equipo interdisciplinario
  con profesión por integrante y exactamente un encargado.
- ``POST/GET /cuadrillas/{id}/avisos`` y ``POST /avisos/{id}/leido``: avisos del operativo a la
  cuadrilla (desvíos de camino, qué llevar, instrucciones, seguridad).

Escriben operador y admin; el decisor lee. Este router se incluye DESPUÉS de los que definen
``/cuadrillas/resumen``, ``/cuadrillas/posiciones`` y ``/cuadrillas/mi-posicion`` para que sus rutas
fijas ganen frente a ``/cuadrillas/{cuadrilla_id}``.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from geoalchemy2 import WKTElement
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core import auditoria
from app.core.eventos import difusor
from app.core.limitador import limite_por_usuario, limite_usuario
from app.core.rbac import ip_cliente, requiere_rol
from app.db.base import SRID, ahora
from app.db.modelos import (
    AvisoCuadrilla,
    Cuadrilla,
    IntegranteCuadrilla,
    ParteTarea,
    PosicionCuadrilla,
    RolOperativo,
    Tarea,
    Usuario,
)
from app.db.sesion import get_db
from app.domain import cuadrillas as dom
from app.servicios import gestion_cuadrillas as srv
from app.servicios import partes as srv_partes

router = APIRouter(
    tags=["cuadrillas"],
    dependencies=[Depends(limite_por_usuario("usuario", limite_usuario))],
)
_MANDOS = ("operador", "decisor", "admin")
_GESTION = ("operador", "admin")
MAX_INTEGRANTES = 50

TipoOperativo = Literal[
    "personas", "familias", "productores_ganado", "apicola", "bienes", "traslado_mixto"
]
TipoIncidente = Literal["humana", "ganadera", "apicola"]
Profesion = Literal[
    "medicina",
    "enfermeria",
    "veterinaria",
    "zootecnia",
    "trabajo_social",
    "policia",
    "bomberos",
    "defensa_civil",
    "prefectura",
    "chofer",
    "tecnico_energia",
    "logistica",
    "otra",
]
Vehiculo = Literal["4x4", "camion_jaula", "colectivo", "lancha", "moto"]


# ---- esquemas ------------------------------------------------------------------------------------


class PuntoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


def _limpiar_equipamiento(items: list[str]) -> list[str]:
    limpios: list[str] = []
    for item in items:
        t = " ".join(item.split())
        if not 2 <= len(t) <= 80:
            raise ValueError("Cada ítem de equipamiento debe tener entre 2 y 80 caracteres")
        if t.lower() not in (x.lower() for x in limpios):
            limpios.append(t)
    return limpios


class IntegranteIn(BaseModel):
    """Integrante: la profesión y el rol del catálogo se deducen uno del otro si falta alguno."""

    model_config = ConfigDict(extra="forbid")
    rol_operativo: str | None = Field(default=None, min_length=2, max_length=60)
    profesion: Profesion | None = None
    es_encargado: bool | None = None
    usuario_id: int | None = Field(default=None, ge=1)


class CuadrillaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str = Field(min_length=2, max_length=120)
    tipo_operativo: TipoOperativo | None = None
    tipo_incidente: TipoIncidente | None = None
    cantidad_integrantes: int | None = Field(default=None, ge=0, le=MAX_INTEGRANTES)
    vehiculo: Vehiculo | None = None
    equipamiento: list[str] = Field(default_factory=list, max_length=40)
    base: PuntoIn | None = None
    notas: str | None = Field(default=None, max_length=500)
    integrantes: list[IntegranteIn] = Field(default_factory=list, max_length=MAX_INTEGRANTES)

    @field_validator("equipamiento")
    @classmethod
    def _equipamiento(cls, v: list[str]) -> list[str]:
        return _limpiar_equipamiento(v)

    @model_validator(mode="after")
    def _tipos(self) -> CuadrillaIn:
        if self.tipo_operativo is None and self.tipo_incidente is None:
            raise ValueError("Indicá tipo_operativo (o tipo_incidente)")
        if self.tipo_operativo is None:
            self.tipo_operativo = dom.operativo_de(self.tipo_incidente)  # type: ignore[arg-type]
        incidente = dom.incidente_de(self.tipo_operativo)
        if self.tipo_incidente is not None and self.tipo_incidente != incidente:
            raise ValueError(f"tipo_incidente no corresponde a {self.tipo_operativo}: {incidente}")
        self.tipo_incidente = incidente  # type: ignore[assignment]
        return self


class CuadrillaPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str | None = Field(default=None, min_length=2, max_length=120)
    tipo_operativo: TipoOperativo | None = None
    tipo_incidente: TipoIncidente | None = None
    cantidad_integrantes: int | None = Field(default=None, ge=0, le=MAX_INTEGRANTES)
    vehiculo: Vehiculo | None = None
    equipamiento: list[str] | None = Field(default=None, max_length=40)
    base: PuntoIn | None = None
    notas: str | None = Field(default=None, max_length=500)
    estado: Literal["disponible"] | None = None  # solo para reactivar una cuadrilla dada de baja

    @field_validator("equipamiento")
    @classmethod
    def _equipamiento(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else _limpiar_equipamiento(v)


class IntegrantePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rol_operativo: str | None = Field(default=None, min_length=2, max_length=60)
    profesion: Profesion | None = None
    es_encargado: bool | None = None
    usuario_id: int | None = Field(default=None, ge=1)  # null explícito = dejar el puesto vacante


# ---- ayudas --------------------------------------------------------------------------------------


def _cuadrilla_bloqueada(db: Session, cuadrilla_id: int) -> Cuadrilla:
    c = db.execute(
        select(Cuadrilla)
        .where(Cuadrilla.id == cuadrilla_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(404, "Cuadrilla no encontrada")
    return c


def _no_baja(c: Cuadrilla) -> None:
    if c.estado == "baja":
        raise HTTPException(409, "La cuadrilla está dada de baja")


def _punto(p: PuntoIn) -> WKTElement:
    return WKTElement(f"POINT({p.lon} {p.lat})", srid=SRID)


def _rol_y_profesion(db: Session, rol: str | None, profesion: str | None) -> tuple[str, str]:
    """Rol del catálogo y profesión de un integrante; se deducen uno del otro si falta alguno."""
    if rol is None and profesion is None:
        raise HTTPException(422, "Indicá la profesión o el rol operativo del integrante")
    if rol is None:
        rol = dom.rol_de_profesion(profesion)  # type: ignore[arg-type]
        if rol is None:
            raise HTTPException(422, "Con la profesión «otra» hay que indicar el rol operativo")
    if db.get(RolOperativo, rol) is None:
        raise HTTPException(422, f"rol_operativo desconocido: {rol}")
    return rol, profesion or dom.profesion_de_rol(rol)


def _validar_cuenta(
    db: Session, usuario_id: int, cuadrilla_id: int | None, excepto: int | None = None
) -> None:
    """La cuenta vinculada debe existir, ser de rol cuadrilla, estar activa y no repetirse."""
    u = db.get(Usuario, usuario_id)
    if u is None or u.rol != "cuadrilla":
        raise HTTPException(422, "Solo se pueden designar usuarios con rol cuadrilla")
    if u.estado != "activo":
        raise HTTPException(422, "El usuario no está activo")
    if cuadrilla_id is not None:
        consulta = select(IntegranteCuadrilla.id).where(
            IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
            IntegranteCuadrilla.usuario_id == usuario_id,
        )
        if excepto is not None:
            consulta = consulta.where(IntegranteCuadrilla.id != excepto)
        if db.execute(consulta).first():
            raise HTTPException(409, "El usuario ya integra esta cuadrilla")


def _contar_integrantes(db: Session, cuadrilla_id: int) -> int:
    return db.execute(
        select(func.count(IntegranteCuadrilla.id)).where(
            IntegranteCuadrilla.cuadrilla_id == cuadrilla_id
        )
    ).scalar_one()


def _respuesta(db: Session, cuadrilla_id: int) -> dict:
    d = srv.detalle(db, cuadrilla_id)
    assert d is not None
    return d


# ---- cuadrillas ----------------------------------------------------------------------------------


@router.get("/cuadrillas")
def listar_cuadrillas(
    incluir_bajas: bool = Query(default=False),
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "cuadrillas": srv.detalles(db, incluir_bajas=incluir_bajas),
        "plantillas": dom.PLANTILLAS,
    }


@router.get("/cuadrillas/plantillas")
def plantillas_de_cuadrillas(_: Usuario = Depends(requiere_rol(*_MANDOS))) -> dict:
    return srv.plantillas()


@router.post("/cuadrillas", status_code=201)
def crear_cuadrilla(
    datos: CuadrillaIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    cantidad = datos.cantidad_integrantes
    if cantidad is None:
        cantidad = len(datos.integrantes)
    if cantidad < len(datos.integrantes):
        raise HTTPException(
            422, "cantidad_integrantes no puede ser menor que los integrantes dados"
        )
    resueltos = [_rol_y_profesion(db, i.rol_operativo, i.profesion) for i in datos.integrantes]
    cuentas = [i.usuario_id for i in datos.integrantes if i.usuario_id is not None]
    if len(cuentas) != len(set(cuentas)):
        raise HTTPException(422, "Un usuario no puede figurar dos veces en la cuadrilla")
    for uid in cuentas:
        _validar_cuenta(db, uid, None)
    marcas = _encargados(datos.integrantes, resueltos)
    cuadrilla = Cuadrilla(
        nombre=datos.nombre.strip(),
        tipo_operativo=datos.tipo_operativo,
        tipo_incidente=datos.tipo_incidente,
        cantidad_integrantes=cantidad,
        vehiculo=datos.vehiculo,
        equipamiento=datos.equipamiento,
        base=_punto(datos.base) if datos.base else None,
        notas=(datos.notas or "").strip() or None,
    )
    db.add(cuadrilla)
    db.flush()
    for i, (rol, profesion), encargado in zip(datos.integrantes, resueltos, marcas, strict=True):
        db.add(
            IntegranteCuadrilla(
                cuadrilla_id=cuadrilla.id,
                usuario_id=i.usuario_id,
                rol_operativo=rol,
                profesion=profesion,
                es_encargado=encargado,
            )
        )
    auditoria.registrar(
        db, "cuadrilla_creada", f"cuadrillas/{cuadrilla.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    return _respuesta(db, cuadrilla.id)


def _encargados(integrantes: list[IntegranteIn], resueltos: list[tuple[str, str]]) -> list[bool]:
    """Marca de encargado de cada integrante: exactamente uno si la cuadrilla tiene integrantes.

    Sin ``es_encargado`` explícito en nadie, es encargado el único integrante con el rol
    ``encargado_cuadrilla`` (compatibilidad con el alta anterior).
    """
    if not integrantes:
        return []
    explicitos = [i.es_encargado for i in integrantes]
    if any(e is not None for e in explicitos):
        marcas = [bool(e) for e in explicitos]
    else:
        marcas = [rol == dom.ROL_ENCARGADO for rol, _ in resueltos]
    if sum(marcas) != 1:
        raise HTTPException(422, "La cuadrilla necesita exactamente un encargado (es_encargado)")
    return marcas


@router.get("/cuadrillas/{cuadrilla_id}")
def obtener_cuadrilla(
    cuadrilla_id: int,
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    """Los mandos ven todo; un integrante solo su cuadrilla y sin nombres de personas."""
    propia = usuario.rol == "cuadrilla"
    if propia and not _es_miembro(db, usuario, cuadrilla_id):
        raise HTTPException(403, "No integrás esta cuadrilla")
    d = srv.detalle(db, cuadrilla_id, con_nombres=not propia)
    if d is None:
        raise HTTPException(404, "Cuadrilla no encontrada")
    return d


@router.get("/mi/cuadrilla")
def mi_cuadrilla(
    usuario: Usuario = Depends(requiere_rol("cuadrilla")),
    db: Session = Depends(get_db),
) -> dict:
    """La cuadrilla de quien consulta (la activa de menor id), sin nombres de personas."""
    ids = list(
        db.execute(
            select(IntegranteCuadrilla.cuadrilla_id)
            .join(Cuadrilla, Cuadrilla.id == IntegranteCuadrilla.cuadrilla_id)
            .where(IntegranteCuadrilla.usuario_id == usuario.id, Cuadrilla.estado != "baja")
            .order_by(IntegranteCuadrilla.cuadrilla_id)
            .limit(1)
        ).scalars()
    )
    d = srv.detalle(db, ids[0], con_nombres=False) if ids else None
    if d is None:
        raise HTTPException(404, "No integrás ninguna cuadrilla")
    return d


@router.patch("/cuadrillas/{cuadrilla_id}")
def actualizar_cuadrilla(
    cuadrilla_id: int,
    datos: CuadrillaPatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    c = _cuadrilla_bloqueada(db, cuadrilla_id)
    enviados = datos.model_fields_set
    if c.estado == "baja" and datos.estado != "disponible":
        raise HTTPException(409, "La cuadrilla está dada de baja: reactivala con estado disponible")
    if datos.estado == "disponible" and c.estado == "baja":
        c.estado = "disponible"
    if datos.nombre is not None:
        c.nombre = datos.nombre.strip()
    if datos.tipo_operativo is not None or datos.tipo_incidente is not None:
        operativo = datos.tipo_operativo or c.tipo_operativo
        if datos.tipo_operativo is None:  # solo cambió el tipo de incidente
            operativo = dom.operativo_de(datos.tipo_incidente)  # type: ignore[arg-type]
        incidente = dom.incidente_de(operativo)
        if datos.tipo_incidente is not None and datos.tipo_incidente != incidente:
            raise HTTPException(422, f"tipo_incidente no corresponde a {operativo}: {incidente}")
        c.tipo_operativo, c.tipo_incidente = operativo, incidente
    if datos.cantidad_integrantes is not None:
        if datos.cantidad_integrantes < _contar_integrantes(db, c.id):
            raise HTTPException(
                422, "cantidad_integrantes no puede ser menor que los integrantes cargados"
            )
        c.cantidad_integrantes = datos.cantidad_integrantes
    if "vehiculo" in enviados:
        c.vehiculo = datos.vehiculo
    if datos.equipamiento is not None:
        c.equipamiento = datos.equipamiento
    if "base" in enviados:
        c.base = _punto(datos.base) if datos.base else None
    if "notas" in enviados:
        c.notas = (datos.notas or "").strip() or None
    auditoria.registrar(
        db, "cuadrilla_actualizada", f"cuadrillas/{c.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    return _respuesta(db, c.id)


@router.delete("/cuadrillas/{cuadrilla_id}")
def eliminar_cuadrilla(
    cuadrilla_id: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    """409 si tiene una tarea en curso; con historial queda dada de baja; sin historial se borra."""
    c = _cuadrilla_bloqueada(db, cuadrilla_id)
    if db.execute(
        select(Tarea.id).where(Tarea.cuadrilla_id == c.id, Tarea.estado == "en_curso").limit(1)
    ).first():
        raise HTTPException(
            409, "La cuadrilla tiene una tarea en curso: cerrala antes de darla de baja"
        )
    if c.estado == "baja":
        return {"id": c.id, "estado": "baja", "eliminada": False, "tareas_sin_cuadrilla": 0}
    historial = any(
        db.execute(select(modelo.id).where(modelo.cuadrilla_id == c.id).limit(1)).first()
        for modelo in (Tarea, ParteTarea, AvisoCuadrilla)
    )
    liberadas = 0
    if historial:
        # Las tareas pendientes vuelven al operador para que las reasigne.
        liberadas = db.execute(
            update(Tarea)
            .where(Tarea.cuadrilla_id == c.id, Tarea.estado == "pendiente")
            .values(cuadrilla_id=None, requiere_atencion=True, actualizado_en=ahora())
        ).rowcount
        db.execute(delete(PosicionCuadrilla).where(PosicionCuadrilla.cuadrilla_id == c.id))
        c.estado = "baja"
        resultado = {"id": c.id, "estado": "baja", "eliminada": False}
    else:
        db.delete(c)
        resultado = {"id": cuadrilla_id, "estado": "eliminada", "eliminada": True}
    auditoria.registrar(
        db,
        "cuadrilla_baja" if historial else "cuadrilla_eliminada",
        f"cuadrillas/{cuadrilla_id}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    if liberadas:
        difusor.publicar("tarea", {"motivo": "cuadrilla_baja", "cuadrilla_id": cuadrilla_id})
    return {**resultado, "tareas_sin_cuadrilla": liberadas}


# ---- integrantes ---------------------------------------------------------------------------------


@router.post("/cuadrillas/{cuadrilla_id}/integrantes", status_code=201)
def agregar_integrante(
    cuadrilla_id: int,
    datos: IntegranteIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    c = _cuadrilla_bloqueada(db, cuadrilla_id)
    _no_baja(c)
    rol, profesion = _rol_y_profesion(db, datos.rol_operativo, datos.profesion)
    if datos.usuario_id is not None:
        _validar_cuenta(db, datos.usuario_id, c.id)
    existentes = list(
        db.execute(
            select(IntegranteCuadrilla)
            .where(IntegranteCuadrilla.cuadrilla_id == c.id)
            .order_by(IntegranteCuadrilla.id)
        ).scalars()
    )
    # Una vacante del mismo rol (sin persona designada) se cubre en vez de duplicar el rol.
    vacante = next(
        (
            i
            for i in existentes
            if datos.usuario_id is not None
            and i.usuario_id is None
            and i.rol_operativo == rol
            and (datos.profesion is None or i.profesion == profesion)
        ),
        None,
    )
    hay_encargado = any(i.es_encargado for i in existentes)
    if datos.es_encargado is None:
        # El primero de una cuadrilla (o el rol encargado_cuadrilla sin encargado) toma el cargo.
        encargado = not hay_encargado and (not existentes or rol == dom.ROL_ENCARGADO)
    else:
        encargado = datos.es_encargado
    if vacante is not None:
        destino = vacante
        destino.usuario_id = datos.usuario_id
        if datos.profesion is not None:
            destino.profesion = profesion
        encargado = destino.es_encargado or encargado
    else:
        if len(existentes) >= MAX_INTEGRANTES:
            raise HTTPException(409, f"Máximo de {MAX_INTEGRANTES} integrantes por cuadrilla")
        destino = IntegranteCuadrilla(
            cuadrilla_id=c.id, usuario_id=datos.usuario_id, rol_operativo=rol, profesion=profesion
        )
        db.add(destino)
    if encargado and not destino.es_encargado:
        for i in existentes:
            i.es_encargado = False
    destino.es_encargado = encargado or destino.es_encargado
    db.flush()
    total = _contar_integrantes(db, c.id)
    if c.cantidad_integrantes < total:  # la cantidad declarada acompaña a los integrantes cargados
        c.cantidad_integrantes = total
    auditoria.registrar(
        db,
        "cuadrilla_integrante_agregado",
        f"cuadrillas/{c.id}/integrantes/{destino.id}",
        usuario.id,
        ip_cliente(request),
        profesion,
    )
    db.commit()
    return _respuesta(db, c.id)


def _integrante(db: Session, cuadrilla_id: int, integrante_id: int) -> IntegranteCuadrilla:
    i = db.execute(
        select(IntegranteCuadrilla)
        .where(
            IntegranteCuadrilla.id == integrante_id,
            IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if i is None:
        raise HTTPException(404, "El integrante no pertenece a esta cuadrilla")
    return i


@router.patch("/cuadrillas/{cuadrilla_id}/integrantes/{integrante_id}")
def actualizar_integrante(
    cuadrilla_id: int,
    integrante_id: int,
    datos: IntegrantePatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    c = _cuadrilla_bloqueada(db, cuadrilla_id)
    _no_baja(c)
    i = _integrante(db, c.id, integrante_id)
    enviados = datos.model_fields_set
    if datos.rol_operativo is not None:  # cambia el rol; la profesión sigue al rol si no se indica
        i.rol_operativo, i.profesion = _rol_y_profesion(
            db, datos.rol_operativo, datos.profesion or None
        )
    elif datos.profesion is not None:  # solo cambia la profesión: el rol del catálogo se conserva
        i.profesion = datos.profesion
    if "usuario_id" in enviados:
        if datos.usuario_id is not None:
            _validar_cuenta(db, datos.usuario_id, c.id, excepto=i.id)
        i.usuario_id = datos.usuario_id
    if datos.es_encargado is True and not i.es_encargado:
        db.execute(
            update(IntegranteCuadrilla)
            .where(IntegranteCuadrilla.cuadrilla_id == c.id)
            .values(es_encargado=False)
        )
        i.es_encargado = True
    elif datos.es_encargado is False and i.es_encargado:
        raise HTTPException(
            409, "La cuadrilla necesita un encargado: marcá a otro integrante como encargado"
        )
    auditoria.registrar(
        db,
        "cuadrilla_integrante_actualizado",
        f"cuadrillas/{c.id}/integrantes/{i.id}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return _respuesta(db, c.id)


@router.delete("/cuadrillas/{cuadrilla_id}/integrantes/{integrante_id}")
def quitar_integrante(
    cuadrilla_id: int,
    integrante_id: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    c = _cuadrilla_bloqueada(db, cuadrilla_id)
    i = _integrante(db, c.id, integrante_id)
    total = _contar_integrantes(db, c.id)
    if i.es_encargado and total > 1:
        raise HTTPException(
            409, "Es el encargado: marcá a otro integrante como encargado antes de quitarlo"
        )
    if c.cantidad_integrantes == total:  # la cantidad declarada acompaña al último integrante
        c.cantidad_integrantes = total - 1
    db.delete(i)
    auditoria.registrar(
        db,
        "cuadrilla_integrante_quitado",
        f"cuadrillas/{c.id}/integrantes/{integrante_id}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    return _respuesta(db, c.id)


# ---- avisos --------------------------------------------------------------------------------------


def _geometria(valor: Any) -> dict | None:
    """GeoJSON Point o LineString válido (lon/lat en grados, hasta 500 puntos), normalizado."""
    if valor is None:
        return None
    if not isinstance(valor, dict) or set(valor) - {"type", "coordinates"}:
        raise ValueError("La geometría debe ser un objeto GeoJSON {type, coordinates}")

    def punto(p: Any) -> list[float]:
        if (
            not isinstance(p, list | tuple)
            or len(p) < 2
            or len(p) > 3
            or not all(isinstance(x, int | float) and not isinstance(x, bool) for x in p)
        ):
            raise ValueError("Coordenada inválida: se espera [lon, lat]")
        lon, lat = float(p[0]), float(p[1])
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("Coordenada fuera de rango: [lon, lat] en grados")
        return [round(lon, 6), round(lat, 6)]

    tipo, coords = valor.get("type"), valor.get("coordinates")
    if tipo == "Point":
        return {"type": "Point", "coordinates": punto(coords)}
    if tipo == "LineString":
        if not isinstance(coords, list) or not 2 <= len(coords) <= 500:
            raise ValueError("Un LineString lleva entre 2 y 500 puntos")
        return {"type": "LineString", "coordinates": [punto(p) for p in coords]}
    raise ValueError("La geometría debe ser Point o LineString")


class AvisoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["desvio", "equipamiento", "instruccion", "seguridad"]
    texto: str = Field(min_length=3, max_length=500)
    items: list[str] = Field(default_factory=list, max_length=30)
    geometria: dict | None = None
    tarea_id: int | None = Field(default=None, ge=1)

    @field_validator("texto")
    @classmethod
    def _texto(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("El texto debe tener al menos 3 caracteres")
        return v

    @field_validator("items")
    @classmethod
    def _items(cls, v: list[str]) -> list[str]:
        limpios = [" ".join(x.split()) for x in v]
        if any(not 1 <= len(x) <= 80 for x in limpios):
            raise ValueError("Cada ítem tiene entre 1 y 80 caracteres")
        return limpios

    @field_validator("geometria")
    @classmethod
    def _geo(cls, v: dict | None) -> dict | None:
        return _geometria(v)

    @model_validator(mode="after")
    def _reglas(self) -> AvisoIn:
        if self.tipo == "desvio" and self.geometria is None:
            raise ValueError("Un aviso de desvío necesita la geometría (Point o LineString)")
        if self.tipo == "equipamiento" and not self.items:
            raise ValueError("Un aviso de equipamiento necesita la lista de ítems")
        return self


def _es_miembro(db: Session, usuario: Usuario, cuadrilla_id: int) -> bool:
    return (
        db.execute(
            select(IntegranteCuadrilla.id).where(
                IntegranteCuadrilla.cuadrilla_id == cuadrilla_id,
                IntegranteCuadrilla.usuario_id == usuario.id,
            )
        ).first()
        is not None
    )


@router.post("/cuadrillas/{cuadrilla_id}/avisos", status_code=201)
def crear_aviso(
    cuadrilla_id: int,
    datos: AvisoIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_GESTION)),
    db: Session = Depends(get_db),
) -> dict:
    c = db.get(Cuadrilla, cuadrilla_id)
    if c is None:
        raise HTTPException(404, "Cuadrilla no encontrada")
    _no_baja(c)
    if datos.tarea_id is not None:
        tarea = db.get(Tarea, datos.tarea_id)
        if tarea is None or tarea.cuadrilla_id != c.id:
            raise HTTPException(422, "La tarea no es de esta cuadrilla")
    aviso = AvisoCuadrilla(
        cuadrilla_id=c.id,
        tarea_id=datos.tarea_id,
        tipo=datos.tipo,
        texto=datos.texto,
        items=datos.items,
        geometria=datos.geometria,
        creado_por=usuario.id,
        creado_por_rol=srv_partes.rol_del_autor(db, usuario, None),
        categoria=srv.CATEGORIA,
    )
    db.add(aviso)
    db.flush()
    auditoria.registrar(
        db,
        "aviso_cuadrilla_creado",
        f"cuadrillas/{c.id}/avisos/{aviso.id}",
        usuario.id,
        ip_cliente(request),
        datos.tipo,
    )
    db.commit()
    _publicar(db, aviso, "creado")
    return srv.aviso_a_dict(aviso)


def _publicar(db: Session, aviso: AvisoCuadrilla, accion: str) -> None:
    """Solo ids y tipo (nunca el texto) a los mandos y a los integrantes de esa cuadrilla."""
    difusor.publicar(
        "aviso_cuadrilla",
        {
            "id": aviso.id,
            "cuadrilla_id": aviso.cuadrilla_id,
            "tarea_id": aviso.tarea_id,
            "tipo": aviso.tipo,
            "accion": accion,
        },
        destinatarios=srv.usuarios_de(db, aviso.cuadrilla_id),
    )


@router.get("/cuadrillas/{cuadrilla_id}/avisos")
def listar_avisos(
    cuadrilla_id: int,
    solo_sin_leer: bool = Query(default=False),
    limite: int = Query(default=100, ge=1, le=200),
    usuario: Usuario = Depends(requiere_rol("cuadrilla", *_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    if db.get(Cuadrilla, cuadrilla_id) is None:
        raise HTTPException(404, "Cuadrilla no encontrada")
    if usuario.rol == "cuadrilla" and not _es_miembro(db, usuario, cuadrilla_id):
        raise HTTPException(403, "No integrás esta cuadrilla")
    consulta = select(AvisoCuadrilla).where(AvisoCuadrilla.cuadrilla_id == cuadrilla_id)
    if solo_sin_leer:
        consulta = consulta.where(AvisoCuadrilla.leido_en.is_(None))
    filas = db.execute(
        consulta.order_by(AvisoCuadrilla.creado_en.desc(), AvisoCuadrilla.id.desc()).limit(limite)
    ).scalars()
    return {"items": [srv.aviso_a_dict(a) for a in filas]}


@router.post("/avisos/{aviso_id}/leido")
def marcar_leido(
    aviso_id: int,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla")),
    db: Session = Depends(get_db),
) -> dict:
    aviso = db.execute(
        select(AvisoCuadrilla)
        .where(AvisoCuadrilla.id == aviso_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if aviso is None:
        raise HTTPException(404, "Aviso no encontrado")
    if not _es_miembro(db, usuario, aviso.cuadrilla_id):
        raise HTTPException(403, "El aviso es de otra cuadrilla")
    if aviso.leido_en is not None:  # ya leído: el primero que lo leyó queda registrado
        return srv.aviso_a_dict(aviso)
    aviso.leido_en = ahora()
    aviso.leido_por = usuario.id
    aviso.leido_por_rol = srv_partes.rol_del_autor(db, usuario, aviso.cuadrilla_id)
    auditoria.registrar(
        db,
        "aviso_cuadrilla_leido",
        f"cuadrillas/{aviso.cuadrilla_id}/avisos/{aviso.id}",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    _publicar(db, aviso, "leido")
    return srv.aviso_a_dict(aviso)
