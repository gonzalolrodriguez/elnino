"""Agua observada por satelite (Sentinel-1 y Sentinel-2) sobre el corredor de Puerto Formosa.

Genera las capas de ``data/geo/satelite/``: una mascara de agua vectorizada por escena
(``agua_<sensor>_<fecha>.geojson``), una vista previa PNG, ``resumen.csv``, ``manifiesto.json`` y
``LEEME.md``.

Fuente: Microsoft Planetary Computer (catalogo STAC publico, token SAS anonimo, sin cuenta):
``sentinel-2-l2a`` (Copernicus Sentinel-2, nivel 2A) y ``sentinel-1-rtc`` (Sentinel-1 con
correccion radiometrica del terreno, producto de Microsoft). Respaldo documentado: Earth Search (AWS).

Metodo (ver ``LEEME.md``):

* Rejilla comun UTM 21S (EPSG:32721) a 20 m sobre el corredor; las escenas se leen por ventanas desde
  los COG remotos (``WarpedVRT``), una escena a la vez, para acotar la memoria.
* Sentinel-2: MNDWI = (B03 - B11) / (B03 + B11) con mascara de nubes y sombras de la banda SCL;
  umbral de Otsu acotado cerca de 0.
* Sentinel-1: VV en dB, filtro de mediana 3x3, umbral de Otsu acotado.
* Se vectoriza el agua, se descartan poligonos y huecos menores a ~0,5 ha y se simplifica.

Uso (desde la raiz del repositorio, con el venv del backend):

    python apps/backend/scripts/descargar_satelite.py [--solo ID ...] [--listar]

Dependencias adicionales: ``apps/backend/scripts/requirements-satelite.txt``.

Reglas: ninguna escena posterior al corte (31/10/2026); es producto derivado de una imagen
(DOCUMENTO DE REFERENCIA), no un pronostico, y no esta validado a campo.
"""

# ruff: noqa: E501  (textos largos de documentacion y notas del manifiesto)
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import struct
import sys
import time
import warnings
import zlib
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[3]
SALIDA = RAIZ / "data" / "geo" / "satelite"
K1_DIARIO = RAIZ / "data" / "processed" / "k1_diario.csv"

CORTE = date(2026, 10, 31)
STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
CATEGORIA = "DOCUMENTO DE REFERENCIA (imagen) · producto derivado (máscara de agua)"
FECHA_DESCARGA = date.today().isoformat()

# Corredor de Puerto Formosa: incluye los sectores K10 (-58.205..-58.128, -26.222..-26.150) y el rio.
AOI = (-58.40, -26.40, -57.95, -25.95)  # lon_min, lat_min, lon_max, lat_max
CRS_TRABAJO = "EPSG:32721"
RESOLUCION_M = 20.0

MIN_AREA_M2 = 5000.0  # ~0,5 ha: poligonos y huecos menores se descartan
SIMPLIFICAR_M = (
    15.0,
    30.0,
    60.0,
    120.0,
)  # tolerancias progresivas hasta entrar en el limite de tamano
LIMITE_BYTES = 500_000
FACTOR_VISTA = 4

BORDE_PX = 25  # pixeles (500 m) descartados junto al borde de la franja con dato

# Clases SCL no validas: 0 sin dato, 1 saturado, 3 sombra de nube, 8-9 nube, 10 cirrus, 11 nieve.
SCL_INVALIDAS = (0, 1, 3, 8, 9, 10, 11)
UMBRAL_MNDWI = (-0.15, 0.15)  # limites del umbral de Otsu (cerca de 0)
UMBRAL_VV_DB = (-21.0, -14.0)  # limites del umbral de Otsu para VV (dB)

# Escenas elegidas por el equipo (decisiones del 19/11/2026). Una fila por producto.
ESCENAS = [
    {
        "id": "s2_2019-10-09",
        "sensor": "S2",
        "fecha": "2019-10-09",
        "evento": "Línea de base de aguas bajas (octubre de 2019)",
    },
    {
        "id": "s1_2019-10-07",
        "sensor": "S1",
        "fecha": "2019-10-07",
        "evento": "Línea de base de aguas bajas (octubre de 2019)",
    },
    {
        "id": "s1_2016-01-09",
        "sensor": "S1",
        "fecha": "2016-01-09",
        "evento": "Pico de 2016 (cuatro días después del máximo del 05/01)",
    },
    {
        "id": "s2_2016-01-23",
        "sensor": "S2",
        "fecha": "2016-01-23",
        "evento": "Descenso posterior al pico de 2016 (18 días después del máximo; la escena del 10/01 no cubre la zona)",
    },
    {
        "id": "s1_2019-05-28",
        "sensor": "S1",
        "fecha": "2019-05-28",
        "evento": "Subida previa al pico de 2019",
    },
    {
        "id": "s2_2019-06-03",
        "sensor": "S2",
        "fecha": "2019-06-03",
        "evento": "Pico de 2019 (un día después del máximo del 02/06)",
    },
    {
        "id": "s1_2026-10-25",
        "sensor": "S1",
        "fecha": "2026-10-25",
        "evento": "Octubre de 2026 (previo al corte)",
    },
    {
        "id": "s2_2026-10-26",
        "sensor": "S2",
        "fecha": "2026-10-26",
        "evento": "Octubre de 2026 (previo al corte)",
    },
]
COLECCION = {"S1": "sentinel-1-rtc", "S2": "sentinel-2-l2a"}
METODO = {
    "S1": "Sentinel-1 RTC · VV en dB · mediana 3x3 · umbral de Otsu",
    "S2": "Sentinel-2 L2A · MNDWI (B03, B11) · máscara SCL de nubes y sombras · umbral de Otsu",
}


def fijar_proj() -> None:
    """Usa la base PROJ que trae rasterio: PostgreSQL/PostGIS instala otra, incompatible, y la anuncia por entorno."""
    import importlib.util

    spec = importlib.util.find_spec("rasterio")
    if spec and spec.submodule_search_locations:
        datos = Path(next(iter(spec.submodule_search_locations))) / "proj_data"
        if datos.is_dir():
            os.environ["PROJ_DATA"] = os.environ["PROJ_LIB"] = str(datos)


def log(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------------- funciones puras


def validar_fecha(fecha: str | date) -> date:
    """Convierte a ``date`` y rechaza lo posterior al corte de datos (31/10/2026)."""
    d = date.fromisoformat(fecha) if isinstance(fecha, str) else fecha
    if d > CORTE:
        raise ValueError(f"fecha {d.isoformat()} posterior al corte {CORTE.isoformat()}")
    return d


def umbral_otsu(valores: np.ndarray, minimo: float, maximo: float, bins: int = 256) -> float:
    """Umbral de Otsu del histograma de ``valores`` (finitos) recortados a [minimo, maximo]."""
    v = np.asarray(valores, dtype=np.float64).ravel()
    v = v[np.isfinite(v)]
    v = v[(v >= minimo) & (v <= maximo)]
    if v.size == 0:
        raise ValueError("sin valores validos para el umbral")
    hist, bordes = np.histogram(v, bins=bins, range=(minimo, maximo))
    centros = (bordes[:-1] + bordes[1:]) / 2
    p = hist / hist.sum()
    w0 = np.cumsum(p)
    w1 = 1.0 - w0
    m = np.cumsum(p * centros)
    mt = m[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        sigma = (mt * w0 - m) ** 2 / (w0 * w1)
    sigma[~np.isfinite(sigma)] = -1.0
    return float(centros[int(np.argmax(sigma))])


def acotar_umbral(umbral: float, limites: tuple[float, float]) -> tuple[float, bool]:
    """Devuelve (umbral acotado, si se recorto)."""
    u = min(max(umbral, limites[0]), limites[1])
    return u, u != umbral


def mndwi(verde: np.ndarray, swir: np.ndarray) -> np.ndarray:
    """MNDWI = (verde - SWIR) / (verde + SWIR); NaN donde la suma no es positiva o falta un dato."""
    g = np.asarray(verde, dtype=np.float32)
    s = np.asarray(swir, dtype=np.float32)
    suma = g + s
    with np.errstate(divide="ignore", invalid="ignore"):
        r = (g - s) / suma
    r[~(suma > 0)] = np.nan
    return r.astype(np.float32)


def reflectancia_s2(dn: np.ndarray, linea_base: float) -> np.ndarray:
    """DN de Sentinel-2 L2A a reflectancia; desde el baseline 04.00 hay un desfase de -1000."""
    offset = -1000.0 if linea_base >= 4.0 else 0.0
    r = (np.asarray(dn, dtype=np.float32) + offset) / 10000.0
    r[np.asarray(dn) == 0] = np.nan
    return np.clip(r, 0.0, None)


def a_db(potencia: np.ndarray) -> np.ndarray:
    """Retrodispersion lineal (potencia) a dB; NaN donde no es positiva."""
    p = np.asarray(potencia, dtype=np.float32)
    out = np.full(p.shape, np.nan, dtype=np.float32)
    ok = p > 0
    out[ok] = 10.0 * np.log10(p[ok])
    return out


def mediana_3x3(a: np.ndarray, bloque: int = 256) -> np.ndarray:
    """Filtro de mediana 3x3 por bloques de filas (memoria acotada). Los NaN se conservan."""
    nan = np.isnan(a)
    rel = np.where(nan, np.float32(np.nanmedian(a)) if (~nan).any() else 0.0, a).astype(np.float32)
    p = np.pad(rel, 1, mode="edge")
    out = np.empty_like(rel)
    for i0 in range(0, rel.shape[0], bloque):
        i1 = min(i0 + bloque, rel.shape[0])
        pila = np.stack(
            [p[i0 + di : i1 + di, dj : dj + rel.shape[1]] for di in range(3) for dj in range(3)]
        )
        out[i0:i1] = np.median(pila, axis=0)
    out[nan] = np.nan
    return out


def erosionar_valido(valido: np.ndarray, px: int) -> np.ndarray:
    """Erosiona la zona con dato ``px`` pixeles (borde de la franja del satelite: allí el dato es ruido).

    El borde de la rejilla no se erosiona (se considera valido hacia afuera).
    """
    if px <= 0:
        return valido
    v = np.pad(valido, px, mode="edge")
    out = v.copy()
    for d in range(1, px + 1):
        out[d:, :] &= v[:-d, :]
        out[:-d, :] &= v[d:, :]
    v = out.copy()
    for d in range(1, px + 1):
        out[:, d:] &= v[:, :-d]
        out[:, :-d] &= v[:, d:]
    return out[px:-px, px:-px]


def k1_mas_cercano(
    serie: dict[date, float], fecha: date, max_dias: int = 7
) -> tuple[date, float] | None:
    """Dia de K1 con altura mas cercano a ``fecha`` (empate: el anterior); None si no hay en el rango."""
    for delta in range(0, max_dias + 1):
        for d in (fecha - timedelta(days=delta), fecha + timedelta(days=delta)):
            if d in serie:
                return d, serie[d]
    return None


def cargar_k1(ruta: Path = K1_DIARIO) -> dict[date, float]:
    serie: dict[date, float] = {}
    with ruta.open(encoding="utf-8", newline="") as f:
        for fila in csv.DictReader(f):
            if fila["altura_max_m"].strip():
                serie[date.fromisoformat(fila["fecha"])] = float(fila["altura_max_m"])
    return serie


def redondear(c, nd: int = 5):
    return (
        [round(c[0], nd), round(c[1], nd)]
        if isinstance(c[0], float)
        else [redondear(x, nd) for x in c]
    )


# ------------------------------------------------------------------------ geometria y salida


def malla_trabajo():
    """Rejilla UTM 21S a 20 m que cubre AOI: (transform, ancho, alto)."""
    from rasterio.transform import from_origin
    from rasterio.warp import transform_bounds

    x0, y0, x1, y1 = transform_bounds("EPSG:4326", CRS_TRABAJO, *AOI)
    x0 = math.floor(x0 / RESOLUCION_M) * RESOLUCION_M
    y1 = math.ceil(y1 / RESOLUCION_M) * RESOLUCION_M
    ancho = int(math.ceil((x1 - x0) / RESOLUCION_M))
    alto = int(math.ceil((y1 - y0) / RESOLUCION_M))
    return from_origin(x0, y1, RESOLUCION_M, RESOLUCION_M), ancho, alto


def vectorizar(
    agua: np.ndarray, transform, min_area: float = MIN_AREA_M2, simplificar: float = 15.0
):
    """Mascara booleana -> (MultiPolygon UTM simplificado, area m2 antes de simplificar) o (None, 0)."""
    from rasterio.features import shapes
    from shapely.geometry import MultiPolygon, Polygon, shape

    polis = []
    area = 0.0
    for geom, v in shapes(agua.astype(np.uint8), mask=agua, transform=transform, connectivity=8):
        if v != 1:
            continue
        g = shape(geom)
        huecos = [r for r in g.interiors if Polygon(r).area >= min_area]
        p = Polygon(g.exterior, huecos)
        if p.area < min_area:
            continue
        area += p.area
        p = p.simplify(simplificar, preserve_topology=True)
        if not p.is_empty:
            polis.append(p)
    if not polis:
        return None, 0.0
    return MultiPolygon(
        [q for p in polis for q in (p.geoms if p.geom_type == "MultiPolygon" else [p])]
    ), area


def a_wgs84(geom) -> dict:
    from rasterio.warp import transform_geom

    d = transform_geom(CRS_TRABAJO, "EPSG:4326", json.loads(json.dumps(geom.__geo_interface__)))
    d["coordinates"] = redondear(json.loads(json.dumps(d["coordinates"])))
    return d


def png_escribir(ruta: Path, rgba: np.ndarray) -> int:
    alto, _, _ = rgba.shape
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
        + trozo(b"IHDR", struct.pack(">IIBBBBB", rgba.shape[1], alto, 8, 6, 0, 0, 0))
        + trozo(b"IDAT", zlib.compress(filas, 9))
        + trozo(b"IEND", b"")
    )
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    return len(datos)


def reducir(a: np.ndarray, f: int) -> np.ndarray:
    """Promedio por bloques f x f (recorta el borde sobrante); NaN se ignoran."""
    h, w = (a.shape[0] // f) * f, (a.shape[1] // f) * f
    b = a[:h, :w].reshape(h // f, f, w // f, f).astype(np.float32)
    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(np.nanmean(b, axis=3), axis=1)


def vista_previa(
    indice: np.ndarray, agua: np.ndarray, nube: np.ndarray | None, lim: tuple[float, float]
) -> np.ndarray:
    """RGBA reducido: indice en grises, agua en azul, nube/sombra en magenta, sin dato transparente."""
    f = FACTOR_VISTA
    ind = reducir(indice, f)
    wat = reducir(agua.astype(np.float32), f) >= 0.5
    gris = np.clip((ind - lim[0]) / (lim[1] - lim[0]), 0, 1)
    gris = np.nan_to_num(gris, nan=0.0)
    g = (60 + 150 * gris).astype(np.uint8)
    rgba = np.stack([g, g, g, np.full_like(g, 255)], axis=-1)
    rgba[np.isnan(ind)] = (0, 0, 0, 0)
    if nube is not None:
        nub = reducir(nube.astype(np.float32), f) >= 0.5
        rgba[nub] = (205, 90, 190, 255)
    rgba[wat] = (30, 110, 220, 255)
    return rgba


# ------------------------------------------------------------------------ lectura de escenas


def abrir_catalogo():
    import planetary_computer as pc
    import pystac_client

    return pystac_client.Client.open(STAC_URL, modifier=pc.sign_inplace)


def buscar(catalogo, sensor: str, fecha: date) -> list:
    validar_fecha(fecha)
    dia = f"{fecha.isoformat()}T00:00:00Z/{fecha.isoformat()}T23:59:59Z"
    items = list(catalogo.search(collections=[COLECCION[sensor]], bbox=AOI, datetime=dia).items())
    for it in items:  # defensa adicional: nada posterior al corte
        validar_fecha(it.datetime.date())
    return sorted(items, key=lambda i: i.id)


def leer_banda(href: str, transform, ancho: int, alto: int, remuestreo, dtype_nodata) -> np.ndarray:
    import rasterio
    from rasterio.vrt import WarpedVRT

    ultimo = None
    for intento in range(1, 4):
        try:
            with rasterio.open(href) as src:
                nodata = src.nodata if src.nodata is not None else dtype_nodata
                with WarpedVRT(
                    src, crs=CRS_TRABAJO, transform=transform, width=ancho, height=alto,
                    resampling=remuestreo, src_nodata=nodata, nodata=nodata,
                ) as vrt:  # fmt: skip
                    return vrt.read(1)
        except Exception as exc:  # noqa: BLE001
            ultimo = exc
            log(f"    intento {intento}/3 fallido: {exc!s:.120}")
            time.sleep(2 * intento)
    raise RuntimeError(f"no se pudo leer {href.split('?')[0]}: {ultimo}")


def procesar_s2(items: list, transform, ancho: int, alto: int):
    """Devuelve (indice MNDWI, nube_o_sombra, valido, info) combinando los tiles del dia."""
    from rasterio.enums import Resampling

    verde = np.full((alto, ancho), np.nan, dtype=np.float32)
    swir = np.full((alto, ancho), np.nan, dtype=np.float32)
    scl = np.zeros((alto, ancho), dtype=np.uint8)
    for it in items:
        base = float(it.properties.get("s2:processing_baseline", "5.0"))
        log(
            f"  tile {it.properties.get('s2:mgrs_tile', it.id[-22:-16])} (baseline {base}, nube {it.properties.get('eo:cloud_cover'):.1f} %)"
        )
        g = reflectancia_s2(
            leer_banda(it.assets["B03"].href, transform, ancho, alto, Resampling.average, 0), base
        )
        s = reflectancia_s2(
            leer_banda(it.assets["B11"].href, transform, ancho, alto, Resampling.average, 0), base
        )
        c = leer_banda(it.assets["SCL"].href, transform, ancho, alto, Resampling.nearest, 0).astype(
            np.uint8
        )
        nuevo = np.isnan(verde) & ~np.isnan(g) & ~np.isnan(s)
        verde[nuevo], swir[nuevo], scl[nuevo] = g[nuevo], s[nuevo], c[nuevo]
        del g, s, c
    con_dato = ~np.isnan(verde)
    con_dato = erosionar_valido(con_dato, BORDE_PX)
    verde[~con_dato] = np.nan
    nube = np.isin(scl, SCL_INVALIDAS) & con_dato
    ind = mndwi(verde, swir)
    del verde, swir
    ind[nube] = np.nan
    valido = ~np.isnan(ind)
    info = {
        "nube_pct": round(100.0 * float(nube.sum()) / max(int(con_dato.sum()), 1), 1),
        "nube_pct_escena": round(
            float(np.mean([it.properties.get("eo:cloud_cover", 0.0) for it in items])), 1
        ),
        "cobertura_pct": round(100.0 * float(con_dato.sum()) / con_dato.size, 1),
    }
    return ind, nube, valido, info


def procesar_s1(items: list, transform, ancho: int, alto: int):
    from rasterio.enums import Resampling

    vv = np.full((alto, ancho), np.nan, dtype=np.float32)
    for it in items:
        log(f"  frame {it.id[:60]}")
        p = leer_banda(
            it.assets["vv"].href, transform, ancho, alto, Resampling.average, -32768.0
        ).astype(np.float32)
        p[p <= -30000] = np.nan
        nuevo = np.isnan(vv) & ~np.isnan(p)
        vv[nuevo] = p[nuevo]
        del p
    db = a_db(vv)
    del vv
    db = mediana_3x3(db)
    db[~erosionar_valido(~np.isnan(db), BORDE_PX)] = np.nan
    valido = ~np.isnan(db)
    info = {
        "nube_pct": None,
        "nube_pct_escena": None,
        "cobertura_pct": round(100.0 * float(valido.mean()), 1),
    }
    return db, None, valido, info


def pico_memoria_mb() -> float | None:
    """Pico del conjunto de trabajo del proceso (Windows); None si no esta disponible."""
    try:
        import ctypes
        from ctypes import wintypes

        class PMC(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t),
                        ("PeakPagefileUsage", ctypes.c_size_t)]  # fmt: skip

        pmc = PMC()
        pmc.cb = ctypes.sizeof(PMC)
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.GetCurrentProcess.restype = wintypes.HANDLE
        h = k32.GetCurrentProcess()
        ps = ctypes.WinDLL("psapi", use_last_error=True)
        ps.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PMC), wintypes.DWORD]
        ps.GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb)
        return round(pmc.PeakWorkingSetSize / 1024 / 1024, 0)
    except Exception:  # noqa: BLE001
        return None


def procesar_escena(
    esc: dict, catalogo, transform, ancho: int, alto: int, k1: dict[date, float]
) -> dict:
    sensor, fecha = esc["sensor"], validar_fecha(esc["fecha"])
    log(f"[{esc['id']}] {sensor} {fecha} · {esc['evento']}")
    items = buscar(catalogo, sensor, fecha)
    if not items:
        raise RuntimeError(f"sin escenas {sensor} el {fecha}")
    if sensor == "S2":
        ind, nube, valido, info = procesar_s2(items, transform, ancho, alto)
        lim_otsu, lim_vista, nom_umbral = UMBRAL_MNDWI, (-0.6, 0.6), "MNDWI"
        # Otsu solo con pixeles validos y sobre el rango plausible del indice.
        crudo = umbral_otsu(ind[valido], -0.8, 0.8)
    else:
        ind, nube, valido, info = procesar_s1(items, transform, ancho, alto)
        lim_otsu, lim_vista, nom_umbral = UMBRAL_VV_DB, (-28.0, -2.0), "VV dB"
        crudo = umbral_otsu(ind[valido], -30.0, 0.0)
    umbral, recortado = acotar_umbral(crudo, lim_otsu)
    log(
        f"  umbral Otsu {crudo:.3f} -> usado {umbral:.3f} {nom_umbral}{' (recortado)' if recortado else ''}; cobertura {info['cobertura_pct']} %"
    )
    agua = (ind > umbral) if sensor == "S2" else (ind < umbral)
    agua &= valido

    multi, area_m2, tol, minimo, datos = None, 0.0, SIMPLIFICAR_M[0], MIN_AREA_M2, b""
    geom_wgs = None
    for tol in SIMPLIFICAR_M:
        for minimo in (MIN_AREA_M2, MIN_AREA_M2 * 4):
            multi, area_m2 = vectorizar(agua, transform, minimo, tol)
            if multi is None:
                continue
            geom_wgs = a_wgs84(multi)
            datos = json.dumps(geom_wgs, separators=(",", ":")).encode()
            if len(datos) < LIMITE_BYTES - 5000:
                break
        else:
            continue
        break
    if multi is None:
        raise RuntimeError("la mascara de agua quedo vacia")

    d_k1 = k1_mas_cercano(k1, fecha)
    fecha_k1, altura_k1 = (d_k1[0].isoformat(), d_k1[1]) if d_k1 else (None, None)
    props = {
        "id": esc["id"],
        "sensor": "Sentinel-1 (SAR, VV)" if sensor == "S1" else "Sentinel-2 (MSI, L2A)",
        "escena_id": "; ".join(it.id for it in items),
        "fecha_escena": fecha.isoformat(),
        "evento": esc["evento"],
        "nube_pct": info["nube_pct"],
        "nube_pct_escena": info["nube_pct_escena"],
        "cobertura_aoi_pct": info["cobertura_pct"],
        "metodo": METODO[sensor],
        "umbral": round(umbral, 3),
        "umbral_unidad": nom_umbral,
        "umbral_otsu_crudo": round(crudo, 3),
        "umbral_recortado": bool(recortado),
        "altura_k1_m": altura_k1,
        "fecha_k1": fecha_k1,
        "area_agua_km2": round(area_m2 / 1e6, 2),
        "categoria": CATEGORIA,
        "incertidumbre": (
            "Máscara de agua derivada con umbral automático (Otsu) a 20 m; no validada a campo. Puede confundir suelo muy húmedo y bañados "
            "con agua y omitir vegetación inundada (SAR y MNDWI). "
            + (
                "Ruido de moteado (speckle) filtrado con mediana 3x3. "
                if sensor == "S1"
                else f"Nubes y sombras enmascaradas ({info['nube_pct']} % de la zona con dato): esas zonas figuran sin agua, no como tierra seca. "
            )
            + (
                f"La escena cubre solo {info['cobertura_pct']} % de la zona. "
                if info["cobertura_pct"] < 95
                else ""
            )
            + "No es un pronóstico."
        ),
        "atribucion": f"Contiene datos Copernicus Sentinel modificados [{fecha.year}]",
        "fuente": f"Microsoft Planetary Computer ({COLECCION[sensor]})",
        "fecha_descarga": FECHA_DESCARGA,
    }
    nombre = f"agua_{sensor.lower()}_{fecha.isoformat()}"
    coleccion = {
        "type": "FeatureCollection",
        "name": nombre,
        "features": [{"type": "Feature", "properties": props, "geometry": geom_wgs}],
    }
    ruta = SALIDA / f"{nombre}.geojson"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(
        json.dumps(coleccion, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    tam = ruta.stat().st_size
    rgba = vista_previa(ind, agua, nube, lim_vista)
    tam_png = png_escribir(SALIDA / f"{nombre}.png", rgba)
    log(
        f"  agua {area_m2 / 1e6:.2f} km2 · {tam / 1024:.0f} KB geojson (tol {tol:g} m, min {minimo / 1e4:.1f} ha) · png {tam_png / 1024:.0f} KB · K1 {altura_k1} m el {fecha_k1}"
    )
    return {"props": props, "archivo": ruta.name, "vista": f"{nombre}.png", "bytes_geojson": tam, "bytes_png": tam_png,
            "simplificacion_m": tol, "area_minima_ha": minimo / 1e4, "assets": [it.id for it in items]}  # fmt: skip


LEEME = """# Agua observada por satélite (Sentinel-1 y Sentinel-2)

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Categoría: **{categoria}**. La imagen original es DOCUMENTO DE REFERENCIA; la máscara de agua es un producto derivado calculado por el equipo con el método de abajo. Generado el {fecha} con `apps/backend/scripts/descargar_satelite.py`.

## Archivos

- `agua_<sensor>_<fecha>.geojson`: una `Feature` MultiPolygon (EPSG:4326) por escena, con las propiedades `sensor`, `escena_id`, `fecha_escena`, `nube_pct`, `metodo`, `umbral`, `altura_k1_m`, `fecha_k1`, `area_agua_km2`, `categoria`, `incertidumbre`, `atribucion`.
- `agua_<sensor>_<fecha>.png`: vista previa (agua en azul; nube y sombra en magenta; el resto, el índice en grises).
- `resumen.csv`: fecha, sensor, área de agua en la zona (km2), altura K1 del día más cercano.
- `manifiesto.json`: fuentes, escenas, URLs, licencias y parámetros.

## Escenas

{tabla}

## Fuente y licencia

- Microsoft Planetary Computer, catálogo STAC público (`{stac}`), con token SAS anónimo; colecciones `sentinel-2-l2a` y `sentinel-1-rtc`.
- Sentinel-1 y Sentinel-2: datos del programa Copernicus de la Unión Europea, de acceso libre y gratuito. Atribución obligatoria: **"Contiene datos Copernicus Sentinel modificados [año]"** (cada archivo trae su año). `sentinel-1-rtc` es un producto de Microsoft (CC BY 4.0) derivado de Sentinel-1 GRD.
- Zona de trabajo: lon {a0}..{a2}, lat {a1}..{a3} (corredor de Puerto Formosa, incluye los sectores K10 y el río Paraguay), rejilla UTM 21S a 20 m.

## Método

1. Se leen por ventanas los COG remotos y se remuestrean a la rejilla de 20 m (promedio).
2. Sentinel-2: MNDWI = (B03 - B11) / (B03 + B11), con reflectancia corregida por el desfase de los baselines desde 04.00; se enmascaran las clases SCL sin dato, saturado, sombra de nube, nube y cirrus. Umbral de Otsu acotado a [{m0}, {m1}].
3. Sentinel-1: VV en dB, filtro de mediana 3x3 contra el moteado (speckle), umbral de Otsu acotado a [{v0}, {v1}] dB; es agua lo que queda por debajo.
4. Se vectoriza, se descartan polígonos y huecos de menos de ~0,5 ha y se simplifica la geometría (15 m o más según el tamaño; está en el manifiesto). Si el archivo supera 500 KB se aumenta la simplificación.

## Límites (leer antes de usar)

- **No es un pronóstico**: describe lo que vio el satélite ese día, no lo que pasará.
- **Sin validación a campo**: el umbral es automático (Otsu); la incertidumbre de la extensión es de varios píxeles (decenas de metros) en el borde y mayor en bañados.
- **Falsos positivos**: suelo muy húmedo, sombras de relieve o de nube mal enmascaradas, bañados y lagunas permanentes.
- **Falsos negativos**: vegetación inundada (monte, pajonal) que el radar en VV y el MNDWI no siempre detectan; agua turbia puede subestimarse en MNDWI.
- **SAR**: moteado (speckle), viento sobre el agua que la hace brillar, y suelos arenosos secos que pueden confundirse con agua.
- **Nubes** (Sentinel-2): las zonas enmascaradas figuran como "sin agua" en el GeoJSON; el porcentaje está en `nube_pct`. Algunas escenas no cubren toda la zona (`cobertura_aoi_pct`); en ese caso el área de agua es parcial.
- **Fechas**: la imagen no coincide exactamente con el pico del río; `altura_k1_m` es la máxima diaria de K1 (OBSERVADO) del día más cercano a la imagen (`fecha_k1`).
- Ningún dato es posterior al corte del 31/10/2026. No se cruza con los sectores K10 (SIMULADO): no se calculan porcentajes de sector anegado.
"""


def escribir_documentos(resultados: list[dict]) -> None:
    resultados = sorted(
        resultados, key=lambda r: (r["props"]["fecha_escena"], r["props"]["sensor"])
    )
    with (SALIDA / "resumen.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "fecha",
                "sensor",
                "area_agua_km2",
                "altura_k1_m",
                "fecha_k1",
                "nube_pct",
                "cobertura_aoi_pct",
                "archivo",
            ]
        )
        for r in resultados:
            p = r["props"]
            w.writerow(
                [
                    p["fecha_escena"],
                    p["sensor"].split(" ")[0],
                    p["area_agua_km2"],
                    p["altura_k1_m"],
                    p["fecha_k1"],
                    p["nube_pct"],
                    p["cobertura_aoi_pct"],
                    r["archivo"],
                ]
            )
    man = {
        "descripcion": "Agua observada por satélite (Sentinel-1/2) sobre el corredor de Puerto Formosa",
        "categoria": CATEGORIA,
        "fecha_descarga": FECHA_DESCARGA,
        "fecha_corte": CORTE.isoformat(),
        "fuente": {"catalogo_stac": STAC_URL, "colecciones": COLECCION, "respaldo": "Earth Search (AWS) https://earth-search.aws.element84.com/v1",
                   "licencia": "Copernicus Sentinel (libre y gratuito); sentinel-1-rtc: CC BY 4.0 (Microsoft)",
                   "atribucion": "Contiene datos Copernicus Sentinel modificados [año]"},
        "zona": {"bbox_wgs84": list(AOI), "crs_trabajo": CRS_TRABAJO, "resolucion_m": RESOLUCION_M},
        "parametros": {"area_minima_m2": MIN_AREA_M2, "umbral_mndwi_limites": list(UMBRAL_MNDWI), "umbral_vv_db_limites": list(UMBRAL_VV_DB),
                       "scl_invalidas": list(SCL_INVALIDAS), "limite_bytes_geojson": LIMITE_BYTES},
        "escenas": [
            {"id": r["props"]["id"], "archivo": r["archivo"], "vista": r["vista"], "escena_id": r["assets"], "bytes_geojson": r["bytes_geojson"],
             "bytes_png": r["bytes_png"], "simplificacion_m": r["simplificacion_m"], "area_minima_ha": r["area_minima_ha"], "propiedades": r["props"]}
            for r in resultados
        ],
        "estado": "ok",
    }  # fmt: skip
    (SALIDA / "manifiesto.json").write_text(
        json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    filas = [
        "| Fecha | Sensor | Evento | Agua en la zona (km2) | K1 (m, día) | Nube | Cobertura |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in resultados:
        p = r["props"]
        k1 = (
            f"{p['altura_k1_m']:.2f} ({p['fecha_k1']})".replace(".", ",")
            if p["altura_k1_m"] is not None
            else "sin dato"
        )
        nube = f"{p['nube_pct']} %" if p["nube_pct"] is not None else "n/c"
        filas.append(
            f"| {p['fecha_escena']} | {p['sensor'].split(' ')[0]} | {p['evento']} | {str(p['area_agua_km2']).replace('.', ',')} | {k1} | {nube} | {p['cobertura_aoi_pct']} % |"
        )
    (SALIDA / "LEEME.md").write_text(
        LEEME.format(categoria=CATEGORIA, fecha=FECHA_DESCARGA, tabla="\n".join(filas), stac=STAC_URL, a0=AOI[0], a1=AOI[1], a2=AOI[2], a3=AOI[3],
                     m0=UMBRAL_MNDWI[0], m1=UMBRAL_MNDWI[1], v0=UMBRAL_VV_DB[0], v1=UMBRAL_VV_DB[1]),
        encoding="utf-8",
    )  # fmt: skip


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--solo", nargs="*", help="ids de escena a procesar (por defecto, todas)")
    ap.add_argument(
        "--listar", action="store_true", help="solo busca y lista las escenas disponibles"
    )
    args = ap.parse_args()
    for e in ESCENAS:
        validar_fecha(e["fecha"])
    escenas = [e for e in ESCENAS if not args.solo or e["id"] in args.solo]
    fijar_proj()
    import rasterio

    catalogo = abrir_catalogo()
    if args.listar:
        for e in escenas:
            for it in buscar(catalogo, e["sensor"], date.fromisoformat(e["fecha"])):
                log(f"{e['id']}: {it.id}")
        return 0
    k1 = cargar_k1()
    transform, ancho, alto = malla_trabajo()
    log(f"Rejilla {ancho}x{alto} a {RESOLUCION_M:g} m ({CRS_TRABAJO})")
    t0 = time.time()
    resultados = []
    env = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff", "GDAL_HTTP_MAX_RETRY": "3",
           "GDAL_HTTP_RETRY_DELAY": "2", "GDAL_CACHEMAX": 128, "VSI_CACHE": "TRUE"}  # fmt: skip
    with rasterio.Env(**env):
        for e in escenas:
            resultados.append(procesar_escena(e, catalogo, transform, ancho, alto, k1))
    if not args.solo:
        escribir_documentos(resultados)
    log(
        f"\nListo en {time.time() - t0:.0f} s · pico de memoria {pico_memoria_mb()} MB · {datetime.now(UTC).date()}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
