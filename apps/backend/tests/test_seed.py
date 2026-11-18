"""La carga inicial deja K3, K10 y K1 tal como vienen del kit, y es idempotente."""

import json

from geoalchemy2.shape import to_shape
from shapely.geometry import shape
from sqlalchemy import func, select

from app.config.settings import RAIZ_REPO
from app.db.modelos import (
    Acceso,
    CentroRecepcion,
    Establecimiento,
    Estacion,
    GrupoFamiliar,
    LecturaHidrometrica,
    RecursoSimulado,
    Sector,
    Usuario,
)
from app.db.seed import sembrar_todo

KIT = RAIZ_REPO / "data" / "kit"


def test_sectores_k10_sin_cambios(db):
    k10 = json.loads((KIT / "K10_sectores_simulados.geojson").read_text(encoding="utf-8"))
    sectores = {s.id: s for s in db.execute(select(Sector)).scalars()}
    assert set(sectores) == {"S1", "S2", "S3", "S4"}
    for f in k10["features"]:
        p, s = f["properties"], sectores[f["properties"]["id"]]
        assert s.nombre == p["nombre"]
        assert float(s.altura_compromiso_m) == p["altura_escala_compromiso_m"]
        assert s.poblacion_simulada == p["poblacion_simulada"]
        assert s.acceso_simulado == p["acceso_simulado"]
        assert s.estacion_referencia == p["estacion_referencia"]
        assert s.categoria == "SIMULADO"
        assert to_shape(s.geom).equals_exact(shape(f["geometry"]), 1e-9)


def test_estaciones_k3(db):
    e = db.get(Estacion, 57)
    assert (float(e.alerta_m), float(e.evacuacion_m), float(e.aguas_bajas_m)) == (7.8, 8.3, 1.6)
    assert e.categoria == "DATO OBSERVADO"
    p = db.get(Estacion, 55)
    assert (float(p.alerta_m), float(p.evacuacion_m)) == (5.35, 6.0)


def test_lecturas_k1_cargadas(db):
    total = db.scalar(select(func.count()).select_from(LecturaHidrometrica))
    assert total == 8335
    cuarentena = db.scalar(
        select(func.count())
        .select_from(LecturaHidrometrica)
        .where(LecturaHidrometrica.calidad == "cuarentena")
    )
    assert cuarentena == 1
    maximo = db.scalar(
        select(func.max(LecturaHidrometrica.valor_m)).where(LecturaHidrometrica.calidad == "valido")
    )
    assert float(maximo) == 9.81
    categorias = set(db.scalars(select(LecturaHidrometrica.categoria).distinct()))
    assert categorias == {"DATO OBSERVADO"}


def test_accesos_coherentes_con_k10(db):
    por_sector: dict[str, list[str]] = {}
    for a in db.scalars(select(Acceso)):
        por_sector.setdefault(a.sector_id, []).append(a.superficie)
        assert a.categoria == "SIMULADO"
    assert sorted(por_sector["S1"]) == ["ripio"]
    assert sorted(por_sector["S2"]) == ["pavimento", "pavimento"]
    assert sorted(por_sector["S3"]) == ["pavimento", "ripio"]
    assert sorted(por_sector["S4"]) == ["tierra"]


def test_centros_y_recursos_son_simulados(db):
    centros = list(db.scalars(select(CentroRecepcion)))
    assert centros and all(c.categoria == "SIMULADO" for c in centros)
    assert all("SIMULADO" in c.nombre for c in centros)
    recursos = {r.tipo for r in db.scalars(select(RecursoSimulado))}
    assert {"colectivo", "camioneta_4x4", "camion_jaula", "lancha"} <= recursos


def test_usuarios_demo_uno_por_rol_y_productor_en_s4(db):
    roles = [u.rol for u in db.scalars(select(Usuario).where(Usuario.es_demo))]
    for rol in ("admin", "decisor", "operador", "cuadrilla"):
        assert roles.count(rol) == 1
    assert roles.count("ciudadano") == 2 and roles.count("productor") == 2
    sectores_est = {e.nombre: e.sector_id for e in db.scalars(select(Establecimiento))}
    assert sectores_est["Establecimiento SIMULADO 1"] == "S4"
    assert sectores_est["Establecimiento SIMULADO 2"] == "S1"
    assert all(u.hash_password.startswith("$argon2id$") for u in db.scalars(select(Usuario)))


def test_campos_sensibles_del_demo_estan_cifrados(db):
    for g in db.scalars(select(GrupoFamiliar).join(Usuario).where(Usuario.es_demo)):
        assert g.telefono_cifrado and "000-000" not in g.telefono_cifrado
        assert g.salud_cifrado and "SIMULADO" not in g.salud_cifrado


def test_semilla_es_idempotente(db):
    def conteos():
        return {
            m.__name__: db.scalar(select(func.count()).select_from(m))
            for m in (Sector, Estacion, LecturaHidrometrica, Acceso, CentroRecepcion, Usuario)
        }

    antes = conteos()
    sembrar_todo(db)
    assert conteos() == antes
