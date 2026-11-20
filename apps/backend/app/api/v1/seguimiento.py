"""Seguimiento de la cuadrilla ("Cuadrilla en camino") (CLAUDE.md §8.6, §9).

- ``POST /cuadrillas/mi-posicion``: la cuadrilla comparte su posición mientras tiene una tarea en
  curso (rate limit por cuadrilla).
- ``GET /mi/seguimiento``: la ciudadanía y los productores ven la cuadrilla de SUS pedidos en curso.
- ``GET /mi/pedidos``: los pedidos propios con su línea de tiempo (ver ``app.servicios.pedidos``).
- ``GET /cuadrillas/posiciones``: los roles operativos ven dónde está cada cuadrilla.

Privacidad (Ley 25.326): se guarda solo la última posición, solo mientras hay una tarea en curso, y
la ven únicamente el solicitante de esa tarea y los mandos. Se identifica por rol, no por persona.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.v1.operacion import _cuadrillas_de
from app.core import auditoria
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol
from app.core.tiempo import hoy_ar
from app.db.modelos import Usuario
from app.db.sesion import get_db
from app.servicios import pedidos
from app.servicios import seguimiento as srv

router = APIRouter(tags=["seguimiento"])
_MANDOS = ("operador", "decisor", "admin")


class PosicionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    precision_m: float | None = Field(default=None, ge=0, le=100000)


@router.post("/cuadrillas/mi-posicion")
def compartir_posicion(
    datos: PosicionIn,
    request: Request,
    usuario: Usuario = Depends(requiere_rol("cuadrilla")),
    db: Session = Depends(get_db),
) -> dict:
    activas = srv.cuadrillas_con_tarea_en_curso(db, _cuadrillas_de(db, usuario))
    if not activas:
        raise HTTPException(
            409,
            "No tenés ninguna tarea en curso: la ubicación se comparte solo mientras hay una.",
        )
    for cuadrilla_id in activas:
        espera = srv.registrar_posicion(db, cuadrilla_id, datos.lat, datos.lon, datos.precision_m)
        if espera is not None:
            db.rollback()
            raise HTTPException(
                429,
                f"Enviaste la posición hace poco. Esperá {espera} s antes de enviar otra.",
                headers={"Retry-After": str(espera)},
            )
    auditoria.registrar(
        db,
        "posicion_cuadrilla_enviada",
        f"cuadrillas/{activas[0]}/posicion",
        usuario.id,
        ip_cliente(request),
    )
    db.commit()
    # Sin coordenadas en el evento: los mandos refrescan con GET /cuadrillas/posiciones.
    difusor.publicar("posicion_cuadrilla", {"cuadrillas": activas})
    return {"cuadrillas": activas, "categoria": srv.CATEGORIA}


@router.get("/mi/seguimiento")
def mi_seguimiento(
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor")),
    db: Session = Depends(get_db),
) -> dict:
    seguimientos = srv.seguimiento_de(db, usuario.id)
    srv.purgar_vencidas(db)
    db.commit()
    return {
        "seguimientos": seguimientos,
        "categoria": srv.CATEGORIA,
        "fuente": srv.FUENTE,
        "fecha_dato": hoy_ar().isoformat(),
    }


@router.get("/mi/pedidos")
def mis_pedidos(
    usuario: Usuario = Depends(requiere_rol("ciudadano", "productor")),
    db: Session = Depends(get_db),
) -> dict:
    """Pedidos propios con línea de tiempo, cuadrilla (por rol), vehículo, seguimiento y centro."""
    items = pedidos.pedidos_de(db, usuario.id)
    srv.purgar_vencidas(db)
    db.commit()
    return {"categoria": pedidos.CATEGORIA, "items": items}


@router.get("/cuadrillas/posiciones")
def posiciones(
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    items = srv.posiciones_operativas(db)
    srv.purgar_vencidas(db)
    auditoria.registrar(
        db, "lectura_ubicacion_cuadrillas", "cuadrillas/posiciones", usuario.id, ip_cliente(request)
    )
    db.commit()
    return {
        "posiciones": items,
        "categoria": srv.CATEGORIA,
        "fuente": srv.FUENTE,
        "fecha_dato": hoy_ar().isoformat(),
        "supuestos": srv.supuestos_usados(),
    }
