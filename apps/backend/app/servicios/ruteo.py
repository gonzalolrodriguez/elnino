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


def _nodo_cercano(db: Session, lon: float, lat: float) -> tuple[int, float] | None:
    fila = db.execute(
        text(
            "SELECT id, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), :srid)::geography) "
            "FROM red_vial_nodos "
            "ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), :srid) LIMIT 1"
        ),
        {"lon": lon, "lat": lat, "srid": SRID},
    ).first()
    return None if fila is None else (int(fila[0]), float(fila[1]))


def _consulta_aristas(perfil: str, comprometidos: list[str], exentos: list[str]) -> str:
    """SQL de aristas para ``pgr_dijkstra``: costo en segundos según perfil y superficie."""
    vel = dom.velocidades(perfil)
    # Sin superficie conocida se asume tierra (criterio conservador).
    superficie = "COALESCE(superficie, 'tierra')"
    casos = " ".join(f"WHEN '{s}' THEN longitud_m / {v * 1000 / 3600!r}" for s, v in vel.items())
    costo = f"CASE {superficie} {casos} END"
    permitidas = ", ".join(f"'{s}'" for s in vel)
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
) -> dict | None:
    maximo = float(supuesto("ruteo_distancia_maxima_a_red_m"))
    n_o = _nodo_cercano(db, *origen)
    n_d = _nodo_cercano(db, *destino)
    if n_o is None or n_d is None or n_o[1] > maximo or n_d[1] > maximo:
        return None
    aristas = _consulta_aristas(perfil, comprometidos, exentos)
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
    escenario = None
    if altura_m is not None:
        escenario = contexto.calcular_escenario(db, altura_m, lluvia_mm, caminos_cerrados or set())
        comprometidos = [s.id for s in escenario.sectores if s.estado == esc.COMPROMETIDO]
    base = {
        "perfil": perfil,
        "origen": {"lon": origen[0], "lat": origen[1], "sector_id": sector_origen},
        "destino": {"lon": destino[0], "lat": destino[1]},
        "sectores_comprometidos": comprometidos,
        "categoria": "SIMULADO",
        "nota": NOTA_CATEGORIA,
        "advertencias": [],
    }

    if red_disponible(db):
        exentos = [sector_origen] if sector_origen in comprometidos else []
        ruta = _ruta_en_red(db, perfil, origen, destino, comprometidos, exentos)
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
        estado = (
            escenario.sector(sector_origen)
            if escenario is not None
            else contexto.calcular_escenario(db, 0.0, 0.0, caminos_cerrados or set()).sector(
                sector_origen
            )
        )
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
