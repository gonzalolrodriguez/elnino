"""Tableros de decisión: ``GET /panel/resumen`` (mandos) y ``GET /admin/resumen`` (admin).

Todo se calcula con datos ya cargados; cada bloque lleva ``categoria``, ``fuente`` y ``fecha_dato``
(CLAUDE.md §9). Son lecturas: no cambian estado.
"""

from __future__ import annotations

from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.mi import _centro_sugerido
from app.core import auditoria, constantes
from app.core.eventos import difusor
from app.core.rbac import ip_cliente, requiere_rol
from app.core.tiempo import hoy_ar
from app.db.base import ahora
from app.db.modelos import (
    AuditoriaAcceso,
    BitacoraDecision,
    CentroRecepcion,
    Cuadrilla,
    IntentoLogin,
    LecturaLluvia,
    Orden,
    Sector,
    SolicitudAsistencia,
    Tarea,
    Usuario,
)
from app.db.sesion import get_db
from app.domain import ascenso
from app.servicios import contexto, recomendacion

router = APIRouter(tags=["panel"])
_MANDOS = ("operador", "decisor", "admin")
FUENTE_K1 = "K1 · serie limpia de Puerto Formosa; umbrales K3"
FUENTE_PLATAFORMA = "Datos cargados en la plataforma (SIMULADO)"


def _bloque(categoria: str, fuente: str, fecha_dato: str | None, **campos) -> dict:
    return {"categoria": categoria, "fuente": fuente, "fecha_dato": fecha_dato, **campos}


@router.get("/panel/resumen")
def panel_resumen(
    request: Request,
    usuario: Usuario = Depends(requiere_rol(*_MANDOS)),
    db: Session = Depends(get_db),
) -> dict:
    hoy = hoy_ar()
    serie = contexto.serie_diaria(db)
    ultima = contexto.ultima_lectura_o_none(serie)
    umbrales = contexto.umbrales_formosa(db)
    tasas = ascenso.tasas_m_dia(serie)

    # ---- río ---------------------------------------------------------------------------------
    if ultima is None:
        rio = _bloque("DATO OBSERVADO", FUENTE_K1, None, disponible=False)
        altura = 0.0
    else:
        fecha_u, altura = ultima
        previo = serie.get(fecha_u - timedelta(days=7))
        tendencia = None if previo is None else round(altura - previo, 2)
        tiempos = []
        for etiqueta, valor in (
            ("Alerta", umbrales.alerta_m),
            ("Evacuación", umbrales.evacuacion_m),
        ):
            t = ascenso.tiempo_restante(altura, valor, tasas)
            tiempos.append(
                {
                    "objetivo": etiqueta,
                    "valor_m": valor,
                    "ya_alcanzado": t.ya_alcanzado,
                    "dias_minimo": t.dias_minimo,
                    "dias_maximo": t.dias_maximo,
                }
            )
        rio = _bloque(
            "DATO OBSERVADO",
            FUENTE_K1,
            fecha_u.isoformat(),
            disponible=True,
            altura_m=altura,
            fecha_lectura=fecha_u.isoformat(),
            umbral_alerta_m=umbrales.alerta_m,
            umbral_evacuacion_m=umbrales.evacuacion_m,
            distancia_a_alerta_m=round(umbrales.alerta_m - altura, 2),
            distancia_a_evacuacion_m=round(umbrales.evacuacion_m - altura, 2),
            tendencia_7d_m=tendencia,
            tendencia_7d_m_por_dia=None if tendencia is None else round(tendencia / 7, 3),
            tiempo_a_umbrales=tiempos,
            supuesto_proyeccion=ascenso.SUPUESTO_LINEAL,
            categoria_proyeccion="SIMULADO",
        )

    # ---- sectores ------------------------------------------------------------------------------
    escenario = contexto.calcular_escenario(db, altura)
    exposicion = recomendacion.cargar_exposicion(db)
    geo = {s.id: s for s in contexto.cargar_sectores(db)}
    centros = contexto.cargar_centros(db)
    sectores = []
    for s in escenario.sectores:
        exp = exposicion.get(s.id, recomendacion.Exposicion())
        entrada = recomendacion.entrada_ganaderia(exp.stock)
        animales = (
            sum(entrada.bovinos.values())
            + entrada.bovinos_sin_clasificar
            + sum((entrada.menores or {}).values())
        )
        g = geo[s.id]
        sectores.append(
            {
                "id": s.id,
                "nombre": s.nombre,
                "estado": s.estado,
                "aislado": s.aislado,
                "margen_a_compromiso_m": s.margen_a_compromiso_m,
                "altura_compromiso_m": s.altura_compromiso_m,
                "personas_k10": s.poblacion_simulada,
                "personas_registradas": exp.personas_registradas,
                "familias_registradas": exp.familias,
                "animales_expuestos": animales,
                "colmenas": entrada.colmenas_vivas,
                "accesos": [
                    {"nombre": a.nombre, "superficie": a.superficie, "estado": a.estado}
                    for a in s.accesos
                ],
                "centro_sugerido": _centro_sugerido(
                    centros,
                    g.lon,
                    g.lat,
                    s.poblacion_simulada + exp.personas_registradas,
                    animales,
                ),
            }
        )
    bloque_sectores = _bloque(
        "SIMULADO",
        contexto.FUENTE_K10 + "; personas y productores registrados (SIMULADO)",
        hoy.isoformat(),
        altura_usada_m=altura,
        items=sectores,
    )

    # ---- solicitudes -------------------------------------------------------------------------
    solicitudes = db.execute(
        select(
            SolicitudAsistencia.estado,
            SolicitudAsistencia.sector_id,
            SolicitudAsistencia.origen,
            SolicitudAsistencia.creado_en,
            SolicitudAsistencia.requiere_verificacion,
        )
    ).all()
    recibidas = [r.creado_en for r in solicitudes if r.estado == "recibida"]
    bloque_solicitudes = _bloque(
        "SIMULADO",
        FUENTE_PLATAFORMA,
        hoy.isoformat(),
        total=len(solicitudes),
        por_estado=dict(Counter(r.estado for r in solicitudes)),
        por_sector=dict(Counter(r.sector_id or "sin_sector" for r in solicitudes)),
        por_origen=dict(Counter(r.origen for r in solicitudes)),
        recibidas_mas_antigua_min=(
            None if not recibidas else int((ahora() - min(recibidas)).total_seconds() // 60)
        ),
        a_verificar=sum(1 for r in solicitudes if r.requiere_verificacion),
    )

    # ---- centros -------------------------------------------------------------------------------
    filas_centros = db.execute(select(CentroRecepcion).order_by(CentroRecepcion.id)).scalars().all()
    bloque_centros = _bloque(
        "SIMULADO",
        "Centros de recepción: capacidad y ocupación SIMULADO",
        _max_fecha(c.fecha_dato for c in filas_centros),
        items=[
            {
                "id": c.id,
                "nombre": c.nombre,
                "tipo": c.tipo,
                "capacidad_personas": c.capacidad_personas,
                "capacidad_animales": c.capacidad_animales,
                "ocupacion": c.ocupacion,
                "ocupacion_pct": (
                    round(100 * c.ocupacion / c.capacidad_personas)
                    if c.capacidad_personas
                    else None
                ),
            }
            for c in filas_centros
        ],
    )

    # ---- cuadrillas y tareas ---------------------------------------------------------------------
    tareas_por = Counter(
        (t.cuadrilla_id, t.estado) for t in db.execute(select(Tarea)).scalars().all()
    )
    cuadrillas = db.execute(select(Cuadrilla).order_by(Cuadrilla.id)).scalars().all()
    bloque_cuadrillas = _bloque(
        "SIMULADO",
        FUENTE_PLATAFORMA,
        hoy.isoformat(),
        items=[
            {
                "id": c.id,
                "nombre": c.nombre,
                "tipo_incidente": c.tipo_incidente,
                "estado": c.estado,
                "tareas": {
                    e: tareas_por.get((c.id, e), 0)
                    for e in ("pendiente", "en_curso", "completada", "cancelada")
                },
            }
            for c in cuadrillas
        ],
        tareas_sin_cuadrilla=sum(n for (cid, _), n in tareas_por.items() if cid is None),
    )

    # ---- órdenes y bitácora ------------------------------------------------------------------
    ordenes = db.execute(select(Orden).order_by(Orden.id.desc()).limit(5)).scalars().all()
    bloque_ordenes = _bloque(
        "SIMULADO",
        "Órdenes emitidas por el rol decisor",
        ordenes[0].creada_en.date().isoformat() if ordenes else None,
        recientes=[
            {
                "id": o.id,
                "tipo": o.tipo,
                "sectores": o.sectores,
                "emitida_por_rol": o.rol_operativo,
                "creada_en": o.creada_en.isoformat(),
            }
            for o in ordenes
        ],
        bitacora_borradores=db.execute(
            select(func.count(BitacoraDecision.id)).where(BitacoraDecision.estado == "borrador")
        ).scalar_one(),
    )

    # ---- lluvia (7 días) ---------------------------------------------------------------------
    desde = hoy - timedelta(days=7)
    lluvia = db.execute(
        select(
            LecturaLluvia.origen, LecturaLluvia.categoria, LecturaLluvia.mm, LecturaLluvia.fecha
        ).where(LecturaLluvia.fecha >= desde)
    ).all()
    por_origen: dict[str, dict] = {}
    for r in lluvia:
        d = por_origen.setdefault(
            r.origen, {"lecturas": 0, "mm_total": 0.0, "sin_medicion": 0, "categoria": r.categoria}
        )
        d["lecturas"] += 1
        if r.mm is None:
            d["sin_medicion"] += 1
        else:
            d["mm_total"] = round(d["mm_total"] + float(r.mm), 1)
    ultima_lluvia = max((r.fecha for r in lluvia), default=None)
    bloque_lluvia = _bloque(
        "SIMULADO",
        "Partes y cargas de lluvia; el kit no trae lluvia observada",
        None if ultima_lluvia is None else ultima_lluvia.isoformat(),
        desde=desde.isoformat(),
        por_origen=por_origen,
        sin_dato_observado=not any(d["categoria"] != "SIMULADO" for d in por_origen.values()),
    )

    auditoria.registrar(
        db, "lectura_datos_personales", "panel/resumen", usuario.id, ip_cliente(request)
    )
    db.commit()
    return {
        "generado_en": ahora().isoformat(),
        "leyenda": constantes.LEYENDA,
        "rio": rio,
        "sectores": bloque_sectores,
        "solicitudes": bloque_solicitudes,
        "centros": bloque_centros,
        "cuadrillas": bloque_cuadrillas,
        "ordenes": bloque_ordenes,
        "lluvia_7d": bloque_lluvia,
        "frescura": {
            "rio_ultima_lectura": None if ultima is None else ultima[0].isoformat(),
            "k10_sectores": next(
                iter(sorted({str(s.fecha_dato) for s in _sectores_fecha(db)})), None
            ),
            "lluvia_ultima_lectura": None if ultima_lluvia is None else ultima_lluvia.isoformat(),
            "fecha_corte": constantes.FECHA_CORTE,
        },
        "categoria": "SIMULADO",
        "fuente": "Resumen calculado con datos de la plataforma",
        "fecha_dato": hoy.isoformat(),
    }


def _max_fecha(fechas) -> str | None:
    validas = [f for f in fechas if f]
    return max(validas).isoformat() if validas else None


def _sectores_fecha(db: Session):
    return db.execute(select(Sector)).scalars().all()


@router.get("/admin/resumen")
def admin_resumen(
    request: Request,
    admin: Usuario = Depends(requiere_rol("admin")),
    db: Session = Depends(get_db),
) -> dict:
    ahora_ = ahora()
    usuarios = db.execute(select(Usuario)).scalars().all()
    intentos = db.execute(select(IntentoLogin)).scalars().all()
    bloqueados = [i for i in intentos if i.bloqueado_hasta and i.bloqueado_hasta > ahora_]
    inactivos_30d = [
        u
        for u in usuarios
        if u.estado == "activo"
        and (u.ultimo_login is None or u.ultimo_login < ahora_ - timedelta(days=30))
    ]
    integra, primera_rota = auditoria.verificar_cadena(db)
    total_audit = db.execute(select(func.count()).select_from(AuditoriaAcceso)).scalar_one()
    db.execute(select(1))  # comprueba la conexión
    auditoria.registrar(
        db, "lectura_datos_personales", "admin/resumen", admin.id, ip_cliente(request)
    )
    db.commit()
    return {
        "generado_en": ahora_.isoformat(),
        "usuarios": {
            "total": len(usuarios),
            "por_rol": dict(Counter(u.rol for u in usuarios)),
            "por_estado": dict(Counter(u.estado for u in usuarios)),
            "sin_login_30_dias": len(inactivos_30d),
            "cuentas_bloqueadas": len(bloqueados),
            "intentos_fallidos_en_curso": sum(i.intentos for i in intentos),
            "bloqueos": [
                {
                    "usuario_id": i.usuario_id,
                    "ip": i.ip,
                    "bloqueado_hasta": i.bloqueado_hasta.isoformat(),
                }
                for i in bloqueados
            ],
        },
        "auditoria": {
            "cadena_integra": integra,
            "primera_fila_inconsistente": primera_rota,
            "filas": total_audit,
        },
        "servicio": {
            "base_de_datos": "ok",
            "websockets_activos": difusor.conexiones_activas(),
            "version": constantes.VERSION,
        },
        "categoria": "SIMULADO",
        "fuente": "Estado interno de la plataforma",
        "fecha_dato": hoy_ar().isoformat(),
    }
