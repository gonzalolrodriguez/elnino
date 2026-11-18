"""Índice relativo de susceptibilidad de anegamiento (ISAD), rotulado SIMULADO (CLAUDE.md P9).

Es un índice relativo entre 0 y 1: combina lluvia antecedente, humedad del suelo, concavidad del
sector y cercanía del río a la altura de compromiso, con pesos de ``supuestos.yaml``. El kit no
tiene cotas ni humedad: los componentes sin dato son SUPUESTO. **Nunca reemplaza** el criterio de
compromiso de K10 (la altura de la escala), que sigue siendo el disparador oficial del simulador.
"""

from __future__ import annotations

from app.config.settings import supuesto

NOTA = (
    "Índice relativo SIMULADO (0 a 1). No reemplaza el criterio de compromiso de K10; "
    "los pesos y la concavidad son SUPUESTO."
)


def _acotar(valor: float) -> float:
    return max(0.0, min(1.0, valor))


def calcular(
    sector_id: str,
    altura_m: float,
    compromiso_m: float,
    aguas_bajas_m: float,
    lluvia_mm: float,
    humedad_suelo: float | None = None,
) -> dict:
    pesos: dict[str, float] = supuesto("isad_pesos")
    saturacion = float(supuesto("isad_lluvia_saturacion_mm"))
    humedad = supuesto("isad_humedad_suelo_defecto") if humedad_suelo is None else humedad_suelo
    concavidad = supuesto("isad_concavidad_sector").get(sector_id, 0.5)
    tramo = max(compromiso_m - aguas_bajas_m, 0.01)
    componentes = {
        "lluvia_antecedente": _acotar(lluvia_mm / saturacion),
        "humedad_suelo": _acotar(float(humedad)),
        "concavidad": _acotar(float(concavidad)),
        "rio": _acotar((altura_m - aguas_bajas_m) / tramo),
    }
    total_pesos = sum(pesos.values())
    valor = sum(pesos[k] * componentes[k] for k in componentes) / total_pesos
    return {
        "valor": round(valor, 3),
        "componentes": {k: round(v, 3) for k, v in componentes.items()},
        "pesos": pesos,
        "categoria": "SIMULADO",
        "nota": NOTA,
    }
