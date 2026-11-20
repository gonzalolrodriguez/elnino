"""Caudal diario modelado de GloFAS (Copernicus EMS, vía Open-Meteo) para Puerto Formosa y Pilcomayo.

Lee ``data/processed/glofas_<estacion>.json`` (ver ``scripts/descargar_glofas.py``). Es caudal
MODELADO en m³/s (DOCUMENTO DE REFERENCIA): no es altura de escala ni un pronóstico oficial, y no se
convierte a metros porque el kit no trae una curva altura-caudal oficial.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Literal

from app.config.settings import DATA_DIR, get_settings
from app.core import constantes

Estacion = Literal["formosa", "pilcomayo"]

NOTA = (
    "GloFAS da caudal (m³/s), no altura de escala; no hay curva altura-caudal oficial en el kit, "
    "así que no se convierte a metros. El INA no publica pronósticos a más de 15 días."
)
CATEGORIA = "DOCUMENTO DE REFERENCIA"


@lru_cache(maxsize=4)
def _cargar(estacion: str) -> dict:
    ruta = DATA_DIR / "processed" / f"glofas_{estacion}.json"
    return json.loads(ruta.read_text(encoding="utf-8"))


def _pico(pares: list[tuple[str, float]], anio: int) -> dict | None:
    candidatos = [(v, f) for f, v in pares if f.startswith(str(anio))]
    if not candidatos:
        return None
    v, f = max(candidatos)
    return {"anio": anio, "caudal_m3s": v, "fecha": f}


def serie(estacion: Estacion) -> dict:
    d = _cargar(estacion)
    m = d["modelado"]
    corte = constantes.FECHA_CORTE
    pares = [(f, v) for f, v in zip(m["fechas"], m["caudal_m3s"], strict=True) if f <= corte]
    validos = [(f, v) for f, v in pares if v is not None]
    posterior = None
    if get_settings().permitir_datos_post_corte:
        p = d["posterior_al_corte"]
        posterior = {
            "rotulo": (
                f"POSTERIOR AL CORTE · ejecución vigente al {d['fecha_descarga_utc']} (UTC); "
                "no es el pronóstico emitido el 31/10/2026"
            ),
            "categoria": CATEGORIA,
            "horizonte_dias": len(p["fechas"]),
            "supuesto": (
                "Estadísticas del ensamble GloFAS; la banda p25–p75 y mín.–máx. refleja solo la "
                "dispersión entre miembros, no el error del modelo hidrológico."
            ),
            "fechas": p["fechas"],
            "caudal_m3s": p["caudal_m3s"],
            "p25": p["p25"],
            "p75": p["p75"],
            "minimo": p["minimo"],
            "maximo": p["maximo"],
            "mediana": p["mediana"],
            "fecha_descarga_utc": d["fecha_descarga_utc"],
        }
    return {
        "estacion": {"clave": estacion, "nombre": d["nombre"]},
        "unidad": d["unidad"],
        "fechas": [f for f, _ in pares],
        "caudal_m3s": [v for _, v in pares],
        "n": len(validos),
        "picos": [p for p in (_pico(validos, 2016), _pico(validos, 2019)) if p],
        "ultima": {"fecha": validos[-1][0], "caudal_m3s": validos[-1][1]} if validos else None,
        "posterior_al_corte": posterior,
        "pronostico_emitido_al_corte": None,
        "notas": [
            NOTA,
            "No se pudo obtener el pronóstico tal como se emitió el 31/10/2026: la API solo ofrece "
            "la ejecución vigente al descargar. Hasta el corte se muestra únicamente caudal "
            "modelado (reanálisis/análisis), sin pronóstico.",
            "Caudal modelado en una celda de ~5 km: puede diferir del caudal real y sus picos no "
            "coinciden necesariamente en fecha con las alturas observadas (K1).",
        ],
        "celda_usada": d["celda_usada"],
        "categoria": CATEGORIA,
        "fuente": d["fuente"],
        "licencia": d["licencia"],
        "atribucion": "GloFAS / Copernicus Emergency Management Service y Open-Meteo (CC BY 4.0)",
        "fecha_dato": constantes.FECHA_CORTE,
        "fecha_descarga": d["fecha_descarga_utc"],
    }
