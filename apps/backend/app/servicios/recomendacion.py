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
from app.db.modelos import (
    Cuadrilla,
    Establecimiento,
    GrupoFamiliar,
    IntegranteCuadrilla,
    Sector,
    StockProductivo,
)
from app.domain import ascenso, asignacion, cuadrillas, ganaderia, ruteo
from app.domain import escenario as esc
from app.servicios import contexto
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
    """Convierte filas de stock ``(especie, categoría, cantidad)`` en la entrada del cálculo."""
    bovinos: dict[str, int] = {}
    sin_clasificar = 0
    menores: dict[str, int] = {}
    colmenas = 0
    for especie, categoria, cantidad in items:
        clave = ganaderia.sin_tildes(especie.casefold()).strip()
        if clave.startswith("bovin"):
            canonica = ganaderia.categoria_canonica(categoria)
            if canonica is None:
                sin_clasificar += cantidad
            else:
                bovinos[canonica] = bovinos.get(canonica, 0) + cantidad
        elif clave in ganaderia.ESPECIES_MENORES:
            menores[clave] = menores.get(clave, 0) + cantidad
        elif clave.startswith("colmena") or clave.startswith("abeja"):
            colmenas += cantidad
    return ganaderia.EntradaGanaderia(
        bovinos=bovinos,
        bovinos_sin_clasificar=sin_clasificar,
        menores=menores or None,
        colmenas_vivas=colmenas,
    )


def roles_de_cuadrillas(db: Session) -> dict[str, list[str]]:
    """Roles de la primera cuadrilla disponible de cada tipo (vacío si no hay ninguna)."""
    resultado: dict[str, list[str]] = {t: [] for t in cuadrillas.TIPOS}
    for tipo in cuadrillas.TIPOS:
        c = db.execute(
            select(Cuadrilla)
            .where(Cuadrilla.tipo_incidente == tipo, Cuadrilla.estado == "disponible")
            .order_by(Cuadrilla.id)
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


def cargar_datos(
    db: Session,
    altura_m: float,
    lluvia_mm: float,
    caminos_cerrados: set[int],
    humedad_suelo: float | None = None,
) -> DatosPlan:
    return DatosPlan(
        altura_m=altura_m,
        lluvia_mm=lluvia_mm,
        escenario=contexto.calcular_escenario(
            db, altura_m, lluvia_mm, caminos_cerrados, humedad_suelo
        ),
        sectores={s.id: s for s in contexto.cargar_sectores(db)},
        exposicion=cargar_exposicion(db),
        centros=contexto.cargar_centros(db),
        recursos=contexto.cargar_recursos(db),
        tasas=ascenso.tasas_m_dia(contexto.serie_diaria(db)),
        roles_cuadrillas=roles_de_cuadrillas(db),
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


def _velocidad_kmh(modo: str, superficie: str | None) -> float:
    if modo == "lancha":
        return float(supuesto("velocidad_lancha_kmh"))
    vel = ruteo.velocidades(ruteo.VEHICULAR)
    return vel[superficie or "tierra"]


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


def construir_plan(
    datos: DatosPlan,
    orden: list[str],
    centros_excluidos: set[int] | None = None,
) -> dict:
    """Asigna personas y animales a centros en el orden dado y estima recursos y tiempos."""
    excluidos = centros_excluidos or set()
    centros = [c for c in datos.centros if c.id not in excluidos]
    factor = float(supuesto("factor_desvio"))

    # ---- datos por sector --------------------------------------------------------------------
    info: dict[str, dict] = {}
    for sid in orden:
        estado = datos.escenario.sector(sid)
        exp = datos.exposicion.get(sid, Exposicion())
        entrada = entrada_ganaderia(exp.stock)
        calc = ganaderia.calcular(entrada) if exp.stock else None
        animales = (calc["bovinos_total"] if calc else 0) + sum((entrada.menores or {}).values())
        personas = datos.sectores[sid].poblacion_simulada + exp.personas_registradas
        info[sid] = {
            "estado": estado,
            "exp": exp,
            "entrada": entrada,
            "calc": calc,
            "animales": animales,
            "personas": personas,
        }

    def dist(sid: str, c: CentroGeo) -> float:
        s = datos.sectores[sid]
        return ruteo.haversine_m(s.lon, s.lat, c.lon, c.lat)

    d_personas = {(sid, c.id): dist(sid, c) for sid in orden for c in centros}
    res_p = asignacion.asignar(
        [asignacion.Demanda(sid, info[sid]["personas"], i) for i, sid in enumerate(orden)],
        [asignacion.Capacidad(c.id, c.nombre, c.cupo_personas) for c in centros],
        d_personas,
    )
    res_a = asignacion.asignar(
        [asignacion.Demanda(sid, info[sid]["animales"], i) for i, sid in enumerate(orden)],
        [asignacion.Capacidad(c.id, c.nombre, c.cupo_animales) for c in centros],
        d_personas,
    )

    # ---- recursos, tiempos y detalle por sector ------------------------------------------------
    viajes_por_vehiculo: dict[str, int] = {}
    faltantes_veh: dict[str, int] = {}
    camiones_necesarios = 0
    acumulado = 0.0
    primer_sector_min: float | None = None
    vulnerables = 0
    aislados_lancha = 0
    detalle: list[dict] = []
    tipos_cuadrilla: set[str] = set()

    for pos, sid in enumerate(orden):
        i = info[sid]
        estado: esc.SectorEstado = i["estado"]
        exp: Exposicion = i["exp"]
        modo, superficie = _modo_transporte(estado)
        asignadas = res_p.asignado_a(sid)
        cap = datos.recursos.get(modo, {}).get("capacidad_unitaria", 0)
        disp = datos.recursos.get(modo, {}).get("cantidad", 0)
        viajes = math.ceil(asignadas / cap) if cap else 0
        rondas = math.ceil(viajes / disp) if disp else 0
        asig_centros = [a for a in res_p.asignaciones if a.demanda_id == sid]
        principal = max(asig_centros, key=lambda a: a.cantidad, default=None)
        ida_min = None
        completar_min = 0.0
        if principal is not None and rondas:
            centro = next(c for c in centros if c.id == principal.centro_id)
            metros = d_personas[(sid, centro.id)] * factor
            ida_min = ruteo.tiempo_min(metros, _velocidad_kmh(modo, superficie))
            completar_min = round((2 * rondas - 1) * ida_min, 1)
        acumulado = round(acumulado + completar_min, 1)
        if primer_sector_min is None and asignadas:
            primer_sector_min = acumulado
        viajes_por_vehiculo[modo] = viajes_por_vehiculo.get(modo, 0) + viajes
        if disp and viajes > disp:
            faltantes_veh[modo] = faltantes_veh.get(modo, 0) + (viajes - disp)
        if modo == "lancha":
            aislados_lancha += 1
        elif superficie != "pavimento":
            vulnerables += 1

        calc = i["calc"]
        camiones = calc["transporte"]["camiones_jaula"] if calc else 0
        cat_b = sum(calc["transporte"]["vehiculos_categoria_b"].values()) if calc else 0
        camiones_necesarios += camiones
        advertencias: list[str] = []
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

        bovinos = calc["bovinos_total"] if calc else 0
        colmenas = i["entrada"].colmenas_vivas
        tipos = cuadrillas.tipos_necesarios(i["personas"] > 0, bovinos, colmenas)
        tipos_cuadrilla.update(tipos)
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
                "traslado_personas": {
                    "vehiculo": modo,
                    "superficie_acceso": superficie,
                    "viajes": viajes,
                    "vehiculos_disponibles": disp,
                    "rondas": rondas,
                    "tiempo_ida_min": ida_min,
                    "tiempo_para_completar_min": completar_min,
                    "tiempo_acumulado_min": acumulado,
                },
                "asignacion_personas": [
                    {"centro_id": a.centro_id, "centro": a.centro_nombre, "cantidad": a.cantidad}
                    for a in asig_centros
                ],
                "personas_sin_lugar": res_p.sin_lugar.get(sid, 0),
                "asignacion_animales": [
                    {"centro_id": a.centro_id, "centro": a.centro_nombre, "cantidad": a.cantidad}
                    for a in res_a.asignaciones
                    if a.demanda_id == sid
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

    disp_jaula = datos.recursos.get("camion_jaula", {}).get("cantidad", 0)
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
        "tiempo_total_min": acumulado,
        "accesos_vulnerables_usados": vulnerables,
        "sectores_por_lancha": aislados_lancha,
        "faltantes": {
            "vehiculos_por_viajes_en_una_ronda": faltantes_veh,
            "camiones_jaula": max(camiones_necesarios - disp_jaula, 0),
            "cupo_personas_en_centros": res_p.total_sin_lugar,
            "cupo_animales_en_centros": res_a.total_sin_lugar,
            "roles_por_cuadrilla": roles_faltantes,
        },
        "cupo_personas_total_centros": cupo_personas_total,
    }
    return {
        "orden_sectores": orden,
        "centros_excluidos": sorted(excluidos),
        "metricas": metricas,
        "sectores": detalle,
        "cupos_restantes_centros": {str(k): v for k, v in res_p.cupos_restantes.items()},
    }


def _entrada_dict(datos: DatosPlan, caminos: set[int]) -> dict:
    return {
        "altura_formosa_m": datos.altura_m,
        "lluvia_mm": datos.lluvia_mm,
        "caminos_cerrados": sorted(caminos),
    }


def recomendar(
    db: Session,
    altura_m: float,
    lluvia_mm: float,
    caminos_cerrados: set[int],
    prioridad: str = "riesgo",
    sectores: list[str] | None = None,
    humedad_suelo: float | None = None,
) -> dict:
    datos = cargar_datos(db, altura_m, lluvia_mm, caminos_cerrados, humedad_suelo)
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
            "Los tiempos usan velocidades y factor de desvío SUPUESTO; no son recorridos reales.",
            ascenso.SUPUESTO_LINEAL,
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
    "tiempo_total_min": "Minutos totales (flota compartida, sectores en secuencia)",
    "accesos_vulnerables_usados": "Sectores que usan accesos de ripio o tierra",
}


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
