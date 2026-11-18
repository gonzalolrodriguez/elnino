"""Descarga reproducible de las capas territoriales oficiales (CLAUDE.md, seccion 10.1).

Decision D7: los lugares (limites, localidades, caminos, escuelas, salud, comisarias,
cursos de agua) son reales y salen de fuentes oficiales. Todo lo descargado se rotula
DOCUMENTO DE REFERENCIA con su fuente, licencia y fecha de descarga.

Uso (desde la raiz del repositorio):

    python apps/backend/scripts/descargar_capas.py            # todas las capas
    python apps/backend/scripts/descargar_capas.py --solo vial,escuelas

Salidas en ``data/geo/``:
    original/<capa>.<ext>      respuesta de la fuente (o su subconjunto de Formosa)
    <capa>.geojson             version recortada, EPSG:4326
    manifiesto.json            metadatos por capa (fuente, licencia, fecha, conteos, bbox)
    verificacion_k10.json      conteo de lugares reales cerca de los sectores K10

Reglas: nunca se inventan datos; si una fuente falla se usa el respaldo declarado (si
existe) y el fallo queda registrado en el manifiesto. Los archivos de ``data/kit`` no se
modifican. Dependencias: httpx, shapely, openpyxl (ya presentes en el venv del backend).
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import time
import traceback
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Any

import httpx
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union
from shapely.prepared import prep

RAIZ = Path(__file__).resolve().parents[3]
GEO = RAIZ / "data" / "geo"
ORIGINAL = GEO / "original"
K10 = RAIZ / "data" / "kit" / "K10_sectores_simulados.geojson"

FECHA = date.today().isoformat()
CATEGORIA = "DOCUMENTO DE REFERENCIA"
USER_AGENT = "operacion-agua-capas/1.0 (prototipo educativo; descarga de capas abiertas)"
LIMITE_ORIGINAL_MB = 20

# Corredor RN 11 - rio Paraguay. Cubre los cuatro sectores K10
# (lon -58.205..-58.128, lat -26.222..-26.150) con ~0,15 grados (~16 km) de margen
# al oeste, norte y sur, y llega hasta -57.95 para incluir la margen del rio Paraguay.
# Incluye la RN 11 y los caminos de acceso a los sectores. En la margen oriental del
# rio hay caminos de Paraguay: se conservan porque son parte del mapa de OSM.
CORREDOR = (-58.40, -26.40, -57.95, -25.95)  # (lon_min, lat_min, lon_max, lat_max)

IGN_WFS = "https://wms.ign.gob.ar/geoserver/ows"
MAPA_EDUCATIVO_WFS = "https://mapa.educacion.gob.ar/geoserver/ows"
GEOREF = "https://apis.datos.gob.ar/georef/api"
OVERPASS = "https://overpass-api.de/api/interpreter"
REFES_URL = (
    "http://datos.salud.gob.ar/dataset/336cf4d9-447a-44c4-8e34-0ba1fc293d55/resource/"
    "5d5710df-cf3f-4d91-b9c5-aecab1e06018/download/"
    "establecimientos-asistenciales-asentados-registro-federal-refes-20241227.xlsx"
)
NATURAL_EARTH_RIOS = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
    "ne_10m_rivers_lake_centerlines.geojson"
)

# --------------------------------------------------------------------------- utilidades


def log(msg: str) -> None:
    print(msg, flush=True)


def cliente() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(180.0, connect=30.0),
        follow_redirects=True,
    )


def obtener(
    http: httpx.Client,
    url: str,
    *,
    params: dict | None = None,
    data: dict | None = None,
    intentos: int = 3,
) -> httpx.Response:
    """GET/POST con reintentos acotados. El cuerpo se decodifica siempre como UTF-8."""
    ultimo: Exception | None = None
    for n in range(1, intentos + 1):
        try:
            r = http.post(url, data=data) if data is not None else http.get(url, params=params)
            r.raise_for_status()
            return r
        except Exception as exc:  # noqa: BLE001 - se registra y se reintenta
            ultimo = exc
            log(f"    intento {n}/{intentos} fallido: {exc!s:.160}")
            time.sleep(3 * n)
    raise RuntimeError(f"fallo definitivo en {url}: {ultimo}")


def json_utf8(r: httpx.Response) -> Any:
    return json.loads(r.content.decode("utf-8-sig"))


def redondear(c: Any, n: int = 6) -> Any:
    if isinstance(c, (list, tuple)):
        return [redondear(x, n) for x in c]
    return round(c, n)


def geom_a_dict(g, tolerancia: float | None = None) -> dict:
    if tolerancia:
        g = g.simplify(tolerancia, preserve_topology=True)
    d = mapping(g)
    return {"type": d["type"], "coordinates": redondear(d["coordinates"])}


def coleccion(
    features: list[dict], nombre: str, fuente: str, licencia: str, notas: str = ""
) -> dict:
    return {
        "type": "FeatureCollection",
        "name": nombre,
        "metadata": {
            "categoria": CATEGORIA,
            "fuente": fuente,
            "licencia": licencia,
            "fecha_descarga": FECHA,
            "crs": "EPSG:4326",
            "nota": notas,
        },
        "features": features,
    }


def escribir_json(ruta: Path, obj: Any) -> int:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return ruta.stat().st_size


def guardar_original(nombre: str, contenido: bytes, ext: str) -> tuple[str | None, str]:
    """Guarda la respuesta cruda salvo que supere el limite; devuelve (ruta relativa, nota)."""
    mb = len(contenido) / 1e6
    if mb > LIMITE_ORIGINAL_MB:
        return (
            None,
            f"original de {mb:.1f} MB no versionado (> {LIMITE_ORIGINAL_MB} MB); se conserva solo el recortado.",
        )
    ORIGINAL.mkdir(parents=True, exist_ok=True)
    ruta = ORIGINAL / f"{nombre}.{ext}"
    ruta.write_bytes(contenido)
    return f"original/{ruta.name}", ""


def bbox_de(features: list[dict]) -> list[float] | None:
    if not features:
        return None
    xs, ys = [], []

    def rec(c: Any) -> None:
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for x in c:
                rec(x)

    for f in features:
        rec(f["geometry"]["coordinates"])
    return [round(min(xs), 6), round(min(ys), 6), round(max(xs), 6), round(max(ys), 6)]


def wfs_geojson(
    http: httpx.Client, url: str, capa: str, *, cql: str | None = None, bbox: tuple | None = None
) -> tuple[bytes, dict]:
    """GetFeature WFS 1.0.0 (orden de ejes lon/lat, sin ambiguedad) con salida GeoJSON."""
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": capa,
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
    }
    if cql:
        params["CQL_FILTER"] = cql
    if bbox:
        params["bbox"] = ",".join(str(v) for v in bbox)
    r = obtener(http, url, params=params)
    return r.content, json_utf8(r)


def entrada(nombre: str, titulo: str, **kw: Any) -> dict:
    base = {
        "nombre": titulo,
        "id": nombre,
        "archivo_original": None,
        "archivo_recortado": None,
        "url": None,
        "licencia": None,
        "fecha_descarga": FECHA,
        "categoria": CATEGORIA,
        "n_features": 0,
        "bbox": None,
        "estado": "ok",
        "fuente_usada": "primaria",
        "notas": "",
    }
    base.update(kw)
    return base


# ------------------------------------------------------------------ limite de Formosa


def poligono_formosa(http: httpx.Client) -> tuple[Any, bytes]:
    crudo, d = wfs_geojson(http, IGN_WFS, "ign:provincia", cql="in1='34'")
    if not d.get("features"):
        raise RuntimeError("IGN WFS no devolvio el poligono de la provincia de Formosa (in1='34')")
    return unary_union([shape(f["geometry"]) for f in d["features"]]), crudo


# ------------------------------------------------------------------------ capas


def capa_admin(http: httpx.Client, formosa, crudo_prov: bytes) -> list[dict]:
    """Provincia, departamentos y municipios (IGN WFS; respaldo: centroides de Georef)."""
    salida = []
    specs = [
        ("provincia", "Provincia de Formosa", "ign:provincia", "in1='34'", 0.0005),
        ("departamentos", "Departamentos de Formosa", "ign:departamento", "in1 LIKE '34%'", 0.0005),
        (
            "municipios",
            "Municipios y comisiones de Formosa",
            "ign:municipio",
            "in1 LIKE '34%'",
            0.0005,
        ),
    ]
    for ident, titulo, capa, cql, tol in specs:
        log(f"[{ident}] IGN WFS {capa}")
        m = entrada(
            ident,
            titulo,
            url=f"{IGN_WFS}?service=WFS&request=GetFeature&typeName={capa}&CQL_FILTER={cql}",
            licencia="IGN, datos abiertos (Capas SIG); citar fuente: Instituto Geografico Nacional",
        )
        try:
            crudo, d = (
                (crudo_prov, json.loads(crudo_prov.decode("utf-8-sig")))
                if ident == "provincia"
                else wfs_geojson(http, IGN_WFS, capa, cql=cql)
            )
            feats = []
            for f in d["features"]:
                p = f["properties"]
                props = {
                    "nombre": p.get("nam"),
                    "nombre_completo": p.get("fna"),
                    "codigo": p.get("in1"),
                    "fuente": p.get("sag", "IGN"),
                }
                feats.append(
                    {
                        "type": "Feature",
                        "properties": props,
                        "geometry": geom_a_dict(shape(f["geometry"]), tol),
                    }
                )
            if not feats:
                raise RuntimeError("sin entidades")
            m["archivo_original"], nota = guardar_original(ident, crudo, "geojson")
            m["notas"] = (
                f"Poligonos simplificados con tolerancia {tol} grados (~50 m). {nota}".strip()
            )
        except Exception as exc:  # noqa: BLE001
            log(f"    IGN fallo: {exc!s:.200}; respaldo Georef (solo centroides)")
            if ident == "provincia":
                m.update(estado="error", error=str(exc))
                salida.append(m)
                continue
            try:
                endpoint = "departamentos" if ident == "departamentos" else "municipios"
                r = obtener(
                    http,
                    f"{GEOREF}/{endpoint}",
                    params={"provincia": "34", "max": 500, "campos": "completo"},
                )
                items = json_utf8(r)[endpoint]
                feats = [
                    {
                        "type": "Feature",
                        "properties": {
                            "nombre": i["nombre"],
                            "nombre_completo": i.get("nombre_completo"),
                            "codigo": i["id"],
                            "fuente": i.get("fuente"),
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                round(i["centroide"]["lon"], 6),
                                round(i["centroide"]["lat"], 6),
                            ],
                        },
                    }
                    for i in items
                ]
                m.update(
                    fuente_usada="respaldo: API Georef (centroides, sin poligonos)",
                    url=f"{GEOREF}/{endpoint}?provincia=34",
                    licencia="CC BY 4.0 (datos.gob.ar)",
                    error_primaria=str(exc),
                    notas="La fuente primaria fallo; se usan solo centroides.",
                )
                m["archivo_original"], _ = guardar_original(ident, r.content, "json")
            except Exception as exc2:  # noqa: BLE001
                m.update(estado="error", error=f"{exc}; respaldo: {exc2}")
                salida.append(m)
                continue
        m["archivo_recortado"] = f"{ident}.geojson"
        m["n_features"] = len(feats)
        m["bbox"] = bbox_de(feats)
        escribir_json(
            GEO / m["archivo_recortado"],
            coleccion(feats, ident, "IGN - Capas SIG (WFS)", m["licencia"], m["notas"]),
        )
        salida.append(m)
    return salida


def capa_asentamientos(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    log("[asentamientos] API Georef /asentamientos (BAHRA / INDEC)")
    m = entrada(
        "localidades_parajes",
        "Localidades, parajes y asentamientos (BAHRA via Georef)",
        url=f"{GEOREF}/asentamientos?provincia=34",
        licencia="CC BY 4.0 (datos.gob.ar, Georef / BAHRA)",
    )
    items: list[dict] = []
    inicio, paso = 0, 500
    while True:
        r = obtener(
            http,
            f"{GEOREF}/asentamientos",
            params={"provincia": "34", "max": paso, "inicio": inicio, "campos": "completo"},
        )
        d = json_utf8(r)
        items += d["asentamientos"]
        inicio += d["cantidad"]
        if d["cantidad"] == 0 or inicio >= d["total"]:
            break
    m["archivo_original"], _ = guardar_original(
        "localidades_parajes", json.dumps(items, ensure_ascii=False).encode("utf-8"), "json"
    )
    pf = prep(formosa.buffer(0.02))  # tolerancia ~2 km por centroides cercanos al limite
    feats, fuera = [], 0
    for i in items:
        c = i.get("centroide") or {}
        if c.get("lon") is None:
            fuera += 1
            continue
        if not pf.contains(Point(c["lon"], c["lat"])):
            fuera += 1
            continue
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": i["id"],
                    "nombre": i["nombre"],
                    "categoria_asentamiento": i.get("categoria"),
                    "departamento": (i.get("departamento") or {}).get("nombre"),
                    "municipio": (i.get("municipio") or {}).get("nombre"),
                    "localidad_censal": (i.get("localidad_censal") or {}).get("nombre"),
                    "fuente": i.get("fuente"),
                    "ubicacion": "centroide del asentamiento",
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(c["lon"], 6), round(c["lat"], 6)],
                },
            }
        )
    m["archivo_recortado"] = "localidades_parajes.geojson"
    m["n_features"] = len(feats)
    m["bbox"] = bbox_de(feats)
    m["notas"] = (
        f"Total en la API: {len(items)}; descartados por falta de coordenadas o fuera de Formosa: {fuera}. "
        "La posicion es el centroide declarado por BAHRA/Georef (no un punto catastral)."
    )
    escribir_json(
        GEO / m["archivo_recortado"],
        coleccion(
            feats, "localidades_parajes", "API Georef / BAHRA (INDEC)", m["licencia"], m["notas"]
        ),
    )
    return [m]


SUPERFICIE = {
    "pavimento": {
        "paved",
        "asphalt",
        "concrete",
        "concrete:plates",
        "concrete:lanes",
        "paving_stones",
        "sett",
        "cobblestone",
        "bricks",
        "metal",
    },
    "ripio": {
        "gravel",
        "fine_gravel",
        "compacted",
        "pebblestone",
        "crushed_stone",
        "unhewn_cobblestone",
    },
    "tierra": {"unpaved", "dirt", "earth", "ground", "mud", "sand", "grass", "clay", "soil"},
}


def clasificar_superficie(tag: str | None) -> str:
    """Mapeo literal del tag OSM ``surface``. Sin tag o valor no listado: ``desconocida``."""
    if not tag:
        return "desconocida"
    for clase, valores in SUPERFICIE.items():
        if tag.strip().lower() in valores:
            return clase
    return "desconocida"


def capa_vial(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    log("[red_vial] Overpass (OSM) en el corredor")
    s, w, n, e = CORREDOR[1], CORREDOR[0], CORREDOR[3], CORREDOR[2]
    consulta = (
        f'[out:json][timeout:180];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|track|service)(_link)?$"]'
        f"({s},{w},{n},{e});out body geom;"
    )
    m = entrada(
        "red_vial",
        "Red vial del corredor RN 11 - rio Paraguay (OpenStreetMap)",
        url=f"{OVERPASS} (consulta bbox {CORREDOR})",
        licencia="ODbL 1.0. (c) colaboradores de OpenStreetMap; atribucion obligatoria",
    )
    r = obtener(http, OVERPASS, data={"data": consulta})
    d = json_utf8(r)
    m["archivo_original"], nota = guardar_original("red_vial_overpass", r.content, "json")
    ways = [x for x in d["elements"] if x.get("type") == "way" and x.get("geometry")]
    uso: dict[int, int] = {}
    for wy in ways:
        for nid in wy["nodes"]:
            uso[nid] = uso.get(nid, 0) + 1
    lon0, lat0, lon1, lat1 = CORREDOR
    feats, descartados = [], 0
    dist: dict[str, int] = {}
    for wy in ways:
        nodos, pts, t = (
            wy["nodes"],
            [(g["lon"], g["lat"]) for g in wy["geometry"]],
            wy.get("tags", {}),
        )
        cortes = (
            [0] + [i for i in range(1, len(nodos) - 1) if uso[nodos[i]] >= 2] + [len(nodos) - 1]
        )
        for k, (a, b) in enumerate(zip(cortes, cortes[1:], strict=False)):
            tramo = pts[a : b + 1]
            if len(tramo) < 2 or not any(lon0 <= x <= lon1 and lat0 <= y <= lat1 for x, y in tramo):
                descartados += 1
                continue
            sup = clasificar_superficie(t.get("surface"))
            dist[sup] = dist.get(sup, 0) + 1
            feats.append(
                {
                    "type": "Feature",
                    "properties": {
                        "osm_id": wy["id"],
                        "segmento": k,
                        "nodo_ini": nodos[a],
                        "nodo_fin": nodos[b],
                        "highway": t.get("highway"),
                        "surface": t.get("surface"),
                        "superficie": sup,
                        "nombre": t.get("name"),
                        "ref": t.get("ref"),
                        "tracktype": t.get("tracktype"),
                        "oneway": t.get("oneway"),
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[round(x, 6), round(y, 6)] for x, y in tramo],
                    },
                }
            )
    m["archivo_recortado"] = "red_vial.geojson"
    m["n_features"] = len(feats)
    m["bbox"] = bbox_de(feats)
    m["distribucion_superficie"] = dist
    m["notas"] = (
        f"Corredor bbox {list(CORREDOR)}. Las vias OSM se parten en cada nodo compartido por otra via (grafo ruteable sin nodificar); "
        f"se conservan los tramos con algun vertice dentro del corredor ({descartados} descartados). "
        "`superficie` es el mapeo literal del tag OSM `surface` (pavimento: paved/asphalt/concrete/paving_stones/sett/cobblestone/bricks; "
        "ripio: gravel/fine_gravel/compacted/pebblestone/crushed_stone; tierra: unpaved/dirt/earth/ground/mud/sand/grass/clay); "
        "sin tag o con otro valor queda `desconocida` (no se infiere desde `highway`). Incluye caminos de Paraguay en la margen oriental del rio. "
        + nota
    ).strip()
    escribir_json(
        GEO / m["archivo_recortado"],
        coleccion(feats, "red_vial", "OpenStreetMap via Overpass API", m["licencia"], m["notas"]),
    )
    return [m]


def capa_cursos(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    log("[cursos_agua] IGN WFS (perennes + intermitentes)")
    m = entrada(
        "cursos_agua",
        "Cursos de agua de Formosa (IGN)",
        url=f"{IGN_WFS} (ign:lineas_de_aguas_continentales_perenne / _intermitentes)",
        licencia="IGN, datos abiertos (Capas SIG); citar fuente: Instituto Geografico Nacional",
    )
    bb = formosa.bounds
    pf, tol = prep(formosa), 0.0003
    feats, crudos, total = [], {}, 0
    try:
        for regimen, capa in (
            ("perenne", "ign:lineas_de_aguas_continentales_perenne"),
            ("intermitente", "ign:lineas_de_aguas_continentales_intermitentes"),
        ):
            crudo, d = wfs_geojson(http, IGN_WFS, capa, bbox=bb)
            crudos[regimen] = d
            total += len(d["features"])
            for f in d["features"]:
                g = shape(f["geometry"])
                if not pf.intersects(g):
                    continue
                if not pf.covers(g):
                    g = g.intersection(formosa)
                    if g.is_empty:
                        continue
                p = f["properties"]
                feats.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "nombre": p.get("nam"),
                            "tipo": p.get("gna"),
                            "objeto": p.get("objeto"),
                            "regimen": regimen,
                            "fuente": p.get("sag", "IGN"),
                        },
                        "geometry": geom_a_dict(g, tol),
                    }
                )
        if not feats:
            raise RuntimeError("sin cursos de agua en el recorte")
        m["archivo_original"], nota = guardar_original(
            "cursos_agua",
            json.dumps(crudos, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            "json",
        )
        m["notas"] = (
            f"Consulta por bbox de la provincia ({total} entidades) y recorte exacto al poligono provincial; simplificado con tolerancia {tol} grados (~30 m). "
            f"Esquema ilustrativo: no usar para cotas. {nota}"
        ).strip()
    except Exception as exc:  # noqa: BLE001
        log(f"    IGN fallo: {exc!s:.200}; respaldo Natural Earth")
        try:
            r = obtener(http, NATURAL_EARTH_RIOS)
            d = json_utf8(r)
            feats = []
            area = box(*bb)
            for f in d["features"]:
                g = (
                    shape(f["geometry"]).intersection(formosa)
                    if shape(f["geometry"]).intersects(area)
                    else None
                )
                if g is None or g.is_empty:
                    continue
                feats.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "nombre": f["properties"].get("name"),
                            "tipo": "Rio",
                            "objeto": None,
                            "regimen": None,
                            "fuente": "Natural Earth",
                        },
                        "geometry": geom_a_dict(g, 0.001),
                    }
                )
            if not feats:
                raise RuntimeError("Natural Earth sin rios en Formosa")
            m.update(
                fuente_usada="respaldo: Natural Earth 10m rivers",
                url=NATURAL_EARTH_RIOS,
                licencia="Dominio publico (Natural Earth)",
                error_primaria=str(exc),
                notas="La fuente primaria (IGN) fallo; escala 1:10M, solo esquema ilustrativo.",
            )
            m["archivo_original"], _ = guardar_original("cursos_agua_ne", r.content, "geojson")
        except Exception as exc2:  # noqa: BLE001
            m.update(estado="error", error=f"{exc}; respaldo: {exc2}")
            return [m]
    m["archivo_recortado"] = "cursos_agua.geojson"
    m["n_features"] = len(feats)
    m["bbox"] = bbox_de(feats)
    escribir_json(
        GEO / m["archivo_recortado"],
        coleccion(feats, "cursos_agua", "IGN - Capas SIG (WFS)", m["licencia"], m["notas"]),
    )
    return [m]


def en_corredor(x: float, y: float) -> bool:
    return CORREDOR[0] <= x <= CORREDOR[2] and CORREDOR[1] <= y <= CORREDOR[3]


def capa_escuelas(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    log("[escuelas] Mapa Educativo Nacional WFS (CUE 34*)")
    m = entrada(
        "establecimientos_educativos",
        "Establecimientos educativos de Formosa (Mapa Educativo Nacional)",
        url=f"{MAPA_EDUCATIVO_WFS}?typeName=publico:establecimiento_educativo&CQL_FILTER=cue LIKE '34%'",
        licencia="CC BY 4.0 (Mapa Educativo Nacional, Ministerio de Capital Humano / DIEE)",
    )
    crudo, d = wfs_geojson(
        http, MAPA_EDUCATIVO_WFS, "publico:establecimiento_educativo", cql="cue LIKE '34%'"
    )
    m["archivo_original"], nota = guardar_original("establecimientos_educativos", crudo, "geojson")
    pf = prep(formosa)
    feats, fuera = [], 0
    for f in d["features"]:
        x, y = f["geometry"]["coordinates"][:2]
        if not pf.contains(Point(x, y)):
            fuera += 1
            continue
        p = f["properties"]
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "cue": p.get("cue"),
                    "nombre": p.get("nam") or p.get("fna"),
                    "nivel": (p.get("nen") or "").strip("; ") or None,
                    "modalidad": (p.get("mde") or "").strip("; ") or None,
                    "ambito": p.get("amg"),
                    "gestion": p.get("ges"),
                    "funcionamiento": p.get("fun"),
                    "precision_ubicacion": p.get("pre"),
                    "en_corredor": en_corredor(x, y),
                    "fuente": p.get("sag"),
                },
                "geometry": {"type": "Point", "coordinates": [round(x, 6), round(y, 6)]},
            }
        )
    m["archivo_recortado"] = "establecimientos_educativos.geojson"
    m["n_features"] = len(feats)
    m["bbox"] = bbox_de(feats)
    m["notas"] = (
        f"Filtro CUE que empieza con 34 (codigo de provincia); {fuera} sin coordenadas dentro de Formosa descartados. Solo campos institucionales. "
        "El servicio no publica direccion ni localidad. Candidatos a centro de recepcion: la autoridad define cuales lo son; la capacidad es SIMULADO. "
        + nota
    ).strip()
    escribir_json(
        GEO / m["archivo_recortado"],
        coleccion(
            feats,
            "establecimientos_educativos",
            "Mapa Educativo Nacional (WFS)",
            m["licencia"],
            m["notas"],
        ),
    )
    return [m]


def capa_salud(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    log("[salud] REFES (xlsx 27/12/2024) + centroides Georef")
    import csv

    import openpyxl

    m = entrada(
        "establecimientos_salud",
        "Establecimientos de salud de Formosa (REFES)",
        url=REFES_URL,
        licencia="CC BY 4.0 (Ministerio de Salud de la Nacion, datos.gob.ar)",
    )
    nota_tls = ""
    try:
        r = obtener(http, REFES_URL, intentos=1)
    except RuntimeError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        # El servidor de datos.salud.gob.ar no entrega la cadena completa de certificados.
        # Reintento sin verificacion solo para este archivo publico y se deja constancia.
        log(
            "    cadena TLS incompleta en datos.salud.gob.ar; reintento sin verificar solo este recurso"
        )
        with httpx.Client(
            headers={"User-Agent": USER_AGENT}, timeout=180.0, follow_redirects=True, verify=False
        ) as inseguro:
            r = obtener(inseguro, REFES_URL)
        nota_tls = " La descarga de REFES se hizo sin verificar el certificado TLS (cadena incompleta del servidor de datos.salud.gob.ar); contenido publico."
    wb = openpyxl.load_workbook(io.BytesIO(r.content), read_only=True)
    filas = list(wb.worksheets[0].iter_rows(values_only=True))
    cab = [str(c).lower() for c in filas[0]]
    reg = [
        dict(zip(cab, f, strict=False))
        for f in filas[1:]
        if f and str(f[cab.index("provincia_id")]).strip() in ("34", "34.0")
    ]
    if not reg:
        raise RuntimeError("REFES sin registros de Formosa")
    # Georef: centroide de la localidad censal (REFES no publica coordenadas).
    rl = obtener(
        http,
        f"{GEOREF}/localidades-censales",
        params={"provincia": "34", "max": 1000, "campos": "completo"},
    )
    cent = {i["id"]: i for i in json_utf8(rl)["localidades_censales"]}
    ORIGINAL.mkdir(parents=True, exist_ok=True)
    with (ORIGINAL / "establecimientos_salud_formosa.csv").open(
        "w", encoding="utf-8", newline=""
    ) as fh:
        w = csv.DictWriter(fh, fieldnames=cab)
        w.writeheader()
        w.writerows(reg)
    m["archivo_original"] = "original/establecimientos_salud_formosa.csv"
    feats, sin = [], 0
    for x in reg:
        loc = str(x.get("localidad_id") or "")
        c = cent.get(loc[:8]) or cent.get(loc[:-3])
        if not c or not c.get("centroide") or c["centroide"].get("lon") is None:
            sin += 1
            continue
        lon, lat = c["centroide"]["lon"], c["centroide"]["lat"]
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": str(x.get("establecimiento_id")),
                    "nombre": x.get("establecimiento_nombre"),
                    "localidad": x.get("localidad_nombre"),
                    "departamento": x.get("departamento_nombre"),
                    "origen_financiamiento": x.get("origen_financiamiento"),
                    "tipologia": x.get("tipologia_nombre"),
                    "tipologia_sigla": x.get("tipologia_sigla"),
                    "domicilio": x.get("domicilio"),
                    "en_corredor": en_corredor(lon, lat),
                    "ubicacion": "centroide de la localidad (REFES no publica coordenadas)",
                    "fuente": "REFES - Ministerio de Salud",
                },
                "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            }
        )
    m["archivo_recortado"] = "establecimientos_salud.geojson"
    m["n_features"] = len(feats)
    m["bbox"] = bbox_de(feats)
    m["notas"] = (
        f"Archivo REFES del 27/12/2024; {len(reg)} establecimientos de Formosa. REFES no trae coordenadas: la posicion es el centroide de la "
        f"localidad censal segun Georef (varios establecimientos comparten punto; precision de localidad, no del edificio). "
        f"{sin} sin localidad ubicable, excluidos del GeoJSON. Solo campos institucionales."
        + nota_tls
    )
    escribir_json(
        GEO / m["archivo_recortado"],
        coleccion(
            feats,
            "establecimientos_salud",
            "REFES (Ministerio de Salud) + Georef",
            m["licencia"],
            m["notas"],
        ),
    )
    return [m]


def capa_policia(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    log("[policia] Overpass amenity=police en Formosa")
    m = entrada(
        "comisarias_destacamentos",
        "Comisarias y destacamentos policiales (OpenStreetMap)",
        url=f"{OVERPASS} (area ISO3166-2=AR-P, amenity=police)",
        licencia="ODbL 1.0. (c) colaboradores de OpenStreetMap; atribucion obligatoria",
    )
    consulta = '[out:json][timeout:180];area["ISO3166-2"="AR-P"]->.a;nwr["amenity"="police"](area.a);out center tags;'
    time.sleep(5)  # cortesia entre consultas a Overpass
    r = obtener(http, OVERPASS, data={"data": consulta})
    d = json_utf8(r)
    m["archivo_original"], nota = guardar_original(
        "comisarias_destacamentos_overpass", r.content, "json"
    )
    pf = prep(formosa.buffer(0.02))
    feats = []
    for el in d["elements"]:
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        if lon is None or not pf.contains(Point(lon, lat)):
            continue
        t = el.get("tags", {})
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": el["id"],
                    "osm_tipo": el["type"],
                    "nombre": t.get("name"),
                    "operador": t.get("operator"),
                    "en_corredor": en_corredor(lon, lat),
                    "fuente": "OpenStreetMap",
                },
                "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            }
        )
    m["archivo_recortado"] = "comisarias_destacamentos.geojson"
    m["n_features"] = len(feats)
    m["bbox"] = bbox_de(feats)
    m["notas"] = (
        "Capa complementaria: la cobertura de OSM es parcial y no equivale al listado oficial de dependencias policiales. "
        "Los puestos del parte de lluvia (UPCA) no se descargan aqui. " + nota
    ).strip()
    escribir_json(
        GEO / m["archivo_recortado"],
        coleccion(
            feats,
            "comisarias_destacamentos",
            "OpenStreetMap via Overpass API",
            m["licencia"],
            m["notas"],
        ),
    )
    return [m]


def capa_poblacion(http: httpx.Client, formosa, _crudo: bytes) -> list[dict]:
    return [
        entrada(
            "poblacion_radios_censales",
            "Poblacion INDEC Censo 2022 por radio censal",
            estado="pendiente",
            fuente_usada="no intentada",
            url="https://www.indec.gob.ar/indec/web/Nivel4-Tema-2-41-135",
            licencia="INDEC, uso libre citando fuente",
            notas="Opcional segun la consigna; no se intento. Las poblaciones del MVP provienen de K10 (SIMULADO).",
        )
    ]


CAPAS: dict[str, Callable] = {
    "admin": capa_admin,
    "asentamientos": capa_asentamientos,
    "vial": capa_vial,
    "cursos": capa_cursos,
    "escuelas": capa_escuelas,
    "salud": capa_salud,
    "policia": capa_policia,
    "poblacion": capa_poblacion,
}

# --------------------------------------------------------------- verificacion K10


def verificar_k10(manifiesto: list[dict]) -> dict:
    """Cuenta lugares reales dentro del bbox de cada sector K10 y a menos de 2 km."""
    sectores = json.loads(K10.read_text(encoding="utf-8"))["features"]
    pares = [
        ("asentamientos", "localidades_parajes.geojson"),
        ("escuelas", "establecimientos_educativos.geojson"),
        ("salud", "establecimientos_salud.geojson"),
        ("comisarias", "comisarias_destacamentos.geojson"),
        ("tramos_viales", "red_vial.geojson"),
    ]
    capas = {}
    for k, nombre in pares:
        ruta = GEO / nombre
        capas[k] = (
            [shape(f["geometry"]) for f in json.loads(ruta.read_text(encoding="utf-8"))["features"]]
            if ruta.exists()
            else None
        )
    salida = {}
    for s in sectores:
        g = shape(s["geometry"])
        x0, y0, x1, y1 = g.bounds
        cerca = box(
            x0 - 0.02, y0 - 0.018, x1 + 0.02, y1 + 0.018
        )  # ~2 km (1 grado lat ~111 km; lon ~100 km a -26)
        fila = {}
        for k, geoms in capas.items():
            fila[k] = (
                None
                if geoms is None
                else {
                    "dentro": sum(1 for q in geoms if g.intersects(q)),
                    "a_2km": sum(1 for q in geoms if cerca.intersects(q)),
                }
            )
        salida[s["properties"]["id"]] = fila
    return salida


# ------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--solo", help=f"lista separada por comas de: {', '.join(CAPAS)}")
    args = ap.parse_args()
    elegidas = [c.strip() for c in args.solo.split(",")] if args.solo else list(CAPAS)
    desconocidas = [c for c in elegidas if c not in CAPAS]
    if desconocidas:
        ap.error(f"capas desconocidas: {desconocidas}")

    GEO.mkdir(parents=True, exist_ok=True)
    ruta_man = GEO / "manifiesto.json"
    previo = (
        {c["id"]: c for c in json.loads(ruta_man.read_text(encoding="utf-8"))["capas"]}
        if args.solo and ruta_man.exists()
        else {}
    )
    previo = {
        k: v for k, v in previo.items() if not (v.get("estado") == "error" and k in CAPAS)
    }  # errores de corridas anteriores
    resultados: list[dict] = []
    with cliente() as http:
        try:
            formosa, crudo_prov = poligono_formosa(http)
        except Exception as exc:  # noqa: BLE001
            log(f"ERROR: sin poligono de Formosa, no se puede recortar: {exc}")
            return 1
        for clave in elegidas:
            try:
                resultados += CAPAS[clave](http, formosa, crudo_prov)
            except Exception as exc:  # noqa: BLE001
                traceback.print_exc()
                resultados.append(
                    entrada(
                        clave,
                        clave,
                        estado="error",
                        error=str(exc),
                        notas="Fallo no recuperado; no se genero archivo.",
                    )
                )
    for r in resultados:
        previo[r["id"]] = r
    manifiesto = {
        "proyecto": "AI LAB Mision: Codigo Formosa - Operacion Agua (Equipo 3)",
        "generado_por": "apps/backend/scripts/descargar_capas.py",
        "fecha_descarga": FECHA,
        "categoria": CATEGORIA,
        "crs": "EPSG:4326 (WGS84). POSGAR 07 geografico seria EPSG:5340.",
        "corredor_vial_bbox": list(CORREDOR),
        "capas": list(previo.values()),
    }
    escribir_json(ruta_man, manifiesto)
    ruta_man.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding="utf-8")
    ver = verificar_k10(resultados)
    ruta_ver = GEO / "verificacion_k10.json"
    ruta_ver.write_text(
        json.dumps(
            {
                "fecha": FECHA,
                "criterio": "dentro = intersecta el bbox del sector K10; a_2km = intersecta el bbox ampliado ~2 km",
                "sectores": ver,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    log("\nResumen:")
    for r in resultados:
        log(
            f"  {r['id']:32s} {r['estado']:10s} {r['n_features']:>7} entidades  [{r['fuente_usada']}]"
        )
    return 0 if all(r["estado"] in ("ok", "pendiente") for r in resultados) else 2


if __name__ == "__main__":
    sys.exit(main())
