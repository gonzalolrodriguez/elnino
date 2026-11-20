"""Carga inicial idempotente: ``python -m app.db.seed`` (desde ``apps/backend``).

Orden: K3 (estaciones) -> K10 (sectores, sin cambios) -> K1 limpio -> datos SIMULADOS de
``data/simulado/`` -> usuarios de demostración. Se puede ejecutar varias veces: cada entidad se
busca por su clave natural y no se duplica ni se pisa lo que un operador haya cambiado
(por ejemplo, ``accesos.transitable``).
"""

from __future__ import annotations

import csv
import json
from datetime import date, datetime, timedelta
from pathlib import Path

from geoalchemy2 import WKTElement
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config.settings import DATA_DIR, get_settings
from app.core import cifrado
from app.core.seguridad import hashear_password
from app.db.base import SRID, ahora
from app.db.consultas import sector_de_punto
from app.db.modelos import (
    Acceso,
    CentroRecepcion,
    ConfirmacionEvacuado,
    Cuadrilla,
    Establecimiento,
    Estacion,
    GrupoFamiliar,
    IntegranteCuadrilla,
    LecturaHidrometrica,
    Notificacion,
    PuestoPluviometrico,
    RecursoSimulado,
    RolOperativo,
    Sector,
    SolicitudAsistencia,
    StockProductivo,
    Tarea,
    Usuario,
)
from app.db.sesion import get_sessionmaker
from app.ingest import limpieza_k1

KIT = DATA_DIR / "kit"
SIMULADO = DATA_DIR / "simulado"

CAT_OBSERVADO = "DATO OBSERVADO"
CAT_SIMULADO = "SIMULADO"
ESTACION_FORMOSA = 57
FUENTE_K1 = "K1 · P1_DATA_INTEGRITY_dataset_participantes_v1.csv (limpio, ver registro_limpieza.md)"
LOTE = 1000


def _json(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding="utf-8"))


def _punto(lon: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=SRID)


def sembrar_roles_operativos(db: Session) -> int:
    for r in _json(SIMULADO / "roles_operativos.json")["roles"]:
        if db.get(RolOperativo, r["codigo"]) is None:
            db.add(
                RolOperativo(codigo=r["codigo"], nombre=r["nombre"], descripcion=r["descripcion"])
            )
    db.flush()
    return len(_json(SIMULADO / "roles_operativos.json")["roles"])


def sembrar_estaciones(db: Session) -> int:
    k3 = _json(KIT / "K3_estaciones_umbrales.json")
    fecha = date.fromisoformat(k3["fecha_corte"])
    for clave, e in k3["estaciones"].items():
        fila = db.get(Estacion, e["siteCode"]) or Estacion(codigo=e["siteCode"])
        fila.clave = clave
        fila.nombre = e["nombre"]
        fila.abreviatura = e.get("abreviatura")
        fila.rio = e["rio"]
        fila.geom = _punto(e["lon"], e["lat"])
        fila.aguas_bajas_m = e["aguas_bajas"]
        fila.alerta_m = e["alerta"]
        fila.evacuacion_m = e["evacuacion"]
        fila.categoria = CAT_OBSERVADO
        fila.fuente = f"K3 · {k3['fuente']}"
        fila.fecha_dato = fecha
        db.add(fila)
    db.flush()
    return len(k3["estaciones"])


def sembrar_sectores(db: Session) -> int:
    """K10 tal como lo armó la mesa: geometría y atributos sin cambios."""
    k10 = _json(KIT / "K10_sectores_simulados.geojson")
    meta = k10["metadata"]
    for f in k10["features"]:
        p = f["properties"]
        fila = db.get(Sector, p["id"]) or Sector(id=p["id"])
        fila.nombre = p["nombre"]
        fila.geom = from_shape(shape(f["geometry"]), srid=SRID)
        fila.altura_compromiso_m = p["altura_escala_compromiso_m"]
        fila.poblacion_simulada = p["poblacion_simulada"]
        fila.acceso_simulado = p["acceso_simulado"]
        fila.estacion_referencia = p["estacion_referencia"]
        fila.categoria = CAT_SIMULADO
        fila.fuente = "K10 · K10_sectores_simulados.geojson"
        fila.version = meta["version"]
        fila.fecha_dato = date.fromisoformat(meta["fecha"])
        db.add(fila)
    db.flush()
    return len(k10["features"])


def sembrar_lecturas_k1(db: Session) -> int:
    """Inserta K1 limpio (regenerándolo si falta). Idempotente por ``obs_id``."""
    if not limpieza_k1.RUTA_LIMPIO.exists():
        limpieza_k1.ejecutar()
    filas: list[dict] = []
    with limpieza_k1.RUTA_LIMPIO.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            inicio = datetime.strptime(r["timestart"], limpieza_k1.FORMATO_ISO)
            filas.append(
                {
                    "obs_id": int(r["obs_id"]),
                    "estacion_codigo": ESTACION_FORMOSA,
                    "timestart": inicio,
                    "timeend": datetime.strptime(r["timeend"], limpieza_k1.FORMATO_ISO),
                    "valor_m": r["valor_m"],
                    "valor_original": r["valor_original"],
                    "unidad_original": r["unidad_original"],
                    "calidad": r["calidad"],
                    "transformacion": r["transformacion"] or None,
                    "categoria": CAT_OBSERVADO,
                    "fuente": FUENTE_K1,
                    "fecha_dato": inicio.date(),
                }
            )
    for i in range(0, len(filas), LOTE):
        db.execute(
            insert(LecturaHidrometrica)
            .values(filas[i : i + LOTE])
            .on_conflict_do_nothing(index_elements=["obs_id"])
        )
    db.flush()
    return len(filas)


def sembrar_accesos(db: Session) -> int:
    datos = _json(SIMULADO / "accesos.geojson")
    fecha = date.fromisoformat(datos["metadata"]["fecha"])
    nuevos = 0
    for f in datos["features"]:
        p = f["properties"]
        existe = db.execute(
            select(Acceso.id).where(
                Acceso.sector_id == p["sector_id"], Acceso.nombre == p["nombre"]
            )
        ).first()
        if existe:
            continue
        db.add(
            Acceso(
                sector_id=p["sector_id"],
                nombre=p["nombre"],
                geom=from_shape(shape(f["geometry"]), srid=SRID),
                superficie=p["superficie"],
                transitable=p["transitable"],
                categoria=CAT_SIMULADO,
                fuente=datos["metadata"]["fuente"],
                fecha_dato=fecha,
            )
        )
        nuevos += 1
    db.flush()
    return nuevos


def sembrar_centros(db: Session) -> int:
    datos = _json(SIMULADO / "centros_recepcion.json")
    fecha = date.fromisoformat(datos["fecha"])
    nuevos = 0
    for c in datos["centros"]:
        if db.execute(
            select(CentroRecepcion.id).where(CentroRecepcion.nombre == c["nombre"])
        ).first():
            continue
        db.add(
            CentroRecepcion(
                nombre=c["nombre"],
                tipo=c["tipo"],
                geom=_punto(c["lon"], c["lat"]),
                sector_id=c["sector_id"],
                capacidad_personas=c["capacidad_personas"],
                capacidad_animales=c["capacidad_animales"],
                servicios=c["servicios"],
                ocupacion=c["ocupacion"],
                nota=datos["nota"],
                categoria=CAT_SIMULADO,
                fuente=datos["fuente"],
                fecha_dato=fecha,
            )
        )
        nuevos += 1
    db.flush()
    return nuevos


def sembrar_recursos(db: Session) -> int:
    datos = _json(SIMULADO / "recursos.json")
    nuevos = 0
    for r in datos["recursos"]:
        if db.execute(select(RecursoSimulado.id).where(RecursoSimulado.tipo == r["tipo"])).first():
            continue
        db.add(RecursoSimulado(categoria=CAT_SIMULADO, fuente=datos["fuente"], **r))
        nuevos += 1
    db.flush()
    return nuevos


def sembrar_puestos(db: Session) -> int:
    datos = _json(SIMULADO / "puestos_pluviometricos.json")
    fecha = date.fromisoformat(datos["fecha"])
    nuevos = 0
    for p in datos["puestos"]:
        if db.execute(
            select(PuestoPluviometrico.id).where(PuestoPluviometrico.codigo == p["codigo"])
        ).first():
            continue
        db.add(
            PuestoPluviometrico(
                codigo=p["codigo"],
                nombre=p["nombre"],
                zona=p["zona"],
                geom=_punto(p["lon"], p["lat"]),
                categoria=CAT_SIMULADO,
                fuente=datos["fuente"],
                fecha_dato=fecha,
            )
        )
        nuevos += 1
    db.flush()
    return nuevos


def sembrar_usuarios(db: Session) -> int:
    s = get_settings()
    if not s.demo_password:
        raise RuntimeError("DEMO_PASSWORD no configurada (ver .env.example); no se crean usuarios.")
    datos = _json(SIMULADO / "usuarios_demo.json")
    nuevos = 0
    for u in datos["usuarios"]:
        if db.execute(select(Usuario.id).where(Usuario.email == u["email"])).first():
            continue
        clave = (
            (s.demo_admin_password or s.demo_password) if u["rol"] == "admin" else s.demo_password
        )
        usuario = Usuario(
            email=u["email"],
            hash_password=hashear_password(clave),
            nombre_visible=u["nombre_visible"],
            rol=u["rol"],
            rol_operativo=u["rol_operativo"],
            es_demo=True,
            consentimiento_en=ahora() if u["rol"] in ("ciudadano", "productor") else None,
        )
        db.add(usuario)
        db.flush()
        if "grupo" in u:
            g = u["grupo"]
            grupo = GrupoFamiliar(
                usuario_id=usuario.id,
                integrantes=g["integrantes"],
                menores=g["menores"],
                mayores=g["mayores"],
                mascotas=g["mascotas"],
                domicilio=_punto(g["lon"], g["lat"]),
                sector_id=sector_de_punto(db, g["lon"], g["lat"]),
            )
            for campo in ("salud", "vulnerabilidad", "telefono"):
                setattr(
                    grupo,
                    f"{campo}_cifrado",
                    cifrado.cifrar(g[campo], f"grupos_familiares.{campo}"),
                )
            db.add(grupo)
        if "establecimiento" in u:
            e = u["establecimiento"]
            est = Establecimiento(
                productor_id=usuario.id,
                nombre=e["nombre"],
                geom_tranquera=_punto(e["lon"], e["lat"]),
                sector_id=sector_de_punto(db, e["lon"], e["lat"]),
            )
            db.add(est)
            db.flush()
            for item in e["stock"]:
                db.add(StockProductivo(establecimiento_id=est.id, **item))
        nuevos += 1
    db.flush()
    return nuevos


def sembrar_cuadrillas(db: Session) -> int:
    datos = _json(SIMULADO / "cuadrillas.json")
    nuevas = 0
    for c in datos["cuadrillas"]:
        existente = db.execute(
            select(Cuadrilla).where(Cuadrilla.nombre == c["nombre"])
        ).scalar_one_or_none()
        if existente is not None:
            if existente.vehiculo is None and c.get("vehiculo"):
                existente.vehiculo = c["vehiculo"]  # bases sembradas antes de la migración 0009
            continue
        cuadrilla = Cuadrilla(
            nombre=c["nombre"], tipo_incidente=c["tipo_incidente"], vehiculo=c.get("vehiculo")
        )
        db.add(cuadrilla)
        db.flush()
        for i in c["integrantes"]:
            usuario_id = None
            if i.get("usuario_email"):
                usuario_id = db.execute(
                    select(Usuario.id).where(Usuario.email == i["usuario_email"])
                ).scalar_one_or_none()
            db.add(
                IntegranteCuadrilla(
                    cuadrilla_id=cuadrilla.id,
                    usuario_id=usuario_id,
                    rol_operativo=i["rol_operativo"],
                )
            )
        nuevas += 1
    db.flush()
    return nuevas


# Casos de demostración de constancias (SIMULADO): (usuario demo, tipo de pedido, desvío del destino
# respecto del centro en metros, respuesta del evacuado). ``None`` = sin responder.
CASOS_CONSTANCIAS = (
    ("ciudadano1@demo.evacuaciones.invalid", "evacuacion", 0.0, "si"),
    ("productor1@demo.evacuaciones.invalid", "ganado", 0.0, None),
    ("ciudadano2@demo.evacuaciones.invalid", "evacuacion", 1200.0, None),
)


def sembrar_constancias_demo(db: Session) -> int:
    """Tres evacuaciones cerradas de ejemplo (verificada, sin confirmar y con discrepancia).

    Pasan por la misma lógica que el endpoint de cierre. Son SIMULADO: pedidos de usuarios de demo
    cerrados por la cuadrilla de demo. Idempotente por el título de la tarea.
    """
    from app.domain.ruteo import haversine_m
    from app.servicios import evacuaciones as srv_evac

    firmante = db.execute(
        select(Usuario).where(Usuario.email == "cuadrilla@demo.evacuaciones.invalid")
    ).scalar_one_or_none()
    centros = db.execute(
        select(
            CentroRecepcion.id,
            func.ST_X(CentroRecepcion.geom),
            func.ST_Y(CentroRecepcion.geom),
        ).order_by(CentroRecepcion.id)
    ).all()
    if firmante is None or not centros:
        return 0
    nuevas = 0
    for email, tipo, desvio_m, respuesta in CASOS_CONSTANCIAS:
        usuario = db.execute(select(Usuario).where(Usuario.email == email)).scalar_one_or_none()
        titulo = f"[DEMO] Traslado registrado · {email.split('@')[0]}"
        if usuario is None or db.execute(select(Tarea.id).where(Tarea.titulo == titulo)).first():
            continue
        grupo = db.execute(
            select(GrupoFamiliar).where(GrupoFamiliar.usuario_id == usuario.id)
        ).scalar_one_or_none()
        est = (
            db.execute(select(Establecimiento).where(Establecimiento.productor_id == usuario.id))
            .scalars()
            .first()
        )
        if grupo is not None and grupo.domicilio is not None:
            origen, personas, animales = to_shape(grupo.domicilio), grupo.integrantes, 0
        elif est is not None:
            origen, personas, animales = to_shape(est.geom_tranquera), 0, 30
        else:
            continue
        solicitud = SolicitudAsistencia(
            solicitante_id=usuario.id,
            origen="app",
            tipo=tipo,
            personas=personas,
            animales=animales,
            texto="Pedido de demostración (SIMULADO)",
            geom=_punto(origen.x, origen.y),
            sector_id=sector_de_punto(db, origen.x, origen.y),
            estado="en_curso",
            detalle={"demo": "constancias"},
        )
        db.add(solicitud)
        db.flush()
        cuadrilla_tipo = "ganadera" if animales else "humana"
        cuadrilla = (
            db.execute(
                select(Cuadrilla)
                .where(Cuadrilla.tipo_incidente == cuadrilla_tipo)
                .order_by(Cuadrilla.id)
            )
            .scalars()
            .first()
        )
        tarea = Tarea(
            cuadrilla_id=cuadrilla.id if cuadrilla else None,
            solicitud_id=solicitud.id,
            sector_id=solicitud.sector_id,
            titulo=titulo,
            descripcion="Traslado de demostración con constancia (SIMULADO)",
            estado="en_curso",
        )
        db.add(tarea)
        db.flush()
        cid, cx, cy = min(centros, key=lambda c: haversine_m(origen.x, origen.y, c[1], c[2]))
        # El desvío se aplica hacia el este (1 grado de longitud ~ 100 km en esta latitud).
        constancia, _ = srv_evac.cerrar_tarea(
            db,
            tarea,
            firmante,
            firmante.rol_operativo or firmante.rol,
            lon=cx + desvio_m / 100000.0,
            lat=cy,
            centro_id=cid,
            personas=personas,
            animales={"bovinos": animales} if animales else {},
            nota="Constancia de demostración (SIMULADO): sin personas reales.",
            clave=None,
        )
        solicitud.estado = "resuelta"
        if respuesta:
            k = db.execute(
                select(ConfirmacionEvacuado).where(ConfirmacionEvacuado.tarea_id == tarea.id)
            ).scalar_one()
            srv_evac.registrar_confirmacion(db, k.id, respuesta, None, "app", usuario.id)
            for n in db.execute(
                select(Notificacion).where(
                    Notificacion.usuario_id == usuario.id,
                    Notificacion.tipo == srv_evac.TIPO_CONFIRMACION,
                )
            ).scalars():
                n.leida = True
        nuevas += 1
    db.flush()
    return nuevas


def sembrar_recorrido_demo(db: Session) -> int:
    """Un pedido de demostración con la tarea en curso para ver al vehículo avanzar (SIMULADO).

    Es el pedido de ``productor2`` atendido por la cuadrilla ganadera de demo. La posición la simula
    el servidor (``seguimiento_demo``); cada vez que se corre el seed la tarea vuelve a "recién
    salió", así la demo puede reiniciarse. Idempotente por el título de la tarea.
    """
    usuario = db.execute(
        select(Usuario).where(Usuario.email == "productor2@demo.evacuaciones.invalid")
    ).scalar_one_or_none()
    cuadrilla = db.execute(
        select(Cuadrilla).where(Cuadrilla.tipo_incidente == "ganadera").order_by(Cuadrilla.id)
    ).scalars().first()
    est = (
        db.execute(select(Establecimiento).where(Establecimiento.productor_id == usuario.id))
        .scalars()
        .first()
        if usuario is not None
        else None
    )
    if usuario is None or cuadrilla is None or est is None:
        return 0
    titulo = "[DEMO] Traslado en camino · productor2"
    inicio = ahora() - timedelta(minutes=3)
    tarea = db.execute(select(Tarea).where(Tarea.titulo == titulo)).scalar_one_or_none()
    if tarea is not None:
        if tarea.estado == "en_curso":
            tarea.actualizado_en = inicio  # reinicia el recorrido simulado
        return 0
    origen = to_shape(est.geom_tranquera)
    solicitud = SolicitudAsistencia(
        solicitante_id=usuario.id,
        origen="app",
        tipo="ganado",
        personas=0,
        animales=25,
        texto="Pedido de demostración (SIMULADO)",
        geom=_punto(origen.x, origen.y),
        sector_id=sector_de_punto(db, origen.x, origen.y),
        estado="en_curso",
        detalle={"demo": "recorrido"},
    )
    db.add(solicitud)
    db.flush()
    db.add(
        Tarea(
            cuadrilla_id=cuadrilla.id,
            solicitud_id=solicitud.id,
            sector_id=solicitud.sector_id,
            titulo=titulo,
            descripcion="Traslado de demostración en camino (SIMULADO)",
            estado="en_curso",
            actualizado_en=inicio,
        )
    )
    db.flush()
    return 1


def sembrar_todo(db: Session) -> dict[str, int]:
    """Carga los datos base; los usuarios y cuadrillas de demo solo con ``SEED_DEMO=true``."""
    demo = get_settings().seed_demo
    resultado = {
        "roles_operativos": sembrar_roles_operativos(db),
        "estaciones": sembrar_estaciones(db),
        "sectores": sembrar_sectores(db),
        "lecturas_k1_leidas": sembrar_lecturas_k1(db),
        "accesos_nuevos": sembrar_accesos(db),
        "centros_nuevos": sembrar_centros(db),
        "recursos_nuevos": sembrar_recursos(db),
        "puestos_nuevos": sembrar_puestos(db),
        "usuarios_demo_nuevos": sembrar_usuarios(db) if demo else 0,
        "cuadrillas_nuevas": sembrar_cuadrillas(db) if demo else 0,
    }
    resultado["constancias_demo_nuevas"] = sembrar_constancias_demo(db) if demo else 0
    resultado["recorrido_demo_nuevo"] = sembrar_recorrido_demo(db) if demo else 0
    db.commit()
    return resultado


def main() -> None:
    with get_sessionmaker()() as db:
        for clave, valor in sembrar_todo(db).items():
            print(f"{clave}: {valor}")


if __name__ == "__main__":
    main()
