"""Seguimiento de la cuadrilla en camino (CLAUDE.md §8.6, §8.7).

Guarda solo la última posición de cada cuadrilla (``posiciones_cuadrilla``) y solo mientras alguna
de sus tareas está ``en_curso``. La ven únicamente el solicitante de esa tarea y los roles
operativos. Todo es SIMULADO en la demo y la llegada es una estimación con supuestos explícitos.
"""

from __future__ import annotations

from datetime import timedelta

from geoalchemy2 import WKTElement
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.config.settings import supuesto
from app.db.base import SRID, ahora
from app.db.modelos import (
    Cuadrilla,
    IntegranteCuadrilla,
    PosicionCuadrilla,
    SolicitudAsistencia,
    Tarea,
)
from app.domain import seguimiento as dom
from app.servicios import ruta_seguimiento as rutas

CATEGORIA = "SIMULADO"
FUENTE = "Posición compartida por la cuadrilla desde la app (SIMULADO en la demo)"
NOTA_ESTIMACION = (
    "Es una estimación: línea recta por un factor de desvío y una velocidad media (SUPUESTO). "
    "No es una promesa de llegada."
)


FUENTE_SIMULADA = (
    "Posición SIMULADA por el servidor (modo demostración): no es la ubicación real de ninguna cuadrilla"
)
NOTA_SIMULADA = (
    "Modo demostración (SIMULADO): el vehículo sale de una base simulada y avanza por la ruta según "
    "el tiempo transcurrido y una velocidad supuesta. No es una ubicación real ni una promesa de llegada."
)


def supuestos_usados() -> dict:
    return {
        "factor_desvio": supuesto("factor_desvio"),
        "velocidad_cuadrilla_kmh": supuesto("velocidad_cuadrilla_kmh"),
        "posicion_vieja_minutos": supuesto("posicion_vieja_minutos"),
        "posicion_vencida_minutos": supuesto("posicion_vencida_minutos"),
        "fuente": "SUPUESTO (ver supuestos.yaml)",
    }


_CANDADO_PURGA = 0x5E6_0001  # clave arbitraria del candado consultivo de la purga


def _limite_vencida():
    return ahora() - timedelta(minutes=float(supuesto("posicion_vencida_minutos")))


def purgar_vencidas(db: Session) -> None:
    """Borra las posiciones vencidas (retención mínima sin tarea programada).

    Se llama en cada lectura y envío; las lecturas además filtran por antigüedad, así que una fila
    vencida nunca se muestra aunque la purga no haya corrido. Un candado consultivo evita que dos
    purgas simultáneas compitan por las mismas filas (si otra ya está purgando, esta no hace nada).
    """
    if not db.execute(select(func.pg_try_advisory_xact_lock(_CANDADO_PURGA))).scalar_one():
        return
    db.execute(
        delete(PosicionCuadrilla)
        .where(PosicionCuadrilla.registrada_en < _limite_vencida())
        .execution_options(synchronize_session=False)
    )


def cuadrillas_con_tarea_en_curso(db: Session, cuadrillas: list[int]) -> list[int]:
    if not cuadrillas:
        return []
    return sorted(
        db.execute(
            select(Tarea.cuadrilla_id)
            .where(Tarea.cuadrilla_id.in_(cuadrillas), Tarea.estado == "en_curso")
            .distinct()
        ).scalars()
    )


def registrar_posicion(
    db: Session, cuadrilla_id: int, lat: float, lon: float, precision_m: float | None
) -> int | None:
    """Guarda (pisa) la posición de la cuadrilla.

    Devuelve ``None`` si se guardó o los segundos que faltan para poder enviar otra (rate limit por
    cuadrilla). La fila se bloquea para que dos envíos simultáneos no se salteen el límite.
    """
    previa = db.execute(
        select(PosicionCuadrilla)
        .where(PosicionCuadrilla.cuadrilla_id == cuadrilla_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    ahora_ = ahora()
    if previa is not None:
        minimo = timedelta(seconds=float(supuesto("intervalo_min_posicion_s")))
        espera = minimo - (ahora_ - previa.registrada_en)
        if espera > timedelta(0):
            return max(1, int(espera.total_seconds()) + 1)
    punto = WKTElement(f"POINT({lon} {lat})", srid=SRID)
    if previa is None:
        # Upsert sin carrera: si otro envío simultáneo insertó la primera fila, este cuenta como
        # demasiado seguido (429) en lugar de chocar con la clave primaria (500).
        creada = db.execute(
            pg_insert(PosicionCuadrilla)
            .values(
                cuadrilla_id=cuadrilla_id,
                geom=punto,
                precision_m=precision_m,
                registrada_en=ahora_,
                categoria=CATEGORIA,
            )
            .on_conflict_do_nothing(index_elements=["cuadrilla_id"])
            .returning(PosicionCuadrilla.cuadrilla_id)
        ).scalar_one_or_none()
        if creada is None:
            return max(1, int(float(supuesto("intervalo_min_posicion_s"))))
    else:
        previa.geom = punto
        previa.precision_m = precision_m
        previa.registrada_en = ahora_
    db.flush()
    return None


def purgar_si_sin_en_curso(db: Session, cuadrilla_id: int | None) -> None:
    """Borra la posición cuando la cuadrilla ya no tiene tareas en curso (retención mínima)."""
    if cuadrilla_id is None:
        return
    hay = db.execute(
        select(func.count(Tarea.id)).where(
            Tarea.cuadrilla_id == cuadrilla_id, Tarea.estado == "en_curso"
        )
    ).scalar_one()
    if hay == 0:
        db.execute(delete(PosicionCuadrilla).where(PosicionCuadrilla.cuadrilla_id == cuadrilla_id))


def _roles(db: Session, cuadrillas: set[int]) -> dict[int, list[str]]:
    """Roles del catálogo de cada cuadrilla (una sola consulta)."""
    roles: dict[int, set[str]] = {c: set() for c in cuadrillas}
    if cuadrillas:
        for cid, rol in db.execute(
            select(IntegranteCuadrilla.cuadrilla_id, IntegranteCuadrilla.rol_operativo).where(
                IntegranteCuadrilla.cuadrilla_id.in_(cuadrillas)
            )
        ).all():
            roles[cid].add(rol)
    return {c: sorted(r) for c, r in roles.items()}


def _posiciones(db: Session, cuadrillas: set[int]) -> dict[int, tuple]:
    """Última posición guardada de cada cuadrilla (vencida o no; se clasifica afuera)."""
    if not cuadrillas:
        return {}
    return {
        cid: (lon, lat, precision, registrada)
        for cid, lon, lat, precision, registrada in db.execute(
            select(
                PosicionCuadrilla.cuadrilla_id,
                func.ST_X(PosicionCuadrilla.geom),
                func.ST_Y(PosicionCuadrilla.geom),
                PosicionCuadrilla.precision_m,
                PosicionCuadrilla.registrada_en,
            ).where(PosicionCuadrilla.cuadrilla_id.in_(cuadrillas))
        ).all()
    }


def seguimiento_de(db: Session, usuario_id: int) -> list[dict]:
    """Seguimiento de los pedidos propios con una tarea en curso (nunca los de otra persona).

    Una posición vencida (``posicion_vencida_minutos``) no se devuelve: el pedido figura como
    ``asignada_sin_posicion`` con ``posicion_vieja: true`` y sin coordenadas ni estimación.
    """
    filas = db.execute(
        select(
            Tarea,
            SolicitudAsistencia,
            Cuadrilla.tipo_incidente,
            Cuadrilla.vehiculo,
            func.ST_X(SolicitudAsistencia.geom),
            func.ST_Y(SolicitudAsistencia.geom),
        )
        .join(SolicitudAsistencia, SolicitudAsistencia.id == Tarea.solicitud_id)
        .join(Cuadrilla, Cuadrilla.id == Tarea.cuadrilla_id)
        .where(SolicitudAsistencia.solicitante_id == usuario_id, Tarea.estado == "en_curso")
        .order_by(Tarea.id.desc())
    ).all()
    limite = float(supuesto("posicion_vieja_minutos"))
    ahora_ = ahora()
    corte = _limite_vencida()
    ids = {tarea.cuadrilla_id for tarea, *_ in filas}
    guardadas = _posiciones(db, ids)
    roles = _roles(db, ids)
    bases = _bases(db, ids)
    items = []
    for tarea, solicitud, tipo, vehiculo, plon, plat in filas:
        pos = guardadas.get(tarea.cuadrilla_id)
        vencida = pos is not None and pos[3] < corte
        if vencida:
            pos = None  # una posición vencida nunca se muestra
        destino = (plon, plat) if plon is not None and plat is not None else None
        # Modo demostración (SIMULADO): sin posición real, el móvil sale de la base simulada.
        sim = None
        if pos is None and destino is not None and rutas.demo_activo():
            sim = rutas.simular(
                db,
                destino,
                vehiculo,
                tarea.actualizado_en,
                ahora_,
                tarea.id,
                origen=bases.get(tarea.cuadrilla_id),
            )
        item: dict = {
            "solicitud_id": solicitud.id,
            "tarea_id": tarea.id,
            "tipo_cuadrilla": tipo,
            "roles": roles[tarea.cuadrilla_id],
            "estado": "en_camino" if (pos or sim) else "asignada_sin_posicion",
            "posicion": None,
            "actualizada_en": None,
            "posicion_vieja": True if vencida and sim is None else None,
            "distancia_m": None,
            "llegada_estimada_min": None,
            "ruta": None,
            "simulada": sim is not None,
            "categoria": CATEGORIA,
            "fuente": FUENTE_SIMULADA if sim else FUENTE,
            "supuestos": supuestos_usados(),
            "nota": NOTA_SIMULADA if sim else NOTA_ESTIMACION,
        }
        if sim:
            item["posicion"] = {"lat": sim.lat, "lon": sim.lon, "precision_m": None}
            item["actualizada_en"] = ahora_.isoformat()
            item["posicion_vieja"] = False
            item["distancia_m"] = round(sim.distancia_restante_m)
            item["llegada_estimada_min"] = rutas.minutos(
                sim.distancia_restante_m, sim.ruta.velocidad_kmh
            )
            item["ruta"] = sim.ruta.a_dict(sim.progreso, simulada=True)
        elif pos:
            lon, lat, precision, registrada = pos
            item["posicion"] = {"lat": lat, "lon": lon, "precision_m": precision}
            item["actualizada_en"] = registrada.isoformat()
            item["posicion_vieja"] = dom.posicion_vieja(registrada, ahora_, limite)
            if destino is not None:
                ruta = rutas.ruta_hacia(db, (lon, lat), destino, vehiculo=vehiculo, clave=tarea.id)
                item["distancia_m"] = round(ruta.distancia_m)
                item["llegada_estimada_min"] = ruta.llegada_estimada_min
                item["ruta"] = ruta.a_dict(0.0, simulada=False)
        items.append(item)
    return items


def _bases(db: Session, cuadrillas: set[int]) -> dict[int, tuple[float, float]]:
    """Base propia (``cuadrillas.base``) de las cuadrillas que la tienen: salida del modo demostración."""
    if not cuadrillas:
        return {}
    return {
        cid: (lon, lat)
        for cid, lon, lat in db.execute(
            select(Cuadrilla.id, func.ST_X(Cuadrilla.base), func.ST_Y(Cuadrilla.base)).where(
                Cuadrilla.id.in_(cuadrillas), Cuadrilla.base.is_not(None)
            )
        ).all()
    }


def _destinos(db: Session, cuadrillas: set[int] | None = None) -> dict[int, dict]:
    """Destino de cada cuadrilla: su tarea en curso más reciente con un pedido ubicado."""
    consulta = (
        select(
            Tarea.cuadrilla_id,
            Tarea.id,
            Tarea.solicitud_id,
            Tarea.sector_id,
            Tarea.actualizado_en,
            func.ST_X(SolicitudAsistencia.geom),
            func.ST_Y(SolicitudAsistencia.geom),
        )
        .join(SolicitudAsistencia, SolicitudAsistencia.id == Tarea.solicitud_id)
        .where(Tarea.estado == "en_curso", SolicitudAsistencia.geom.is_not(None))
        .order_by(Tarea.id.desc())
    )
    if cuadrillas is not None:
        consulta = consulta.where(Tarea.cuadrilla_id.in_(cuadrillas or {-1}))
    destinos: dict[int, dict] = {}
    for cid, tarea_id, solicitud_id, sector, inicio, lon, lat in db.execute(consulta).all():
        if cid is not None and cid not in destinos:  # la más reciente gana
            destinos[cid] = {
                "tarea_id": tarea_id,
                "solicitud_id": solicitud_id,
                "sector_id": sector,
                "inicio": inicio,
                "lon": lon,
                "lat": lat,
            }
    return destinos


def _destino_publico(d: dict | None) -> dict | None:
    if d is None:
        return None
    return {
        "lat": d["lat"],
        "lon": d["lon"],
        "tarea_id": d["tarea_id"],
        "solicitud_id": d["solicitud_id"],
        "sector_id": d["sector_id"],
    }


def posiciones_operativas(db: Session) -> list[dict]:
    """Última posición de cada cuadrilla con tarea en curso (solo roles operativos).

    Las posiciones vencidas (``posicion_vencida_minutos``) no se devuelven. Cada ítem trae el
    ``destino`` (el pedido de su tarea en curso) y la ``ruta`` hacia él, con la misma forma que
    ``seguimiento.ruta`` de ``GET /mi/pedidos``; ``null`` si la tarea no tiene un pedido ubicado.
    """
    filas = db.execute(
        select(
            Cuadrilla.id,
            Cuadrilla.nombre,
            Cuadrilla.tipo_incidente,
            Cuadrilla.tipo_operativo,
            Cuadrilla.vehiculo,
            func.ST_X(PosicionCuadrilla.geom),
            func.ST_Y(PosicionCuadrilla.geom),
            PosicionCuadrilla.precision_m,
            PosicionCuadrilla.registrada_en,
        )
        .join(PosicionCuadrilla, PosicionCuadrilla.cuadrilla_id == Cuadrilla.id)
        .where(
            Cuadrilla.id.in_(select(Tarea.cuadrilla_id).where(Tarea.estado == "en_curso")),
            PosicionCuadrilla.registrada_en >= _limite_vencida(),
        )
        .order_by(Cuadrilla.id)
    ).all()
    limite = float(supuesto("posicion_vieja_minutos"))
    ahora_ = ahora()
    ids = {fila[0] for fila in filas}
    roles = _roles(db, ids)
    destinos = _destinos(db, ids)
    en_curso = _en_curso(db, ids)
    reales = []
    for cid, nombre, tipo, operativo, vehiculo, lon, lat, precision, registrada in filas:
        destino = destinos.get(cid)
        ruta = None
        if destino is not None:
            ruta = rutas.ruta_hacia(
                db,
                (lon, lat),
                (destino["lon"], destino["lat"]),
                vehiculo=vehiculo,
                clave=destino["tarea_id"],
            ).a_dict(0.0, simulada=False)
        reales.append(
            {
                "cuadrilla_id": cid,
                "nombre": nombre,
                "tipo_incidente": tipo,
                "tipo_operativo": operativo,
                "vehiculo": vehiculo,
                "roles": roles[cid],
                "lat": lat,
                "lon": lon,
                "precision_m": precision,
                "actualizada_en": registrada.isoformat(),
                "posicion_vieja": dom.posicion_vieja(registrada, ahora_, limite),
                "tareas_en_curso": en_curso.get(cid, 0),
                "simulada": False,
                "destino": _destino_publico(destino),
                "ruta": ruta,
                "categoria": CATEGORIA,
            }
        )
    if rutas.demo_activo():
        reales += _posiciones_simuladas(db, ids, ahora_)
        reales.sort(key=lambda p: p["cuadrilla_id"])
    return reales


def _en_curso(db: Session, cuadrillas: set[int]) -> dict[int, int]:
    if not cuadrillas:
        return {}
    return dict(
        db.execute(
            select(Tarea.cuadrilla_id, func.count(Tarea.id))
            .where(Tarea.cuadrilla_id.in_(cuadrillas), Tarea.estado == "en_curso")
            .group_by(Tarea.cuadrilla_id)
        ).all()
    )


def _posiciones_simuladas(db: Session, con_posicion_real: set[int], ahora_) -> list[dict]:
    """Modo demostración: cuadrillas con tarea en curso y sin posición real, sobre su ruta simulada."""
    destinos = {
        cid: d for cid, d in _destinos(db).items() if cid not in con_posicion_real
    }  # una por cuadrilla: su tarea en curso más reciente
    if not destinos:
        return []
    ids = set(destinos)
    datos = {
        c.id: c for c in db.execute(select(Cuadrilla).where(Cuadrilla.id.in_(ids))).scalars().all()
    }
    roles = _roles(db, ids)
    bases = _bases(db, ids)
    en_curso = _en_curso(db, ids)
    items = []
    for cid, d in sorted(destinos.items()):
        c = datos[cid]
        sim = rutas.simular(
            db,
            (d["lon"], d["lat"]),
            c.vehiculo,
            d["inicio"],
            ahora_,
            d["tarea_id"],
            origen=bases.get(cid),
        )
        items.append(
            {
                "cuadrilla_id": cid,
                "nombre": c.nombre,
                "tipo_incidente": c.tipo_incidente,
                "tipo_operativo": c.tipo_operativo,
                "vehiculo": c.vehiculo,
                "roles": roles[cid],
                "lat": sim.lat,
                "lon": sim.lon,
                "precision_m": None,
                "actualizada_en": ahora_.isoformat(),
                "posicion_vieja": False,
                "tareas_en_curso": en_curso.get(cid, 0),
                "simulada": True,
                "destino": _destino_publico(d),
                "ruta": sim.ruta.a_dict(sim.progreso, simulada=True),
                "categoria": CATEGORIA,
            }
        )
    return items
