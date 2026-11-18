"""Velocidades de ascenso del río a partir del máximo diario de K1 (lógica pura, sin I/O).

Solo se comparan días con dato en ambos extremos: no se interpola ni se cruzan huecos.
La proyección lineal del tiempo restante es un SUPUESTO con rango de incertidumbre.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

UMBRALES_M = (7.50, 7.80, 8.30)

# Ventanas de cada evento (SUPUESTO: elegidas para acotar la creciente de cada episodio;
# con el año calendario completo la mayor suba de 7 días cae en otros episodios).
PERIODOS: dict[str, tuple[date, date]] = {
    "2015-16": (date(2015, 6, 1), date(2016, 3, 31)),
    "2019": (date(2019, 1, 1), date(2019, 7, 31)),
    "oct-2026": (date(2026, 10, 1), date(2026, 10, 31)),
}


@dataclass(frozen=True)
class Suba:
    metros: float
    fecha_fin: date  # día en que termina la ventana (el de mayor altura)


@dataclass(frozen=True)
class ResumenAscenso:
    periodo: str
    mayor_suba_1d: Suba | None
    mayor_suba_7d: Suba | None
    cruces: dict[float, date | None]


def mayor_suba(serie: dict[date, float], dias: int, desde: date, hasta: date) -> Suba | None:
    """Mayor diferencia ``serie[d] - serie[d - dias]`` con ``d`` en [desde, hasta].

    Ambos extremos deben tener dato. Devuelve ``None`` si no hay ningún par.
    """
    mejor: Suba | None = None
    d = desde
    while d <= hasta:
        previo = d - timedelta(days=dias)
        if d in serie and previo in serie:
            delta = round(serie[d] - serie[previo], 4)
            if mejor is None or delta > mejor.metros:
                mejor = Suba(delta, d)
        d += timedelta(days=1)
    return mejor


def primer_cruce(serie: dict[date, float], umbral: float, desde: date, hasta: date) -> date | None:
    """Primer día del período con máximo diario >= umbral."""
    for d in sorted(serie):
        if desde <= d <= hasta and serie[d] >= umbral:
            return d
    return None


def resumen_periodo(
    serie: dict[date, float], periodo: str, rango: tuple[date, date] | None = None
) -> ResumenAscenso:
    desde, hasta = rango or PERIODOS[periodo]
    return ResumenAscenso(
        periodo=periodo,
        mayor_suba_1d=mayor_suba(serie, 1, desde, hasta),
        mayor_suba_7d=mayor_suba(serie, 7, desde, hasta),
        cruces={u: primer_cruce(serie, u, desde, hasta) for u in UMBRALES_M},
    )


def resumen_todos(serie: dict[date, float]) -> list[ResumenAscenso]:
    return [resumen_periodo(serie, nombre) for nombre in PERIODOS]
