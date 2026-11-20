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


# --- Familias indivisibles (odd/tasks/motor-evacuacion.md, M7) --------------------------------


@dataclass(frozen=True)
class Familia:
    """Grupo familiar que viaja y se aloja junto. ``id`` es interno: no se expone en la API."""

    id: str
    demanda_id: str
    personas: int
    vulnerable: bool = False  # tiene menores o mayores: se ubica primero


@dataclass
class ResultadoFamilias(ResultadoAsignacion):
    familias_ubicadas: dict[str, int] = field(default_factory=dict)  # familia_id -> centro_id
    familias_sin_lugar: list[Familia] = field(default_factory=list)


def asignar_con_familias(
    demandas: list[Demanda],
    familias: list[Familia],
    capacidades: list[Capacidad],
    costos: dict[tuple[str, int], float],
) -> ResultadoFamilias:
    """Reparte sin separar familias.

    1. Cupos por grupo: ``asignar_costo_minimo`` decide cuántos lugares de cada centro le tocan a
       cada grupo (prioridad y tiempo total).
    2. Dentro de cada grupo, en orden de prioridad, cada familia (primero las vulnerables y después
       las más grandes, que son las más difíciles de ubicar) va entera al centro más rápido cuyo
       cupo la contiene; si ninguno alcanza, puede completar con lugar libre de ese centro. Si no
       entra entera en ningún centro, queda en ``familias_sin_lugar``: nunca se la separa.
    3. El resto del grupo (personas sin familia declarada) ocupa los cupos que quedan y, si hace
       falta, lugar libre. Los cupos que un grupo no usa quedan libres para los siguientes.

    ``demandas[i].cantidad`` incluye a las personas de sus familias.
    """
    base = asignar_costo_minimo(demandas, capacidades, costos)
    nombres = {c.id: c.nombre for c in capacidades}
    cuota: dict[tuple[str, int], int] = {}
    for a in base.asignaciones:
        cuota[(a.demanda_id, a.centro_id)] = cuota.get((a.demanda_id, a.centro_id), 0) + a.cantidad
    libre = dict(base.cupos_restantes)
    colocado: dict[tuple[str, int], int] = {}
    resultado = ResultadoFamilias()

    def poner(did: str, cid: int, cantidad: int) -> None:
        colocado[(did, cid)] = colocado.get((did, cid), 0) + cantidad

    for d in sorted(demandas, key=lambda x: (x.prioridad, x.id)):
        propias = sorted(
            (f for f in familias if f.demanda_id == d.id),
            key=lambda f: (not f.vulnerable, -f.personas, f.id),
        )
        centros = sorted(
            (cid for (did, cid) in costos if did == d.id and cid in nombres),
            key=lambda cid: (costos[(d.id, cid)], cid),
        )
        for f in propias:
            elegido = next(
                (cid for cid in centros if cuota.get((d.id, cid), 0) >= f.personas), None
            )
            de_cuota = f.personas
            if elegido is None:
                elegido = next(
                    (
                        cid
                        for cid in centros
                        if cuota.get((d.id, cid), 0) + libre.get(cid, 0) >= f.personas
                    ),
                    None,
                )
                if elegido is not None:
                    de_cuota = cuota.get((d.id, elegido), 0)
            if elegido is None:
                resultado.familias_sin_lugar.append(f)
                continue
            cuota[(d.id, elegido)] = cuota.get((d.id, elegido), 0) - de_cuota
            libre[elegido] = libre.get(elegido, 0) - (f.personas - de_cuota)
            poner(d.id, elegido, f.personas)
            resultado.familias_ubicadas[f.id] = elegido

        resto = max(d.cantidad - sum(f.personas for f in propias), 0)
        for fuente in ("cuota", "libre"):
            for cid in centros:
                if resto == 0:
                    break
                disponible = cuota.get((d.id, cid), 0) if fuente == "cuota" else libre.get(cid, 0)
                toma = min(resto, disponible)
                if toma > 0:
                    if fuente == "cuota":
                        cuota[(d.id, cid)] -= toma
                    else:
                        libre[cid] -= toma
                    poner(d.id, cid, toma)
                    resto -= toma
        sin_familia = sum(f.personas for f in resultado.familias_sin_lugar if f.demanda_id == d.id)
        if resto + sin_familia > 0:
            resultado.sin_lugar[d.id] = resto + sin_familia
        # Los cupos que este grupo no usó vuelven a estar libres para los siguientes.
        for (did, cid), q in list(cuota.items()):
            if did == d.id and q > 0:
                libre[cid] = libre.get(cid, 0) + q
                cuota[(did, cid)] = 0

    for (did, cid), cantidad in sorted(colocado.items()):
        if cantidad > 0:
            resultado.asignaciones.append(Asignacion(did, cid, nombres[cid], cantidad))
    resultado.cupos_restantes = {cid: libre.get(cid, 0) for cid in sorted(nombres)}
    return resultado


def viajes_sin_partir(familias: list[int], resto: int, capacidad: int) -> int:
    """Viajes de vehículos de ``capacidad`` lugares sin repartir una familia entre viajes distintos.

    Empaquetado "el primero que entra, de mayor a menor". Una familia más grande que el vehículo
    ocupa vehículos completos del mismo convoy y su parte final va como bloque. Las personas sin
    familia (``resto``) llenan los lugares que sobran y, si hace falta, vehículos nuevos.
    """
    if capacidad <= 0:
        return 0
    huecos: list[int] = []  # lugares libres de cada vehículo
    for tam in sorted((t for t in familias if t > 0), reverse=True):
        completos, parte = divmod(tam, capacidad)
        huecos.extend([0] * completos)
        if parte:
            i = next((i for i, h in enumerate(huecos) if h >= parte), None)
            if i is None:
                huecos.append(capacidad - parte)
            else:
                huecos[i] -= parte
    libres = sum(huecos)
    faltan = max(resto - libres, 0)
    return len(huecos) + -(-faltan // capacidad)
