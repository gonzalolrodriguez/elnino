"""Centinela: bitácora K8, verificadores K6/K7 y cálculo ganadero (CLAUDE.md §8.5, §8.9, §9)."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import auditoria, constantes
from app.core.rbac import ip_cliente, requiere_rol, usuario_actual
from app.db.modelos import BitacoraDecision, Estacion, LecturaLluvia, RolOperativo, Usuario
from app.db.sesion import get_db
from app.domain import ganaderia, hidrografia, verificador
from app.servicios import capas, contexto

router = APIRouter(tags=["centinela"])
_MANDOS = ("operador", "decisor", "admin")


# ---- bitácora K8 --------------------------------------------------------------------------------


class _Campos(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str = Field(max_length=4000, description="Decisión")
    evidencia: str = Field(max_length=4000, description="Evidencia (dato con fuente abrible)")
    limites: str = Field(max_length=4000, description="Límites")
    riesgos: str = Field(max_length=4000, description="Riesgos de la decisión y de la contraria")
    gatillos: str = Field(max_length=4000, description="Gatillos de cambio (valor y fuente)")
    responsable_rol: str | None = Field(default=None, max_length=60)
    fecha_simulada: date

    @field_validator("decision", "evidencia", "limites", "riesgos", "gatillos")
    @classmethod
    def no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Campo obligatorio de la bitácora K8: no puede estar vacío")
        return v


class BitacoraIn(_Campos):
    snapshot: dict | None = None


def _bitacora_a_dict(b: BitacoraDecision) -> dict:
    return {
        "id": b.id,
        "estado": b.estado,
        "decision": b.decision,
        "evidencia": b.evidencia,
        "limites": b.limites,
        "riesgos": b.riesgos,
        "gatillos": b.gatillos,
        "responsable_rol": b.responsable_rol,
        "fecha_simulada": b.fecha_simulada.isoformat(),
        "orden_id": b.orden_id,
        "snapshot": b.snapshot,
        "creada_en": b.creada_en.isoformat(),
        "categoria": b.categoria,
    }


def _rol_responsable(db: Session, usuario: Usuario, indicado: str | None) -> str:
    rol = indicado or usuario.rol_operativo
    if not rol:
        raise HTTPException(422, "Indicar responsable_rol (el usuario no tiene rol operativo)")
    if db.get(RolOperativo, rol) is None:
        raise HTTPException(422, f"responsable_rol desconocido: {rol}")
    return rol


@router.get("/bitacora")
def listar_bitacora(
    estado: str | None = Query(default=None, max_length=20),
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    consulta = select(BitacoraDecision).order_by(BitacoraDecision.id.desc()).limit(200)
    if estado:
        consulta = consulta.where(BitacoraDecision.estado == estado)
    return {"entradas": [_bitacora_a_dict(b) for b in db.execute(consulta).scalars()]}


@router.post("/bitacora", status_code=201)
def crear_bitacora(
    datos: BitacoraIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("decisor")),
    db: Session = Depends(get_db),
) -> dict:
    b = BitacoraDecision(
        decision=datos.decision,
        evidencia=datos.evidencia,
        limites=datos.limites,
        riesgos=datos.riesgos,
        gatillos=datos.gatillos,
        responsable_rol=_rol_responsable(db, usuario, datos.responsable_rol),
        fecha_simulada=datos.fecha_simulada,
        snapshot=datos.snapshot,
        estado="completa",
        creada_por=usuario.id,
    )
    db.add(b)
    db.flush()
    auditoria.registrar(db, "bitacora_creada", f"bitacora/{b.id}", usuario.id, ip_cliente(request))
    db.commit()
    return _bitacora_a_dict(b)


@router.patch("/bitacora/{bitacora_id}")
def completar_bitacora(
    bitacora_id: int,
    datos: _Campos,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("decisor")),
    db: Session = Depends(get_db),
) -> dict:
    """Completa un borrador generado por una orden; los seis campos son obligatorios."""
    b = db.get(BitacoraDecision, bitacora_id)
    if b is None:
        raise HTTPException(404, "Entrada de bitácora no encontrada")
    if b.estado != "borrador":
        raise HTTPException(409, "Solo se pueden completar borradores")
    b.decision, b.evidencia, b.limites = datos.decision, datos.evidencia, datos.limites
    b.riesgos, b.gatillos = datos.riesgos, datos.gatillos
    b.responsable_rol = _rol_responsable(db, usuario, datos.responsable_rol)
    b.fecha_simulada = datos.fecha_simulada
    b.estado = "completa"
    auditoria.registrar(
        db, "bitacora_completada", f"bitacora/{b.id}", usuario.id, ip_cliente(request)
    )
    db.commit()
    return _bitacora_a_dict(b)


@router.get("/bitacora/{bitacora_id}/export", response_class=PlainTextResponse)
def exportar_bitacora(
    bitacora_id: int,
    _: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    b = db.get(BitacoraDecision, bitacora_id)
    if b is None:
        raise HTTPException(404, "Entrada de bitácora no encontrada")
    md = "\n".join(
        [
            f"# Bitácora de decisiones K8 · entrada {b.id}",
            "",
            f"> {constantes.LEYENDA}",
            "",
            f"- **Estado:** {b.estado}",
            f"- **Responsable (rol):** {b.responsable_rol}",
            f"- **Fecha (día simulado):** {b.fecha_simulada.isoformat()}",
            f"- **Categoría:** {b.categoria}",
            f"- **Orden asociada:** {b.orden_id if b.orden_id else '-'}",
            "",
            "## Decisión",
            b.decision,
            "",
            "## Evidencia",
            b.evidencia,
            "",
            "## Límites",
            b.limites,
            "",
            "## Riesgos",
            b.riesgos,
            "",
            "## Gatillos de cambio",
            b.gatillos,
            "",
        ]
    )
    return PlainTextResponse(
        md,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="bitacora_{b.id}.md"'},
    )


# ---- verificadores ------------------------------------------------------------------------------


@router.get("/verificador/k6")
def verificar_k6(db: Session = Depends(get_db)) -> dict:
    serie = contexto.serie_diaria(db)
    estacion = contexto.estacion_formosa(db)
    observadas = db.execute(
        select(func.count()).select_from(LecturaLluvia).where(LecturaLluvia.categoria != "SIMULADO")
    ).scalar_one()
    return {
        "informe": "K6 · informe de situación hidrológica generado por un asistente de IA (SIMULADO)",
        "afirmaciones": verificador.verificar_k6(
            serie,
            float(estacion.alerta_m),
            float(estacion.evacuacion_m),
            estacion.fuente,
            observadas,
        ),
        "nota": "Cada veredicto sale de K1 (serie limpia) y K3; lo que el kit no permite contrastar "
        "figura como NO VERIFICABLE.",
        "categoria": "DATO OBSERVADO",
        "fuente": "K1, K3 y K9",
        "fecha_dato": constantes.FECHA_CORTE,
    }


@router.get("/verificador/k7")
def verificar_k7(db: Session = Depends(get_db)) -> dict:
    por_clave = {e.clave: e for e in db.execute(select(Estacion)).scalars()}
    estaciones = {}
    for clave in ("formosa", "pilcomayo"):
        e = por_clave[clave]
        p = to_shape(e.geom)
        estaciones[clave] = {
            "lat": p.y,
            "lon": p.x,
            "alerta_m": float(e.alerta_m),
            "evacuacion_m": float(e.evacuacion_m),
        }
    medidas = hidrografia.analizar(capas.cursos_principales(), capas.localidad("Clorinda"))
    return {
        "esquema": "K7 · red hidrográfica propuesta (esquema educativo generado por IA, no verificado)",
        "relaciones": verificador.verificar_k7(estaciones, medidas),
        "nota": "Las relaciones 3 y 6 se calculan con K3; las 1, 2 y 5 se miden sobre la capa de "
        "cursos de agua del IGN (data/geo/). Las 4 y 7 involucran al Paraná y a Corrientes, que la "
        "capa de Formosa no incluye: figuran como NO VERIFICABLE CON LA CAPA DISPONIBLE.",
        "categoria": "DOCUMENTO DE REFERENCIA",
        "fuente": f"K3 (coordenadas y umbrales); {capas.FUENTE_CURSOS}; {capas.FUENTE_LOCALIDADES}",
        "fecha_dato": constantes.FECHA_CORTE,
    }


# ---- Arca Productiva ----------------------------------------------------------------------------


class BovinoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    categoria: str = Field(min_length=2, max_length=60)
    cantidad: int = Field(ge=0, le=100000)


class MenorIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    especie: str = Field(pattern="^(caprino|ovino|porcino)$")
    cantidad: int = Field(ge=0, le=100000)


class ColmenasIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vivas: int = Field(default=0, ge=0, le=100000)
    muertas: int = Field(default=0, ge=0, le=100000)
    traslado: str = Field(default="vehicular", pattern="^(vehicular|a_pie)$")


class CalculoGanaderoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bovinos: list[BovinoIn] = Field(default_factory=list, max_length=30)
    otros: list[MenorIn] = Field(default_factory=list, max_length=10)
    colmenas: ColmenasIn | None = None
    superficie_albardon_m2: float | None = Field(default=None, ge=0, le=1e9)


@router.post("/ganaderia/calculo")
def calculo_ganadero(datos: CalculoGanaderoIn, _: Usuario = Depends(usuario_actual)) -> dict:
    bovinos: dict[str, int] = {}
    sin_clasificar = 0
    for b in datos.bovinos:
        canonica = ganaderia.categoria_canonica(b.categoria)
        if canonica is None:
            raise HTTPException(
                422,
                f"Categoría bovina desconocida: '{b.categoria}'. Usar: vaca preñada, vaca vacía, "
                "vaca con cría, ternero, vaquillona o toro.",
            )
        bovinos[canonica] = bovinos.get(canonica, 0) + b.cantidad
    menores: dict[str, int] = {}
    for o in datos.otros:
        menores[o.especie] = menores.get(o.especie, 0) + o.cantidad
    entrada = ganaderia.EntradaGanaderia(
        bovinos=bovinos,
        bovinos_sin_clasificar=sin_clasificar,
        menores=menores or None,
        colmenas_vivas=datos.colmenas.vivas if datos.colmenas else 0,
        colmenas_muertas=datos.colmenas.muertas if datos.colmenas else 0,
        traslado_colmenas=datos.colmenas.traslado if datos.colmenas else "vehicular",
        superficie_albardon_m2=datos.superficie_albardon_m2,
    )
    return ganaderia.calcular(entrada) | {"fecha_dato": date.today().isoformat()}
