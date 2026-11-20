"""Recomendador (CLAUDE.md §8.2) y comparador de alternativas (§8.4).

Todo lo que sale de acá es una **recomendación**: decidir evacuar, definir recorridos y disponer
recursos corresponde a las autoridades. Las cifras de personas y producción registradas se cuentan
por separado (consultas agregadas distintas, sin ``JOIN`` entre familias y stock) para no duplicar
personas (CLAUDE.md §16). No se descifran datos de salud: los vulnerables se cuentan por edad.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.core.tiempo import hoy_ar
from app.db.consultas import sectores_de_puntos
from app.db.modelos import (
    Cuadrilla,
    Establecimiento,
    GrupoFamiliar,
    IntegranteCuadrilla,
    Sector,
    StockProductivo,
)
from app.domain import ascenso, asignacion, cuadrillas, factibilidad, ganaderia, ruteo
from app.domain import escenario as esc
from app.servicios import contexto
from app.servicios import ruteo as srv_ruteo
from app.servicios.contexto import CentroGeo, SectorGeo

ETIQUETA = (
    "RECOMENDACIÓN, no es una orden: la decisión de evacuar, los recorridos y la disposición de "
    "recursos corresponden a las autoridades con rol autorizado."
)
FUENTE = (
    "Cálculo con K10 (SIMULADO), personas y productores registrados (SIMULADO), recursos y centros "
    "(SIMULADO) y supuestos de supuestos.yaml"
)


@dataclass
class Exposicion:
    familias: int = 0
    personas_registradas: int = 0
    menores: int = 0
    mayores: int = 0
    establecimientos: list[dict] = field(default_factory=list)
    stock: list[tuple[str, str, int]] = field(default_factory=list)  # especie, categoría, cant.


def cargar_exposicion(db: Session) -> dict[str, Exposicion]:
    """Familias y producción registradas dentro de cada sector (``ST_Intersects``).

    Las familias y el stock se consultan por separado y el stock se agrega por establecimiento y
    categoría antes de asignarlo al sector: así una familia no se cuenta una vez por cada fila de
    stock.
    """
    exp: dict[str, Exposicion] = {}
    familias = db.execute(
        select(
            Sector.id,
            func.count(GrupoFamiliar.id),
            func.coalesce(func.sum(GrupoFamiliar.integrantes), 0),
            func.coalesce(func.sum(GrupoFamiliar.menores), 0),
            func.coalesce(func.sum(GrupoFamiliar.mayores), 0),
        )
        .join(GrupoFamiliar, func.ST_Intersects(Sector.geom, GrupoFamiliar.domicilio))
        .group_by(Sector.id)
    ).all()
    for sid, n, personas, menores, mayores in familias:
        e = exp.setdefault(sid, Exposicion())
        e.familias, e.personas_registradas = int(n), int(personas)
        e.menores, e.mayores = int(menores), int(mayores)

    ubicados = db.execute(
        select(Sector.id, Establecimiento.id, Establecimiento.nombre).join(
            Establecimiento, func.ST_Intersects(Sector.geom, Establecimiento.geom_tranquera)
        )
    ).all()
    por_est: dict[int, str] = {}
    for sid, eid, nombre in ubicados:
        exp.setdefault(sid, Exposicion()).establecimientos.append({"id": eid, "nombre": nombre})
        por_est[eid] = sid
    if por_est:
        stock = db.execute(
            select(
                StockProductivo.establecimiento_id,
                StockProductivo.especie,
                StockProductivo.categoria_animal,
                func.sum(StockProductivo.cantidad),
            )
            .where(StockProductivo.establecimiento_id.in_(list(por_est)))
            .group_by(
                StockProductivo.establecimiento_id,
                StockProductivo.especie,
                StockProductivo.categoria_animal,
            )
        ).all()
        for eid, especie, categoria, cantidad in stock:
            exp[por_est[eid]].stock.append((especie, categoria, int(cantidad)))
    return exp


def entrada_ganaderia(items: list[tuple[str, str, int]]) -> ganaderia.EntradaGanaderia:
    """Convierte filas de stock ``(especie, categoría, cantidad)`` en la entrada del cálculo.

    La especie y la categoría se normalizan con alias y plurales (``vacas``, ``colmenas``...). Lo
    que no se puede clasificar NO se descarta en silencio: cuenta como "sin clasificar" cuando es
    ganado bovino de categoría genérica o desconocida, y genera un aviso en la salida.
    """
    bovinos: dict[str, int] = {}
    sin_clasificar = 0
    menores: dict[str, int] = {}
    colmenas = colmenas_muertas = 0
    avisos: list[str] = []
    for especie, categoria, cantidad in items:
        canonica_especie = ganaderia.especie_canonica(especie)
        if canonica_especie == ganaderia.ESPECIE_BOVINO:
            canonica = ganaderia.categoria_canonica(categoria)
            if canonica is None:
                sin_clasificar += cantidad
                avisos.append(
                    f"{cantidad} bovinos con categoría '{categoria}' sin clasificar: indicar "
                    f"{', '.join(ganaderia.CATEGORIAS_BOVINAS_PERMITIDAS)}."
                )
            else:
                bovinos[canonica] = bovinos.get(canonica, 0) + cantidad
        elif canonica_especie in ganaderia.ESPECIES_MENORES:
            menores[canonica_especie] = menores.get(canonica_especie, 0) + cantidad
        elif canonica_especie == ganaderia.ESPECIE_APICULTURA:
            if "muert" in ganaderia.sin_tildes(categoria.casefold()):
                colmenas_muertas += cantidad
            else:
                colmenas += cantidad
        elif canonica_especie == "equino":
            avisos.append(
                f"{cantidad} equinos declarados: la plataforma no calcula recursos para equinos "
                "(sin supuesto cargado); coordinar su traslado aparte."
            )
        else:
            avisos.append(
                f"{cantidad} animales de la especie '{especie}' no se pudieron clasificar y no "
                "entran en el cálculo."
            )
    return ganaderia.EntradaGanaderia(
        bovinos=bovinos,
        bovinos_sin_clasificar=sin_clasificar,
        menores=menores or None,
        colmenas_vivas=colmenas,
        colmenas_muertas=colmenas_muertas,
        avisos_clasificacion=tuple(avisos),
    )


def roles_de_cuadrillas(db: Session) -> dict[str, list[str]]:
    """Roles de la primera cuadrilla disponible de cada tipo (vacío si no hay ninguna)."""
    resultado: dict[str, list[str]] = {t: [] for t in cuadrillas.TIPOS}
    for tipo in cuadrillas.TIPOS:
        c = db.execute(
            select(Cuadrilla)
            .where(Cuadrilla.tipo_incidente == tipo)
            .order_by((Cuadrilla.estado != "disponible"), Cuadrilla.id)
            .limit(1)
        ).scalar_one_or_none()
        if c is not None:
            resultado[tipo] = list(
                db.execute(
                    select(IntegranteCuadrilla.rol_operativo).where(
                        IntegranteCuadrilla.cuadrilla_id == c.id
                    )
                ).scalars()
            )
    return resultado


@dataclass(frozen=True)
class Pronostico:
    """Lluvia prevista (SIMULADO): ``mm`` que se suman a la lluvia del escenario en ``horas``."""

    mm: float
    horas: float


@dataclass
class DatosPlan:
    altura_m: float
    lluvia_mm: float
    escenario: esc.Escenario
    sectores: dict[str, SectorGeo]
    exposicion: dict[str, Exposicion]
    centros: list[CentroGeo]
    recursos: dict[str, dict]
    tasas: dict[str, float]
    roles_cuadrillas: dict[str, list[str]]
    # Centros que no pueden recibir evacuados en este escenario: id -> motivo.
    centros_descartados: dict[int, str] = field(default_factory=dict)
    # Minutos por la red vial (pgRouting) de cada sector a cada centro, por perfil.
    tiempos_red: dict[str, dict[tuple[str, int], float]] = field(default_factory=dict)
    pronostico: Pronostico | None = None


def descartar_centros(
    centros: list[CentroGeo],
    sector_de_centro: dict[int, str | None],
    escenario: esc.Escenario,
    excluir_en_riesgo: bool,
) -> dict[int, str]:
    """Centros que no deben recibir evacuados: los que quedan dentro de un sector comprometido (y,
    con el supuesto ``centro_excluir_en_riesgo``, de uno en riesgo)."""
    estados = {s.id: s.estado for s in escenario.sectores}
    descartados: dict[int, str] = {}
    for c in centros:
        sid = sector_de_centro.get(c.id)
        estado = estados.get(sid) if sid else None
        if estado == esc.COMPROMETIDO:
            descartados[c.id] = f"Dentro del sector {sid}, comprometido en este escenario."
        elif estado == esc.EN_RIESGO and excluir_en_riesgo:
            descartados[c.id] = (
                f"Dentro del sector {sid}, en riesgo en este escenario (supuesto "
                "centro_excluir_en_riesgo)."
            )
    return descartados


def cargar_datos(
    db: Session,
    altura_m: float,
    lluvia_mm: float,
    caminos_cerrados: set[int],
    humedad_suelo: float | None = None,
    pronostico: Pronostico | None = None,
) -> DatosPlan:
    escenario = contexto.calcular_escenario(
        db, altura_m, lluvia_mm, caminos_cerrados, humedad_suelo
    )
    sectores = {s.id: s for s in contexto.cargar_sectores(db)}
    centros = contexto.cargar_centros(db)
    sector_de_centro = sectores_de_puntos(db, {c.id: (c.lon, c.lat) for c in centros})
    descartados = descartar_centros(
        centros, sector_de_centro, escenario, bool(supuesto("centro_excluir_en_riesgo"))
    )
    exposicion = cargar_exposicion(db)
    a_evacuar = [s.id for s in escenario.sectores if s.estado != esc.NORMAL]
    origenes = {sid: (sectores[sid].lon, sectores[sid].lat) for sid in a_evacuar}
    # El camión jaula solo hace falta donde hay producción declarada.
    con_ganado = {sid: p for sid, p in origenes.items() if exposicion.get(sid, Exposicion()).stock}
    tiempos_red = {
        perfil: srv_ruteo.matriz_tiempos(
            db,
            perfil,
            puntos,
            {
                c.id: (c.lon, c.lat)
                for c in centros
                if c.id not in descartados
                and (c.cupo_personas if perfil == ruteo.VEHICULAR else c.cupo_animales) > 0
            },
            escenario,
            lluvia_mm,
            {s: s for s in puntos},
        )
        for perfil, puntos in ((ruteo.VEHICULAR, origenes), (ruteo.CAMION_JAULA, con_ganado))
    }
    return DatosPlan(
        altura_m=altura_m,
        lluvia_mm=lluvia_mm,
        escenario=escenario,
        sectores=sectores,
        exposicion=exposicion,
        centros=centros,
        recursos=contexto.cargar_recursos(db),
        tasas=ascenso.tasas_m_dia(contexto.serie_diaria(db)),
        roles_cuadrillas=roles_de_cuadrillas(db),
        centros_descartados=descartados,
        tiempos_red=tiempos_red,
        pronostico=pronostico,
    )


def sectores_a_evacuar(datos: DatosPlan) -> list[str]:
    return [s.id for s in datos.escenario.sectores if s.estado != esc.NORMAL]


def orden_por(datos: DatosPlan, criterio: str, ids: list[str] | None = None) -> list[str]:
    """Orden de atención: ``riesgo`` (comprometidos primero, luego menor margen) o ``poblacion``."""
    elegidos = [s for s in datos.escenario.sectores if (ids is None or s.id in ids)]
    if ids is None:
        elegidos = [s for s in elegidos if s.estado != esc.NORMAL]

    def personas(s) -> int:
        return s.poblacion_simulada + datos.exposicion.get(s.id, Exposicion()).personas_registradas

    if criterio == "poblacion":
        elegidos.sort(key=lambda s: (-personas(s), s.id))
    else:
        elegidos.sort(
            key=lambda s: (0 if s.estado == esc.COMPROMETIDO else 1, s.margen_a_compromiso_m, s.id)
        )
    return [s.id for s in elegidos]


def _modo_transporte(estado: esc.SectorEstado) -> tuple[str, str | None]:
    """Vehículo para personas y superficie del mejor acceso transitable."""
    transitables = [a for a in estado.accesos if a.estado == esc.ACCESO_TRANSITABLE]
    firmes = [a for a in transitables if a.superficie in ("pavimento", "ripio")]
    if firmes:
        return "colectivo", (
            "pavimento" if any(a.superficie == "pavimento" for a in firmes) else "ripio"
        )
    if transitables:
        return "camioneta_4x4", "tierra"
    return "lancha", None


def _ventana(datos: DatosPlan, estado: esc.SectorEstado, hay_ganado: bool) -> dict:
    tr = ascenso.tiempo_restante(datos.altura_m, estado.altura_compromiso_m, datos.tasas)
    h_min, h_max = supuesto("ventana_inicio_ganado_horas")
    ventana: dict = {
        "ya_comprometido": tr.ya_alcanzado,
        "dias_hasta_compromiso_minimo": tr.dias_minimo,
        "dias_hasta_compromiso_maximo": tr.dias_maximo,
        "supuesto": ascenso.SUPUESTO_LINEAL,
        "categoria": "SIMULADO",
    }
    if hay_ganado:
        if tr.ya_alcanzado:
            ventana["inicio_ganado"] = (
                "Sector ya comprometido: el traslado del ganado es inmediato."
            )
        elif tr.dias_minimo is None:
            ventana["inicio_ganado"] = "Sin tasa de ascenso disponible para estimar la ventana."
        else:
            horas = tr.dias_minimo * 24
            ventana["inicio_ganado_horas_desde_ahora"] = [
                round(max(horas - h_max, 0)),
                round(max(horas - h_min, 0)),
            ]
            ventana["inicio_ganado"] = (
                f"Iniciar el traslado del ganado {h_min} a {h_max} h antes del compromiso previsto; "
                f"con el ritmo más rápido observado eso es entre {round(max(horas - h_max, 0))} y "
                f"{round(max(horas - h_min, 0))} h desde ahora."
            )
    return ventana


# --- Tiempos de viaje sector -> centro -------------------------------------------------------------

METODO_RED = "red_vial"
METODO_APROXIMADO = "aproximado"
METODO_LANCHA = "lancha_linea_recta"
METODO_ARREO = "arreo_aproximado"


def _minutos_aprox(metros: float, perfil: str, superficie: str | None) -> float | None:
    vel = ruteo.velocidades(perfil).get(superficie or "tierra")
    if vel is None:
        return None
    return metros * float(supuesto("factor_desvio")) / (vel * 1000 / 60)


def minutos_personas(
    datos: DatosPlan, sid: str, centro: CentroGeo, modo: str, superficie: str | None
) -> tuple[float | None, str]:
    """Minutos de ida del sector al centro para personas, y el método con que se calcularon.

    Lancha: línea recta a velocidad de lancha. Con ruedas: la red vial (pgRouting) si hay ruta; si
    no, línea recta × factor de desvío a la velocidad de la superficie del acceso que se usa.
    """
    s = datos.sectores[sid]
    recta = ruteo.haversine_m(s.lon, s.lat, centro.lon, centro.lat)
    if modo == "lancha":
        vel = float(supuesto("velocidad_lancha_kmh")) * 1000 / 60
        return round(recta / vel, 1), METODO_LANCHA
    red = datos.tiempos_red.get(ruteo.VEHICULAR, {}).get((sid, centro.id))
    if red is not None:
        return red, METODO_RED
    m = _minutos_aprox(recta, ruteo.VEHICULAR, superficie)
    return (None, METODO_APROXIMADO) if m is None else (round(m, 1), METODO_APROXIMADO)


def minutos_animales(
    datos: DatosPlan, sid: str, centro: CentroGeo, superficie: str | None
) -> tuple[float | None, str]:
    """Minutos de ida para el ganado: camión jaula (red o aproximado, solo pavimento y ripio) y, si
    el camión no puede salir del sector, arreo a pie aproximado."""
    s = datos.sectores[sid]
    recta = ruteo.haversine_m(s.lon, s.lat, centro.lon, centro.lat)
    red = datos.tiempos_red.get(ruteo.CAMION_JAULA, {}).get((sid, centro.id))
    if red is not None and superficie in ("pavimento", "ripio"):
        return red, METODO_RED
    m = _minutos_aprox(recta, ruteo.CAMION_JAULA, superficie)
    if m is not None:
        return round(m, 1), METODO_APROXIMADO
    m = _minutos_aprox(recta, ruteo.ARREO, superficie)
    return (None, METODO_ARREO) if m is None else (round(m, 1), METODO_ARREO)


def _promedio_ponderado(pares: list[tuple[float, int]]) -> float | None:
    total = sum(c for _, c in pares)
    if not total:
        return None
    return round(sum(m * c for m, c in pares) / total, 1)


# --- Plazos y factibilidad ---------------------------------------------------------------------------


def _plazo_rio_h(
    datos: DatosPlan, estado: esc.SectorEstado
) -> tuple[float | None, float | None, bool]:
    tr = ascenso.tiempo_restante(datos.altura_m, estado.altura_compromiso_m, datos.tasas)
    if tr.ya_alcanzado:
        return 0.0, 0.0, True
    if tr.dias_minimo is None:
        return None, None, False
    return tr.dias_minimo * 24, tr.dias_maximo * 24, False


def _plazo_seco_h(datos: DatosPlan, superficie: str | None, perfil: str) -> float | None:
    """Horas hasta la lluvia prevista si esa lluvia deja intransitable el acceso que se usa."""
    p = datos.pronostico
    if p is None or superficie is None:
        return None
    total = datos.lluvia_mm + p.mm
    if superficie in ruteo.superficies_cerradas_por_lluvia(perfil, total):
        return p.horas
    return None


def _factibilidad(
    datos: DatosPlan,
    estado: esc.SectorEstado,
    superficie: str | None,
    fin_personas_min: float | None,
    fin_ganado_min: float | None,
    hay_ganado: bool,
) -> dict:
    rio_min, rio_max, ya = _plazo_rio_h(datos, estado)
    margen = float(supuesto("margen_seguridad_fraccion"))
    plazo = factibilidad.plazo_efectivo(
        rio_min, rio_max, _plazo_seco_h(datos, superficie, ruteo.VEHICULAR)
    )
    personas = factibilidad.evaluar(
        plazo,
        None if fin_personas_min is None else fin_personas_min / 60,
        margen,
        ya_comprometido=ya,
    )
    resultado = {
        "personas": factibilidad.a_dict(personas),
        "margen_seguridad_fraccion": margen,
        "supuestos": [
            ascenso.SUPUESTO_LINEAL,
            "El tiempo para completar cuenta desde que se da la orden y usa la flota disponible "
            "de cada tipo de vehículo, compartida entre los sectores en el orden de la alternativa.",
        ],
        "categoria": "SIMULADO",
    }
    if datos.pronostico is not None:
        resultado["pronostico_lluvia"] = {
            "mm": datos.pronostico.mm,
            "horas": datos.pronostico.horas,
            "categoria": "SIMULADO",
        }
    if hay_ganado:
        _, h_max = supuesto("ventana_inicio_ganado_horas")
        plazo_g = factibilidad.plazo_efectivo(
            rio_min, rio_max, _plazo_seco_h(datos, superficie, ruteo.CAMION_JAULA)
        )
        ganado = factibilidad.evaluar(
            plazo_g,
            None if fin_ganado_min is None else fin_ganado_min / 60,
            margen,
            ya_comprometido=ya,
            anticipacion_h=float(h_max),
        )
        resultado["ganado"] = factibilidad.a_dict(ganado)
    return resultado


def construir_plan(
    datos: DatosPlan,
    orden: list[str],
    centros_excluidos: set[int] | None = None,
) -> dict:
    """Asigna personas y animales a centros en el orden dado, estima recursos, tiempos y si alcanza.

    - Centros: se quitan los excluidos por el usuario y los descartados por el escenario.
    - Reparto: flujo de costo mínimo (minutos de viaje) que respeta el orden de prioridad.
    - Tiempos: red vial real si está cargada; si no, línea recta × factor de desvío (se informa).
    - Flota: cada tipo de vehículo tiene su línea de tiempo; los sectores que comparten un tipo van
      en secuencia y los que usan tipos distintos, en paralelo.
    """
    excluidos = centros_excluidos or set()
    centros = [
        c for c in datos.centros if c.id not in excluidos and c.id not in datos.centros_descartados
    ]

    # ---- datos por sector --------------------------------------------------------------------
    info: dict[str, dict] = {}
    for sid in orden:
        estado = datos.escenario.sector(sid)
        exp = datos.exposicion.get(sid, Exposicion())
        entrada = entrada_ganaderia(exp.stock)
        calc = ganaderia.calcular(entrada) if exp.stock else None
        animales = (calc["bovinos_total"] if calc else 0) + sum((entrada.menores or {}).values())
        personas = datos.sectores[sid].poblacion_simulada + exp.personas_registradas
        modo, superficie = _modo_transporte(estado)
        info[sid] = {
            "estado": estado,
            "exp": exp,
            "entrada": entrada,
            "calc": calc,
            "animales": animales,
            "personas": personas,
            "modo": modo,
            "superficie": superficie,
        }

    # ---- tiempos de viaje y reparto -------------------------------------------------------------
    min_p: dict[tuple[str, int], float] = {}
    min_a: dict[tuple[str, int], float] = {}
    metodo_p: dict[tuple[str, int], str] = {}
    metodo_a: dict[tuple[str, int], str] = {}
    for sid in orden:
        i = info[sid]
        for c in centros:
            if c.cupo_personas > 0:
                m, metodo = minutos_personas(datos, sid, c, i["modo"], i["superficie"])
                if m is not None:
                    min_p[(sid, c.id)], metodo_p[(sid, c.id)] = m, metodo
            if c.cupo_animales > 0:
                m, metodo = minutos_animales(datos, sid, c, i["superficie"])
                if m is not None:
                    min_a[(sid, c.id)], metodo_a[(sid, c.id)] = m, metodo
    res_p = asignacion.asignar_costo_minimo(
        [asignacion.Demanda(sid, info[sid]["personas"], i) for i, sid in enumerate(orden)],
        [asignacion.Capacidad(c.id, c.nombre, c.cupo_personas) for c in centros],
        min_p,
    )
    res_a = asignacion.asignar_costo_minimo(
        [asignacion.Demanda(sid, info[sid]["animales"], i) for i, sid in enumerate(orden)],
        [asignacion.Capacidad(c.id, c.nombre, c.cupo_animales) for c in centros],
        min_a,
    )

    # ---- flota, tiempos y detalle por sector --------------------------------------------------
    viajes_por_vehiculo: dict[str, int] = {}
    faltantes_veh: dict[str, int] = {}
    linea_tiempo: dict[str, float] = {}  # minutos ocupados de cada tipo de vehículo
    camiones_necesarios = 0
    disp_jaula = datos.recursos.get("camion_jaula", {}).get("cantidad", 0)
    fines: list[float] = []
    primer_sector_min: float | None = None
    vulnerables = 0
    aislados_lancha = 0
    detalle: list[dict] = []
    tipos_cuadrilla: set[str] = set()
    metodos_usados: dict[str, int] = {}
    veredictos: dict[str, int] = {}

    for pos, sid in enumerate(orden):
        i = info[sid]
        estado: esc.SectorEstado = i["estado"]
        exp: Exposicion = i["exp"]
        modo, superficie = i["modo"], i["superficie"]
        asignadas = res_p.asignado_a(sid)
        cap = datos.recursos.get(modo, {}).get("capacidad_unitaria", 0)
        disp = datos.recursos.get(modo, {}).get("cantidad", 0)
        viajes = math.ceil(asignadas / cap) if cap else 0
        rondas = math.ceil(viajes / disp) if disp else 0
        sin_flota = bool(asignadas) and not (cap and disp)
        asig_centros = [a for a in res_p.asignaciones if a.demanda_id == sid]
        for a in asig_centros:
            metodo = metodo_p[(sid, a.centro_id)]
            metodos_usados[metodo] = metodos_usados.get(metodo, 0) + 1
        ida_min = _promedio_ponderado(
            [(min_p[(sid, a.centro_id)], a.cantidad) for a in asig_centros]
        )
        completar_min = 0.0
        if ida_min is not None and rondas:
            completar_min = round((2 * rondas - 1) * ida_min, 1)
        inicio_min = linea_tiempo.get(modo, 0.0)
        fin_min: float | None = None
        if not sin_flota:
            fin_min = round(inicio_min + completar_min, 1)
            linea_tiempo[modo] = fin_min
            if asignadas:
                fines.append(fin_min)
                if primer_sector_min is None:
                    primer_sector_min = fin_min
        viajes_por_vehiculo[modo] = viajes_por_vehiculo.get(modo, 0) + viajes
        if disp and viajes > disp:
            faltantes_veh[modo] = faltantes_veh.get(modo, 0) + (viajes - disp)
        elif sin_flota:  # no hay ningun vehiculo de ese tipo: faltante total, no "0 minutos"
            faltantes_veh[modo] = faltantes_veh.get(modo, 0) + max(
                math.ceil(asignadas / (cap or 1)), 1
            )
        if modo == "lancha":
            aislados_lancha += 1
        elif superficie != "pavimento":
            vulnerables += 1

        calc = i["calc"]
        camiones = calc["transporte"]["camiones_jaula"] if calc else 0
        cat_b = sum(calc["transporte"]["vehiculos_categoria_b"].values()) if calc else 0
        camiones_necesarios += camiones
        asig_animales = [a for a in res_a.asignaciones if a.demanda_id == sid]
        en_camion = [
            (min_a[(sid, a.centro_id)], a.cantidad)
            for a in asig_animales
            if metodo_a[(sid, a.centro_id)] != METODO_ARREO
        ]
        ida_camion = _promedio_ponderado(en_camion)
        fin_ganado_min: float | None = None
        if camiones and ida_camion is not None and disp_jaula:
            rondas_j = math.ceil(camiones / disp_jaula)
            inicio_j = linea_tiempo.get("camion_jaula", 0.0)
            fin_ganado_min = round(inicio_j + (2 * rondas_j - 1) * ida_camion, 1)
            linea_tiempo["camion_jaula"] = fin_ganado_min

        advertencias: list[str] = []
        if sin_flota:
            advertencias.append(
                f"No hay vehículos '{modo}' cargados: no se puede estimar el traslado de las "
                f"{asignadas} personas asignadas (faltante total, sin tiempo calculado)."
            )
        if calc:
            advertencias.extend(calc["advertencias"])
        if camiones and superficie in (None, "tierra"):
            advertencias.append(
                "El camión jaula no usa caminos de tierra: sin acceso firme, evaluar arreo a un "
                "albardón o esperar a que el camino sea transitable."
            )
        if res_p.sin_lugar.get(sid):
            advertencias.append(f"{res_p.sin_lugar[sid]} personas sin lugar en los centros.")
        if res_a.sin_lugar.get(sid):
            advertencias.append(f"{res_a.sin_lugar[sid]} animales sin cupo en los centros.")
        if estado.aislado:
            advertencias.append(
                "Sector aislado: sin accesos transitables (considerar lancha o espera)."
            )
        if any(metodo_p[(sid, a.centro_id)] == METODO_APROXIMADO for a in asig_centros):
            advertencias.append(
                "Tiempo aproximado (línea recta × factor de desvío): no hay ruta por la red vial "
                "cargada para este sector o la red no está cargada."
            )

        bovinos = calc["bovinos_total"] if calc else 0
        colmenas = i["entrada"].colmenas_vivas
        tipos = cuadrillas.tipos_necesarios(i["personas"] > 0, bovinos, colmenas)
        tipos_cuadrilla.update(tipos)
        fact = _factibilidad(datos, estado, superficie, fin_min, fin_ganado_min, bovinos > 0)
        v = fact["personas"]["veredicto"]
        veredictos[v] = veredictos.get(v, 0) + 1
        detalle.append(
            {
                "id": sid,
                "nombre": estado.nombre,
                "prioridad": pos + 1,
                "estado": estado.estado,
                "aislado": estado.aislado,
                "poblacion": {
                    "simulada_k10": datos.sectores[sid].poblacion_simulada,
                    "familias_registradas": exp.familias,
                    "personas_registradas": exp.personas_registradas,
                    "menores": exp.menores,
                    "mayores": exp.mayores,
                    "total_estimada": i["personas"],
                    "nota": "Suma la población simulada de K10 y las familias registradas dentro "
                    "del polígono; no se descifran datos de salud.",
                },
                "produccion": {
                    "establecimientos": exp.establecimientos,
                    "bovinos": bovinos,
                    "animales_menores": dict(i["entrada"].menores or {}),
                    "colmenas": colmenas,
                    "ganaderia": calc,
                },
                "ventana": _ventana(datos, estado, bovinos > 0),
                "factibilidad": fact,
                "traslado_personas": {
                    "vehiculo": modo,
                    "superficie_acceso": superficie,
                    "viajes": viajes,
                    "vehiculos_disponibles": disp,
                    "rondas": rondas,
                    "sin_flota": sin_flota,
                    "tiempo_ida_min": ida_min,
                    "tiempo_inicio_min": None if sin_flota else inicio_min,
                    "tiempo_para_completar_min": None if sin_flota else completar_min,
                    "tiempo_acumulado_min": fin_min,
                    "metodo_tiempo": sorted({metodo_p[(sid, a.centro_id)] for a in asig_centros}),
                },
                "traslado_ganado": {
                    "camiones_jaula": camiones,
                    "camiones_disponibles": disp_jaula,
                    "tiempo_ida_min": ida_camion,
                    "tiempo_acumulado_min": fin_ganado_min,
                    "metodo_tiempo": sorted({metodo_a[(sid, a.centro_id)] for a in asig_animales}),
                },
                "asignacion_personas": [
                    {
                        "centro_id": a.centro_id,
                        "centro": a.centro_nombre,
                        "cantidad": a.cantidad,
                        "tiempo_ida_min": min_p[(sid, a.centro_id)],
                        "metodo_tiempo": metodo_p[(sid, a.centro_id)],
                    }
                    for a in asig_centros
                ],
                "personas_sin_lugar": res_p.sin_lugar.get(sid, 0),
                "asignacion_animales": [
                    {
                        "centro_id": a.centro_id,
                        "centro": a.centro_nombre,
                        "cantidad": a.cantidad,
                        "tiempo_ida_min": min_a[(sid, a.centro_id)],
                        "metodo_tiempo": metodo_a[(sid, a.centro_id)],
                    }
                    for a in asig_animales
                ],
                "animales_sin_cupo": res_a.sin_lugar.get(sid, 0),
                "camiones_jaula": camiones,
                "vehiculos_categoria_b": cat_b,
                "cuadrillas_sugeridas": [
                    {"tipo": t, "roles": cuadrillas.plantilla(t)} for t in tipos
                ],
                "advertencias": advertencias,
            }
        )

    roles_faltantes = {
        t: cuadrillas.roles_faltantes(t, datos.roles_cuadrillas.get(t, []))
        for t in sorted(tipos_cuadrilla)
    }
    cupo_personas_total = sum(c.cupo_personas for c in centros)
    metricas = {
        "personas_a_evacuar": sum(i["personas"] for i in info.values()),
        "personas_evacuadas": res_p.total_asignado,
        "personas_sin_lugar": res_p.total_sin_lugar,
        "animales_a_trasladar": sum(i["animales"] for i in info.values()),
        "animales_con_cupo": res_a.total_asignado,
        "animales_sin_cupo": res_a.total_sin_lugar,
        "viajes_por_vehiculo": viajes_por_vehiculo,
        "camiones_jaula_necesarios": camiones_necesarios,
        "tiempo_primer_sector_min": primer_sector_min,
        "tiempo_total_min": max(fines, default=0.0),
        "accesos_vulnerables_usados": vulnerables,
        "sectores_por_lancha": aislados_lancha,
        "sectores_no_alcanzan": veredictos.get(factibilidad.NO_ALCANZA, 0),
        "sectores_justos": veredictos.get(factibilidad.JUSTO, 0),
        "sectores_ya_comprometidos": veredictos.get(factibilidad.YA_COMPROMETIDO, 0),
        "veredictos": veredictos,
        "metodo_tiempos": metodos_usados,
        "personas_minuto": round(
            sum(min_p[(a.demanda_id, a.centro_id)] * a.cantidad for a in res_p.asignaciones), 1
        ),
        "faltantes": {
            "vehiculos_por_viajes_en_una_ronda": faltantes_veh,
            "camiones_jaula": max(camiones_necesarios - disp_jaula, 0),
            "cupo_personas_en_centros": res_p.total_sin_lugar,
            "cupo_animales_en_centros": res_a.total_sin_lugar,
            "roles_por_cuadrilla": roles_faltantes,
        },
        "cupo_personas_total_centros": cupo_personas_total,
    }
    nombres = {c.id: c.nombre for c in datos.centros}
    return {
        "orden_sectores": orden,
        "centros_excluidos": sorted(excluidos),
        "centros_descartados": [
            {"id": cid, "nombre": nombres.get(cid), "motivo": motivo}
            for cid, motivo in sorted(datos.centros_descartados.items())
        ],
        "metricas": metricas,
        "sectores": detalle,
        "cupos_restantes_centros": {str(k): v for k, v in res_p.cupos_restantes.items()},
    }


def _entrada_dict(datos: DatosPlan, caminos: set[int]) -> dict:
    return {
        "altura_formosa_m": datos.altura_m,
        "lluvia_mm": datos.lluvia_mm,
        "caminos_cerrados": sorted(caminos),
        "pronostico_lluvia": None
        if datos.pronostico is None
        else {"mm": datos.pronostico.mm, "horas": datos.pronostico.horas, "categoria": "SIMULADO"},
    }


def recomendar(
    db: Session,
    altura_m: float,
    lluvia_mm: float,
    caminos_cerrados: set[int],
    prioridad: str = "riesgo",
    sectores: list[str] | None = None,
    humedad_suelo: float | None = None,
    pronostico: Pronostico | None = None,
) -> dict:
    datos = cargar_datos(db, altura_m, lluvia_mm, caminos_cerrados, humedad_suelo, pronostico)
    orden = orden_por(datos, prioridad, sectores)
    plan = construir_plan(datos, orden)
    return {
        "etiqueta": ETIQUETA,
        "entrada": _entrada_dict(datos, caminos_cerrados) | {"prioridad": prioridad},
        "escenario": {"rio": datos.escenario.rio, "resumen": datos.escenario.resumen},
        "recomendacion": plan,
        "limites": [
            "Población: la de K10 más las familias registradas es SIMULADA; no hay padrón real.",
            "Capacidad de centros, vehículos y camiones son SIMULADO.",
            *limites_tiempos(datos),
            ascenso.SUPUESTO_LINEAL,
            "El veredicto de factibilidad compara el tiempo de traslado con el plazo del río (rango "
            "de tasas observadas) y, si se informa, con la lluvia prevista SIMULADA: no es un "
            "pronóstico ni una orden.",
        ],
        "categoria": "SIMULADO",
        "fuente": FUENTE,
        "fecha_dato": hoy_ar().isoformat(),
    }


ETIQUETAS_METRICAS = {
    "personas_evacuadas": "Personas con lugar en centros",
    "personas_sin_lugar": "Personas sin lugar",
    "animales_con_cupo": "Animales con cupo",
    "animales_sin_cupo": "Animales sin cupo",
    "camiones_jaula_necesarios": "Camiones jaula necesarios",
    "tiempo_primer_sector_min": "Minutos hasta completar el primer sector",
    "tiempo_total_min": "Minutos totales (cada tipo de vehículo en secuencia; tipos en paralelo)",
    "accesos_vulnerables_usados": "Sectores que usan accesos de ripio o tierra",
    "sectores_no_alcanzan": "Sectores que no alcanzan a evacuarse a tiempo",
    "sectores_justos": "Sectores que llegan justo (sin holgura)",
    "personas_minuto": "Personas × minutos de viaje (menor es mejor)",
}


def limites_tiempos(datos: DatosPlan) -> list[str]:
    """Cómo se calcularon los tiempos de viaje en este escenario."""
    con_red = any(datos.tiempos_red.values())
    textos = [
        "Las velocidades por superficie y el factor de desvío son SUPUESTO.",
    ]
    if con_red:
        textos.append(
            "Los tiempos con método 'red_vial' salen de la red vial de OpenStreetMap (DOCUMENTO DE "
            "REFERENCIA) con pgRouting; los 'aproximado' usan línea recta × factor de desvío."
        )
    else:
        textos.append(
            "No hay red vial cargada: todos los tiempos son aproximados (línea recta × factor de "
            "desvío); no son recorridos reales."
        )
    return textos


def comparar(datos: DatosPlan, caminos: set[int], editable: dict | None) -> list[dict]:
    """Dos alternativas generadas (por riesgo y por población) y una editable."""
    alternativas = []
    for tipo, nombre, criterio in (
        ("riesgo", "Alternativa A · prioridad por riesgo", "riesgo"),
        ("poblacion", "Alternativa B · prioridad por población", "poblacion"),
    ):
        plan = construir_plan(datos, orden_por(datos, criterio))
        alternativas.append(
            {"tipo": tipo, "nombre": nombre, "parametros": {"criterio": criterio}, **plan}
        )
    editable = editable or {}
    orden_ed = editable.get("orden_sectores") or orden_por(datos, "riesgo")
    excluidos = set(editable.get("centros_excluidos") or [])
    plan = construir_plan(datos, orden_ed, excluidos)
    alternativas.append(
        {
            "tipo": "editable",
            "nombre": editable.get("nombre") or "Alternativa C · editable",
            "parametros": {"orden_sectores": orden_ed, "centros_excluidos": sorted(excluidos)},
            **plan,
        }
    )
    return alternativas


def tabla_comparacion(alternativas: list[dict]) -> list[dict]:
    filas = []
    for clave, etiqueta in ETIQUETAS_METRICAS.items():
        filas.append(
            {
                "metrica": clave,
                "etiqueta": etiqueta,
                "valores": [a["metricas"][clave] for a in alternativas],
            }
        )
    filas.append(
        {
            "metrica": "viajes_por_vehiculo",
            "etiqueta": "Viajes por tipo de vehículo",
            "valores": [a["metricas"]["viajes_por_vehiculo"] for a in alternativas],
        }
    )
    filas.append(
        {
            "metrica": "faltantes",
            "etiqueta": "Recursos y roles faltantes",
            "valores": [a["metricas"]["faltantes"] for a in alternativas],
        }
    )
    return filas
