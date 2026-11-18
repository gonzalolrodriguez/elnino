"""Limpieza de la serie K1 (altura hidrométrica de Puerto Formosa).

Reglas (LEEME_P1_PARTICIPANTES.txt y CLAUDE.md §4.5):

- Lectura con ``utf-8-sig`` (el CSV trae BOM).
- Se eliminan solo las filas totalmente idénticas (mismo ``obs_id`` y mismo contenido).
- Fechas a ``YYYY-MM-DD HH:MM:SS`` (``dd/mm/aaaa`` y ``aaaa/mm/dd``).
- Coma decimal a punto; centímetros a metros (÷100).
- Valor físicamente imposible: cuarentena (se conserva la fila, no se reemplaza).
- Los negativos y las varias mediciones del mismo día se conservan.
- No se interpola ni se inventa ningún dato faltante.

Uso: ``python -m app.ingest.limpieza_k1`` (desde ``apps/backend``).
"""

from __future__ import annotations

import csv
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

from app.config.settings import RAIZ_REPO

RUTA_ORIGINAL = RAIZ_REPO / "data" / "kit" / "P1_DATA_INTEGRITY_dataset_participantes_v1.csv"
RUTA_LIMPIO = RAIZ_REPO / "data" / "processed" / "k1_limpio.csv"
RUTA_DIARIO = RAIZ_REPO / "data" / "processed" / "k1_diario.csv"
RUTA_REGISTRO = RAIZ_REPO / "docs" / "registro_limpieza.md"

FECHA_INICIO = date(2006, 1, 1)
FECHA_FIN = date(2026, 10, 31)

# Cota máxima físicamente plausible para la escala (SUPUESTO; la serie válida llega a 9,81 m).
MAX_FISICO_M = 15.0

COLUMNAS_LIMPIO = [
    "obs_id",
    "timestart",
    "timeend",
    "valor_m",
    "valor_original",
    "unidad_original",
    "timeupdate",
    "calidad",
    "transformacion",
]
CALIDAD_VALIDO = "valido"
CALIDAD_CUARENTENA = "cuarentena"

FORMATO_ISO = "%Y-%m-%d %H:%M:%S"


@dataclass
class Resumen:
    """Conteos obtenidos de los datos (no valores asumidos)."""

    filas_originales: int = 0
    duplicados_identicos: int = 0
    obs_id_repetidos_distintos: int = 0
    fechas_ddmmaaaa: int = 0
    fechas_aaaammdd: int = 0
    coma_decimal: int = 0
    unidad_cm: int = 0
    cuarentena: list[dict] = field(default_factory=list)
    negativos: int = 0
    dias_con_varias_mediciones: int = 0
    filas_finales: int = 0
    filas_validas: int = 0
    dias_sin_dato_2018: list[date] = field(default_factory=list)
    dias_sin_dato_total: int = 0
    dias_sin_dato_por_anio: dict[int, int] = field(default_factory=dict)
    maximo_m: float = 0.0
    maximo_fechas: list[str] = field(default_factory=list)
    pico_2019_m: float = 0.0
    pico_2019_fecha: str = ""
    valor_2026_10_01: float | None = None
    valor_2026_10_31: float | None = None
    minimo_m: float = 0.0
    minimo_fecha: str = ""


# ---------------------------------------------------------------- funciones puras


def normalizar_fecha(texto: str) -> tuple[str, str | None]:
    """Devuelve (fecha ISO, tipo de transformación o None).

    Acepta ``YYYY-MM-DD HH:MM:SS``, ``dd/mm/YYYY HH:MM:SS`` y ``YYYY/mm/dd HH:MM:SS``.
    """
    texto = texto.strip()
    if "/" in texto:
        parte_fecha = texto.split(" ")[0]
        primero = parte_fecha.split("/")[0]
        if len(primero) == 4:
            dt = datetime.strptime(texto, "%Y/%m/%d %H:%M:%S")
            return dt.strftime(FORMATO_ISO), "fecha_aaaammdd"
        dt = datetime.strptime(texto, "%d/%m/%Y %H:%M:%S")
        return dt.strftime(FORMATO_ISO), "fecha_ddmmaaaa"
    dt = datetime.strptime(texto, FORMATO_ISO)
    return dt.strftime(FORMATO_ISO), None


def normalizar_valor(texto: str, unidad: str) -> tuple[float, list[str]]:
    """Convierte el valor a metros. Devuelve (valor_m, transformaciones aplicadas)."""
    transformaciones: list[str] = []
    crudo = texto.strip()
    if "," in crudo:
        crudo = crudo.replace(",", ".")
        transformaciones.append("coma_decimal")
    valor = float(crudo)
    unidad = unidad.strip().lower()
    if unidad == "cm":
        valor = valor / 100.0
        transformaciones.append("cm_a_m")
    elif unidad != "m":
        raise ValueError(f"Unidad no reconocida: {unidad!r}")
    return round(valor, 4), transformaciones


def es_valor_imposible(valor_m: float) -> bool:
    return valor_m > MAX_FISICO_M


def leer_original(ruta: Path = RUTA_ORIGINAL) -> list[dict]:
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def limpiar(filas: list[dict]) -> tuple[list[dict], Resumen]:
    """Aplica las reglas y devuelve (filas limpias ordenadas, resumen)."""
    resumen = Resumen(filas_originales=len(filas))

    # 1. Duplicados idénticos: misma fila completa. Mismo obs_id con contenido distinto se conserva
    #    y se informa (el LEEME pide revisar la unicidad, no descartar a ciegas).
    vistos: set[tuple] = set()
    ids_vistos: dict[str, tuple] = {}
    unicas: list[dict] = []
    for fila in filas:
        clave = tuple(
            fila[c]
            for c in ("obs_id", "timestart", "timeend", "valor", "unidad_registro", "timeupdate")
        )
        if clave in vistos:
            resumen.duplicados_identicos += 1
            continue
        vistos.add(clave)
        if fila["obs_id"] in ids_vistos:
            resumen.obs_id_repetidos_distintos += 1
        ids_vistos[fila["obs_id"]] = clave
        unicas.append(fila)

    limpias: list[dict] = []
    for fila in unicas:
        transformaciones: list[str] = []
        inicio, t1 = normalizar_fecha(fila["timestart"])
        fin, t2 = normalizar_fecha(fila["timeend"])
        if t1 or t2:
            tipo = t1 or t2
            transformaciones.append(tipo)
            if tipo == "fecha_ddmmaaaa":
                resumen.fechas_ddmmaaaa += 1
            else:
                resumen.fechas_aaaammdd += 1
        valor_m, tv = normalizar_valor(fila["valor"], fila["unidad_registro"])
        transformaciones.extend(tv)
        if "coma_decimal" in tv:
            resumen.coma_decimal += 1
        if "cm_a_m" in tv:
            resumen.unidad_cm += 1

        calidad = CALIDAD_VALIDO
        if es_valor_imposible(valor_m):
            calidad = CALIDAD_CUARENTENA
            transformaciones.append("cuarentena_valor_imposible")
        limpia = {
            "obs_id": fila["obs_id"],
            "timestart": inicio,
            "timeend": fin,
            "valor_m": f"{valor_m:g}",
            "valor_original": fila["valor"],
            "unidad_original": fila["unidad_registro"],
            "timeupdate": fila["timeupdate"],
            "calidad": calidad,
            "transformacion": "|".join(transformaciones),
        }
        limpias.append(limpia)

    limpias.sort(key=lambda r: (r["timestart"], r["obs_id"]))
    _completar_resumen(limpias, resumen)
    return limpias, resumen


def serie_diaria(limpias: list[dict]) -> dict[date, tuple[float, int]]:
    """Máximo diario y cantidad de mediciones válidas por día calendario (fecha de timestart)."""
    maximos: dict[date, float] = {}
    cantidades: Counter = Counter()
    for r in limpias:
        if r["calidad"] != CALIDAD_VALIDO:
            continue
        dia = datetime.strptime(r["timestart"], FORMATO_ISO).date()
        valor = float(r["valor_m"])
        maximos[dia] = max(valor, maximos.get(dia, valor))
        cantidades[dia] += 1
    return {d: (maximos[d], cantidades[d]) for d in maximos}


def _completar_resumen(limpias: list[dict], resumen: Resumen) -> None:
    resumen.filas_finales = len(limpias)
    validas = [r for r in limpias if r["calidad"] == CALIDAD_VALIDO]
    resumen.filas_validas = len(validas)
    resumen.cuarentena = [r for r in limpias if r["calidad"] == CALIDAD_CUARENTENA]
    resumen.negativos = sum(1 for r in validas if float(r["valor_m"]) < 0)

    por_dia: Counter = Counter(r["timestart"][:10] for r in limpias)
    resumen.dias_con_varias_mediciones = sum(1 for v in por_dia.values() if v > 1)

    diario = serie_diaria(limpias)
    todos = [FECHA_INICIO + timedelta(days=i) for i in range((FECHA_FIN - FECHA_INICIO).days + 1)]
    faltan = [d for d in todos if d not in diario]
    resumen.dias_sin_dato_total = len(faltan)
    resumen.dias_sin_dato_2018 = [d for d in faltan if d.year == 2018]
    por_anio: Counter = Counter(d.year for d in faltan)
    resumen.dias_sin_dato_por_anio = dict(sorted(por_anio.items()))

    max_valor = max(float(r["valor_m"]) for r in validas)
    resumen.maximo_m = max_valor
    resumen.maximo_fechas = sorted(
        r["timestart"] for r in validas if float(r["valor_m"]) == max_valor
    )
    v2019 = [r for r in validas if r["timestart"].startswith("2019")]
    pico = max(v2019, key=lambda r: float(r["valor_m"]))
    resumen.pico_2019_m = float(pico["valor_m"])
    resumen.pico_2019_fecha = pico["timestart"]
    minimo = min(validas, key=lambda r: float(r["valor_m"]))
    resumen.minimo_m = float(minimo["valor_m"])
    resumen.minimo_fecha = minimo["timestart"]
    resumen.valor_2026_10_01 = diario.get(date(2026, 10, 1), (None, 0))[0]
    resumen.valor_2026_10_31 = diario.get(date(2026, 10, 31), (None, 0))[0]


# ---------------------------------------------------------------- salidas


def escribir_limpio(limpias: list[dict], ruta: Path = RUTA_LIMPIO) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS_LIMPIO)
        w.writeheader()
        w.writerows(limpias)


def escribir_diario(limpias: list[dict], ruta: Path = RUTA_DIARIO) -> None:
    """Un renglón por día 2006-01-01..2026-10-31; sin dato = celdas vacías (no se interpola)."""
    diario = serie_diaria(limpias)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["fecha", "altura_max_m", "n_mediciones"])
        dia = FECHA_INICIO
        while dia <= FECHA_FIN:
            if dia in diario:
                valor, n = diario[dia]
                w.writerow([dia.isoformat(), f"{valor:g}", n])
            else:
                w.writerow([dia.isoformat(), "", ""])
            dia += timedelta(days=1)


def leer_diario(ruta: Path = RUTA_DIARIO) -> dict[date, float]:
    """Lee ``k1_diario.csv``; los días vacíos no aparecen en el resultado."""
    resultado: dict[date, float] = {}
    with ruta.open(encoding="utf-8", newline="") as f:
        for fila in csv.DictReader(f):
            if fila["altura_max_m"] != "":
                resultado[date.fromisoformat(fila["fecha"])] = float(fila["altura_max_m"])
    return resultado


def _rangos_consecutivos(dias: list[date]) -> list[tuple[date, date]]:
    rangos: list[tuple[date, date]] = []
    for d in sorted(dias):
        if rangos and d - rangos[-1][1] == timedelta(days=1):
            rangos[-1] = (rangos[-1][0], d)
        else:
            rangos.append((d, d))
    return rangos


def _coma(x: float | None) -> str:
    return "s/d" if x is None else f"{x:.2f}".replace(".", ",")


def generar_registro_markdown(resumen: Resumen) -> str:
    """Rellena la plantilla oficial ``registro_limpieza.md`` con los conteos obtenidos."""
    q = resumen.cuarentena[0] if resumen.cuarentena else None
    rangos_2018 = _rangos_consecutivos(resumen.dias_sin_dato_2018)
    if rangos_2018:
        primero, ultimo = rangos_2018[0][0], rangos_2018[-1][1]
        texto_2018 = (
            f"{len(rangos_2018)} tramos sin registro entre {primero.isoformat()} y "
            f"{ultimo.isoformat()}; el resto de 2018 tiene cobertura diaria"
        )
    else:
        texto_2018 = "sin huecos"
    por_anio = ", ".join(f"{a}: {n}" for a, n in resumen.dias_sin_dato_por_anio.items())
    fila_q = (
        f"| Valor físicamente imposible | valor > {MAX_FISICO_M:g} m frente a una serie cuyo "
        f"máximo válido es {_coma(resumen.maximo_m)} m ({q['timestart'][:10]}: "
        f"{q['valor_original']} {q['unidad_original']}) | {len(resumen.cuarentena)} | "
        "Cuarentena: la fila se conserva con `calidad=cuarentena`, no se reemplaza ni se "
        "corrige (falta evidencia; pendiente de verificación con la fuente INA) | "
        "Queda fuera del máximo diario; ese día sin otra medición figura vacío |"
        if q
        else "| Valor físicamente imposible | rango físico | 0 | — | — |"
    )
    maximo_fecha = ", ".join(sorted({f[:10] for f in resumen.maximo_fechas}))
    return f"""# Registro de limpieza de K1 · AI LAB Misión: Código Formosa
Herramienta: `python -m app.ingest.limpieza_k1` (Python, módulo estándar `csv`) · Equipo: Equipo 3 · Instituto Politécnico Formosa

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Entrada: `data/kit/P1_DATA_INTEGRITY_dataset_participantes_v1.csv` ({resumen.filas_originales} filas, UTF-8 con BOM, no se modifica). Salidas: `data/processed/k1_limpio.csv` y `data/processed/k1_diario.csv`. Los conteos se calcularon desde los datos al ejecutar el script.

| Problema encontrado en K1 | Cómo se detectó | Cantidad de registros afectados | Cómo se resolvió | Decisión que afecta a la serie |
|---|---|---|---|---|
| Filas duplicadas idénticas | mismo `obs_id` y contenido idéntico en todas las columnas | {resumen.duplicados_identicos} | Se conservó la primera aparición y se descartaron las repetidas | Sin efecto en valores; evita contar dos veces una medición |
| `obs_id` repetido con contenido distinto | unicidad de `obs_id` tras quitar idénticas | {resumen.obs_id_repetidos_distintos} | No hubo casos; de haberlos se conservarían y se informarían | Ninguna |
| Fechas en otro formato | patrón distinto de `YYYY-MM-DD HH:MM:SS` | {resumen.fechas_ddmmaaaa + resumen.fechas_aaaammdd} ({resumen.fechas_ddmmaaaa} `dd/mm/aaaa` y {resumen.fechas_aaaammdd} `aaaa/mm/dd`) | Se normalizaron a `YYYY-MM-DD HH:MM:SS` sin cambiar el instante | Las mediciones quedan en su día correcto |
| Coma decimal | valor con `,` | {resumen.coma_decimal} | Se reemplazó por punto | Valores recuperados sin alterar su magnitud |
| Unidad en centímetros | `unidad_registro = cm` | {resumen.unidad_cm} | Se dividió por 100 para expresar en metros | Valores alineados con la unidad canónica (m) |
{fila_q}
| Valores negativos | valor < 0 | {resumen.negativos} | Se conservaron (la escala puede registrar valores bajo cero; mínimo {_coma(resumen.minimo_m)} m el {resumen.minimo_fecha[:10]}) | Se mantienen en la serie |
| Varias mediciones el mismo día | conteo de registros por fecha | {resumen.dias_con_varias_mediciones} días | No son duplicados: se conservaron todas; el máximo diario usa la mayor válida | Serie diaria = máximo del día |
| Huecos de cobertura en 2018 | días calendario sin registro | {len(resumen.dias_sin_dato_2018)} días ({texto_2018}) | No se interpolaron ni se inventaron valores: quedan vacíos en `k1_diario.csv` | Las velocidades de ascenso no cruzan los huecos |

Días sin dato en toda la serie (2006-01-01 a 2026-10-31): {resumen.dias_sin_dato_total}. Por año: {por_anio}.

Comprobación final: máximo de la serie limpia = {_coma(resumen.maximo_m)} m en {maximo_fecha} (esperado: 9,81 m, enero de 2016) · cantidad de registros finales: {resumen.filas_finales} ({resumen.filas_validas} válidos + {len(resumen.cuarentena)} en cuarentena)

Otras comprobaciones: pico de 2019 = {_coma(resumen.pico_2019_m)} m ({resumen.pico_2019_fecha[:16]}; la fecha de la serie puede diferir un día de la citada en otros documentos por huso horario); 2026-10-01 = {_coma(resumen.valor_2026_10_01)} m; 2026-10-31 = {_coma(resumen.valor_2026_10_31)} m.

Categoría: `DATO OBSERVADO` con alteraciones pedagógicas deliberadas (no es una serie oficial ni apta para decisiones operativas).
"""


def ejecutar() -> Resumen:
    filas = leer_original()
    limpias, resumen = limpiar(filas)
    escribir_limpio(limpias)
    escribir_diario(limpias)
    RUTA_REGISTRO.parent.mkdir(parents=True, exist_ok=True)
    RUTA_REGISTRO.write_text(generar_registro_markdown(resumen), encoding="utf-8")
    return resumen


def main() -> None:
    r = ejecutar()
    print(f"Filas originales: {r.filas_originales}")
    print(f"Duplicados idénticos eliminados: {r.duplicados_identicos}")
    print(f"obs_id repetidos con contenido distinto: {r.obs_id_repetidos_distintos}")
    print(f"Fechas dd/mm/aaaa: {r.fechas_ddmmaaaa} · aaaa/mm/dd: {r.fechas_aaaammdd}")
    print(f"Coma decimal: {r.coma_decimal} · cm a m: {r.unidad_cm}")
    print(f"Cuarentena: {len(r.cuarentena)}")
    print(f"Negativos: {r.negativos} (mínimo {r.minimo_m} m el {r.minimo_fecha[:10]})")
    print(f"Días con varias mediciones: {r.dias_con_varias_mediciones}")
    print(f"Filas finales: {r.filas_finales} ({r.filas_validas} válidas)")
    print(f"Días sin dato 2018: {len(r.dias_sin_dato_2018)} · total: {r.dias_sin_dato_total}")
    print(f"Máximo: {r.maximo_m} m en {r.maximo_fechas}")
    print(f"Pico 2019: {r.pico_2019_m} m ({r.pico_2019_fecha})")
    print(f"2026-10-01: {r.valor_2026_10_01} · 2026-10-31: {r.valor_2026_10_31}")


if __name__ == "__main__":
    main()
