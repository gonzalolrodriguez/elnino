#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI LAB Misión: Código Formosa · Operación Agua — El Niño bajo auditoría
Preparación del kit de datos (K1, K2, K3) y de las claves de las pruebas 1 y 4.

Uso (correr el 2/11/2026, con la fecha de corte 2026-10-31):

  python3 preparar_kit.py descargar --corte 2026-10-31
  python3 preparar_kit.py plantar   --corte 2026-10-31
  python3 preparar_kit.py claves    --corte 2026-10-31
  python3 preparar_kit.py validar   --corte 2026-10-31 --entrega equipo3.csv

  Prueba sin red (serie sintética, solo para verificar el flujo):
  python3 preparar_kit.py descargar --corte 2026-10-31 --sintetico
  python3 preparar_kit.py plantar   --corte 2026-10-31
  python3 preparar_kit.py claves    --corte 2026-10-31

Carpetas que genera:
  original/   descarga intacta de la API del INA + hash SHA-256 (no se toca)
  kit/        archivos que van a la plataforma (K1 con errores, K2 limpia, K3 umbrales)
  claves/     serie limpia, log de errores y claves de validación (acceso restringido)

Requiere: pandas, requests  (pip install pandas requests)
Fuente: Instituto Nacional del Agua – Sistema de Información y Alerta Hidrológico
        https://alerta.ina.gob.ar  (API pública, sin registro)
"""
import argparse, hashlib, io, json, random, sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

API_DATOS = "https://alerta.ina.gob.ar/pub/datos/datos"
API_ESTACIONES = "https://alerta.ina.gob.ar/pub/datos/estaciones&format=json"
ESTACIONES = {"formosa": 57, "pilcomayo": 55}   # siteCode INA (red de escalas de Prefectura)
VAR_ALTURA = 2                                   # varId: altura hidrométrica
INICIO = "2006-01-01"
NIVELES_REFERENCIA = {                           # respaldo si el catálogo no trae los umbrales
    "formosa":   {"aguas_bajas": 1.60, "alerta": 7.80, "evacuacion": 8.30},
    "pilcomayo": {"aguas_bajas": 1.40, "alerta": 5.35, "evacuacion": 6.00},
}
SEMILLA = 20261121   # reproducible: misma semilla, mismos errores plantados

# Cantidades de errores plantados (si se cambian, cambian las claves: avisar a Push)
N_DUPLICADOS = 12
N_FECHAS_MIXTAS = 40
N_HUECOS = 25
N_COMA_DECIMAL = 3
TRAMO_CM = ("2011-03-01", "2011-03-31")
ANIO_HUECOS = 2018
ANIO_VALOR_IMPOSIBLE = 2012
VALOR_IMPOSIBLE = 98.1


# ----------------------------------------------------------------------------- utilidades
def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def carpetas(base: Path):
    d = {k: base / k for k in ("original", "kit", "claves")}
    for p in d.values():
        p.mkdir(parents=True, exist_ok=True)
    return d


def leer_csv_ina(texto: str) -> pd.DataFrame:
    """Lee el CSV de la API del INA de forma defensiva.
    - El encabezado puede venir con prefijo '###'.
    - Se detectan la columna de fecha (la que parsea como datetime) y la de valor (numérica).
    Devuelve DataFrame con columnas: fecha (datetime), altura_m (float).
    """
    lineas = [l for l in texto.splitlines() if l.strip()]
    if not lineas:
        raise SystemExit("La respuesta de la API vino vacía.")
    lineas[0] = lineas[0].lstrip("#").strip()
    sep = ";" if lineas[0].count(";") > lineas[0].count(",") else ","
    df = pd.read_csv(io.StringIO("\n".join(lineas)), sep=sep)
    df.columns = [str(c).strip().lower() for c in df.columns]

    col_fecha = next((c for c in df.columns if any(k in c for k in ("fecha", "time", "date"))), None)
    if col_fecha is None:
        for c in df.columns:
            if pd.to_datetime(df[c], errors="coerce").notna().mean() > 0.9:
                col_fecha = c; break
    col_valor = next((c for c in df.columns if any(k in c for k in ("valor", "value", "altura", "nivel"))), None)
    if col_valor is None:
        for c in df.columns:
            if c != col_fecha and pd.to_numeric(df[c], errors="coerce").notna().mean() > 0.9:
                col_valor = c; break
    if col_fecha is None or col_valor is None:
        raise SystemExit(f"No pude identificar columnas de fecha/valor. Columnas: {list(df.columns)}")

    out = pd.DataFrame({
        "fecha": pd.to_datetime(df[col_fecha], errors="coerce", utc=True).dt.tz_convert(None),
        "altura_m": pd.to_numeric(df[col_valor], errors="coerce"),
    }).dropna()
    return out


def a_diaria(df: pd.DataFrame, agregacion: str) -> pd.DataFrame:
    """Lleva la serie a un valor por día. Hay tramos subdiarios (por ejemplo 2016, cada 3 h).
    'max' conserva el pico del día (coincide con la lectura de crecida que informa el INA);
    'mean' promedia. La elección se documenta en el kit."""
    d = df.copy()
    d["fecha"] = d["fecha"].dt.normalize()
    g = d.groupby("fecha")["altura_m"]
    s = g.max() if agregacion == "max" else g.mean()
    return s.round(2).reset_index()


def serie_sintetica(corte: date) -> pd.DataFrame:
    """Serie de prueba (NO son datos reales): ciclo anual + picos en ene-2016 y jun-2019 + ascenso oct-2026."""
    rnd = random.Random(1)
    fechas = pd.date_range(INICIO, corte, freq="D")
    vals = []
    for f in fechas:
        base = 3.2 + 1.4 * __import__("math").sin((f.dayofyear - 150) / 365 * 6.283)
        if date(2015, 11, 1) <= f.date() <= date(2016, 2, 29):
            base += 5.5 * (1 - abs((f - pd.Timestamp("2016-01-06")).days) / 60)
        if date(2019, 4, 15) <= f.date() <= date(2019, 7, 20):
            base += 5.2 * (1 - abs((f - pd.Timestamp("2019-06-03")).days) / 48)
        if date(2026, 10, 1) <= f.date() <= corte:
            base = 2.37 + 0.114 * (f.date() - date(2026, 10, 1)).days
        vals.append(round(base + rnd.uniform(-0.05, 0.05), 2))
    df = pd.DataFrame({"fecha": fechas, "altura_m": vals})
    df.loc[df["fecha"] == "2016-01-06", "altura_m"] = 9.81
    df.loc[df["fecha"] == "2019-06-03", "altura_m"] = 9.72
    return df


# ----------------------------------------------------------------------------- comandos
def cmd_descargar(args):
    d = carpetas(args.base)
    corte = args.corte
    if args.sintetico:
        print("⚠ Modo sintético: se generan series de prueba, NO datos reales.")
        for nombre in ESTACIONES:
            df = serie_sintetica(corte)
            if nombre == "pilcomayo":
                df["altura_m"] = (df["altura_m"] * 0.65).round(2)
            p = d["original"] / f"{nombre}_{INICIO}_{corte}_RAW.csv"
            df.to_csv(p, index=False)
            print("  escrito", p)
        est = {"formosa": {"siteCode": 57, "nombre": "FORMOSA", **NIVELES_REFERENCIA["formosa"]},
               "pilcomayo": {"siteCode": 55, "nombre": "PUERTO PILCOMAYO", **NIVELES_REFERENCIA["pilcomayo"]}}
    else:
        import requests
        est = {}
        for nombre, code in ESTACIONES.items():
            url = f"{API_DATOS}&timeStart={INICIO}&timeEnd={corte}&siteCode={code}&varId={VAR_ALTURA}&format=csv"
            print("descargando", url)
            r = requests.get(url, timeout=120); r.raise_for_status()
            p = d["original"] / f"{nombre}_{INICIO}_{corte}_RAW.csv"
            p.write_text(r.text, encoding="utf-8")
            print("  escrito", p, "sha256", sha256(p)[:16], "…")
        print("descargando catálogo de estaciones")
        r = requests.get(API_ESTACIONES, timeout=120); r.raise_for_status()
        (d["original"] / "estaciones_INA.json").write_text(r.text, encoding="utf-8")
        cat = r.json()
        items = cat if isinstance(cat, list) else cat.get("features", cat.get("data", []))
        for nombre, code in ESTACIONES.items():
            hit = None
            for it in items:
                props = it.get("properties", it) if isinstance(it, dict) else {}
                if str(props.get("siteCode", props.get("id", ""))) == str(code):
                    hit = props; break
            est[nombre] = {"siteCode": code, "catalogo": hit, **NIVELES_REFERENCIA[nombre]}
            if hit is None:
                print(f"  ⚠ siteCode {code} no encontrado en el catálogo: se usan los umbrales de referencia")
    # hashes y manifiesto
    manifiesto = {"fecha_corte": str(corte), "descargado": datetime.now().isoformat(timespec="seconds"),
                  "fuente": "INA – SIyAH, alerta.ina.gob.ar", "sintetico": bool(args.sintetico),
                  "archivos": {p.name: sha256(p) for p in d["original"].glob("*") if p.is_file()}}
    (d["original"] / "MANIFIESTO.json").write_text(json.dumps(manifiesto, indent=2, ensure_ascii=False))
    (d["kit"] / "estaciones_umbrales.json").write_text(json.dumps(
        {"fecha_corte": str(corte), "fuente": "INA – SIyAH (red de escalas de Prefectura Naval)", "unidad": "m",
         "categoria": "Dato observado", "estaciones": est}, indent=2, ensure_ascii=False))
    print("✔ descarga congelada. Manifiesto:", d["original"] / "MANIFIESTO.json")


def cargar_original(d, nombre, corte, agregacion):
    p = d["original"] / f"{nombre}_{INICIO}_{corte}_RAW.csv"
    if not p.exists():
        raise SystemExit(f"Falta {p}. Corré primero: descargar --corte {corte}")
    return a_diaria(leer_csv_ina(p.read_text(encoding="utf-8")), agregacion)


def cmd_plantar(args):
    d = carpetas(args.base)
    corte = args.corte
    rnd = random.Random(SEMILLA)
    limpia = cargar_original(d, "formosa", corte, args.agregacion)
    limpia = limpia.sort_values("fecha").reset_index(drop=True)
    limpia.to_csv(d["claves"] / "formosa_alturas_LIMPIA.csv", index=False, date_format="%Y-%m-%d")

    pil = cargar_original(d, "pilcomayo", corte, args.agregacion).sort_values("fecha")
    pil.to_csv(d["kit"] / "pilcomayo_alturas.csv", index=False, date_format="%Y-%m-%d")

    log = {"fecha_corte": str(corte), "semilla": SEMILLA, "agregacion_diaria": args.agregacion, "errores": {}}
    raw = limpia.copy()
    raw["fecha_txt"] = raw["fecha"].dt.strftime("%Y-%m-%d")
    raw["altura_txt"] = raw["altura_m"].map(lambda v: f"{v:.2f}")

    # b) tramo en centímetros
    m = (raw["fecha"] >= TRAMO_CM[0]) & (raw["fecha"] <= TRAMO_CM[1])
    raw.loc[m, "altura_txt"] = (raw.loc[m, "altura_m"] * 100).round(0).astype(int).astype(str)
    log["errores"]["unidad_cm"] = {"desde": TRAMO_CM[0], "hasta": TRAMO_CM[1], "registros": int(m.sum())}

    # e) un valor imposible en una fecha cualquiera del año elegido (no en el máximo)
    cand = raw.index[raw["fecha"].dt.year == ANIO_VALOR_IMPOSIBLE].tolist()
    i_imp = rnd.choice(cand)
    raw.loc[i_imp, "altura_txt"] = f"{VALOR_IMPOSIBLE:.1f}"
    log["errores"]["valor_imposible"] = {"fecha": raw.loc[i_imp, "fecha_txt"], "valor_plantado": VALOR_IMPOSIBLE,
                                         "valor_real": float(raw.loc[i_imp, "altura_m"])}

    # d) huecos
    cand = [i for i in raw.index[raw["fecha"].dt.year == ANIO_HUECOS] if i != i_imp]
    idx_huecos = sorted(rnd.sample(cand, N_HUECOS))
    raw.loc[idx_huecos, "altura_txt"] = ""
    log["errores"]["huecos"] = {"anio": ANIO_HUECOS, "cantidad": N_HUECOS, "fechas": raw.loc[idx_huecos, "fecha_txt"].tolist()}

    # f) coma decimal
    usados = set(idx_huecos) | {i_imp} | set(raw.index[m])
    cand = [i for i in raw.index if i not in usados]
    idx_coma = sorted(rnd.sample(cand, N_COMA_DECIMAL))
    raw.loc[idx_coma, "altura_txt"] = raw.loc[idx_coma, "altura_txt"].str.replace(".", ",", regex=False)
    log["errores"]["coma_decimal"] = {"cantidad": N_COMA_DECIMAL, "fechas": raw.loc[idx_coma, "fecha_txt"].tolist()}
    usados |= set(idx_coma)

    # c) fechas en formato DD/MM/AAAA
    cand = [i for i in raw.index if i not in usados]
    idx_mix = sorted(rnd.sample(cand, N_FECHAS_MIXTAS))
    raw.loc[idx_mix, "fecha_txt"] = raw.loc[idx_mix, "fecha"].dt.strftime("%d/%m/%Y")
    log["errores"]["fechas_formato_mixto"] = {"cantidad": N_FECHAS_MIXTAS, "formato": "DD/MM/AAAA",
                                              "fechas_iso": raw.loc[idx_mix, "fecha"].dt.strftime("%Y-%m-%d").tolist()}
    usados |= set(idx_mix)

    # a) duplicados con valor distinto (filas adicionales)
    cand = [i for i in raw.index if i not in usados]
    idx_dup = sorted(rnd.sample(cand, N_DUPLICADOS))
    filas_dup = raw.loc[idx_dup].copy()
    filas_dup["altura_txt"] = filas_dup["altura_m"].map(lambda v: f"{v + rnd.choice([-1, 1]) * rnd.uniform(0.3, 0.8):.2f}")
    log["errores"]["duplicados"] = {"fechas_duplicadas": N_DUPLICADOS, "filas_adicionales": N_DUPLICADOS,
                                    "fechas": raw.loc[idx_dup, "fecha"].dt.strftime("%Y-%m-%d").tolist()}

    salida = pd.concat([raw, filas_dup]).sort_values(["fecha"], kind="stable")
    salida = salida.reset_index(drop=True)   # las filas duplicadas quedan junto a su original: se detectan por fecha
    # g) encabezado con '###' y columna 'calidad' vacía
    cuerpo = "\n".join(f"{f};{a};" for f, a in zip(salida["fecha_txt"], salida["altura_txt"]))
    texto = f"### fecha;altura;calidad\n{cuerpo}\n"
    k1 = d["kit"] / "formosa_alturas_RAW.csv"
    k1.write_text(texto, encoding="utf-8")
    log["errores"]["encabezado"] = {"prefijo": "###", "columna_vacia": "calidad", "separador": ";"}
    log["registros_limpios"] = int(len(limpia))
    log["registros_K1"] = int(len(salida))
    log["sha256_K1"] = sha256(k1)
    (d["claves"] / "log_errores.json").write_text(json.dumps(log, indent=2, ensure_ascii=False))
    print("✔ K1 escrito:", k1, f"({len(salida)} filas; serie limpia {len(limpia)})")
    print("✔ K2 escrito:", d["kit"] / "pilcomayo_alturas.csv")
    print("✔ log de errores (CLAVE):", d["claves"] / "log_errores.json")


def cmd_claves(args):
    d = carpetas(args.base)
    corte = args.corte
    p = d["claves"] / "formosa_alturas_LIMPIA.csv"
    if not p.exists():
        raise SystemExit("Falta la serie limpia. Corré primero: plantar")
    s = pd.read_csv(p, parse_dates=["fecha"]).sort_values("fecha")
    niveles = json.loads((d["kit"] / "estaciones_umbrales.json").read_text())["estaciones"]["formosa"]
    imax = s["altura_m"].idxmax()
    fmax, vmax = s.loc[imax, "fecha"], float(s.loc[imax, "altura_m"])
    dias_max = s.loc[s["altura_m"] == vmax, "fecha"].dt.strftime("%Y-%m-%d").tolist()

    def valor_en(f):
        r = s.loc[s["fecha"] == pd.Timestamp(f), "altura_m"]
        return float(r.iloc[0]) if len(r) else None

    h_ini, h_fin = valor_en(date(corte.year, corte.month, 1)), valor_en(corte)
    dias = (corte - date(corte.year, corte.month, 1)).days
    tasa = round((h_fin - h_ini) * 100 / dias, 1) if None not in (h_ini, h_fin) else None
    margen = round(niveles["evacuacion"] - h_fin, 2) if h_fin is not None else None
    log = json.loads((d["claves"] / "log_errores.json").read_text())
    claves = {
        "fecha_corte": str(corte),
        "P1": {
            "codigo": f"{fmax:%Y-%m};{vmax:.2f}",
            "maximo_historico_m": vmax, "fechas_del_maximo": dias_max,
            "duplicados_fechas": log["errores"]["duplicados"]["fechas_duplicadas"],
            "tramo_en_cm": f'{log["errores"]["unidad_cm"]["desde"]} a {log["errores"]["unidad_cm"]["hasta"]}',
            "valor_imposible_fecha": log["errores"]["valor_imposible"]["fecha"],
            "huecos": log["errores"]["huecos"]["cantidad"],
            "fechas_formato_mixto": log["errores"]["fechas_formato_mixto"]["cantidad"],
            "coma_decimal": log["errores"]["coma_decimal"]["cantidad"],
        },
        "P4": {
            "formula_tasa": f"(altura {corte} − altura {corte.year}-{corte.month:02d}-01) / {dias} días, en cm/día",
            "altura_inicio_mes": h_ini, "altura_corte": h_fin,
            "tasa_cm_dia": tasa, "tolerancia_tasa": 1.0,
            "margen_evacuacion_m": margen, "tolerancia_margen": 0.05,
            "nivel_evacuacion": niveles["evacuacion"], "nivel_alerta": niveles["alerta"],
        },
        "verificacion_manual": {
            "comparar_con_reporte_INA_del_corte": h_fin,
            "maximo_2016_esperado": "9,81 m (5-6/01/2016) según INA",
            "maximo_2019_esperado": "9,72 m (2-4/06/2019) según INA",
            "max_2016_en_serie": float(s.loc[(s["fecha"].dt.year == 2016), "altura_m"].max()),
            "max_2019_en_serie": float(s.loc[(s["fecha"].dt.year == 2019), "altura_m"].max()),
        },
    }
    (d["claves"] / "claves_P1_P4.json").write_text(json.dumps(claves, indent=2, ensure_ascii=False))
    print(json.dumps(claves, indent=2, ensure_ascii=False))
    print("✔ claves escritas:", d["claves"] / "claves_P1_P4.json")


def cmd_validar(args):
    """Valida el CSV corregido que entrega un equipo (Prueba 1)."""
    d = carpetas(args.base)
    limpia = pd.read_csv(d["claves"] / "formosa_alturas_LIMPIA.csv", parse_dates=["fecha"])
    texto = Path(args.entrega).read_text(encoding="utf-8")
    errores = []
    try:
        e = pd.read_csv(io.StringIO(texto))
    except Exception as ex:
        print("✘ no se pudo leer como CSV con coma:", ex); sys.exit(1)
    if list(e.columns) != ["fecha", "altura_m"]:
        errores.append(f"columnas esperadas fecha,altura_m; recibidas {list(e.columns)}")
    else:
        f = pd.to_datetime(e["fecha"], format="%Y-%m-%d", errors="coerce")
        if f.isna().any(): errores.append(f"{int(f.isna().sum())} fechas no están en formato ISO AAAA-MM-DD")
        if f.duplicated().any(): errores.append(f"{int(f.duplicated().sum())} fechas duplicadas")
        v = pd.to_numeric(e["altura_m"], errors="coerce")
        if v.isna().any(): errores.append(f"{int(v.isna().sum())} valores no numéricos o vacíos (¿coma decimal?)")
        if (v > 20).any(): errores.append("hay valores físicamente imposibles (> 20 m)")
        comp = limpia.merge(pd.DataFrame({"fecha": f, "v": v}), on="fecha", how="left")
        dif = (comp["altura_m"] - comp["v"]).abs()
        n_mal = int((dif > 0.011).sum() + comp["v"].isna().sum())
        if n_mal: errores.append(f"{n_mal} registros difieren de la serie limpia (tolerancia 0,01 m) o faltan")
    if errores:
        print("✘ ENTREGA NO VÁLIDA"); [print("  -", x) for x in errores]; sys.exit(1)
    print("✔ ENTREGA VÁLIDA: formato correcto y coincide con la serie limpia")


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description="Preparación del kit de datos de AI LAB Misión: Código Formosa")
    ap.add_argument("comando", choices=["descargar", "plantar", "claves", "validar"])
    ap.add_argument("--corte", type=lambda s: date.fromisoformat(s), required=True, help="fecha de corte, AAAA-MM-DD")
    ap.add_argument("--base", type=Path, default=Path("datos_ailab"), help="carpeta de trabajo")
    ap.add_argument("--agregacion", choices=["max", "mean"], default="max", help="cómo llevar tramos subdiarios a diario")
    ap.add_argument("--sintetico", action="store_true", help="serie de prueba sin red (NO datos reales)")
    ap.add_argument("--entrega", help="CSV corregido de un equipo (comando validar)")
    a = ap.parse_args()
    {"descargar": cmd_descargar, "plantar": cmd_plantar, "claves": cmd_claves, "validar": cmd_validar}[a.comando](a)


if __name__ == "__main__":
    main()
