"""Simulación: escenario, recomendación, alternativas y ruteo (CLAUDE.md §8, §9 · Simulación)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core import constantes
from app.core.eventos import difusor
from app.core.rbac import requiere_rol
from app.db.modelos import Alternativa, Usuario
from app.db.sesion import get_db
from app.domain import ruteo as dom_ruteo
from app.servicios import contexto, recomendacion
from app.servicios import ruteo as srv_ruteo

router = APIRouter(prefix="/simulacion", tags=["simulacion"])
router_ruteo = APIRouter(tags=["simulacion"])

_MANDOS = ("operador", "decisor", "admin")
ORIGENES_LLUVIA = ("simulado", "manual", "parte_policial", "planilla_upca")


class EscenarioIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    altura_formosa_m: float = Field(ge=0, le=12, description="Altura de Puerto Formosa (0 a 12 m)")
    lluvia_mm: float = Field(default=0, ge=0, le=1000)
    lluvia_origen: Literal["simulado", "manual", "parte_policial", "planilla_upca"] = "simulado"
    caminos_cerrados: list[int] = Field(default_factory=list, max_length=200)
    humedad_suelo: float | None = Field(default=None, ge=0, le=1)


def _validar_caminos(db: Session, ids: list[int]) -> set[int]:
    faltan = contexto.accesos_faltantes(db, ids)
    if faltan:
        raise HTTPException(404, f"Acceso inexistente: {', '.join(map(str, faltan))}")
    return set(ids)


@router.post("/escenario")
def escenario(
    datos: EscenarioIn,
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    cerrados = _validar_caminos(db, datos.caminos_cerrados)
    e = contexto.calcular_escenario(
        db, datos.altura_formosa_m, datos.lluvia_mm, cerrados, datos.humedad_suelo
    )
    salida = contexto.escenario_a_dict(e)
    resultado = {
        "entrada": datos.model_dump(),
        "lluvia": {
            "mm": datos.lluvia_mm,
            "origen": datos.lluvia_origen,
            "categoria": "SIMULADO"
            if datos.lluvia_origen in ("simulado", "manual")
            else "DOCUMENTO DE REFERENCIA",
        },
        **salida,
        "categoria": "SIMULADO",
        "fuente": f"{contexto.FUENTE_K10}; umbrales K3; supuestos.yaml",
        "fecha_dato": date.today().isoformat(),
    }
    difusor.publicar(
        "escenario", {"motivo": "simulacion", "resumen": e.resumen, "altura_m": e.altura_m}
    )
    return resultado


class RecomendacionIn(EscenarioIn):
    prioridad: Literal["riesgo", "poblacion"] = "riesgo"
    sectores: list[str] | None = Field(default=None, max_length=10)


def _validar_sectores(db: Session, ids: list[str] | None) -> None:
    if ids:
        conocidos = {s.id for s in contexto.cargar_sectores(db)}
        desconocidos = sorted(set(ids) - conocidos)
        if desconocidos:
            raise HTTPException(422, f"Sector desconocido: {', '.join(desconocidos)}")


@router.post("/recomendacion")
def recomendacion_(
    datos: RecomendacionIn,
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    cerrados = _validar_caminos(db, datos.caminos_cerrados)
    _validar_sectores(db, datos.sectores)
    return recomendacion.recomendar(
        db,
        datos.altura_formosa_m,
        datos.lluvia_mm,
        cerrados,
        datos.prioridad,
        datos.sectores,
        datos.humedad_suelo,
    )


class AlternativaEditable(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str | None = Field(default=None, max_length=120)
    orden_sectores: list[str] | None = Field(default=None, max_length=10)
    centros_excluidos: list[int] = Field(default_factory=list, max_length=50)


class AlternativasIn(EscenarioIn):
    editable: AlternativaEditable | None = None


@router.post("/alternativas")
def alternativas(
    datos: AlternativasIn,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    cerrados = _validar_caminos(db, datos.caminos_cerrados)
    if datos.editable:
        _validar_sectores(db, datos.editable.orden_sectores)
    d = recomendacion.cargar_datos(
        db, datos.altura_formosa_m, datos.lluvia_mm, cerrados, datos.humedad_suelo
    )
    editable = datos.editable.model_dump() if datos.editable else None
    alts = recomendacion.comparar(d, cerrados, editable)
    snapshot = {
        "entrada": {
            "altura_formosa_m": datos.altura_formosa_m,
            "lluvia_mm": datos.lluvia_mm,
            "caminos_cerrados": sorted(cerrados),
        },
        "rio": d.escenario.rio,
        "resumen": d.escenario.resumen,
    }
    for a in alts:
        fila = Alternativa(
            nombre=a["nombre"],
            escenario_snapshot=snapshot,
            parametros={
                "tipo": a["tipo"],
                **a["parametros"],
                "orden_sectores": a["orden_sectores"],
            },
            metricas=a["metricas"],
            creada_por=usuario.id,
        )
        db.add(fila)
        db.flush()
        a["id"] = fila.id
    db.commit()
    return {
        "etiqueta": recomendacion.ETIQUETA,
        "escenario": snapshot,
        "alternativas": alts,
        "comparacion": recomendacion.tabla_comparacion(alts),
        "categoria": "SIMULADO",
        "fuente": recomendacion.FUENTE,
        "fecha_dato": date.today().isoformat(),
    }


class Punto(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)


class RuteoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    perfil: Literal["vehicular", "camion_jaula", "arreo"] = "vehicular"
    origen: Punto
    destino: Punto | None = None
    centro_id: int | None = Field(default=None, description="Alternativa a 'destino'")
    altura_formosa_m: float | None = Field(default=None, ge=0, le=12)
    lluvia_mm: float = Field(default=0, ge=0, le=1000)
    caminos_cerrados: list[int] = Field(default_factory=list, max_length=200)


@router_ruteo.post("/ruteo")
def ruteo(
    datos: RuteoIn,
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    if datos.perfil not in dom_ruteo.PERFILES:
        raise HTTPException(422, "Perfil inválido")
    if (datos.destino is None) == (datos.centro_id is None):
        raise HTTPException(422, "Indicar exactamente uno: 'destino' o 'centro_id'")
    cerrados = _validar_caminos(db, datos.caminos_cerrados)
    if datos.destino is not None:
        destino = (datos.destino.lon, datos.destino.lat)
    else:
        centro = next((c for c in contexto.cargar_centros(db) if c.id == datos.centro_id), None)
        if centro is None:
            raise HTTPException(404, "Centro de recepción no encontrado")
        destino = (centro.lon, centro.lat)
    r = srv_ruteo.resolver_ruta(
        db,
        datos.perfil,
        (datos.origen.lon, datos.origen.lat),
        destino,
        datos.altura_formosa_m,
        datos.lluvia_mm,
        cerrados,
    )
    r["fecha_dato"] = date.today().isoformat()
    r["fuente"] = "red_vial cargada (si la hay) y accesos SIMULADO; supuestos.yaml"
    r["leyenda"] = constantes.LEYENDA
    return r
