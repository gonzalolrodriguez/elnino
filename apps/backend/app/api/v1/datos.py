"""Datos de referencia: estaciones, sectores, accesos, centros y series (CLAUDE.md §9 · Datos)."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, Field
from shapely.geometry import mapping
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import auditoria, constantes
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.db.base import ahora
from app.db.modelos import Acceso, CentroRecepcion, Estacion, RolOperativo, Sector, Usuario
from app.db.sesion import get_db
from app.domain import ascenso
from app.servicios import contexto

router = APIRouter(tags=["datos"])

FUENTE_K1 = "K1 · P1_DATA_INTEGRITY_dataset_participantes_v1.csv (limpio, ver registro_limpieza.md)"
FUENTE_K3 = "K3 · K3_estaciones_umbrales.json (INA, red de escalas de Prefectura Naval Argentina)"


@router.get("/estaciones")
def estaciones(db: Session = Depends(get_db)) -> dict:
    filas = db.execute(select(Estacion).order_by(Estacion.codigo)).scalars().all()
    return {
        "estaciones": [
            {
                "codigo": e.codigo,
                "clave": e.clave,
                "nombre": e.nombre,
                "abreviatura": e.abreviatura,
                "rio": e.rio,
                "lon": to_shape(e.geom).x,
                "lat": to_shape(e.geom).y,
                "aguas_bajas_m": float(e.aguas_bajas_m),
                "alerta_m": float(e.alerta_m),
                "evacuacion_m": float(e.evacuacion_m),
                "categoria": e.categoria,
                "fuente": e.fuente,
                "fecha_dato": e.fecha_dato.isoformat(),
            }
            for e in filas
        ],
        "categoria": "DATO OBSERVADO",
        "fuente": FUENTE_K3,
        "fecha_dato": constantes.FECHA_CORTE,
    }


@router.get("/sectores")
def sectores(db: Session = Depends(get_db)) -> dict:
    """Sectores K10 tal como los armó la mesa, como GeoJSON (todo rotulado SIMULADO)."""
    filas = db.execute(select(Sector).order_by(Sector.id)).scalars().all()
    return {
        "type": "FeatureCollection",
        "metadata": {
            "categoria": "SIMULADO",
            "fuente": contexto.FUENTE_K10,
            "version": filas[0].version if filas else None,
            "fecha_dato": filas[0].fecha_dato.isoformat()
            if filas and filas[0].fecha_dato
            else None,
            "crs": "EPSG:4326",
        },
        "features": [
            {
                "type": "Feature",
                "geometry": mapping(to_shape(s.geom)),
                "properties": {
                    "id": s.id,
                    "nombre": s.nombre,
                    "altura_escala_compromiso_m": float(s.altura_compromiso_m),
                    "poblacion_simulada": s.poblacion_simulada,
                    "acceso_simulado": s.acceso_simulado,
                    "estacion_referencia": s.estacion_referencia,
                    "categoria": s.categoria,
                    "SIMULADO": True,
                },
            }
            for s in filas
        ],
    }


def _geojson_acceso(a: Acceso) -> dict:
    return {
        "type": "Feature",
        "geometry": mapping(to_shape(a.geom)),
        "properties": {
            "id": a.id,
            "sector_id": a.sector_id,
            "nombre": a.nombre,
            "superficie": a.superficie,
            "transitable": a.transitable,
            "motivo": a.motivo,
            "actualizado_en": a.actualizado_en.isoformat(),
            "actualizado_por_rol": a.actualizado_por_rol,
            "categoria": a.categoria,
            "fuente": a.fuente,
            "fecha_dato": a.fecha_dato.isoformat() if a.fecha_dato else None,
        },
    }


@router.get("/accesos")
def accesos(_: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)) -> dict:
    filas = db.execute(select(Acceso).order_by(Acceso.id)).scalars().all()
    return {
        "type": "FeatureCollection",
        "metadata": {
            "categoria": "SIMULADO",
            "fuente": filas[0].fuente if filas else None,
            "nota": "Accesos de ejemplo; se reemplazan por la red vial oficial (D7).",
        },
        "features": [_geojson_acceso(a) for a in filas],
    }


class AccesoPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transitable: bool
    motivo: str | None = Field(default=None, max_length=300)


@router.patch("/accesos/{acceso_id}")
def actualizar_acceso(
    acceso_id: int,
    datos: AccesoPatch,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("operador", "decisor", "admin")),
    db: Session = Depends(get_db),
) -> dict:
    acceso = db.get(Acceso, acceso_id)
    if acceso is None:
        raise HTTPException(404, "Acceso no encontrado")
    acceso.transitable = datos.transitable
    acceso.motivo = None if datos.transitable else datos.motivo
    acceso.actualizado_en = ahora()
    acceso.actualizado_por_rol = usuario.rol_operativo or usuario.rol
    auditoria.registrar(
        db,
        "acceso_actualizado",
        f"accesos/{acceso.id}",
        usuario.id,
        ip_cliente(request),
        f"transitable={datos.transitable}",
    )
    db.commit()
    difusor.publicar(
        "escenario",
        {"motivo": "acceso_actualizado", "acceso_id": acceso.id, "transitable": acceso.transitable},
    )
    return _geojson_acceso(acceso)


@router.get("/centros")
def centros(_: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)) -> dict:
    filas = db.execute(select(CentroRecepcion).order_by(CentroRecepcion.id)).scalars().all()
    return {
        "centros": [
            {
                "id": c.id,
                "nombre": c.nombre,
                "tipo": c.tipo,
                "lon": to_shape(c.geom).x,
                "lat": to_shape(c.geom).y,
                "sector_id": c.sector_id,
                "capacidad_personas": c.capacidad_personas,
                "capacidad_animales": c.capacidad_animales,
                "ocupacion": c.ocupacion,
                "cupo_libre_personas": max(c.capacidad_personas - c.ocupacion, 0),
                "servicios": c.servicios,
                "nota": c.nota,
                "categoria": c.categoria,
                "fuente": c.fuente,
                "fecha_dato": c.fecha_dato.isoformat() if c.fecha_dato else None,
            }
            for c in filas
        ],
        "categoria": "SIMULADO",
        "nota": "Qué edificio es centro de recepción y su capacidad lo define la autoridad.",
    }


@router.get("/roles-operativos")
def roles_operativos(_: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)) -> dict:
    """Catálogo de roles operativos (sin nombres de funcionarios)."""
    filas = db.execute(select(RolOperativo).order_by(RolOperativo.codigo)).scalars().all()
    return {
        "roles": [
            {"codigo": r.codigo, "nombre": r.nombre, "descripcion": r.descripcion} for r in filas
        ],
        "categoria": "SIMULADO",
        "fuente": "Catálogo de roles operativos (SUPUESTO, sin nombres de personas)",
    }


@router.get("/serie/formosa")
def serie_formosa(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Serie diaria (máximo del día) de Puerto Formosa con umbrales. K1 limpio, sin interpolar."""
    corte = date.fromisoformat(constantes.FECHA_CORTE)
    tope = hasta if hasta and hasta < corte else corte
    serie = contexto.serie_diaria(db, desde, tope)
    estacion = contexto.estacion_formosa(db)

    def pico(año: int) -> dict | None:
        candidatos = {d: v for d, v in serie.items() if d.year == año}
        if not candidatos:
            return None
        v = max(candidatos.values())
        return {
            "anio": año,
            "altura_m": v,
            "fecha": min(d for d, x in candidatos.items() if x == v).isoformat(),
        }

    ultimo = contexto.ultima_lectura(serie) if serie else None
    return {
        "estacion": {"codigo": estacion.codigo, "nombre": estacion.nombre, "rio": estacion.rio},
        "unidad": "m",
        "umbrales": {
            "aguas_bajas_m": float(estacion.aguas_bajas_m),
            "alerta_m": float(estacion.alerta_m),
            "evacuacion_m": float(estacion.evacuacion_m),
            "categoria": "DATO OBSERVADO",
            "fuente": FUENTE_K3,
        },
        "picos": [p for p in (pico(2016), pico(2019)) if p],
        "maximo": (
            None
            if not serie
            else {
                "altura_m": max(serie.values()),
                "fecha": min(d for d, v in serie.items() if v == max(serie.values())).isoformat(),
            }
        ),
        "ultima": None
        if ultimo is None
        else {"fecha": ultimo[0].isoformat(), "altura_m": ultimo[1]},
        "n": len(serie),
        "puntos": [{"fecha": d.isoformat(), "altura_max_m": v} for d, v in serie.items()],
        "notas": [
            "Máximo diario de las lecturas válidas; los días sin dato no se interpolan.",
            "Los valores en cuarentena (p. ej. 98,1 del 15/07/2012) no se muestran.",
        ],
        "categoria": "DATO OBSERVADO",
        "fuente": FUENTE_K1,
        "fecha_dato": constantes.FECHA_CORTE,
    }


def _suba(s: ascenso.Suba | None) -> dict | None:
    return None if s is None else {"metros": s.metros, "fecha": s.fecha_fin.isoformat()}


@router.get("/serie/ascenso")
def serie_ascenso(
    altura_actual_m: float | None = Query(default=None, ge=0, le=12),
    db: Session = Depends(get_db),
) -> dict:
    """Velocidades de ascenso (2015-16, 2019, oct-2026) y tiempo restante a cada umbral.

    La proyección es lineal (SUPUESTO) y se da como rango entre la tasa más alta y la más baja.
    """
    serie = contexto.serie_diaria(db)
    fecha_ultima, altura_ultima = contexto.ultima_lectura(serie)
    altura = altura_ultima if altura_actual_m is None else altura_actual_m
    umbrales = contexto.umbrales_formosa(db)
    tasas = ascenso.tasas_m_dia(serie)

    objetivos = [
        ("Alerta (K3)", umbrales.alerta_m, "DATO OBSERVADO"),
        ("Evacuación (K3)", umbrales.evacuacion_m, "DATO OBSERVADO"),
    ] + [
        (f"Compromiso {s.id} ({s.nombre})", s.altura_compromiso_m, "SIMULADO")
        for s in sorted(contexto.cargar_sectores(db), key=lambda s: s.altura_compromiso_m)
    ]
    tiempos = []
    for etiqueta, valor, cat in objetivos:
        t = ascenso.tiempo_restante(altura, valor, tasas)
        tiempos.append(
            {
                "objetivo": etiqueta,
                "valor_m": valor,
                "categoria_del_umbral": cat,
                "ya_alcanzado": t.ya_alcanzado,
                "dias_minimo": t.dias_minimo,
                "dias_maximo": t.dias_maximo,
                "por_tasa": t.por_tasa,
            }
        )
    periodos = []
    for nombre, (desde, hasta) in ascenso.PERIODOS.items():
        r = ascenso.resumen_periodo(serie, nombre)
        periodos.append(
            {
                "periodo": nombre,
                "ventana": {
                    "desde": desde.isoformat(),
                    "hasta": hasta.isoformat(),
                    "fuente": "SUPUESTO",
                },
                "mayor_suba_1d": _suba(r.mayor_suba_1d),
                "mayor_suba_7d": _suba(r.mayor_suba_7d),
                "cruces": {f"{u:.2f}": (d.isoformat() if d else None) for u, d in r.cruces.items()},
            }
        )
    return {
        "altura_actual_m": altura,
        "fecha_altura": fecha_ultima.isoformat() if altura_actual_m is None else None,
        "periodos": periodos,
        "periodos_categoria": "DATO OBSERVADO",
        "tasas_m_dia": tasas,
        "tiempo_restante": tiempos,
        "supuesto": ascenso.SUPUESTO_LINEAL,
        "horizonte_pronostico_oficial_dias": 15,
        "categoria_proyeccion": "SIMULADO",
        "categoria": "DATO OBSERVADO",
        "fuente": FUENTE_K1 + "; umbrales de K3; compromisos de K10 (SIMULADO)",
        "fecha_dato": constantes.FECHA_CORTE,
    }
