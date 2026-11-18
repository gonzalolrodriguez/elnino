"""Asignación de personas (o animales) a centros de recepción por prioridad y capacidad.

Algoritmo voraz y determinista: los grupos se atienden en orden de prioridad (menor número, primero)
y cada uno llena los centros más cercanos con cupo libre (si no hay distancias, los de mayor cupo).
Un grupo puede repartirse entre varios centros. Lo que no entra se informa como ``sin_lugar``: la
plataforma nunca oculta un faltante de cupo. Lógica pura, sin I/O.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Demanda:
    id: str
    cantidad: int
    prioridad: int = 0  # menor = primero


@dataclass(frozen=True)
class Capacidad:
    id: int
    nombre: str
    cupo_libre: int


@dataclass
class Asignacion:
    demanda_id: str
    centro_id: int
    centro_nombre: str
    cantidad: int


@dataclass
class ResultadoAsignacion:
    asignaciones: list[Asignacion] = field(default_factory=list)
    sin_lugar: dict[str, int] = field(default_factory=dict)  # demanda_id -> cantidad sin cupo
    cupos_restantes: dict[int, int] = field(default_factory=dict)  # centro_id -> cupo libre

    @property
    def total_asignado(self) -> int:
        return sum(a.cantidad for a in self.asignaciones)

    @property
    def total_sin_lugar(self) -> int:
        return sum(self.sin_lugar.values())

    def asignado_a(self, demanda_id: str) -> int:
        return sum(a.cantidad for a in self.asignaciones if a.demanda_id == demanda_id)


def asignar(
    demandas: list[Demanda],
    capacidades: list[Capacidad],
    distancias: dict[tuple[str, int], float] | None = None,
) -> ResultadoAsignacion:
    """Reparte ``demandas`` en ``capacidades``.

    ``distancias[(demanda_id, centro_id)]`` (metros) ordena los centros de cada grupo; si falta, se
    prefiere el centro con más cupo y, a igualdad, el de menor id (orden determinista).
    """
    cupos = {c.id: max(c.cupo_libre, 0) for c in capacidades}
    nombres = {c.id: c.nombre for c in capacidades}
    resultado = ResultadoAsignacion()
    for d in sorted(demandas, key=lambda x: (x.prioridad, x.id)):
        pendiente = max(d.cantidad, 0)
        if distancias:
            orden = sorted(cupos, key=lambda cid: (distancias.get((d.id, cid), float("inf")), cid))
        else:
            orden = sorted(cupos, key=lambda cid: (-cupos[cid], cid))
        for cid in orden:
            if pendiente == 0:
                break
            cabe = min(pendiente, cupos[cid])
            if cabe > 0:
                resultado.asignaciones.append(Asignacion(d.id, cid, nombres[cid], cabe))
                cupos[cid] -= cabe
                pendiente -= cabe
        if pendiente > 0:
            resultado.sin_lugar[d.id] = pendiente
    resultado.cupos_restantes = dict(cupos)
    return resultado
