"""Arca Productiva (CLAUDE.md §8.5): dormidero, camiones, lotes, raciones y checklist. Lógica pura.

Las cifras de INTA (dormidero, lotes, raciones) y de transporte (camión jaula, vehículo categoría B)
están en ``supuestos.yaml`` con su fuente o la palabra SUPUESTO. Ninguna es normativa verificada.
"""

from __future__ import annotations

import math
import unicodedata
from dataclasses import dataclass

from app.config.settings import cargar_supuestos, supuesto

# Nombre canónico de cada categoría bovina y su lote en destino (reglas de agrupación del INTA).
LOTE_DE = {
    "vaca_prenada": "vientres_toros",
    "vaca_vacia": "vientres_toros",
    "toro": "vientres_toros",
    "vaquillona": "vaquillonas",
    "novillo": "vaquillonas",
    "vaca_con_cria": "vacas_con_cria_terneros",
    "ternero": "vacas_con_cria_terneros",
}
NOMBRE_LOTE = {
    "vientres_toros": "Vientres y toros",
    "vaquillonas": "Vaquillonas",
    "vacas_con_cria_terneros": "Vacas con cría y terneros",
}
# Vocabulario cerrado. Las claves de los alias van en minúsculas, sin tildes y en singular
# (``_normalizar`` baja el plural de cada palabra antes de buscar).
ESPECIE_BOVINO = "bovino"
ESPECIE_APICULTURA = "apicultura"
ESPECIES_MENORES = ("caprino", "ovino", "porcino")
ESPECIES_PERMITIDAS = ("bovino", "ovino", "caprino", "porcino", "equino", "apicultura")
_ALIAS_ESPECIE = {
    "bovino": "bovino",
    "vacuno": "bovino",
    "ganado bovino": "bovino",
    "ganado vacuno": "bovino",
    "vaca": "bovino",
    "toro": "bovino",
    "ternero": "bovino",
    "novillo": "bovino",
    "vaquillona": "bovino",
    "ovino": "ovino",
    "oveja": "ovino",
    "carnero": "ovino",
    "cordero": "ovino",
    "ganado ovino": "ovino",
    "caprino": "caprino",
    "cabra": "caprino",
    "chivo": "caprino",
    "cabrito": "caprino",
    "ganado caprino": "caprino",
    "porcino": "porcino",
    "cerdo": "porcino",
    "cerda": "porcino",
    "chancho": "porcino",
    "lechon": "porcino",
    "equino": "equino",
    "caballo": "equino",
    "yegua": "equino",
    "potrillo": "equino",
    "apicultura": "apicultura",
    "apicola": "apicultura",
    "colmena": "apicultura",
    "abeja": "apicultura",
    "apiario": "apicultura",
}
# Categorías bovinas: alias -> nombre canónico (con su lote y su ración más abajo/en supuestos).
_ALIAS = {
    "vaca prenada": "vaca_prenada",
    "vientre prenado": "vaca_prenada",
    "vaca vacia": "vaca_vacia",
    "vientre vacio": "vaca_vacia",
    "vaca con cria": "vaca_con_cria",
    "vaca con cria al pie": "vaca_con_cria",
    "vaca parida": "vaca_con_cria",
    "ternero": "ternero",
    "ternera": "ternero",
    "ternero al pie": "ternero",
    "cria": "ternero",
    "vaquillona": "vaquillona",
    "novillo": "novillo",
    "novillito": "novillo",
    "toro": "toro",
}
# Palabras que nombran al ganado bovino sin decir la categoría: se cuentan (dormidero y camiones)
# pero no tienen lote ni ración, y se avisa.
_GENERICAS = {"vaca", "vacuno", "bovino", "ganado", "hacienda", "rodeo", "ganado bovino"}
CATEGORIAS_BOVINAS_PERMITIDAS = (
    "vaca preñada",
    "vaca vacía",
    "vaca con cría",
    "ternero",
    "vaquillona",
    "novillo",
    "toro",
)
GENERICA = "generica"


def sin_tildes(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def _normalizar(texto: str) -> str:
    """Minúsculas, sin tildes ni signos, con el plural bajado a singular palabra por palabra.

    ``"Vacas con crías"`` -> ``"vaca con cria"``; ``"Ovejas"`` -> ``"oveja"``.
    """
    limpio = "".join(c if c.isalnum() or c.isspace() else " " for c in sin_tildes(texto.casefold()))
    palabras = []
    for p in limpio.split():
        if len(p) > 4 and p.endswith("es") and p[:-2].endswith(("n", "r", "l", "d", "z")):
            p = p[:-2]  # plurales en consonante: lechones -> lechon
        elif len(p) > 3 and p.endswith("s"):
            p = p[:-1]
        palabras.append(p)
    return " ".join(palabras)


def especie_canonica(texto: str) -> str | None:
    """``"Vacas"``/``"bovinos"`` -> ``bovino``; ``"colmenas"`` -> ``apicultura``; ``None`` si no."""
    return _ALIAS_ESPECIE.get(_normalizar(texto))


def categoria_canonica(texto: str) -> str | None:
    """Normaliza ``"Vacas preñadas"`` -> ``vaca_prenada``; ``None`` si no es una categoría."""
    clave = _normalizar(texto)
    if clave in _ALIAS:
        return _ALIAS[clave]
    if clave.replace(" ", "_") in LOTE_DE:
        return clave.replace(" ", "_")
    return None


def es_categoria_generica(texto: str) -> bool:
    return _normalizar(texto) in _GENERICAS


@dataclass(frozen=True)
class EntradaGanaderia:
    bovinos: dict[str, int]  # categoría canónica -> cabezas
    bovinos_sin_clasificar: int = 0
    menores: dict[str, int] | None = None  # caprino|ovino|porcino -> cabezas
    colmenas_vivas: int = 0
    colmenas_muertas: int = 0
    # Avisos de filas de stock que no se pudieron clasificar (se muestran, no se descartan).
    avisos_clasificacion: tuple[str, ...] = ()
    traslado_colmenas: str = "vehicular"  # vehicular | a_pie
    superficie_albardon_m2: float | None = None


def _trozos(total: int, maximo: int) -> list[int]:
    """Parte ``total`` en lotes de a lo sumo ``maximo`` cabezas, lo más parejos posible."""
    if total <= 0:
        return []
    n = math.ceil(total / maximo)
    base, resto = divmod(total, n)
    return [base + (1 if i < resto else 0) for i in range(n)]


def calcular(entrada: EntradaGanaderia) -> dict:
    raciones: dict[str, dict[str, float]] = supuesto("racion_diaria_kg")
    m2 = float(supuesto("dormidero_m2_por_bovino"))
    maximo_lote = int(supuesto("lote_maximo_cabezas"))
    por_camion = int(supuesto("camion_jaula_bovinos"))
    capacidad_b = int(supuesto("vehiculo_cat_b_capacidad"))

    total_bovinos = sum(entrada.bovinos.values()) + entrada.bovinos_sin_clasificar
    categorias_presentes = [c for c, n in entrada.bovinos.items() if n > 0]
    n_categorias = len(categorias_presentes) + (1 if entrada.bovinos_sin_clasificar else 0)

    # Lotes en destino (INTA): toros con vacas preñadas y vacías; vaquillonas aparte; vacas con
    # cría con sus terneros. Cada lote se parte en tramos de hasta ``lote_maximo_cabezas``.
    lotes: list[dict] = []
    for clave_lote, nombre in NOMBRE_LOTE.items():
        miembros = {c: n for c, n in entrada.bovinos.items() if n > 0 and LOTE_DE[c] == clave_lote}
        cabezas = sum(miembros.values())
        partes = _trozos(cabezas, maximo_lote)
        for i, cantidad in enumerate(partes, start=1):
            etiqueta = nombre if len(partes) == 1 else f"{nombre} ({i}/{len(partes)})"
            lotes.append(
                {
                    "lote": etiqueta,
                    "tipo": clave_lote,
                    "cabezas": cantidad,
                    "categorias": miembros if len(partes) == 1 else None,
                }
            )

    maiz = round(sum(n * raciones[c]["maiz"] for c, n in entrada.bovinos.items()), 2)
    pellet = round(sum(n * raciones[c]["pellet_girasol"] for c, n in entrada.bovinos.items()), 2)

    dormidero = round(total_bovinos * m2, 1)
    albardon = entrada.superficie_albardon_m2
    camiones = math.ceil(total_bovinos / por_camion) if total_bovinos else 0

    menores = {e: n for e, n in (entrada.menores or {}).items() if n > 0}
    vehiculos_b = {e: math.ceil(n / capacidad_b) for e, n in menores.items()}

    advertencias: list[str] = list(entrada.avisos_clasificacion)
    if entrada.bovinos_sin_clasificar:
        advertencias.append(
            f"{entrada.bovinos_sin_clasificar} bovinos con categoría no reconocida: cuentan para "
            "dormidero y camiones, pero no tienen lote ni ración."
        )
    if "ternero" in entrada.bovinos and "vaca_con_cria" not in entrada.bovinos:
        advertencias.append(
            "Hay terneros sin vacas con cría: revisar el stock declarado (un ternero al pie "
            "tiene madre)."
        )

    return {
        "bovinos_total": total_bovinos,
        "dormidero": {
            "superficie_necesaria_m2": dormidero,
            "m2_por_animal": m2,
            "superficie_albardon_m2": albardon,
            "alcanza": None if albardon is None else albardon >= dormidero,
            "faltante_m2": None if albardon is None else round(max(dormidero - albardon, 0.0), 1),
            "divisiones_internas": n_categorias > 1,
        },
        "transporte": {
            "camiones_jaula": camiones,
            "bovinos_por_camion": por_camion,
            "camion_con_divisiones": camiones > 0 and n_categorias > 1,
            "vehiculos_categoria_b": vehiculos_b,
            "animales_por_vehiculo_categoria_b": capacidad_b,
            "nota": "Vehículos categoría B: piso rígido y sin malla para caprinos, porcinos y ovinos.",
        },
        "lotes_destino": lotes,
        "lote_maximo_cabezas": maximo_lote,
        "racion_diaria": {"maiz_kg": maiz, "pellet_girasol_kg": pellet},
        "apicultura": _apicultura(entrada),
        "checklist_destino": CHECKLIST_DESTINO,
        "advertencias": advertencias,
        "supuestos": {
            k: cargar_supuestos()[k]
            for k in (
                "dormidero_m2_por_bovino",
                "lote_maximo_cabezas",
                "racion_diaria_kg",
                "camion_jaula_bovinos",
                "vehiculo_cat_b_capacidad",
            )
        },
        "categoria": "SIMULADO",
        "fuente": "Cálculo con supuestos de supuestos.yaml (INTA, a verificar; el resto SUPUESTO)",
    }


def _apicultura(entrada: EntradaGanaderia) -> dict | None:
    if entrada.colmenas_vivas == 0 and entrada.colmenas_muertas == 0:
        return None
    return {
        "colmenas_vivas": entrada.colmenas_vivas,
        "colmenas_muertas": entrada.colmenas_muertas,
        "traslado": entrada.traslado_colmenas,
        "recomendacion": (
            "Colmenas vivas: traslado nocturno con piquera cerrada a un albardón seco."
            if entrada.colmenas_vivas
            else "Solo colmenas muertas: priorizar el rescate del material de cría."
        )
        + (
            " Traslado a pie: grupos reducidos por corredores altos."
            if entrada.traslado_colmenas == "a_pie"
            else " Traslado vehicular: vehículo cubierto y ventilado."
        ),
    }


CHECKLIST_DESTINO = [
    "Inspeccionar el potrero de destino y descartar presencia de mío-mío (Baccharis coridifolia).",
    "Ofrecer agua y forraje al bajar del camión.",
    "Acostumbramiento gradual al grano para evitar acidosis.",
    "Sales minerales con fósforo y calcio.",
    "Control sanitario a los 7 días (leptospirosis, rabia paresiante, pietín, tristeza bovina).",
    "Lotes homogéneos de hasta 200 cabezas, con las divisiones de categoría respetadas.",
]
