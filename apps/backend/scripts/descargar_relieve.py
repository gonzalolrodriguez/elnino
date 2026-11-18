"""Relieve real de la cuenca (planialtimetria) para la landing y los mapas de simulacion.

Genera, a partir de datos publicos sin clave, las capas de ``data/geo/relieve/``:

* un DEM de la cuenca (Mato Grosso / Pantanal -> confluencia Paraguay-Parana, incluye toda la
  provincia de Formosa) en malla para el 3D, curvas de nivel y una imagen de relieve;
* un DEM local mas fino del corredor de los sectores K10 (z11) con curvas de nivel de paso chico;
* el trazado real del rio Paraguay (y el Pilcomayo) desde Natural Earth.

Fuentes (ver ``manifiesto.json`` y ``LEEME.md``):

* Elevaciones: AWS Terrain Tiles, formato ``terrarium``
  (``https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png``). elev = (R*256 + G +
  B/256) - 32768. Mosaico de varias fuentes (en esta region, SRTM de la NASA/USGS a ~30 m); la
  precision vertical es de varios metros, y en llanuras muy planas (Chaco) es comparable a los
  desniveles reales.
* Rio: Natural Earth 10m rivers + lake centerlines (dominio publico).
* Departamentos de Formosa: ya descargados por ``descargar_capas.py`` (IGN); no se vuelven a bajar.

Uso (desde la raiz del repositorio):

    python apps/backend/scripts/descargar_relieve.py

Reglas: nunca se inventan elevaciones; si una fuente falla se registra en el manifiesto y no se
genera la capa. Solo requiere ``httpx``, ``numpy`` y ``shapely`` (ya presentes en el venv del
backend): el PNG se decodifica y escribe con ``zlib`` de la biblioteca estandar.
"""

# ruff: noqa: E501  (textos largos de documentacion y notas del manifiesto)
from __future__ import annotations

import argparse
import base64
import json
import math
import struct
import sys
import time
import zlib
from datetime import date
from pathlib import Path

import httpx
import numpy as np
from shapely.geometry import LineString, MultiLineString, box, shape
from shapely.ops import linemerge

RAIZ = Path(__file__).resolve().parents[3]
GEO = RAIZ / "data" / "geo"
SALIDA = GEO / "relieve"
FECHA = date.today().isoformat()
CATEGORIA = "DOCUMENTO DE REFERENCIA"
USER_AGENT = "operacion-agua-relieve/1.0 (prototipo educativo; descarga de capas abiertas)"

TILES_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
NE_RIOS = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
    "ne_10m_rivers_lake_centerlines.geojson"
)

# Cuenca: oeste -62.8 incluye todo Formosa (limite occidental ~ -62.4); este -54.0 cubre las
# nacientes del Paraguay (~ -55.1) y la meseta de Mato Grosso; norte -14.2 incluye las nacientes
# (~ -14.3); sur -28.0 pasa la confluencia con el Parana (-27.3).
CUENCA = (-62.8, -28.0, -54.0, -14.2)  # lon_min, lat_min, lon_max, lat_max
Z_CUENCA = 7
PASO_MALLA = 0.05  # grados, malla 3D
PASO_CURVAS = 0.02  # grados, malla para curvas (~2,2 km; el DEM base es de ~1,1 km por pixel)
PASO_TINTE = 0.02  # grados, imagen de tinte equirrectangular (para 3D/SVG)
# Curvas de la cuenca: llanura (50-150 m) y meseta (varios cientos de m). 25 m por debajo de 200 m
# muestra el escalon de la llanura sin ruido; 100 m por encima resume la meseta. Maestras cada 100 m.
NIVELES_CUENCA = list(range(25, 200, 25)) + list(range(200, 1201, 100))
MAESTRAS_CUENCA = {100, 200, 300, 500, 700, 1000}

# Corredor local de los sectores K10 (mismo bbox que el corredor vial de descargar_capas.py).
CORREDOR = (-58.40, -26.40, -57.95, -25.95)
Z_LOCAL = 11
PASO_LOCAL = 0.0007  # grados (~ 75 m)
SIGMA_LOCAL = (
    4  # celdas (~ 300 m): atenua el ruido del DEM (+-varios m) sin borrar el desnivel regional
)
PASO_CURVAS_LOCAL = 2.0  # metros: el DEM tiene ruido de ~2 m (desvio crudo-suavizado) y error vertical de varios m; 1 m seria sobreinterpretar

# Rampa hipsometrica de la cuenca (m -> color). Lightness creciente; pensada para fondo oscuro.
RAMPA_CUENCA = [
    (0, "#2a6660"),
    (60, "#37796a"),
    (80, "#4a8b6e"),
    (100, "#639c76"),
    (150, "#8caf7c"),
    (200, "#b4ba86"),
    (300, "#cfbb8b"),
    (500, "#dcb68f"),
    (800, "#ecd0b2"),
    (1000, "#f6e8d8"),
]
COLORES_LOCAL = ["#37796a", "#4a8b6e", "#639c76", "#8caf7c", "#b4ba86", "#cfbb8b"]


def log(msg: str) -> None:
    print(msg, flush=True)


# ------------------------------------------------------------------------------ PNG (zlib)


def png_leer(datos: bytes) -> np.ndarray:
    """Decodifica un PNG 8 bits RGB/RGBA no entrelazado a un arreglo (alto, ancho, canales)."""
    if datos[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("no es un PNG")
    pos, idat, ihdr = 8, b"", None
    while pos < len(datos):
        n, tipo = struct.unpack(">I4s", datos[pos : pos + 8])
        cuerpo = datos[pos + 8 : pos + 8 + n]
        pos += 12 + n
        if tipo == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", cuerpo)
        elif tipo == b"IDAT":
            idat += cuerpo
    ancho, alto, prof, tipo_color, _, _, entrelazado = ihdr
    if prof != 8 or tipo_color not in (2, 6) or entrelazado:
        raise ValueError(
            f"PNG no soportado: prof={prof} color={tipo_color} entrelazado={entrelazado}"
        )
    can = 3 if tipo_color == 2 else 4
    crudo = zlib.decompress(idat)
    paso = ancho * can
    salida = np.zeros((alto, paso), dtype=np.uint8)
    previa = np.zeros(paso, dtype=np.int32)
    p = 0
    for y in range(alto):
        f = crudo[p]
        fila = np.frombuffer(crudo, dtype=np.uint8, count=paso, offset=p + 1).astype(np.int32)
        p += paso + 1
        if f == 0:
            act = fila
        elif f == 1:  # Sub
            act = fila.copy()
            for i in range(can, paso):
                act[i] = (act[i] + act[i - can]) & 255
        elif f == 2:  # Up
            act = (fila + previa) & 255
        elif f == 3:  # Average
            act = fila.copy()
            for i in range(paso):
                izq = act[i - can] if i >= can else 0
                act[i] = (act[i] + ((izq + previa[i]) >> 1)) & 255
        elif f == 4:  # Paeth
            act = fila.copy()
            for i in range(paso):
                a = act[i - can] if i >= can else 0
                b = previa[i]
                c = previa[i - can] if i >= can else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                act[i] = (act[i] + pr) & 255
        else:
            raise ValueError(f"filtro PNG desconocido {f}")
        salida[y] = act
        previa = act
    return salida.reshape(alto, ancho, can)


def png_escribir(ruta: Path, rgba: np.ndarray) -> int:
    alto, ancho, _ = rgba.shape
    filas = b"".join(b"\x00" + rgba[y].tobytes() for y in range(alto))

    def trozo(tipo: bytes, cuerpo: bytes) -> bytes:
        return (
            struct.pack(">I", len(cuerpo))
            + tipo
            + cuerpo
            + struct.pack(">I", zlib.crc32(tipo + cuerpo))
        )

    datos = (
        b"\x89PNG\r\n\x1a\n"
        + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 6, 0, 0, 0))
        + trozo(b"IDAT", zlib.compress(filas, 9))
        + trozo(b"IEND", b"")
    )
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    return len(datos)


# ---------------------------------------------------------------------------- mosaico DEM


def merc_px(lon, lat, z: int):
    n = 256 * 2**z
    x = (np.asarray(lon) + 180.0) / 360.0 * n
    s = np.sin(np.radians(lat))
    y = (0.5 - np.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def descargar_mosaico(http: httpx.Client, bbox: tuple, z: int, margen_px: int = 8) -> dict:
    """Baja los tiles terrarium que cubren bbox y devuelve el mosaico de elevaciones (m)."""
    lon0, lat0, lon1, lat1 = bbox
    x0, y1 = merc_px(lon0, lat0, z)  # y1: borde sur
    x1, y0 = merc_px(lon1, lat1, z)  # y0: borde norte
    tx0, tx1 = int((x0 - margen_px) // 256), int((x1 + margen_px) // 256)
    ty0, ty1 = int((y0 - margen_px) // 256), int((y1 + margen_px) // 256)
    tiles = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    log(f"  z{z}: {len(tiles)} tiles ({tx1 - tx0 + 1} x {ty1 - ty0 + 1})")
    mosaico = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), dtype=np.float32)
    for tx, ty in tiles:
        url = TILES_URL.format(z=z, x=tx, y=ty)
        ultimo = None
        for intento in range(1, 4):
            try:
                r = http.get(url)
                r.raise_for_status()
                rgb = png_leer(r.content).astype(np.float32)
                break
            except Exception as exc:  # noqa: BLE001
                ultimo = exc
                log(f"    intento {intento}/3 fallido en {url}: {exc!s:.120}")
                time.sleep(2 * intento)
        else:
            raise RuntimeError(f"tile {url}: {ultimo}")
        elev = rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768
        mosaico[
            (ty - ty0) * 256 : (ty - ty0 + 1) * 256, (tx - tx0) * 256 : (tx - tx0 + 1) * 256
        ] = elev
    return {"z": z, "mosaico": mosaico, "px0": tx0 * 256, "py0": ty0 * 256, "n_tiles": len(tiles)}


def muestrear(m: dict, lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    """Interpolacion bilineal del mosaico (Mercator) en una malla lon/lat regular (lat decreciente)."""
    px, _ = merc_px(lons, 0.0, m["z"])
    _, py = merc_px(0.0, lats, m["z"])
    px = px - m["px0"] - 0.5
    py = py - m["py0"] - 0.5
    PX, PY = np.meshgrid(px, py)
    ix, iy = np.floor(PX).astype(int), np.floor(PY).astype(int)
    fx, fy = PX - ix, PY - iy
    mos = m["mosaico"]
    h, w = mos.shape
    ix = np.clip(ix, 0, w - 2)
    iy = np.clip(iy, 0, h - 2)
    a, b = mos[iy, ix], mos[iy, ix + 1]
    c, d = mos[iy + 1, ix], mos[iy + 1, ix + 1]
    return (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy).astype(
        np.float32
    )


def malla(bbox: tuple, paso: float) -> tuple[np.ndarray, np.ndarray]:
    lon0, lat0, lon1, lat1 = bbox
    nx = int(round((lon1 - lon0) / paso)) + 1
    ny = int(round((lat1 - lat0) / paso)) + 1
    return lon0 + np.arange(nx) * paso, lat1 - np.arange(
        ny
    ) * paso  # lat decreciente (fila 0 = norte)


def gauss(z: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0:
        return z
    r = int(math.ceil(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    p = np.pad(z, r, mode="edge")
    p = np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 1, p)


# ------------------------------------------------------------------- marching squares


def _segmentos_celda(caso: int, centro_alto: bool) -> list[tuple[str, str]]:
    # Lados: t (arriba), r (derecha), b (abajo), l (izquierda).
    tabla = {
        1: [("l", "b")], 2: [("b", "r")], 3: [("l", "r")], 4: [("t", "r")],
        6: [("t", "b")], 7: [("l", "t")], 8: [("l", "t")], 9: [("t", "b")],
        11: [("t", "r")], 12: [("l", "r")], 13: [("b", "r")], 14: [("l", "b")],
    }  # fmt: skip
    if caso in tabla:
        return tabla[caso]
    if caso == 5:  # b y d altos
        return [("l", "t"), ("b", "r")] if centro_alto else [("t", "r"), ("l", "b")]
    if caso == 10:  # a y c altos
        return [("t", "r"), ("l", "b")] if centro_alto else [("l", "t"), ("b", "r")]
    return []


def curvas_nivel(
    z: np.ndarray, lons: np.ndarray, lats: np.ndarray, nivel: float
) -> list[list[tuple[float, float]]]:
    """Polilineas (lon, lat) del isovalor ``nivel`` por marching squares con interpolacion lineal."""
    zz = z.astype(np.float64).copy()
    zz[zz == nivel] += 1e-6
    alto = zz > nivel
    a, b, c, d = alto[:-1, :-1], alto[:-1, 1:], alto[1:, 1:], alto[1:, :-1]
    caso = (a.astype(int) << 3) | (b.astype(int) << 2) | (c.astype(int) << 1) | d.astype(int)
    ii, jj = np.nonzero((caso > 0) & (caso < 15))
    ady: dict[tuple, list[tuple]] = {}

    def clave(lado: str, i: int, j: int) -> tuple:
        return {"t": ("h", i, j), "b": ("h", i + 1, j), "l": ("v", i, j), "r": ("v", i, j + 1)}[
            lado
        ]

    for i, j in zip(ii.tolist(), jj.tolist(), strict=True):
        cs = int(caso[i, j])
        centro = (zz[i, j] + zz[i, j + 1] + zz[i + 1, j + 1] + zz[i + 1, j]) / 4 > nivel
        for s1, s2 in _segmentos_celda(cs, centro):
            k1, k2 = clave(s1, i, j), clave(s2, i, j)
            ady.setdefault(k1, []).append(k2)
            ady.setdefault(k2, []).append(k1)

    def punto(k: tuple) -> tuple[float, float]:
        tipo, i, j = k
        if tipo == "h":  # entre (i, j) y (i, j+1)
            z0, z1 = zz[i, j], zz[i, j + 1]
            t = (nivel - z0) / (z1 - z0)
            return float(lons[j] + t * (lons[j + 1] - lons[j])), float(lats[i])
        z0, z1 = zz[i, j], zz[i + 1, j]  # vertical: entre (i, j) y (i+1, j)
        t = (nivel - z0) / (z1 - z0)
        return float(lons[j]), float(lats[i] + t * (lats[i + 1] - lats[i]))

    visto: set[tuple] = set()
    lineas: list[list[tuple[float, float]]] = []

    def recorrer(ini: tuple) -> None:
        cadena = [ini]
        visto.add(ini)
        actual, previo = ini, None
        while True:
            sig = next((n for n in ady[actual] if n != previo and n not in visto), None)
            if sig is None:
                # cierre de anillo
                if (
                    previo is not None
                    and ini in ady[actual]
                    and len(cadena) > 2
                    and ady[actual].count(ini)
                ):
                    cadena.append(ini)
                break
            cadena.append(sig)
            visto.add(sig)
            previo, actual = actual, sig
        lineas.append([punto(k) for k in cadena])

    for k, v in ady.items():
        if len(v) == 1 and k not in visto:
            recorrer(k)
    for k in list(ady):
        if k not in visto:
            recorrer(k)
    return lineas


def contornos_a_features(
    z: np.ndarray, lons, lats, niveles, maestras, tolerancia: float, min_long: float, nombre: str
) -> list[dict]:
    feats = []
    for nv in niveles:
        partes = []
        for linea in curvas_nivel(z, lons, lats, nv):
            if len(linea) < 3:
                continue
            ls = LineString(linea)
            if ls.length < min_long:
                continue
            ls = ls.simplify(tolerancia, preserve_topology=False)
            if len(ls.coords) >= 2:
                partes.append(ls)
        if not partes:
            continue
        geom = MultiLineString(partes) if len(partes) > 1 else partes[0]
        d = json.loads(json.dumps(geom.__geo_interface__))

        def red(c):
            return (
                [round(c[0], 4), round(c[1], 4)] if isinstance(c[0], float) else [red(x) for x in c]
            )

        d["coordinates"] = red(d["coordinates"])
        feats.append(
            {
                "type": "Feature",
                "properties": {"elev_m": nv, "maestra": bool(nv in maestras)},
                "geometry": d,
            }
        )
    log(
        f"  {nombre}: {len(feats)} niveles, {sum(len(f['geometry']['coordinates']) if f['geometry']['type'] == 'MultiLineString' else 1 for f in feats)} lineas"
    )
    return feats


# ------------------------------------------------------------------- imagen de relieve


def hex_rgb(h: str) -> np.ndarray:
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def tinte(z: np.ndarray, rampa: list[tuple[float, str]]) -> np.ndarray:
    xs = np.array([p[0] for p in rampa], dtype=np.float32)
    cols = np.stack([hex_rgb(p[1]) for p in rampa])
    return np.stack([np.interp(z, xs, cols[:, k]) for k in range(3)], axis=-1)


def sombreado(z: np.ndarray, dx_m, dy_m, exag: float) -> np.ndarray:
    gx = np.gradient(z * exag, axis=1) / dx_m
    gy = np.gradient(z * exag, axis=0) / dy_m
    pend = np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gy, gx)  # filas hacia el sur: el gradiente en y apunta al sur
    az, alt = math.radians(315), math.radians(40)
    azr = math.pi / 2 - az
    s = np.sin(alt) * np.cos(pend) + np.cos(alt) * np.sin(pend) * np.cos(azr - asp)
    return np.clip(s, 0, 1)


def componer(color: np.ndarray, sombra: np.ndarray, fuerza: float) -> np.ndarray:
    k = 1 - fuerza + fuerza * (sombra / max(float(np.sin(math.radians(40))), 1e-6))
    rgb = np.clip(color * k[..., None], 0, 255).astype(np.uint8)
    a = np.full(rgb.shape[:2] + (1,), 255, dtype=np.uint8)
    return np.concatenate([rgb, a], axis=-1)


def imagen_mercator(
    m: dict, bbox: tuple, ancho_px: int, rampa, exag: float, fuerza: float, sigma: float
):
    """Recorta el mosaico en Mercator (sin remuestrear en lat) y lo pinta; devuelve (rgba, z)."""
    lon0, lat0, lon1, lat1 = bbox
    x0, y1 = merc_px(lon0, lat0, m["z"])
    x1, y0 = merc_px(lon1, lat1, m["z"])
    nx_src = int(round(x1 - x0))
    ny_src = int(round(y1 - y0))
    f = max(1, int(round(nx_src / ancho_px)))
    nx, ny = nx_src // f, ny_src // f
    # celdas de f x f pixeles fuente, promediadas (reduce ruido y tamano)
    xs = (np.arange(nx) * f + x0 - m["px0"]).astype(int)
    ys = (np.arange(ny) * f + y0 - m["py0"]).astype(int)
    acum = np.zeros((ny, nx), dtype=np.float32)
    for dy in range(f):
        for dx in range(f):
            acum += m["mosaico"][np.ix_(ys + dy, xs + dx)]
    z = gauss(acum / (f * f), sigma)
    metros_px = 40075016.686 / (256 * 2 ** m["z"]) * f
    lat_c = np.degrees(
        np.arctan(
            np.sinh(math.pi * (1 - 2 * (y0 + (np.arange(ny) + 0.5) * f) / (256 * 2 ** m["z"])))
        )
    )
    dx_m = (metros_px * np.cos(np.radians(lat_c)))[:, None]
    sombra = sombreado(z, dx_m, dx_m, exag)
    return componer(tinte(z, rampa), sombra, fuerza), z, f


def imagen_equirect(
    z: np.ndarray, lats: np.ndarray, paso: float, rampa, exag: float, fuerza: float
) -> np.ndarray:
    dx_m = (paso * 111320 * np.cos(np.radians(lats)))[:, None]
    dy_m = paso * 110574
    return componer(tinte(z, rampa), sombreado(z, dx_m, dy_m, exag), fuerza)


# -------------------------------------------------------------------------- rio


def rio_paraguay(http: httpx.Client, bbox: tuple) -> tuple[list[dict], dict]:
    log("[rios] Natural Earth 10m rivers + lake centerlines")
    r = http.get(NE_RIOS)
    r.raise_for_status()
    d = json.loads(r.content.decode("utf-8"))
    area = box(*bbox)
    feats: list[dict] = []
    info: dict = {}
    for f in d["features"]:
        p = f["properties"]
        g = shape(f["geometry"])
        nombre = p.get("name")
        # NE agrupa el sistema Paraguay-Parana en un solo rasgo (rivernum 36, rotulado "Parana"):
        # su primer tramo de 964 vertices va de las nacientes del Paraguay (Mato Grosso) hasta
        # la confluencia con el Parana (-58.6, -27.3). Se identifica por geometria, no por nombre.
        if p.get("rivernum") == 36 and p.get("scalerank") == 2 and g.geom_type == "MultiLineString":
            tronco = max(g.geoms, key=lambda s: len(s.coords))
            if tronco.coords[0][1] > -16 and tronco.coords[-1][1] < -26:
                feats.append(("Rio Paraguay", "principal", tronco))
                info["paraguay_vertices"] = len(tronco.coords)
                info["paraguay_inicio"] = [round(c, 4) for c in tronco.coords[0]]
                info["paraguay_fin"] = [round(c, 4) for c in tronco.coords[-1]]
        elif nombre == "Pilcomayo" and g.intersects(area):
            feats.append(("Rio Pilcomayo", "afluente", g))
    if not any(n == "Rio Paraguay" for n, _, _ in feats):
        raise RuntimeError("Natural Earth: no se encontro el tronco del rio Paraguay")
    salida = []
    for nombre, rol, g in feats:
        g = g.intersection(area)
        if g.is_empty:
            continue
        if g.geom_type == "MultiLineString":
            g = linemerge(g)
        d2 = json.loads(json.dumps(g.simplify(0.003).__geo_interface__))
        d2["coordinates"] = json.loads(json.dumps(d2["coordinates"]))
        salida.append(
            {
                "type": "Feature",
                "properties": {
                    "id": nombre.split()[-1].lower(),
                    "nombre": nombre.replace("Rio", "Río"),
                    "rol": rol,
                    "fuente": "Natural Earth",
                },
                "geometry": d2,
            }
        )
    return salida, info


# ------------------------------------------------------------------------- main


def escribir_json(ruta: Path, obj) -> int:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return ruta.stat().st_size


def coleccion(feats, nombre, fuente, licencia, nota):
    return {
        "type": "FeatureCollection",
        "name": nombre,
        "metadata": {
            "categoria": CATEGORIA,
            "fuente": fuente,
            "licencia": licencia,
            "fecha_descarga": FECHA,
            "crs": "EPSG:4326",
            "nota": nota,
        },
        "features": feats,
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--paso-local", type=float, default=None, help="intervalo (m) de las curvas locales"
    )
    args = ap.parse_args()
    resumen: dict = {}
    manifiesto: list[dict] = []
    with httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(120.0, connect=30.0),
        follow_redirects=True,
    ) as http:
        # ------------------------------------------------------------------ cuenca
        log(f"[cuenca] DEM terrarium z{Z_CUENCA}, bbox {CUENCA}")
        mc = descargar_mosaico(http, CUENCA, Z_CUENCA)
        lons_m, lats_m = malla(CUENCA, PASO_MALLA)
        zm = gauss(muestrear(mc, lons_m, lats_m), 0.7)
        dm = np.round(zm * 10).astype("<i2")
        lons_c, lats_c = malla(CUENCA, PASO_CURVAS)
        zc = gauss(muestrear(mc, lons_c, lats_c), 1.0)
        zmin, zmax = float(zc.min()), float(zc.max())
        log(
            f"  elevacion (suavizada) min {zmin:.1f} m  max {zmax:.1f} m; malla 3D {len(lons_m)}x{len(lats_m)}"
        )
        malla_json = {
            "categoria": CATEGORIA,
            "fuente": "AWS Terrain Tiles (terrarium) z7",
            "fecha_descarga": FECHA,
            "bbox": list(CUENCA),
            "nx": len(lons_m),
            "ny": len(lats_m),
            "paso_grados": PASO_MALLA,
            "filas": "norte a sur",
            "unidad": "decimetros (int16 little-endian en base64)",
            "min_m": round(float(zm.min()), 1),
            "max_m": round(float(zm.max()), 1),
            "datos_b64": base64.b64encode(dm.tobytes()).decode("ascii"),
        }
        tam_malla = escribir_json(SALIDA / "dem_cuenca_malla.json", malla_json)
        feats = contornos_a_features(
            zc, lons_c, lats_c, NIVELES_CUENCA, MAESTRAS_CUENCA, 0.01, 0.12, "curvas cuenca"
        )
        tam_cc = escribir_json(
            SALIDA / "curvas_cuenca.geojson",
            coleccion(
                feats,
                "curvas_cuenca",
                "AWS Terrain Tiles (terrarium) z7",
                "Ver atribucion de AWS Terrain Tiles en LEEME.md",
                "Curvas cada 25 m hasta 200 m y cada 100 m por encima; suavizadas; no usar para cotas de inundacion.",
            ),
        )
        # tinte equirrectangular (3D y SVG) y Mercator (MapLibre del panel)
        lons_t, lats_t = malla(CUENCA, PASO_TINTE)
        zt = gauss(muestrear(mc, lons_t, lats_t), 0.8)
        rgba = imagen_equirect(zt, lats_t, PASO_TINTE, RAMPA_CUENCA, 12.0, 0.55)
        tam_tinte = png_escribir(SALIDA / "tinte_cuenca.png", rgba)
        rgba_m, _, f_m = imagen_mercator(mc, CUENCA, 520, RAMPA_CUENCA, 12.0, 0.55, 0.8)
        tam_tinte_m = png_escribir(SALIDA / "tinte_cuenca_mercator.png", rgba_m)
        # rio
        rios, info_rio = rio_paraguay(http, CUENCA)
        tam_rio = escribir_json(
            SALIDA / "rio_paraguay.geojson",
            coleccion(
                rios,
                "rio_paraguay",
                "Natural Earth 10m rivers + lake centerlines",
                "Dominio publico (Natural Earth)",
                "Escala 1:10M. Rasgo del sistema Paraguay-Parana de Natural Earth recortado al tronco Mato Grosso -> confluencia; "
                "mas el Pilcomayo. No es el cauce detallado: la linea puede apartarse varios km del rio real.",
            ),
        )
        resumen["cuenca"] = {
            "bbox": list(CUENCA),
            "zoom": Z_CUENCA,
            "tiles": mc["n_tiles"],
            "min_m": round(zmin, 1),
            "max_m": round(zmax, 1),
            "malla": [len(lons_m), len(lats_m)],
            "curvas_niveles": len(feats),
            "bytes": {
                "malla": tam_malla,
                "curvas": tam_cc,
                "tinte": tam_tinte,
                "tinte_mercator": tam_tinte_m,
                "rio": tam_rio,
            },
        }
        mf = {
            "id": "relieve_cuenca",
            "nombre": "Relieve de la cuenca (DEM, curvas de nivel, rio Paraguay)",
            "url": TILES_URL + f" (z{Z_CUENCA}); " + NE_RIOS,
            "licencia": "AWS Terrain Tiles: ver LEEME.md; Natural Earth: dominio publico",
            "bbox": list(CUENCA),
            "zoom": Z_CUENCA,
            "tiles": mc["n_tiles"],
            "elevacion_min_m": round(zmin, 1),
            "elevacion_max_m": round(zmax, 1),
            "intervalo_curvas": "25 m hasta 200 m; 100 m por encima (maestras 100/200/300/500/700/1000)",
            "rampa": RAMPA_CUENCA,
            "tinte_mercator": {"archivo": "relieve/tinte_cuenca_mercator.png", "px": [rgba_m.shape[1], rgba_m.shape[0]], "factor_px": f_m},
            "rio": info_rio,
            "archivos": [
                "relieve/dem_cuenca_malla.json", "relieve/curvas_cuenca.geojson", "relieve/tinte_cuenca.png",
                "relieve/tinte_cuenca_mercator.png", "relieve/rio_paraguay.geojson",
            ],
            "fecha_descarga": FECHA, "categoria": CATEGORIA, "estado": "ok", "fuente_usada": "primaria", "notas":
            "Elevaciones suavizadas (precision vertical de varios metros). Rio de Natural Earth 1:10M (el tronco Paraguay va rotulado "
            "'Parana' en esa fuente por ser un solo sistema). Departamentos: reutiliza departamentos.geojson (IGN).",
        }  # fmt: skip
        manifiesto.append(mf)

        # ------------------------------------------------------------------- local
        margen = 0.01
        caja = (
            CORREDOR[0] - margen,
            CORREDOR[1] - margen,
            CORREDOR[2] + margen,
            CORREDOR[3] + margen,
        )
        log(f"[local] DEM terrarium z{Z_LOCAL}, corredor {CORREDOR}")
        ml = descargar_mosaico(http, caja, Z_LOCAL)
        lons_l, lats_l = malla(caja, PASO_LOCAL)
        crudo = muestrear(ml, lons_l, lats_l)
        zl = gauss(crudo, SIGMA_LOCAL)
        # recorte al corredor exacto
        mi = (lons_l >= CORREDOR[0]) & (lons_l <= CORREDOR[2])
        mj = (lats_l >= CORREDOR[1]) & (lats_l <= CORREDOR[3])
        zl_c = zl[np.ix_(mj, mi)]
        crudo_c = crudo[np.ix_(mj, mi)]
        lons_c2, lats_c2 = lons_l[mi], lats_l[mj]
        p2, p98 = float(np.percentile(zl_c, 2)), float(np.percentile(zl_c, 98))
        # Ruido del DEM: desvio entre el valor crudo y el suavizado.
        ruido = float(np.std(crudo_c - zl_c))
        log(
            f"  corredor: min {zl_c.min():.1f} max {zl_c.max():.1f} p2 {p2:.1f} p98 {p98:.1f} (suavizado); ruido (desvio crudo-suavizado) {ruido:.2f} m"
        )
        paso_l = args.paso_local or PASO_CURVAS_LOCAL
        n0 = math.floor(zl_c.min() / paso_l) * paso_l
        niveles = [
            round(v, 3)
            for v in np.arange(n0, zl_c.max() + paso_l, paso_l)
            if zl_c.min() < v < zl_c.max()
        ]
        maestras = {v for v in niveles if abs((v / (5 * paso_l)) - round(v / (5 * paso_l))) < 1e-6}
        feats_l = contornos_a_features(
            zl_c, lons_c2, lats_c2, niveles, maestras, 0.0004, 0.01, "curvas local"
        )
        tam_cl = escribir_json(
            SALIDA / "curvas_local.geojson",
            coleccion(
                feats_l,
                "curvas_local",
                "AWS Terrain Tiles (terrarium) z11",
                "Ver atribucion de AWS Terrain Tiles en LEEME.md",
                f"Curvas cada {paso_l:g} m sobre un DEM de ~75 m suavizado (sigma {SIGMA_LOCAL} celdas, ~300 m). "
                "La precision vertical del DEM es de varios metros: las curvas muestran el gradiente regional, no cotas de terreno ni de inundacion.",
            ),
        )
        rampa_local = [
            (p2 + (p98 - p2) * k / (len(COLORES_LOCAL) - 1), c) for k, c in enumerate(COLORES_LOCAL)
        ]
        rgba_l, z_l_img, f_l = imagen_mercator(
            ml, CORREDOR, 330, rampa_local, 40.0, 0.35, SIGMA_LOCAL / 2
        )
        tam_tl = png_escribir(SALIDA / "tinte_local_mercator.png", rgba_l)
        resumen["local"] = {
            "bbox": list(CORREDOR), "zoom": Z_LOCAL, "tiles": ml["n_tiles"], "min_m": round(float(zl_c.min()), 1),
            "max_m": round(float(zl_c.max()), 1), "p2": round(p2, 1), "p98": round(p98, 1), "ruido_m": round(ruido, 2),
            "intervalo_m": paso_l, "niveles": len(feats_l), "bytes": {"curvas": tam_cl, "tinte": tam_tl},
        }  # fmt: skip
        manifiesto.append(
            {
                "id": "relieve_local",
                "nombre": "Relieve local del corredor de los sectores K10 (DEM z11, curvas de nivel)",
                "url": TILES_URL + f" (z{Z_LOCAL})",
                "licencia": "AWS Terrain Tiles: ver LEEME.md",
                "bbox": list(CORREDOR),
                "zoom": Z_LOCAL,
                "tiles": ml["n_tiles"],
                "elevacion_min_m": round(float(zl_c.min()), 1),
                "elevacion_max_m": round(float(zl_c.max()), 1),
                "rampa_p2_p98_m": [round(p2, 1), round(p98, 1)],
                "intervalo_curvas": f"{paso_l:g} m (maestras cada {5 * paso_l:g} m)",
                "ruido_dem_m": round(ruido, 2),
                "rampa": rampa_local,
                "archivos": ["relieve/curvas_local.geojson", "relieve/tinte_local_mercator.png"],
                "fecha_descarga": FECHA,
                "categoria": CATEGORIA,
                "estado": "ok",
                "fuente_usada": "primaria",
                "notas": "DEM de ~75 m suavizado; precision vertical de varios metros. Muestra el gradiente regional de la llanura, "
                "no cotas de inundacion: el umbral de los sectores sigue siendo la altura de escala de K10 (SIMULADO).",
            }  # fmt: skip
        )

    # meta para el frontend (una sola fuente de verdad de rampas, rangos y atribucion)
    meta = {
        "categoria": CATEGORIA,
        "fecha_descarga": FECHA,
        "atribucion": "Mapzen/AWS Terrain Tiles (terrarium); datos de elevacion SRTM (NASA/USGS) y otras fuentes; "
        "rio: Natural Earth (dominio publico); departamentos: IGN.",
        "cuenca": {"bbox": list(CUENCA), "zoom": Z_CUENCA, "min_m": round(zmin, 1), "max_m": round(zmax, 1), "rampa": RAMPA_CUENCA,
                   "intervalo": "25 m (< 200 m) y 100 m (>= 200 m)"},
        "local": {"bbox": list(CORREDOR), "zoom": Z_LOCAL, "min_m": round(float(zl_c.min()), 1), "max_m": round(float(zl_c.max()), 1),
                  "rampa": rampa_local, "intervalo_m": paso_l, "ruido_dem_m": round(ruido, 2)},
    }  # fmt: skip
    escribir_json(SALIDA / "meta.json", meta)

    ruta_man = GEO / "manifiesto.json"
    man = json.loads(ruta_man.read_text(encoding="utf-8"))
    ids = {m["id"] for m in manifiesto}
    man["capas"] = [c for c in man["capas"] if c["id"] not in ids] + manifiesto
    ruta_man.write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

    log("\nResumen:")
    log(json.dumps(resumen, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
