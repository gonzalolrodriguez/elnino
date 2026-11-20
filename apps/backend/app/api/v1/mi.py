"""Área personal de ciudadanía y productores (CLAUDE.md §9 · Ciudadanía y Productores)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, Field, model_validator
from shapely.geometry import mapping
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.v1.esquemas import StockIn
from app.core import auditoria, datos_personales
from app.core.eventos import difusor
from app.core.limitador import limite_por_usuario, limite_usuario
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.db.base import SRID, ahora
from app.db.consultas import sector_de_punto
from app.db.modelos import (
    Establecimiento,
    GrupoFamiliar,
    Notificacion,
    Orden,
    Sector,
    SolicitudAsistencia,
    StockProductivo,
    Usuario,
)
from app.db.sesion import get_db
from app.domain import ganaderia, ruteo
from app.servicios import contexto, recomendacion
from app.servicios.mi import sectores_de_usuario

router = APIRouter(
    prefix="/mi",
    tags=["mi-cuenta"],
    dependencies=[Depends(limite_por_usuario("usuario", limite_usuario))],
)
_CIUDADANIA = ("ciudadano", "productor")


def _punto(lon: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=SRID)


# ---- grupo familiar -----------------------------------------------------------------------------


class GrupoFamiliarIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    integrantes: int = Field(default=1, ge=1, le=40)
    menores: int = Field(default=0, ge=0, le=40)
    mayores: int = Field(default=0, ge=0, le=40)
    mascotas: int = Field(default=0, ge=0, le=100)
    telefono: str | None = Field(default=None, max_length=30)
    salud: str | None = Field(default=None, max_length=500)
    vulnerabilidad: str | None = Field(default=None, max_length=500)
    lon: float | None = Field(default=None, ge=-180, le=180)
    lat: float | None = Field(default=None, ge=-90, le=90)

    @model_validator(mode="after")
    def coherente(self):
        if (self.lon is None) != (self.lat is None):
            raise ValueError("Indicar lon y lat juntas")
        if self.menores + self.mayores > self.integrantes:
            raise ValueError("menores + mayores no puede superar a los integrantes")
        return self


def _grupo_a_dict(db: Session, g: GrupoFamiliar, usuario: Usuario, request: Request) -> dict:
    sensibles = datos_personales.leer_sensibles(db, g, usuario, ip_cliente(request))
    punto = to_shape(g.domicilio) if g.domicilio is not None else None
    return {
        "integrantes": g.integrantes,
        "menores": g.menores,
        "mayores": g.mayores,
        "mascotas": g.mascotas,
        **sensibles,
        "lon": punto.x if punto else None,
        "lat": punto.y if punto else None,
        "sector_id": g.sector_id,
        "actualizado_en": g.actualizado_en.isoformat(),
    }


@router.get("/grupo-familiar")
def obtener_grupo(
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_CIUDADANIA)),
    db: Session = Depends(get_db),
) -> dict:
    g = db.execute(
        select(GrupoFamiliar).where(GrupoFamiliar.usuario_id == usuario.id)
    ).scalar_one_or_none()
    if g is None:
        raise HTTPException(404, "Todavía no cargaste tu grupo familiar")
    salida = _grupo_a_dict(db, g, usuario, request)
    db.commit()  # persiste el registro de lectura de datos personales
    return salida


@router.put("/grupo-familiar")
def guardar_grupo(
    datos: GrupoFamiliarIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_CIUDADANIA)),
    db: Session = Depends(get_db),
) -> dict:
    g = db.execute(
        select(GrupoFamiliar).where(GrupoFamiliar.usuario_id == usuario.id)
    ).scalar_one_or_none()
    if g is None:
        g = GrupoFamiliar(usuario_id=usuario.id)
        db.add(g)
    # Un campo omitido queda SIN CAMBIOS (un cliente que solo corrige la cantidad de integrantes no
    # borra el teléfono ni los datos de salud); un campo enviado como null los borra.
    enviados = datos.model_fields_set
    for campo in ("integrantes", "menores", "mayores", "mascotas"):
        if campo in enviados:
            setattr(g, campo, getattr(datos, campo))
    if (g.menores or 0) + (g.mayores or 0) > (g.integrantes or 1):
        raise HTTPException(422, "menores + mayores no puede superar a los integrantes")
    datos_personales.guardar_sensibles(
        g,
        **{c: getattr(datos, c) for c in ("telefono", "salud", "vulnerabilidad") if c in enviados},
    )
    if "lon" in enviados or "lat" in enviados:
        if datos.lon is not None:
            g.domicilio = _punto(datos.lon, datos.lat)
            g.sector_id = sector_de_punto(db, datos.lon, datos.lat)
        else:
            g.domicilio, g.sector_id = None, None
    g.actualizado_en = ahora()
    db.flush()
    auditoria.registrar(
        db,
        "grupo_familiar_actualizado",
        f"grupos_familiares/{g.id}",
        usuario.id,
        ip_cliente(request),
    )
    salida = _grupo_a_dict(db, g, usuario, request)
    db.commit()
    return salida


# ---- establecimientos ---------------------------------------------------------------------------


class EstablecimientoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str = Field(min_length=2, max_length=160)
    renspa: str | None = Field(default=None, max_length=30)
    renapa: str | None = Field(default=None, max_length=30)
    paippa: str | None = Field(default=None, max_length=30)
    lon: float = Field(ge=-180, le=180, description="Tranquera")
    lat: float = Field(ge=-90, le=90, description="Tranquera")
    superficie_albardon_m2: float | None = Field(default=None, ge=0, le=1e9)
    acceso_habitual: str | None = Field(default=None, max_length=120)
    stock: list[StockIn] | None = Field(default=None, max_length=50)


class StockPut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stock: list[StockIn] = Field(max_length=50)


def _establecimiento(db: Session, usuario: Usuario, est_id: int) -> Establecimiento:
    e = db.get(Establecimiento, est_id)
    if e is None or e.productor_id != usuario.id:
        raise HTTPException(404, "Establecimiento no encontrado")
    return e


def _est_a_dict(db: Session, e: Establecimiento) -> dict:
    punto = to_shape(e.geom_tranquera)
    stock = (
        db.execute(
            select(StockProductivo)
            .where(StockProductivo.establecimiento_id == e.id)
            .order_by(StockProductivo.id)
        )
        .scalars()
        .all()
    )
    return {
        "id": e.id,
        "nombre": e.nombre,
        "renspa": e.renspa,
        "renapa": e.renapa,
        "paippa": e.paippa,
        "lon": punto.x,
        "lat": punto.y,
        "superficie_albardon_m2": e.superficie_albardon_m2,
        "acceso_habitual": e.acceso_habitual,
        "sector_id": e.sector_id,
        "stock": [
            {"especie": s.especie, "categoria_animal": s.categoria_animal, "cantidad": s.cantidad}
            for s in stock
        ],
    }


def _reemplazar_stock(db: Session, est_id: int, items: list[StockIn]) -> None:
    db.execute(delete(StockProductivo).where(StockProductivo.establecimiento_id == est_id))
    for i in items:
        db.add(StockProductivo(establecimiento_id=est_id, **i.model_dump()))


@router.get("/establecimientos")
def listar_establecimientos(
    usuario: Usuario = Depends(requiere_rol("productor")), db: Session = Depends(get_db)
) -> dict:
    filas = (
        db.execute(
            select(Establecimiento)
            .where(Establecimiento.productor_id == usuario.id)
            .order_by(Establecimiento.id)
        )
        .scalars()
        .all()
    )
    return {"establecimientos": [_est_a_dict(db, e) for e in filas]}


@router.post("/establecimientos", status_code=201)
def crear_establecimiento(
    datos: EstablecimientoIn,
    usuario: Usuario = Depends(requiere_rol("productor")),
    db: Session = Depends(get_db),
) -> dict:
    e = Establecimiento(
        productor_id=usuario.id,
        nombre=datos.nombre,
        renspa=datos.renspa,
        renapa=datos.renapa,
        paippa=datos.paippa,
        geom_tranquera=_punto(datos.lon, datos.lat),
        sector_id=sector_de_punto(db, datos.lon, datos.lat),
        superficie_albardon_m2=datos.superficie_albardon_m2,
        acceso_habitual=datos.acceso_habitual,
    )
    db.add(e)
    db.flush()
    _reemplazar_stock(db, e.id, datos.stock or [])
    db.commit()
    return _est_a_dict(db, e)


@router.put("/establecimientos/{est_id}")
def actualizar_establecimiento(
    est_id: int,
    datos: EstablecimientoIn,
    usuario: Usuario = Depends(requiere_rol("productor")),
    db: Session = Depends(get_db),
) -> dict:
    e = _establecimiento(db, usuario, est_id)
    e.nombre, e.renspa, e.renapa, e.paippa = datos.nombre, datos.renspa, datos.renapa, datos.paippa
    e.geom_tranquera = _punto(datos.lon, datos.lat)
    e.sector_id = sector_de_punto(db, datos.lon, datos.lat)
    e.superficie_albardon_m2, e.acceso_habitual = (
        datos.superficie_albardon_m2,
        datos.acceso_habitual,
    )
    if datos.stock is not None:
        _reemplazar_stock(db, e.id, datos.stock)
    db.commit()
    return _est_a_dict(db, e)


@router.put("/establecimientos/{est_id}/stock")
def reemplazar_stock(
    est_id: int,
    datos: StockPut,
    usuario: Usuario = Depends(requiere_rol("productor")),
    db: Session = Depends(get_db),
) -> dict:
    e = _establecimiento(db, usuario, est_id)
    _reemplazar_stock(db, e.id, datos.stock)
    db.commit()
    return _est_a_dict(db, e)


class LogisticaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    establecimiento_id: int
    texto: str | None = Field(default=None, max_length=500)


@router.post("/solicitudes-logistica", status_code=201)
def solicitud_logistica(
    datos: LogisticaIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("productor")),
    db: Session = Depends(get_db),
) -> dict:
    """Solicitud anticipada de logística: el cálculo de Arca Productiva sale del stock declarado."""
    e = _establecimiento(db, usuario, datos.establecimiento_id)
    items = [
        (s.especie, s.categoria_animal, s.cantidad)
        for s in db.execute(
            select(StockProductivo).where(StockProductivo.establecimiento_id == e.id)
        ).scalars()
    ]
    entrada = recomendacion.entrada_ganaderia(items)
    entrada = ganaderia.EntradaGanaderia(
        bovinos=entrada.bovinos,
        bovinos_sin_clasificar=entrada.bovinos_sin_clasificar,
        menores=entrada.menores,
        colmenas_vivas=entrada.colmenas_vivas,
        superficie_albardon_m2=e.superficie_albardon_m2,
    )
    calculo = ganaderia.calcular(entrada)
    punto = to_shape(e.geom_tranquera)
    animales = calculo["bovinos_total"] + sum((entrada.menores or {}).values())
    s = SolicitudAsistencia(
        solicitante_id=usuario.id,
        origen="web",
        tipo="logistica",
        personas=0,
        animales=animales,
        texto=datos.texto,
        geom=_punto(punto.x, punto.y),
        sector_id=e.sector_id,
        detalle={"establecimiento_id": e.id, "establecimiento": e.nombre, "ganaderia": calculo},
    )
    db.add(s)
    db.flush()
    auditoria.registrar(
        db, "solicitud_creada", f"solicitudes/{s.id}", usuario.id, ip_cliente(request), "logistica"
    )
    db.commit()
    difusor.publicar(
        "solicitud", {"id": s.id, "estado": s.estado, "sector_id": s.sector_id}, usuario.id
    )
    return {
        "id": s.id,
        "estado": s.estado,
        "tipo": s.tipo,
        "sector_id": s.sector_id,
        "animales": animales,
        "calculo": calculo,
        "nota": "Es una solicitud anticipada: no garantiza el traslado; lo define la autoridad.",
    }


# ---- notificaciones y sector --------------------------------------------------------------------


def _notif_a_dict(n: Notificacion) -> dict:
    return {
        "id": n.id,
        "orden_id": n.orden_id,
        "tipo": n.tipo,
        "datos": n.datos,
        "mensaje": n.mensaje,
        "leida": n.leida,
        "creada_en": n.creada_en.isoformat(),
    }


@router.get("/notificaciones")
def notificaciones(
    solo_no_leidas: bool = Query(default=False),
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
) -> dict:
    consulta = select(Notificacion).where(Notificacion.usuario_id == usuario.id)
    if solo_no_leidas:
        consulta = consulta.where(Notificacion.leida.is_(False))
    filas = db.execute(consulta.order_by(Notificacion.id.desc()).limit(200)).scalars().all()
    return {
        "notificaciones": [_notif_a_dict(n) for n in filas],
        "no_leidas": sum(1 for n in filas if not n.leida),
    }


@router.patch("/notificaciones/{notificacion_id}/leida")
def marcar_leida(
    notificacion_id: int,
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
) -> dict:
    n = db.get(Notificacion, notificacion_id)
    if n is None or n.usuario_id != usuario.id:
        raise HTTPException(404, "Notificación no encontrada")
    n.leida = True
    db.commit()
    return _notif_a_dict(n)


def _centro_sugerido(centros, lon: float, lat: float, personas: int, animales: int) -> dict:
    def mejor(candidatos):
        if not candidatos:
            return None
        c = min(candidatos, key=lambda x: (ruteo.haversine_m(lon, lat, x.lon, x.lat), x.id))
        return {
            "id": c.id,
            "nombre": c.nombre,
            "tipo": c.tipo,
            "lon": c.lon,
            "lat": c.lat,
            "distancia_linea_recta_m": round(ruteo.haversine_m(lon, lat, c.lon, c.lat)),
            "categoria": "SIMULADO",
        }

    return {
        "personas": mejor([c for c in centros if c.cupo_personas >= max(personas, 1)])
        if personas
        else None,
        "animales": mejor([c for c in centros if c.cupo_animales >= animales])
        if animales
        else None,
        "nota": "Sugerencia SIMULADA por cercanía y cupo; el centro lo define la autoridad.",
    }


@router.get("/sector")
def mi_sector(usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)) -> dict:
    ids = sorted(sectores_de_usuario(db, usuario.id))
    serie = contexto.serie_diaria(db)
    fecha_u, altura = contexto.ultima_lectura(serie)
    escenario = contexto.calcular_escenario(db, altura)
    centros = contexto.cargar_centros(db)

    g = db.execute(
        select(GrupoFamiliar).where(GrupoFamiliar.usuario_id == usuario.id)
    ).scalar_one_or_none()
    est = (
        db.execute(
            select(Establecimiento)
            .where(Establecimiento.productor_id == usuario.id)
            .order_by(Establecimiento.id)
        )
        .scalars()
        .all()
    )
    ubicacion = None
    personas = animales = 0
    if g is not None and g.domicilio is not None:
        p = to_shape(g.domicilio)
        ubicacion, personas = (p.x, p.y), g.integrantes
    if est:
        p = to_shape(est[0].geom_tranquera)
        ubicacion = ubicacion or (p.x, p.y)
        items = [
            (s.especie, s.categoria_animal, int(s.cantidad))
            for s in db.execute(
                select(StockProductivo).where(
                    StockProductivo.establecimiento_id.in_([e.id for e in est])
                )
            ).scalars()
        ]
        calc = recomendacion.entrada_ganaderia(items)
        animales = (
            sum(calc.bovinos.values())
            + calc.bovinos_sin_clasificar
            + sum((calc.menores or {}).values())
        )

    sectores = []
    for sid in ids:
        e = escenario.sector(sid)
        fila = db.get(Sector, sid)
        sectores.append(
            {
                "id": sid,
                "nombre": e.nombre,
                "geometria": mapping(to_shape(fila.geom)) if fila is not None else None,
                "estado": e.estado,
                "aislado": e.aislado,
                "altura_compromiso_m": e.altura_compromiso_m,
                "margen_a_compromiso_m": e.margen_a_compromiso_m,
                "accesos": [
                    {"nombre": a.nombre, "superficie": a.superficie, "estado": a.estado}
                    for a in e.accesos
                ],
                "alertas": [
                    {
                        "orden_id": o.id,
                        "tipo": o.tipo,
                        "fundamento": o.fundamento,
                        "creada_en": o.creada_en.isoformat(),
                    }
                    # Filtro en SQL (JSONB @>): un sector no pierde alertas porque otras órdenes
                    # más nuevas sean de otros sectores.
                    for o in db.execute(
                        select(Orden)
                        .where(Orden.sectores.contains([sid]))
                        .order_by(Orden.id.desc())
                        .limit(5)
                    ).scalars()
                ],
                "categoria": "SIMULADO",
                "fuente": contexto.FUENTE_K10,
            }
        )
    return {
        "sectores": sectores,
        "altura_referencia": {
            "altura_m": altura,
            "fecha": fecha_u.isoformat(),
            "categoria": "DATO OBSERVADO",
            "fuente": "K1 · serie limpia de Puerto Formosa",
        },
        "centro_asignado": (
            _centro_sugerido(centros, ubicacion[0], ubicacion[1], personas, animales)
            if ubicacion
            else None
        ),
        "nota": "Estado calculado con la última altura observada; no es una orden de evacuación.",
    }
