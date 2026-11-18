"""Ingesta pluviométrica (CLAUDE.md §8.8): validación, categoría, vecinos, planilla y exportación.

Reglas: celda vacía o ``mm = NULL`` es "sin medición" y **no** es cero; el origen de cada lectura
queda siempre registrado y visible. Los turnos son ``07`` y ``17`` (partes policiales); la planilla
UPCA es diaria y se guarda como turno ``DI`` (acumulado diario).
"""

from __future__ import annotations

import io
import statistics
import unicodedata
from datetime import date, datetime
from decimal import Decimal

import openpyxl
from geoalchemy2 import Geography
from geoalchemy2.shape import to_shape
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings, supuesto
from app.core import constantes
from app.db.modelos import LecturaLluvia, PuestoPluviometrico

TURNOS = ("07", "17")
TURNO_DIARIO = "DI"
ORIGENES = ("parte_policial", "carga_manual", "planilla_upca", "simulado")
MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]
MAX_FILAS_PLANILLA = 5000
MAX_BYTES_PLANILLA = 5 * 1024 * 1024


class ErrorLluvia(Exception):
    def __init__(self, estado: int, mensaje: str) -> None:
        super().__init__(mensaje)
        self.estado = estado
        self.mensaje = mensaje


def sin_tildes(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto.casefold()) if unicodedata.category(c) != "Mn"
    ).strip()


def categoria_y_fuente(puesto: PuestoPluviometrico, origen: str, fecha: date) -> tuple[str, str]:
    """SIMULADO si el puesto, el origen o la fecha (posterior al corte) lo son."""
    corte = date.fromisoformat(constantes.FECHA_CORTE)
    if puesto.categoria == "SIMULADO" or origen in ("simulado", "carga_manual") or fecha > corte:
        return "SIMULADO", f"{origen} · lectura de demostración (puesto, origen o fecha simulados)"
    return "DOCUMENTO DE REFERENCIA", f"{origen} · parte de lluvia"


def validar_mm(mm: float | None) -> None:
    maximo = float(supuesto("lluvia_max_mm_turno"))
    if mm is not None and not (0 <= mm <= maximo):
        raise ErrorLluvia(422, f"mm fuera de rango (0 a {maximo:g})")


def validar_fecha(fecha: date, origen: str) -> None:
    if fecha > date.today():
        raise ErrorLluvia(422, "La fecha no puede ser futura")
    corte = date.fromisoformat(constantes.FECHA_CORTE)
    if (
        fecha > corte
        and origen in ("parte_policial", "planilla_upca")
        and not get_settings().permitir_datos_post_corte
    ):
        raise ErrorLluvia(
            422,
            "Dato posterior al corte (31/10/2026) de un parte real: requiere la decisión de la mesa "
            "(PERMITIR_DATOS_POST_CORTE).",
        )


def buscar_puesto(db: Session, codigo: str) -> PuestoPluviometrico | None:
    return db.execute(
        select(PuestoPluviometrico).where(
            func.upper(PuestoPluviometrico.codigo) == codigo.strip().upper()
        )
    ).scalar_one_or_none()


def advertencia_vecinos(
    db: Session, puesto: PuestoPluviometrico, fecha: date, turno: str, mm: float | None
) -> list[str]:
    """Compara con puestos vecinos del mismo día y turno (advertencia, no rechazo)."""
    if mm is None:
        return []
    cfg = supuesto("lluvia_vecinos")
    centro = to_shape(puesto.geom)
    vecinos = db.execute(
        select(PuestoPluviometrico.codigo, LecturaLluvia.mm)
        .join(LecturaLluvia, LecturaLluvia.puesto_id == PuestoPluviometrico.id)
        .where(
            PuestoPluviometrico.id != puesto.id,
            LecturaLluvia.fecha == fecha,
            LecturaLluvia.turno == turno,
            LecturaLluvia.mm.is_not(None),
            func.ST_DWithin(
                cast(PuestoPluviometrico.geom, Geography),
                cast(func.ST_SetSRID(func.ST_MakePoint(centro.x, centro.y), 4326), Geography),
                float(cfg["radio_km"]) * 1000,
            ),
        )
    ).all()
    if not vecinos:
        return []
    mediana = statistics.median(float(v) for _, v in vecinos)
    if abs(mm - mediana) > float(cfg["diferencia_mm"]):
        return [
            f"El valor ({mm:g} mm) difiere en más de {cfg['diferencia_mm']} mm de la mediana de "
            f"{len(vecinos)} puesto(s) vecino(s) a menos de {cfg['radio_km']} km ({mediana:g} mm): "
            "verificar el parte."
        ]
    return []


def registrar_lectura(
    db: Session,
    codigo_puesto: str,
    fecha: date,
    turno: str,
    mm: float | None,
    origen: str,
) -> tuple[LecturaLluvia, list[str]]:
    """Valida y agrega la lectura a la sesión (el llamador hace commit)."""
    if turno not in TURNOS + (TURNO_DIARIO,):
        raise ErrorLluvia(422, "Turno inválido: 07 o 17")
    if origen not in ORIGENES:
        raise ErrorLluvia(422, "Origen inválido")
    validar_mm(mm)
    validar_fecha(fecha, origen)
    puesto = buscar_puesto(db, codigo_puesto)
    if puesto is None:
        raise ErrorLluvia(404, f"Puesto pluviométrico inexistente: {codigo_puesto}")
    existe = db.execute(
        select(LecturaLluvia.id).where(
            LecturaLluvia.puesto_id == puesto.id,
            LecturaLluvia.fecha == fecha,
            LecturaLluvia.turno == turno,
        )
    ).first()
    if existe:
        raise ErrorLluvia(409, "Ya existe una lectura de ese puesto, fecha y turno")
    categoria, fuente = categoria_y_fuente(puesto, origen, fecha)
    fila = LecturaLluvia(
        puesto_id=puesto.id,
        fecha=fecha,
        turno=turno,
        mm=None if mm is None else Decimal(str(mm)),
        origen=origen,
        categoria=categoria,
        fuente=fuente,
    )
    db.add(fila)
    db.flush()
    return fila, advertencia_vecinos(db, puesto, fecha, turno, mm)


# ---- planilla UPCA -----------------------------------------------------------------------------


def _a_fecha(valor) -> date | None:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        for formato in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(valor.strip(), formato).date()
            except ValueError:
                continue
    return None


def _a_mm(valor) -> tuple[bool, float | None]:
    """(válido, mm). Vacío -> (True, None) = sin medición; 0 -> (True, 0.0)."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return True, None
    if isinstance(valor, bool):
        return False, None
    if isinstance(valor, int | float):
        return True, float(valor)
    try:
        return True, float(str(valor).strip().replace(",", "."))
    except ValueError:
        return False, None


def importar_planilla(db: Session, contenido: bytes) -> dict:
    """Lee la hoja ``CARGA DIARIA`` (A fecha, B estación, D mm desde la fila 4). Hace commit."""
    if len(contenido) > MAX_BYTES_PLANILLA:
        raise ErrorLluvia(422, "El archivo supera el tamaño máximo (5 MB)")
    if contenido[:2] != b"PK":
        raise ErrorLluvia(422, "El archivo no es una planilla .xlsx")
    try:
        libro = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
    except Exception as exc:
        raise ErrorLluvia(422, "No se pudo leer la planilla .xlsx") from exc
    hoja = next((h for h in libro.worksheets if "carga diaria" in sin_tildes(h.title)), None)
    if hoja is None:
        raise ErrorLluvia(422, "La planilla no tiene la hoja 'CARGA DIARIA'")

    puestos = db.execute(select(PuestoPluviometrico)).scalars().all()
    por_nombre = {sin_tildes(p.nombre): p for p in puestos} | {
        sin_tildes(p.codigo): p for p in puestos
    }
    resultado = {
        "filas_leidas": 0,
        "insertadas": 0,
        "sin_medicion": 0,
        "incompletas": 0,
        "duplicadas": 0,
        "rechazadas": [],
    }
    for n, fila in enumerate(hoja.iter_rows(min_row=4, max_col=4, values_only=True), start=4):
        if n - 3 > MAX_FILAS_PLANILLA:
            resultado["rechazadas"].append({"fila": n, "motivo": "Se superó el máximo de filas"})
            break
        fecha_v, estacion_v, _, mm_v = (list(fila) + [None] * 4)[:4]
        if fecha_v is None and estacion_v is None and mm_v is None:
            continue
        resultado["filas_leidas"] += 1
        fecha = _a_fecha(fecha_v)
        if fecha is None or not estacion_v or not str(estacion_v).strip():
            resultado["incompletas"] += 1
            continue
        valido, mm = _a_mm(mm_v)
        if not valido:
            resultado["rechazadas"].append({"fila": n, "motivo": "mm no numérico"})
            continue
        puesto = por_nombre.get(sin_tildes(str(estacion_v)))
        if puesto is None:
            resultado["rechazadas"].append(
                {"fila": n, "motivo": f"Estación desconocida: {str(estacion_v)[:60]}"}
            )
            continue
        try:
            with db.begin_nested():
                registrar_lectura(db, puesto.codigo, fecha, TURNO_DIARIO, mm, "planilla_upca")
        except ErrorLluvia as exc:
            if exc.estado == 409:
                resultado["duplicadas"] += 1
            else:
                resultado["rechazadas"].append({"fila": n, "motivo": exc.mensaje})
            continue
        resultado["insertadas"] += 1
        if mm is None:
            resultado["sin_medicion"] += 1
    db.commit()
    resultado["nota"] = (
        "Celda de mm vacía = sin medición (se guarda como NULL, no como 0). La planilla es diaria "
        "y se guarda como turno DI."
    )
    return resultado


def exportar_planilla(db: Session, anio_hidrologico: int, departamento: str | None) -> bytes:
    """Excel con el formato de la hoja CARGA DIARIA; año hidrológico = sep(anio) a ago(anio+1)."""
    desde, hasta = date(anio_hidrologico, 9, 1), date(anio_hidrologico + 1, 8, 31)
    consulta = (
        select(PuestoPluviometrico, LecturaLluvia)
        .join(LecturaLluvia, LecturaLluvia.puesto_id == PuestoPluviometrico.id)
        .where(LecturaLluvia.fecha >= desde, LecturaLluvia.fecha <= hasta)
        .order_by(LecturaLluvia.fecha, PuestoPluviometrico.nombre)
    )
    if departamento:
        consulta = consulta.where(func.lower(PuestoPluviometrico.zona) == departamento.lower())
    por_dia: dict[tuple, dict] = {}
    for puesto, lectura in db.execute(consulta).all():
        d = por_dia.setdefault(
            (lectura.fecha, puesto.id),
            {"puesto": puesto, "mm": None, "origenes": set(), "categorias": set()},
        )
        if lectura.mm is not None:  # vacío no suma ni se vuelve 0
            d["mm"] = (d["mm"] or Decimal(0)) + lectura.mm
        d["origenes"].add(lectura.origen)
        d["categorias"].add(lectura.categoria)

    libro = openpyxl.Workbook()
    hoja = libro.active
    hoja.title = "CARGA DIARIA"
    hoja["A1"] = "CARGA DIARIA DE PRECIPITACIONES"
    hoja["A2"] = constantes.LEYENDA
    encabezados = [
        "FECHA",
        "ESTACIÓN",
        "DEPARTAMENTO",
        "mm LLUVIA",
        "AÑO",
        "MES",
        "MES NOMBRE",
        "OBSERVACIONES",
    ]
    for i, t in enumerate(encabezados, start=1):
        hoja.cell(row=3, column=i, value=t)
    fila = 4
    for (fecha, _), d in sorted(por_dia.items(), key=lambda kv: (kv[0][0], kv[1]["puesto"].nombre)):
        p = d["puesto"]
        hoja.cell(row=fila, column=1, value=fecha).number_format = "DD/MM/YYYY"
        hoja.cell(row=fila, column=2, value=p.nombre)
        hoja.cell(row=fila, column=3, value=p.zona)
        hoja.cell(row=fila, column=4, value=None if d["mm"] is None else float(d["mm"]))
        hoja.cell(row=fila, column=5, value=fecha.year)
        hoja.cell(row=fila, column=6, value=fecha.month)
        hoja.cell(row=fila, column=7, value=MESES[fecha.month - 1])
        hoja.cell(
            row=fila,
            column=8,
            value=f"origen: {', '.join(sorted(d['origenes']))} · {', '.join(sorted(d['categorias']))}",
        )
        fila += 1
    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()
