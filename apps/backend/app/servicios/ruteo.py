"""Ruteo bimodal sobre ``red_vial`` con pgRouting, con alternativa sin red (CLAUDE.md §8.3).

Perfiles: ``vehicular`` (vehículos de rescate), ``camion_jaula`` (solo pavimento y ripio) y
``arreo`` (a pie, penaliza los tramos dentro de sectores comprometidos). Las aristas bloqueadas por
el operador se excluyen siempre; para los perfiles con ruedas también las que cruzan sectores
comprometidos (salvo el sector de origen, del que si no nadie podría salir; se informa).
"""

from __future__ import annotations

import json
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.db.base import SRID
from app.db.consultas import sector_de_punto
from app.domain import escenario as esc
from app.domain import ruteo as dom
from app.servicios import contexto

_ID = re.compile(r"^[A-Za-z0-9_]{1,10}$")

NOTA_CATEGORIA = (
    "Resultado calculado con velocidades SUPUESTO; las capas de origen se indican en 'capas'."
)


def red_disponible(db: Session) -> bool:
    return bool(
        db.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM red_vial WHERE source IS NOT NULL AND target IS NOT NULL)"
            )
        ).scalar_one()
    )


def _nodo_mas_cercano(
    db: Session, lon: float, lat: float, superficies: list[str] | None = None
) -> tuple[int, float] | None:
    filtro = ""
    params: dict = {"lon": lon, "lat": lat, "srid": SRID}
    if superficies is not None:
        filtro = (
            "WHERE EXISTS (SELECT 1 FROM red_vial r WHERE (r.source = n.id OR r.target = n.id) "
            "AND NOT r.bloqueada AND COALESCE(r.superficie, 'tierra') = ANY(CAST(:sup AS text[]))) "
        )
        params["sup"] = list(superficies)
    fila = db.execute(
        text(
            "SELECT n.id, ST_Distance(n.geom::geography, "
            "ST_SetSRID(ST_MakePoint(:lon, :lat), :srid)::geography) "
            f"FROM red_vial_nodos n {filtro}"
            "ORDER BY n.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), :srid) LIMIT 1"
        ),
        params,
    ).first()
    return None if fila is None else (int(fila[0]), float(fila[1]))


def _nodo_cercano(
    db: Session, lon: float, lat: float, superficies: list[str] | None = None
) -> tuple[int, float] | None:
    """Nodo de la red donde se engancha el punto y su distancia en metros.

    Con ``superficies``, prefiere el nodo más cercano que toca un tramo no bloqueado y firme
    (pavimento o ripio) y, si no hay, uno de cualquier superficie usable; así un origen no queda
    enganchado a un camino de tierra cerrado por la lluvia ni a uno lento cuando hay una ruta firme
    al lado. Solo si queda a no más de ``ruteo_enganche_usable_m`` por encima del nodo más cercano:
    un salto mayor equivaldría a recorrer sin costo un camino que no se puede usar.
    """
    cercano = _nodo_mas_cercano(db, lon, lat)
    if superficies is None or cercano is None:
        return cercano
    tope = cercano[1] + float(supuesto("ruteo_enganche_usable_m"))
    # Primero un camino firme (pavimento o ripio) usable; si no hay cerca, cualquier usable.
    firmes = [s for s in superficies if s in ("pavimento", "ripio")]
    for opciones in (firmes, superficies):
        if not opciones:
            continue
        nodo = _nodo_mas_cercano(db, lon, lat, opciones)
        if nodo is not None and nodo[1] <= tope:
            return nodo
    return cercano


def superficies_usables(perfil: str, lluvia_mm: float) -> list[str]:
    """Superficies que el perfil puede usar con esa lluvia."""
    cerradas = dom.superficies_cerradas_por_lluvia(perfil, lluvia_mm)
    return [s for s in dom.velocidades(perfil) if s not in cerradas]


def _consulta_aristas(
    perfil: str,
    comprometidos: list[str],
    exentos: list[str],
    accesos_bloqueados: list[int] | None = None,
    lluvia_mm: float = 0.0,
) -> str:
    """SQL de aristas para ``pgr_dijkstra``: costo en segundos según perfil y superficie.

    Con lluvia, los perfiles con ruedas pierden los tramos de las superficies que el umbral cierra.
    """
    vel = dom.velocidades(perfil)
    # Sin superficie conocida se asume tierra (criterio conservador).
    superficie = "COALESCE(superficie, 'tierra')"
    casos = " ".join(f"WHEN '{s}' THEN longitud_m / {v * 1000 / 3600!r}" for s, v in vel.items())
    costo = f"CASE {superficie} {casos} END"
    cerradas = dom.superficies_cerradas_por_lluvia(perfil, lluvia_mm)
    permitidas = ", ".join(f"'{s}'" for s in vel if s not in cerradas) or "NULL"
    afectados = [s for s in comprometidos if s not in exentos]
    for sid in afectados:
        if not _ID.match(sid):
            raise ValueError(f"Identificador de sector inválido: {sid}")
    zona = (
        "(SELECT ST_Union(geom) FROM sectores WHERE id IN ("
        + ", ".join(f"'{s}'" for s in afectados)
        + "))"
        if afectados
        else None
    )
    where = [
        "NOT bloqueada",
        "source IS NOT NULL",
        "target IS NOT NULL",
        "longitud_m IS NOT NULL",
        f"{superficie} IN ({permitidas})",
    ]
    bloqueados = [int(i) for i in (accesos_bloqueados or [])]
    if bloqueados:
        # Un acceso cerrado (por el operador, la lluvia o el agua) corta las aristas de la red que
        # lo recorren: las que quedan, en su mayor parte, dentro de ``acceso_red_vial_buffer_m``.
        radio = float(supuesto("acceso_red_vial_buffer_m"))
        where.append(
            "NOT EXISTS (SELECT 1 FROM accesos a WHERE a.id IN ("
            + ", ".join(str(i) for i in bloqueados)
            + f") AND ST_Covers(ST_Buffer(a.geom::geography, {radio!r}), red_vial.geom::geography))"
        )
    if perfil == dom.ARREO:
        if zona:
            factor = float(supuesto("arreo_penalizacion_zona_comprometida"))
            costo = f"({costo}) * CASE WHEN ST_Intersects(geom, {zona}) THEN {factor!r} ELSE 1 END"
    elif zona:
        where.append(f"NOT ST_Intersects(geom, {zona})")
    return (
        f"SELECT id, source, target, ({costo}) AS cost, ({costo}) AS reverse_cost "
        f"FROM red_vial WHERE {' AND '.join(where)}"
    )


def _ruta_en_red(
    db: Session,
    perfil: str,
    origen: tuple[float, float],
    destino: tuple[float, float],
    comprometidos: list[str],
    exentos: list[str],
    accesos_bloqueados: list[int] | None = None,
    lluvia_mm: float = 0.0,
) -> dict | None:
    maximo = float(supuesto("ruteo_distancia_maxima_a_red_m"))
    usables = superficies_usables(perfil, lluvia_mm)
    n_o = _nodo_cercano(db, *origen, usables)
    n_d = _nodo_cercano(db, *destino, usables)
    if n_o is None or n_d is None or n_o[1] > maximo or n_d[1] > maximo:
        return None
    aristas = _consulta_aristas(perfil, comprometidos, exentos, accesos_bloqueados, lluvia_mm)
    filas = db.execute(
        text(
            "SELECT d.seq, d.edge, d.cost, r.nombre, r.superficie, r.longitud_m, r.categoria, r.fuente "
            "FROM pgr_dijkstra(CAST(:aristas AS text), CAST(:o AS bigint), CAST(:d AS bigint), false) d "
            "JOIN red_vial r ON r.id = d.edge WHERE d.edge > 0 ORDER BY d.seq"
        ),
        {"aristas": aristas, "o": n_o[0], "d": n_d[0]},
    ).all()
    if not filas and n_o[0] != n_d[0]:
        return None
    ids = [int(f.edge) for f in filas]
    geometria = None
    if ids:
        geo = db.execute(
            text(
                "SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(geom ORDER BY array_position(CAST(:ids AS int[]), id)))) "
                "FROM red_vial WHERE id = ANY(CAST(:ids AS int[]))"
            ),
            {"ids": ids},
        ).scalar_one()
        geometria = json.loads(geo) if geo else None
    longitud = sum(float(f.longitud_m) for f in filas)
    conexion = n_o[1] + n_d[1]
    vel = dom.velocidades(perfil)
    segundos = sum(float(f.cost) for f in filas) + conexion / (min(vel.values()) * 1000 / 3600)
    return {
        "distancia_m": round(longitud + conexion, 1),
        "distancia_por_red_m": round(longitud, 1),
        "distancia_de_conexion_m": round(conexion, 1),
        "tiempo_min": round(segundos / 60, 1),
        "geometria": geometria,
        "tramos": [
            {
                "arista_id": int(f.edge),
                "nombre": f.nombre,
                "superficie": f.superficie or "tierra",
                "longitud_m": round(float(f.longitud_m), 1),
            }
            for f in filas
        ],
        "capas": sorted({f"{f.categoria} · {f.fuente}" for f in filas}),
    }


def _accesos_candidatos(
    db: Session, estado: esc.SectorEstado, lon: float, lat: float
) -> list[dom.AccesoCandidato]:
    transitables = [a for a in estado.accesos if a.estado == esc.ACCESO_TRANSITABLE]
    if not transitables:
        return []
    filas = db.execute(
        text(
            "SELECT id, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), :srid)::geography) "
            "FROM accesos WHERE id = ANY(CAST(:ids AS int[]))"
        ),
        {"lon": lon, "lat": lat, "srid": SRID, "ids": [a.id for a in transitables]},
    ).all()
    dist = {int(i): float(d) for i, d in filas}
    return [
        dom.AccesoCandidato(a.id, a.nombre, a.superficie, dist.get(a.id, 0.0)) for a in transitables
    ]


def resolver_ruta(
    db: Session,
    perfil: str,
    origen: tuple[float, float],
    destino: tuple[float, float],
    altura_m: float | None = None,
    lluvia_mm: float = 0.0,
    caminos_cerrados: set[int] | None = None,
) -> dict:
    """Ruta con pgRouting si hay red y alcanza; si no, estimación aproximada con su limitación."""
    sector_origen = sector_de_punto(db, *origen)
    comprometidos: list[str] = []
    # El escenario se calcula siempre: la lluvia y los cierres de caminos valen aunque no se
    # informe la altura del río (sin altura no hay sectores comprometidos por el agua).
    escenario = contexto.calcular_escenario(
        db, altura_m if altura_m is not None else 0.0, lluvia_mm, caminos_cerrados or set()
    )
    if altura_m is not None:
        comprometidos = [s.id for s in escenario.sectores if s.estado == esc.COMPROMETIDO]
    # Accesos que no se pueden usar: el arreo solo respeta el cierre del operador; los vehículos
    # también la lluvia y el anegamiento.
    bloqueados = accesos_cerrados_para(perfil, escenario)
    base_bloqueados = bloqueados
    base = {
        "perfil": perfil,
        "origen": {"lon": origen[0], "lat": origen[1], "sector_id": sector_origen},
        "destino": {"lon": destino[0], "lat": destino[1]},
        "sectores_comprometidos": comprometidos,
        "accesos_bloqueados": bloqueados,
        "superficies_cerradas_por_lluvia": sorted(
            dom.superficies_cerradas_por_lluvia(perfil, lluvia_mm)
        ),
        "categoria": "SIMULADO",
        "nota": NOTA_CATEGORIA,
        "advertencias": [],
    }

    if red_disponible(db):
        exentos = [sector_origen] if sector_origen in comprometidos else []
        ruta = _ruta_en_red(
            db, perfil, origen, destino, comprometidos, exentos, base_bloqueados, lluvia_mm
        )
        if ruta is not None:
            if exentos and perfil != dom.ARREO:
                base["advertencias"].append(
                    f"El origen está en el sector comprometido {sector_origen}: el tramo inicial "
                    "dentro del sector no se excluyó de la red."
                )
            return base | {"encontrada": True, "metodo": "pgrouting", "limitacion": None, **ruta}
        base["advertencias"].append(
            "No se encontró ruta en la red cargada (origen o destino lejos de la red, o sin "
            "conexión con los tramos habilitados): se usa la estimación aproximada."
        )

    linea = dom.haversine_m(*origen, *destino)
    candidatos: list[dom.AccesoCandidato] | None = None
    if sector_origen is not None:
        estado = escenario.sector(sector_origen)
        candidatos = _accesos_candidatos(db, estado, *origen)
    aprox = dom.estimar_aproximado(perfil, linea, candidatos)
    if aprox is None:
        return base | {
            "encontrada": False,
            "metodo": "aproximado",
            "limitacion": dom.LIMITACION_APROXIMADA.format(factor=float(supuesto("factor_desvio"))),
            "motivo": (
                f"El sector {sector_origen} no tiene un acceso transitable para el perfil "
                f"{perfil}: está aislado para ese modo de traslado."
            ),
        }
    return base | {
        "encontrada": True,
        "metodo": "aproximado",
        "limitacion": aprox.limitacion,
        "distancia_m": aprox.distancia_m,
        "tiempo_min": aprox.tiempo_min,
        "linea_recta_m": aprox.linea_recta_m,
        "factor_desvio": aprox.factor_desvio,
        "acceso_usado": None
        if aprox.acceso is None
        else {
            "id": aprox.acceso.id,
            "nombre": aprox.acceso.nombre,
            "superficie": aprox.acceso.superficie,
            "distancia_desde_origen_m": round(aprox.acceso.distancia_origen_m, 1),
        },
        "geometria": None,
        "capas": [],
    }


def accesos_cerrados_para(perfil: str, escenario: esc.Escenario) -> list[int]:
    """Accesos que el perfil no puede usar en el escenario (el arreo solo respeta al operador)."""
    estados = (
        {esc.ACCESO_CERRADO_OPERADOR}
        if perfil == dom.ARREO
        else {esc.ACCESO_CERRADO_OPERADOR, esc.ACCESO_INTRANSITABLE_LLUVIA, esc.ACCESO_ANEGADO}
    )
    return sorted(a.id for s in escenario.sectores for a in s.accesos if a.estado in estados)


def matriz_tiempos(
    db: Session,
    perfil: str,
    origenes: dict[str, tuple[float, float]],
    destinos: dict[int, tuple[float, float]],
    escenario: esc.Escenario,
    lluvia_mm: float,
    sector_de_origen: dict[str, str | None] | None = None,
) -> dict[tuple[str, int], float]:
    """Minutos por la red de cada origen a cada destino (``pgr_dijkstraCost``, muchos a muchos).

    Mismas reglas que ``resolver_ruta``: excluye aristas bloqueadas, accesos cerrados, superficies
    cerradas por la lluvia y, para los perfiles con ruedas, los tramos dentro de sectores
    comprometidos (salvo el sector del propio origen). Los orígenes se agrupan por sector eximido:
    una consulta por grupo. Un par ausente del resultado no tiene ruta por la red (o la red no está
    cargada, o el punto queda a más de ``ruteo_distancia_maxima_a_red_m``).
    """
    if not origenes or not destinos or not red_disponible(db):
        return {}
    maximo = float(supuesto("ruteo_distancia_maxima_a_red_m"))
    vel_min = min(dom.velocidades(perfil).values()) * 1000 / 60  # m/min

    usables = superficies_usables(perfil, lluvia_mm)

    def nodos(puntos: dict) -> dict:
        r = {}
        for clave, (lon, lat) in puntos.items():
            n = _nodo_cercano(db, lon, lat, usables)
            if n is not None and n[1] <= maximo:
                r[clave] = n
        return r

    n_orig, n_dest = nodos(origenes), nodos(destinos)
    if not n_orig or not n_dest:
        return {}
    comprometidos = [s.id for s in escenario.sectores if s.estado == esc.COMPROMETIDO]
    bloqueados = accesos_cerrados_para(perfil, escenario)
    sectores = sector_de_origen or {}
    grupos: dict[str | None, list[str]] = {}
    for clave in n_orig:
        sid = sectores.get(clave)
        grupos.setdefault(sid if sid in comprometidos else None, []).append(clave)

    resultado: dict[tuple[str, int], float] = {}
    destinos_por_nodo: dict[int, list[int]] = {}
    for did, (nodo, _) in n_dest.items():
        destinos_por_nodo.setdefault(nodo, []).append(did)
    for exento, claves in grupos.items():
        aristas = _consulta_aristas(
            perfil, comprometidos, [exento] if exento else [], bloqueados, lluvia_mm
        )
        inicio = sorted({n_orig[c][0] for c in claves})
        fin = sorted(destinos_por_nodo)
        costos = {
            (int(f[0]), int(f[1])): float(f[2])
            for f in db.execute(
                text(
                    "SELECT start_vid, end_vid, agg_cost FROM pgr_dijkstraCost("
                    "CAST(:aristas AS text), CAST(:o AS bigint[]), CAST(:d AS bigint[]), false)"
                ),
                {"aristas": aristas, "o": inicio, "d": fin},
            ).all()
        }
        for clave in claves:
            n_o, conexion_o = n_orig[clave]
            for n_d, dids in destinos_por_nodo.items():
                segundos = 0.0 if n_o == n_d else costos.get((n_o, n_d))
                if segundos is None:
                    continue
                for did in dids:
                    conexion = conexion_o + n_dest[did][1]
                    resultado[(clave, did)] = round(segundos / 60 + conexion / vel_min, 1)
    return resultado
