"""Factibilidad temporal de una evacuación (¿alcanza el tiempo?). Lógica pura, sin I/O.

Compara el tiempo que lleva completar el traslado de un sector con el plazo disponible:

- **Plazo del río:** horas hasta que Puerto Formosa alcance la altura de compromiso del sector, con
  el rango de tasas de ascenso observadas (la más rápida da el plazo mínimo; la más lenta, el
  máximo). Es una proyección lineal: SUPUESTO, no pronóstico.
- **Ventana seca:** si se informa un pronóstico de lluvia (SIMULADO) que deja intransitable el
  acceso que usa el traslado, el plazo es la hora prevista de esa lluvia, sin rango.

El plazo efectivo es el menor de los dos. Veredictos:

- ``ya_comprometido``: el sector ya alcanzó su altura de compromiso: la evacuación es de emergencia.
- ``alcanza``: termina antes del plazo mínimo y deja libre al menos la fracción
  ``margen_seguridad_fraccion`` de ese plazo (holgura para demoras).
- ``justo``: termina antes del plazo máximo, pero no del mínimo con holgura (depende de que el río
  no suba al ritmo más rápido observado o de no tener demoras).
- ``no_alcanza``: no termina ni con el plazo máximo.
- ``sin_estimacion``: falta el tiempo de traslado (sin flota) o el plazo (sin tasas ni pronóstico).
"""

from __future__ import annotations

from dataclasses import dataclass

YA_COMPROMETIDO = "ya_comprometido"
ALCANZA = "alcanza"
JUSTO = "justo"
NO_ALCANZA = "no_alcanza"
SIN_ESTIMACION = "sin_estimacion"

LIMITANTE_RIO = "rio"
LIMITANTE_LLUVIA = "ventana_seca"


@dataclass(frozen=True)
class Plazo:
    """Horas disponibles desde ahora (``None`` = sin estimación)."""

    minimo_h: float | None
    maximo_h: float | None
    limitante: str | None  # "rio" | "ventana_seca" | None


def plazo_efectivo(
    rio_min_h: float | None,
    rio_max_h: float | None,
    seco_h: float | None,
) -> Plazo:
    """Combina el plazo del río (rango) con la ventana seca (valor único): gana el menor."""
    if seco_h is None:
        if rio_min_h is None:
            return Plazo(None, None, None)
        return Plazo(rio_min_h, rio_max_h, LIMITANTE_RIO)
    tope = seco_h if rio_max_h is None else min(seco_h, rio_max_h)
    if rio_min_h is None or seco_h <= rio_min_h:
        return Plazo(seco_h, tope, LIMITANTE_LLUVIA)
    return Plazo(rio_min_h, tope, LIMITANTE_RIO)


@dataclass(frozen=True)
class Veredicto:
    veredicto: str
    plazo: Plazo
    tiempo_para_completar_h: float | None
    holgura_h: float | None  # plazo mínimo - tiempo para completar (negativa = no alcanza)
    iniciar_antes_de_h: float | None  # hora límite de inicio con el plazo mínimo
    explicacion: str


def _h(x: float | None) -> str:
    return "sin dato" if x is None else f"{x:.1f} h"


def evaluar(
    plazo: Plazo,
    tiempo_para_completar_h: float | None,
    margen_fraccion: float,
    ya_comprometido: bool = False,
    anticipacion_h: float = 0.0,
) -> Veredicto:
    """Veredicto de factibilidad.

    ``margen_fraccion`` (0 a 1) es la parte del plazo mínimo que debe quedar libre para "alcanza".
    ``anticipacion_h`` adelanta el plazo (p. ej. el ganado debe salir 24 a 48 h antes del agua).
    """
    if ya_comprometido:
        return Veredicto(
            YA_COMPROMETIDO,
            Plazo(0.0, 0.0, LIMITANTE_RIO),
            tiempo_para_completar_h,
            None,
            0.0,
            "El sector ya alcanzó su altura de compromiso: la evacuación es de emergencia.",
        )
    minimo = None if plazo.minimo_h is None else max(plazo.minimo_h - anticipacion_h, 0.0)
    maximo = None if plazo.maximo_h is None else max(plazo.maximo_h - anticipacion_h, 0.0)
    ajustado = Plazo(minimo, maximo, plazo.limitante)
    if tiempo_para_completar_h is None or minimo is None:
        falta = "el tiempo de traslado" if tiempo_para_completar_h is None else "el plazo"
        return Veredicto(
            SIN_ESTIMACION,
            ajustado,
            tiempo_para_completar_h,
            None,
            None,
            f"No se puede evaluar: falta {falta}.",
        )
    t = tiempo_para_completar_h
    holgura = round(minimo - t, 1)
    inicio = round(minimo - t, 1)
    exigida = minimo * margen_fraccion
    if t <= minimo - exigida and t < minimo:
        veredicto = ALCANZA
        texto = (
            f"Termina en {_h(t)}; el plazo más corto es {_h(minimo)} (holgura {_h(holgura)}, "
            f"mínimo exigido {margen_fraccion:.0%} del plazo)."
        )
    elif maximo is not None and t <= maximo:
        veredicto = JUSTO
        texto = (
            f"Termina en {_h(t)}: no entra con holgura en el plazo más corto ({_h(minimo)}) "
            f"pero sí en el más largo ({_h(maximo)}). Depende del ritmo de ascenso y de no tener "
            "demoras."
        )
    else:
        veredicto = NO_ALCANZA
        texto = (
            f"Termina en {_h(t)} y el plazo es de {_h(minimo)} a {_h(maximo)}: no alcanza; "
            "sumar vehículos, adelantar el inicio o cambiar el orden."
        )
    if plazo.limitante == LIMITANTE_LLUVIA:
        texto += " El plazo lo fija la lluvia prevista (ventana seca)."
    if anticipacion_h:
        texto += f" Incluye {anticipacion_h:g} h de anticipación."
    return Veredicto(veredicto, ajustado, round(t, 1), holgura, inicio, texto)


def a_dict(v: Veredicto) -> dict:
    return {
        "veredicto": v.veredicto,
        "plazo_minimo_h": None if v.plazo.minimo_h is None else round(v.plazo.minimo_h, 1),
        "plazo_maximo_h": None if v.plazo.maximo_h is None else round(v.plazo.maximo_h, 1),
        "limitante": v.plazo.limitante,
        "tiempo_para_completar_h": v.tiempo_para_completar_h,
        "holgura_h": v.holgura_h,
        "iniciar_antes_de_h": v.iniciar_antes_de_h,
        "explicacion": v.explicacion,
    }
