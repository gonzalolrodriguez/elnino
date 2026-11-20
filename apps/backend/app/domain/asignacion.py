"""Asignación de personas (o animales) a centros de recepción por prioridad y capacidad.

Dos algoritmos deterministas, lógica pura sin I/O:

- ``asignar`` (voraz): los grupos se atienden en orden de prioridad (menor número, primero) y cada
  uno llena los centros más cercanos con cupo libre (si no hay distancias, los de mayor cupo).
- ``asignar_costo_minimo`` (flujo de costo mínimo): respeta la misma prioridad (un grupo de mayor
  prioridad nunca queda sin lugar para dárselo a uno de menor) y, con eso fijo, minimiza la suma de
  cantidad × costo (p. ej. personas × minutos de viaje). Admite pares grupo–centro inalcanzables.

Un grupo puede repartirse entre varios centros. Lo que no entra se informa como ``sin_lugar``: la
plataforma nunca oculta un faltante de cupo.
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


# --- Flujo de costo mínimo ---------------------------------------------------------------------


class _Red:
    """Red residual mínima para flujo de costo mínimo (caminos más cortos sucesivos)."""

    def __init__(self, n: int) -> None:
        self.ady: list[list[int]] = [[] for _ in range(n)]
        self.destino: list[int] = []
        self.cap: list[int] = []
        self.costo: list[int] = []

    def arista(self, u: int, v: int, cap: int, costo: int) -> int:
        self.ady[u].append(len(self.destino))
        self.destino.append(v)
        self.cap.append(cap)
        self.costo.append(costo)
        self.ady[v].append(len(self.destino))
        self.destino.append(u)
        self.cap.append(0)
        self.costo.append(-costo)
        return len(self.destino) - 2

    def flujo(self, s: int, t: int) -> None:
        n = len(self.ady)
        while True:
            # Bellman-Ford con cola (admite costos negativos de las aristas residuales).
            dist = [None] * n
            previa = [-1] * n
            dist[s] = 0
            cola, en_cola = [s], [False] * n
            en_cola[s] = True
            i = 0
            while i < len(cola):
                u = cola[i]
                i += 1
                en_cola[u] = False
                for e in self.ady[u]:
                    if self.cap[e] <= 0:
                        continue
                    v = self.destino[e]
                    nd = dist[u] + self.costo[e]
                    if dist[v] is None or nd < dist[v]:
                        dist[v] = nd
                        previa[v] = e
                        if not en_cola[v]:
                            en_cola[v] = True
                            cola.append(v)
            if dist[t] is None:
                return
            # Cuello de botella del camino y aumento.
            empuje, v = None, t
            while v != s:
                e = previa[v]
                empuje = self.cap[e] if empuje is None else min(empuje, self.cap[e])
                v = self.destino[e ^ 1]
            v = t
            while v != s:
                e = previa[v]
                self.cap[e] -= empuje
                self.cap[e ^ 1] += empuje
                v = self.destino[e ^ 1]


def asignar_costo_minimo(
    demandas: list[Demanda],
    capacidades: list[Capacidad],
    costos: dict[tuple[str, int], float],
) -> ResultadoAsignacion:
    """Reparte ``demandas`` en ``capacidades``: mínima cantidad × costo, sin romper la prioridad.

    ``costos[(demanda_id, centro_id)]`` es el costo unitario (p. ej. minutos de viaje); un par que
    falta es inalcanzable. La prioridad se impone con una penalidad por unidad sin lugar que crece
    con la prioridad del grupo y es mayor que cualquier ahorro posible de costo: así, a igual
    cantidad atendida, nunca conviene dejar sin lugar a un grupo de mayor prioridad.
    """
    ordenadas = sorted(demandas, key=lambda x: (x.prioridad, x.id))
    centros = sorted(capacidades, key=lambda c: c.id)
    nombres = {c.id: c.nombre for c in centros}
    # Costos enteros (décimas) para que el resultado no dependa del redondeo de punto flotante.
    enteros = {k: int(round(max(v, 0.0) * 10)) for k, v in costos.items()}
    maximo = max(enteros.values(), default=0)
    escalon = (2 * maximo + 1) * (len(centros) + 2)
    n_d, n_c = len(ordenadas), len(centros)
    fuente, sumidero = 0, 1 + n_d + n_c
    red = _Red(n_d + n_c + 2)
    asignadas: list[tuple[int, str, int]] = []  # (arista, demanda_id, centro_id)
    sin_lugar: list[tuple[int, str]] = []
    for i, d in enumerate(ordenadas):
        nodo = 1 + i
        cantidad = max(d.cantidad, 0)
        red.arista(fuente, nodo, cantidad, 0)
        for j, c in enumerate(centros):
            if (d.id, c.id) in enteros and c.cupo_libre > 0:
                e = red.arista(nodo, 1 + n_d + j, cantidad, enteros[(d.id, c.id)])
                asignadas.append((e, d.id, c.id))
        penalidad = escalon * (n_d - i)
        sin_lugar.append((red.arista(nodo, sumidero, cantidad, penalidad), d.id))
    cupo_arista = {
        c.id: red.arista(1 + n_d + j, sumidero, max(c.cupo_libre, 0), 0)
        for j, c in enumerate(centros)
    }
    red.flujo(fuente, sumidero)

    resultado = ResultadoAsignacion()
    for e, did, cid in asignadas:
        cantidad = red.cap[e ^ 1]
        if cantidad > 0:
            resultado.asignaciones.append(Asignacion(did, cid, nombres[cid], cantidad))
    for e, did in sin_lugar:
        if red.cap[e ^ 1] > 0:
            resultado.sin_lugar[did] = red.cap[e ^ 1]
    resultado.cupos_restantes = {cid: red.cap[e] for cid, e in cupo_arista.items()}
    return resultado
