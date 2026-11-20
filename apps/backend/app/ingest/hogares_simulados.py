"""Set separado de hogares SIMULADOS para la población de K10 (odd/tasks/motor-evacuacion.md, M7).

K10 trae un total de población simulada por sector, sin hogares. Para probar que el motor no separa
familias con toda la población (y no solo con las familias registradas), este script divide la
población de cada sector en hogares con la distribución de tamaños ``hogar_tamano_distribucion``
de ``supuestos.yaml`` (SUPUESTO). Es determinista (semilla fija) y la suma por sector es exactamente
la población de K10, que no se modifica.

Uso (desde ``apps/backend``)::

    python -m app.ingest.hogares_simulados            # escribe data/simulado/hogares_k10.json
    python -m app.ingest.hogares_simulados --verificar  # falla si el archivo no coincide

El recomendador lo usa solo si se pide ``poblacion_k10_en_hogares: true``.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

from app.config.settings import DATA_DIR, cargar_supuestos, supuesto

SEMILLA = 2026
ARCHIVO = DATA_DIR / "simulado" / "hogares_k10.json"
K10 = DATA_DIR / "kit" / "K10_sectores_simulados.geojson"
FECHA = "2026-11-19"


def poblacion_k10(ruta: Path = K10) -> dict[str, int]:
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    return {
        f["properties"]["id"]: int(f["properties"]["poblacion_simulada"]) for f in datos["features"]
    }


def dividir_en_hogares(
    poblacion: int, distribucion: dict[int, float], rng: random.Random
) -> list[int]:
    """Tamaños de hogar que suman exactamente ``poblacion`` (el último se recorta si hace falta)."""
    tamanos = sorted(distribucion)
    pesos = [distribucion[t] for t in tamanos]
    hogares: list[int] = []
    resto = poblacion
    while resto > 0:
        t = rng.choices(tamanos, weights=pesos)[0]
        t = min(t, resto)
        hogares.append(t)
        resto -= t
    return hogares


def generar() -> dict:
    distribucion = {int(k): float(v) for k, v in supuesto("hogar_tamano_distribucion").items()}
    rng = random.Random(SEMILLA)
    sectores = {}
    for sid, poblacion in sorted(poblacion_k10().items()):
        hogares = dividir_en_hogares(poblacion, distribucion, rng)
        sectores[sid] = {
            "poblacion_k10": poblacion,
            "hogares": len(hogares),
            "promedio_personas": round(poblacion / len(hogares), 2),
            "tamanos": hogares,
        }
    return {
        "categoria": "SIMULADO",
        "fecha": FECHA,
        "fuente": (
            "SIMULADO · población de K10 (sin cambios) dividida en hogares con la distribución "
            "hogar_tamano_distribucion de supuestos.yaml (SUPUESTO)"
        ),
        "nota": (
            "Set separado para probar que el motor no separa familias. No es un padrón ni sale "
            "del censo: el cuadro de hogares por cantidad de personas del Censo 2022 de Formosa "
            "no se pudo obtener (ver odd/tasks/motor-evacuacion.md, M7). No se carga en la base: "
            "el recomendador lo lee solo con poblacion_k10_en_hogares=true."
        ),
        "semilla": SEMILLA,
        "distribucion": {str(k): v for k, v in sorted(distribucion.items())},
        "distribucion_fuente": cargar_supuestos()["hogar_tamano_distribucion"]["fuente"],
        "sectores": sectores,
    }


def cargar(ruta: Path = ARCHIVO) -> dict[str, list[int]]:
    """Tamaños de hogar por sector del set separado (``{}`` si el archivo no existe)."""
    if not ruta.exists():
        return {}
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    return {sid: list(s["tamanos"]) for sid, s in datos["sectores"].items()}


def main() -> None:
    ap = argparse.ArgumentParser(description="Genera data/simulado/hogares_k10.json (SIMULADO).")
    ap.add_argument("--verificar", action="store_true", help="Solo comparar con el archivo")
    args = ap.parse_args()
    nuevo = generar()
    texto = json.dumps(nuevo, ensure_ascii=False, indent=2) + "\n"
    if args.verificar:
        actual = ARCHIVO.read_text(encoding="utf-8") if ARCHIVO.exists() else ""
        if actual != texto:
            sys.exit(f"{ARCHIVO} no coincide con la generación (correr sin --verificar)")
        print("hogares_k10.json: coincide")
        return
    ARCHIVO.write_text(texto, encoding="utf-8")
    for sid, s in nuevo["sectores"].items():
        print(f"{sid}: {s['poblacion_k10']} personas en {s['hogares']} hogares")


if __name__ == "__main__":
    main()
