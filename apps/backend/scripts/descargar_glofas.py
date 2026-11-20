"""Caudal diario modelado del río Paraguay (GloFAS, Copernicus EMS) vía la Flood API de Open-Meteo.

Genera ``data/processed/glofas_formosa.json`` y ``data/processed/glofas_pilcomayo.json`` y agrega
la entrada correspondiente a ``data/processed/LEEME_glofas.md``.

Fuente: https://flood-api.open-meteo.com/v1/flood (sin clave; datos de GloFAS v4, Copernicus Emergency
Management Service, vía Open-Meteo, licencia CC BY 4.0). Resolución de la grilla: 0,05° (~5 km); la API
ajusta cada punto pedido a la celda más cercana y el script registra la celda realmente usada.

Qué se guarda y por qué:

* ``modelado``: caudal diario (m³/s) del 01/01/2006 al 31/10/2026 (corte). Es caudal MODELADO, no
  observado, y no es un pronóstico oficial.
* ``posterior_al_corte``: fechas posteriores al corte con las estadísticas del ensamble (p25, p75, mín.,
  máx., mediana). La API **no permite pedir el pronóstico "tal como se emitió" el 31/10/2026**: solo sirve
  la ejecución vigente al momento de la descarga. Por eso esas fechas se guardan aparte, con la fecha y
  hora de descarga, y el backend solo las expone con ``PERMITIR_DATOS_POST_CORTE=true``.

Uso (raíz del repositorio, con el venv del backend):

    python apps/backend/scripts/descargar_glofas.py [--hasta-pronostico 2027-01-31]
"""

# ruff: noqa: E501  (textos largos de documentacion)
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import UTC, date, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
SALIDA = RAIZ / "data" / "processed"

URL_API = "https://flood-api.open-meteo.com/v1/flood"
CORTE = date(2026, 10, 31)
INICIO = date(2006, 1, 1)
ESTADISTICAS = (
    "river_discharge_p25",
    "river_discharge_p75",
    "river_discharge_min",
    "river_discharge_max",
    "river_discharge_median",
)
# Coordenadas de K3 (INA / Prefectura).
PUNTOS = {
    "formosa": {"nombre": "Puerto Formosa (K3, siteCode 57)", "lat": -26.183, "lon": -58.183},
    "pilcomayo": {"nombre": "Puerto Pilcomayo (K3, siteCode 55)", "lat": -25.367, "lon": -57.65},
}
LICENCIA = (
    "CC BY 4.0 · GloFAS / Copernicus Emergency Management Service (datos) y Open-Meteo (API). "
    "Uso no comercial."
)
FUENTE = (
    "GloFAS v4 (Copernicus Emergency Management Service) vía Open-Meteo Flood API "
    "(https://open-meteo.com/en/docs/flood-api)"
)


def pedir(punto: dict, variables: list[str], desde: date, hasta: date) -> tuple[dict, str]:
    params = {
        "latitude": punto["lat"],
        "longitude": punto["lon"],
        "daily": ",".join(variables),
        "start_date": desde.isoformat(),
        "end_date": hasta.isoformat(),
        "timezone": "GMT",
    }
    url = f"{URL_API}?{urllib.parse.urlencode(params, safe=',')}"
    req = urllib.request.Request(url, headers={"User-Agent": "evacuafor-prototipo/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310 (URL fija, https)
        return json.loads(r.read()), url


def construir(clave: str, hasta_pronostico: date) -> dict:
    punto = PUNTOS[clave]
    hist, url_hist = pedir(punto, ["river_discharge"], INICIO, CORTE)
    time.sleep(1)
    post, url_post = pedir(
        punto,
        ["river_discharge", *ESTADISTICAS],
        date.fromordinal(CORTE.toordinal() + 1),
        hasta_pronostico,
    )
    d = hist["daily"]
    p = post["daily"]
    return {
        "estacion": clave,
        "nombre": punto["nombre"],
        "unidad": "m³/s",
        "variable": "river_discharge (caudal diario modelado)",
        "categoria": "DOCUMENTO DE REFERENCIA",
        "fuente": FUENTE,
        "licencia": LICENCIA,
        "api": URL_API,
        "fecha_descarga_utc": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "fecha_corte": CORTE.isoformat(),
        "punto_solicitado": {"lat": punto["lat"], "lon": punto["lon"]},
        "celda_usada": {
            "lat": hist["latitude"],
            "lon": hist["longitude"],
            "elevacion_m": hist.get("elevation"),
            "resolucion": "0,05° (~5 km, GloFAS v4); la API toma la celda más cercana",
        },
        "solicitudes": [url_hist, url_post],
        "modelado": {
            "descripcion": "Caudal diario modelado (reanálisis/análisis GloFAS) hasta el corte.",
            "fechas": d["time"],
            "caudal_m3s": d["river_discharge"],
        },
        "posterior_al_corte": {
            "descripcion": (
                "Ejecución vigente al momento de la descarga; NO es el pronóstico emitido el "
                "31/10/2026 (la API no lo ofrece). Posterior al corte: apagado por defecto."
            ),
            "fechas": p["time"],
            "caudal_m3s": p["river_discharge"],
            "p25": p["river_discharge_p25"],
            "p75": p["river_discharge_p75"],
            "minimo": p["river_discharge_min"],
            "maximo": p["river_discharge_max"],
            "mediana": p["river_discharge_median"],
        },
    }


LEEME = """# Caudal modelado GloFAS (data/processed/glofas_*.json)

Generado por `apps/backend/scripts/descargar_glofas.py` el {fecha}.

* Fuente: {fuente}.
* Licencia / atribución: {licencia}
* Categoría: DOCUMENTO DE REFERENCIA (datos globales modelados; no observados ni pronóstico oficial).
* Variable: `river_discharge`, caudal diario en m³/s. No es altura de escala: no hay curva
  altura-caudal oficial en el kit, así que no se convierte a metros.
* Período `modelado`: 01/01/2006 a 31/10/2026 (corte). Zona horaria GMT.
* Celdas usadas: {celdas}
* `posterior_al_corte`: la API no ofrece el pronóstico tal como se emitió el 31/10/2026, solo la
  ejecución vigente al descargar. Esas fechas se guardan aparte y el backend las expone solo con
  `PERMITIR_DATOS_POST_CORTE=true`, rotuladas con la fecha y hora de descarga.
"""


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--hasta-pronostico", type=date.fromisoformat, default=date(2027, 1, 31))
    args = ap.parse_args()
    SALIDA.mkdir(parents=True, exist_ok=True)
    celdas = []
    ultimo = None
    for clave in PUNTOS:
        datos = construir(clave, args.hasta_pronostico)
        ruta = SALIDA / f"glofas_{clave}.json"
        ruta.write_text(
            json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
        )
        c = datos["celda_usada"]
        celdas.append(f"{clave}: lat {c['lat']}, lon {c['lon']}, elevación {c['elevacion_m']} m")
        ultimo = datos
        print(f"{ruta.name}: {len(datos['modelado']['fechas'])} días modelados")
        time.sleep(1)
    (SALIDA / "LEEME_glofas.md").write_text(
        LEEME.format(
            fecha=ultimo["fecha_descarga_utc"],
            fuente=FUENTE,
            licencia=LICENCIA,
            celdas="; ".join(celdas),
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
