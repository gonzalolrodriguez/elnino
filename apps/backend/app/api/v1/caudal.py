"""Caudal modelado GloFAS (CLAUDE.md §9 · Datos). DOCUMENTO DE REFERENCIA."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.servicios import caudal

router = APIRouter(tags=["datos"])


@router.get("/serie/caudal-glofas")
def serie_caudal_glofas(
    estacion: caudal.Estacion = Query(default="formosa"),
) -> dict:
    """Caudal diario modelado (m³/s) hasta el corte; posterior al corte solo con el flag."""
    return caudal.serie(estacion)
