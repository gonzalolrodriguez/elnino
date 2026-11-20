"""Carga de la red vial en ``red_vial`` / ``red_vial_nodos`` para pgRouting (CLAUDE.md §8.3, P10).

Uso (desde ``apps/backend``; sin archivo usa ``DATA_DIR/geo/red_vial.geojson``)::

    python -m app.ingest.red_vial [archivo.geojson] [--fuente TEXTO] [--categoria CATEGORIA]
                                  [--fecha AAAA-MM-DD] [--agregar] [--si-vacia]

Entrada: GeoJSON con ``LineString`` o ``MultiLineString`` en EPSG:4326. Propiedades reconocidas
(todas opcionales):

- ``nombre`` (o ``name``): nombre del camino.
- ``superficie``: ``pavimento`` | ``ripio`` | ``tierra`` | ``desconocida``. Si falta se infiere de
  ``surface`` y de ``highway`` de OpenStreetMap; si no hay nada, ``desconocida`` (costo de tierra
  para vehículos y arreo; el camión jaula no la usa).
- ``nodo_ini`` / ``nodo_fin``: ids de nodo de OSM. Si todas las líneas los traen, se usan como
  vértices (remapeados a enteros compactos) y NO se vuelve a nodar; si no, el script nodea.
  La red de ``data/geo/red_vial.geojson`` (OSM, ya partida en nodos) se carga así.
- El resto de propiedades (osm_id, highway, ref, oneway...) se ignora; la red se usa sin sentido.

El script parte las líneas en las intersecciones (nodado propio con Shapely, sin depender de
``pgr_createTopology``, que se elimina en pgRouting 4), asigna ``source``/``target`` a las aristas,
calcula ``longitud_m`` y guarda los vértices en ``red_vial_nodos``. El costo según el perfil
(vehicular, camión jaula, arreo) se calcula al consultar, con las velocidades de ``supuestos.yaml``.
Por defecto reemplaza toda la red anterior; con ``--agregar`` la suma a la existente (los vértices
de la red agregada no se unen a los de la anterior: usar un solo archivo). Con ``--si-vacia`` no
hace nada si ya hay una red cargada (así lo usa ``docker compose`` al arrancar el backend).
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from geoalchemy2.shape import from_shape
from shapely import STRtree
from shapely.geometry import LineString, MultiLineString, MultiPoint, Point, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import substring
from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from app.config.settings import DATA_DIR
from app.db.base import SRID
from app.db.modelos import RedVial, RedVialNodo
from app.db.sesion import get_sessionmaker

SUPERFICIES = ("pavimento", "ripio", "tierra", "desconocida")
DECIMALES = 7  # ~1 cm: dos vértices que coinciden hasta ahí son el mismo nodo

_SURFACE_OSM = {
    "asphalt": "pavimento",
    "paved": "pavimento",
    "concrete": "pavimento",
    "paving_stones": "pavimento",
    "gravel": "ripio",
    "fine_gravel": "ripio",
    "compacted": "ripio",
    "unpaved": "tierra",
    "dirt": "tierra",
    "ground": "tierra",
    "earth": "tierra",
    "sand": "tierra",
    "grass": "tierra",
    "mud": "tierra",
}
_HIGHWAY_PAVIMENTADO = {"motorway", "trunk", "primary", "secondary", "motorway_link", "trunk_link"}


def inferir_superficie(props: dict) -> str:
    """Superficie desde ``superficie``, ``surface`` o ``highway``; si no hay dato, ``desconocida``.

    ``desconocida`` se rutea con el costo de la tierra para perfiles con ruedas y a pie, y el camión
    jaula no la usa (criterio conservador, ver ``supuestos.yaml``).
    """
    directa = str(props.get("superficie") or "").strip().lower()
    if directa in SUPERFICIES and directa != "desconocida":
        return directa
    osm = str(props.get("surface") or "").strip().lower()
    if osm in _SURFACE_OSM:
        return _SURFACE_OSM[osm]
    if str(props.get("highway") or "").strip().lower() in _HIGHWAY_PAVIMENTADO:
        return "pavimento"
    return "desconocida"


def _lineas(geom: BaseGeometry) -> list[LineString]:
    if isinstance(geom, LineString):
        return [geom] if geom.length > 0 else []
    if isinstance(geom, MultiLineString):
        return [g for g in geom.geoms if g.length > 0]
    return []


def _clave(x: float, y: float) -> tuple[float, float]:
    return (round(x, DECIMALES), round(y, DECIMALES))


def nodar(lineas: list[tuple[LineString, dict]]) -> list[tuple[LineString, dict]]:
    """Parte cada línea en los puntos donde cruza o toca a otra. Conserva los atributos."""
    geoms = [g for g, _ in lineas]
    arbol = STRtree(geoms)
    resultado: list[tuple[LineString, dict]] = []
    for i, (linea, props) in enumerate(lineas):
        cortes = {0.0, linea.length}
        for j in arbol.query(linea):
            if int(j) == i:
                continue
            inter = linea.intersection(geoms[int(j)])
            if inter.is_empty:
                continue
            puntos: list[Point] = []
            if isinstance(inter, Point):
                puntos = [inter]
            elif isinstance(inter, MultiPoint):
                puntos = list(inter.geoms)
            else:  # tramos superpuestos o colecciones: se corta en los extremos de cada pieza
                for parte in getattr(inter, "geoms", [inter]):
                    if isinstance(parte, Point):
                        puntos.append(parte)
                    elif isinstance(parte, LineString) and not parte.is_empty:
                        puntos += [Point(parte.coords[0]), Point(parte.coords[-1])]
            cortes.update(linea.project(p) for p in puntos)
        ordenados = sorted(cortes)
        for a, b in zip(ordenados, ordenados[1:], strict=False):
            if b - a < 1e-9:
                continue
            tramo = substring(linea, a, b)
            if isinstance(tramo, LineString) and tramo.length > 0:
                resultado.append((tramo, props))
    return resultado


def cargar_red(
    db: Session,
    features: list[dict],
    fuente: str,
    categoria: str = "DOCUMENTO DE REFERENCIA",
    fecha: date | None = None,
    reemplazar: bool = True,
) -> dict[str, int]:
    """Inserta la red; devuelve ``{"lineas", "aristas", "nodos"}``. Hace commit."""
    lineas: list[tuple[LineString, dict]] = []
    con_nodos = True  # todas las líneas traen nodo_ini / nodo_fin (red ya partida en los nodos)
    for f in features:
        geom = f.get("geometry")
        if not geom:
            continue
        props = f.get("properties") or {}
        meta = {
            "nombre": (props.get("nombre") or props.get("name") or None),
            "superficie": inferir_superficie(props),
            "ini": props.get("nodo_ini"),
            "fin": props.get("nodo_fin"),
        }
        partes = _lineas(shape(geom))
        if len(partes) != 1 or meta["ini"] is None or meta["fin"] is None:
            con_nodos = False
        for tramo in partes:
            lineas.append((tramo, meta))

    segmentos = lineas if con_nodos else nodar(lineas)
    if reemplazar:
        db.execute(delete(RedVial))
        db.execute(delete(RedVialNodo))
        db.flush()

    ids: dict[tuple, int] = {}
    siguiente = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM red_vial_nodos")).scalar_one()

    def nodo(x: float, y: float, externo=None) -> int:
        nonlocal siguiente
        clave = ("n", externo) if externo is not None else _clave(x, y)
        if clave not in ids:
            siguiente += 1
            ids[clave] = siguiente
            db.add(RedVialNodo(id=siguiente, geom=from_shape(Point(x, y), srid=SRID)))
        return ids[clave]

    for tramo, meta in segmentos:
        a, b = tramo.coords[0], tramo.coords[-1]
        db.add(
            RedVial(
                geom=from_shape(LineString(tramo.coords), srid=SRID),
                nombre=meta["nombre"],
                superficie=meta["superficie"],
                source=nodo(a[0], a[1], meta.get("ini") if con_nodos else None),
                target=nodo(b[0], b[1], meta.get("fin") if con_nodos else None),
                categoria=categoria,
                fuente=fuente,
                fecha_dato=fecha,
            )
        )
    db.flush()
    db.execute(
        text(
            "UPDATE red_vial SET longitud_m = ST_Length(geom::geography), "
            "costo = ST_Length(geom::geography), costo_inverso = ST_Length(geom::geography) "
            "WHERE longitud_m IS NULL"
        )
    )
    db.commit()
    return {"lineas": len(lineas), "aristas": len(segmentos), "nodos": len(ids)}


def cargar_archivo(
    ruta: Path,
    fuente: str | None = None,
    categoria: str = "DOCUMENTO DE REFERENCIA",
    fecha: date | None = None,
    reemplazar: bool = True,
) -> dict[str, int]:
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    features = datos["features"] if datos.get("type") == "FeatureCollection" else [datos]
    with get_sessionmaker()() as db:
        return cargar_red(db, features, fuente or ruta.name, categoria, fecha, reemplazar)


def red_cargada() -> bool:
    with get_sessionmaker()() as db:
        return bool(db.execute(text("SELECT EXISTS (SELECT 1 FROM red_vial)")).scalar_one())


def main() -> None:
    ap = argparse.ArgumentParser(description="Carga una red vial GeoJSON en red_vial (pgRouting).")
    ap.add_argument(
        "archivo",
        type=Path,
        nargs="?",
        default=DATA_DIR / "geo" / "red_vial.geojson",
        help="GeoJSON de la red (por defecto data/geo/red_vial.geojson bajo DATA_DIR)",
    )
    ap.add_argument(
        "--fuente", default=None, help="Texto de fuente (por defecto, el nombre del archivo)"
    )
    ap.add_argument("--categoria", default="DOCUMENTO DE REFERENCIA")
    ap.add_argument(
        "--fecha", type=date.fromisoformat, default=None, help="Fecha del dato (AAAA-MM-DD)"
    )
    ap.add_argument("--agregar", action="store_true", help="No reemplazar la red existente")
    ap.add_argument(
        "--si-vacia", action="store_true", help="Cargar solo si todavía no hay red cargada"
    )
    args = ap.parse_args()
    if args.si_vacia and red_cargada():
        print("red_vial: ya cargada, no se modifica")
        return
    resumen = cargar_archivo(
        args.archivo, args.fuente, args.categoria, args.fecha, not args.agregar
    )
    for clave, valor in resumen.items():
        print(f"{clave}: {valor}")


if __name__ == "__main__":
    main()
