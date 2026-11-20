"""Gestión completa de cuadrillas: CRUD, integrantes con profesión, avisos, posiciones con ruta y
evidencia multimedia de los partes (CLAUDE.md §8.6, §9). Todo SIMULADO, sin personas reales."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import func, select, text, update

from app.config.settings import get_settings
from app.core.eventos import Difusor, _Conexion
from app.db.base import ahora
from app.db.modelos import (
    AuditoriaAcceso,
    AvisoCuadrilla,
    Cuadrilla,
    ParteTarea,
    PosicionCuadrilla,
    Tarea,
)
from app.servicios import ruta_seguimiento as rs
from tests.conftest import bearer, correo_unico, iniciar_sesion
from tests.test_evacuaciones import _cuadrilla_demo_id, _pedido_con_tarea
from tests.test_ruteo import sin_red  # noqa: F401 (fixture: sin red vial -> ruta aproximada)
from tests.test_seguimiento import POS, pedido_en_curso  # noqa: F401, F811

PASSWORD = "ClaveInstitucional2026!"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 60
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 40
MP4 = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2" + b"\x00" * 60
DESVIO = {"type": "LineString", "coordinates": [[-58.151, -26.176], [-58.139, -26.1825]]}


@pytest.fixture(autouse=True)
def carpeta_adjuntos(tmp_path, monkeypatch):
    monkeypatch.setenv("ADJUNTOS_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _limpiar_posiciones_y_cuadrillas(db):
    """Las cuadrillas que crea cada prueba se dan de baja al terminar: así no reciben tareas de las
    órdenes de otras pruebas (el reparto va a la cuadrilla con menos tareas abiertas)."""
    ultima = db.execute(select(func.coalesce(func.max(Cuadrilla.id), 0))).scalar_one()
    db.commit()
    yield
    db.rollback()
    db.execute(PosicionCuadrilla.__table__.delete())
    db.execute(
        update(Cuadrilla)
        .where(Cuadrilla.id > ultima, Cuadrilla.estado != "baja")
        .values(estado="baja")
    )
    db.commit()


# ---- ayudas ------------------------------------------------------------------------------------


def _crear(client, como, **extra):
    cuerpo = {
        "nombre": f"Equipo de prueba {uuid.uuid4().hex[:6]}",
        "tipo_operativo": "familias",
        "integrantes": [
            {"profesion": "trabajo_social", "es_encargado": True},
            {"profesion": "medicina"},
            {"profesion": "chofer"},
        ],
        **extra,
    }
    r = client.post("/api/v1/cuadrillas", json=cuerpo, headers=como("operador"))
    assert r.status_code == 201, r.text
    return r.json()


def _usuario_cuadrilla(client, token_admin) -> dict:
    r = client.post(
        "/api/v1/usuarios",
        headers=bearer(token_admin),
        json={
            "email": correo_unico("cuad"),
            "password": PASSWORD,
            "nombre_visible": "Integrante SIMULADO 1",
            "rol": "cuadrilla",
        },
    )
    assert r.status_code == 201, r.text
    u = r.json()
    h = bearer(iniciar_sesion(client, u["email"], PASSWORD).json()["access_token"])
    return {"id": u["id"], "email": u["email"], "h": h}


def _cuadrilla_con_miembro(client, como, token_admin, **extra) -> dict:
    u = _usuario_cuadrilla(client, token_admin)
    c = _crear(
        client,
        como,
        integrantes=[
            {"profesion": "veterinaria", "es_encargado": True, "usuario_id": u["id"]},
            {"profesion": "chofer"},
        ],
        **extra,
    )
    return {"c": c, "u": u, "h": u["h"]}


def _tarea(db, cuadrilla_id: int, estado: str = "pendiente", titulo: str | None = None) -> int:
    t = Tarea(
        cuadrilla_id=cuadrilla_id,
        sector_id="S4",
        titulo=titulo or f"[PRUEBA] tarea {uuid.uuid4().hex[:6]}",
        estado=estado,
    )
    db.add(t)
    db.commit()
    return t.id


def _parte(db, tarea_id: int, cuadrilla_id: int) -> int:
    p = ParteTarea(
        tarea_id=tarea_id,
        cuadrilla_id=cuadrilla_id,
        tipo="avance",
        observacion="Avance de prueba",
        autor_rol="encargado_cuadrilla",
        categoria="SIMULADO",
    )
    db.add(p)
    db.commit()
    return p.id


# ---- alta y validación ---------------------------------------------------------------------------


def test_alta_completa_forma_y_un_solo_encargado(client, como):
    c = _crear(
        client,
        como,
        cantidad_integrantes=5,
        vehiculo="colectivo",
        equipamiento=["palas", "ruedas de auxilio", "palas"],
        base={"lat": -26.185, "lon": -58.183},
        notas="SIMULADO · prueba",
    )
    assert set(c) >= {
        "id",
        "nombre",
        "tipo_operativo",
        "tipo_incidente",
        "cantidad_integrantes",
        "vehiculo",
        "equipamiento",
        "estado",
        "base",
        "notas",
        "integrantes",
        "creado_en",
    }
    assert c["tipo_operativo"] == "familias" and c["tipo_incidente"] == "humana"
    assert c["cantidad_integrantes"] == 5 and c["vehiculo"] == "colectivo"
    assert c["equipamiento"] == ["palas", "ruedas de auxilio"]  # sin repetidos
    assert c["base"] == {"lat": -26.185, "lon": -58.183} and c["estado"] == "disponible"
    assert c["categoria"] == "SIMULADO"
    assert sum(i["es_encargado"] for i in c["integrantes"]) == 1
    assert c["integrantes"][0]["es_encargado"] is True  # el encargado va primero
    assert {i["profesion"] for i in c["integrantes"]} == {"trabajo_social", "medicina", "chofer"}
    assert {i["rol_operativo"] for i in c["integrantes"]} == {
        "trabajo_social",
        "sipec",
        "transporte",
    }  # el rol del catálogo se deduce de la profesión
    for i in c["integrantes"]:
        assert set(i) == {
            "id",
            "usuario_id",
            "rol_operativo",
            "profesion",
            "es_encargado",
            "nombre_visible",
        }
    assert client.get(f"/api/v1/cuadrillas/{c['id']}", headers=como("decisor")).json() == c


def test_alta_anterior_solo_con_tipo_incidente_sigue_funcionando(client, como):
    r = client.post(
        "/api/v1/cuadrillas",
        json={
            "nombre": "Cuadrilla apícola de prueba 2",
            "tipo_incidente": "apicola",
            "integrantes": [{"rol_operativo": "encargado_cuadrilla"}, {"rol_operativo": "inta"}],
        },
        headers=como("operador"),
    )
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["tipo_operativo"] == "apicola" and c["cantidad_integrantes"] == 2
    assert c["roles_faltantes"] == ["veterinario", "transporte"]
    assert [(i["rol_operativo"], i["profesion"], i["es_encargado"]) for i in c["integrantes"]] == [
        ("encargado_cuadrilla", "logistica", True),
        ("inta", "zootecnia", False),
    ]


@pytest.mark.parametrize(
    "extra",
    [
        # sin encargado
        {"integrantes": [{"profesion": "medicina"}, {"profesion": "chofer"}]},
        # dos encargados
        {
            "integrantes": [
                {"profesion": "medicina", "es_encargado": True},
                {"profesion": "chofer", "es_encargado": True},
            ]
        },
        # cantidad menor que los integrantes dados
        {"cantidad_integrantes": 1},
        # tipo de incidente que no corresponde al tipo operativo
        {"tipo_incidente": "ganadera"},
        {"integrantes": [{"profesion": "astronauta"}]},
        {"integrantes": [{"profesion": "otra"}]},  # «otra» no tiene rol por defecto
        {"integrantes": [{}]},
        {"base": {"lat": -91, "lon": -58}},
        {"vehiculo": "helicoptero"},
        {"equipamiento": ["x"]},
        {"cantidad_integrantes": 999},
        {"campo_inventado": 1},
    ],
)
def test_alta_invalida_422(client, como, extra):
    cuerpo = {
        "nombre": "Equipo inválido",
        "tipo_operativo": "familias",
        "integrantes": [{"profesion": "medicina", "es_encargado": True}, {"profesion": "chofer"}],
        **extra,
    }
    assert (
        client.post("/api/v1/cuadrillas", json=cuerpo, headers=como("operador")).status_code == 422
    )


def test_alta_sin_tipo_422_y_roles_de_escritura(client, como):
    sin_tipo = {"nombre": "Equipo sin tipo"}
    assert (
        client.post("/api/v1/cuadrillas", json=sin_tipo, headers=como("operador")).status_code
        == 422
    )
    cuerpo = {"nombre": "Equipo por rol", "tipo_operativo": "bienes"}
    for quien, esperado in (
        ("operador", 201),
        ("admin", 201),
        ("decisor", 403),
        ("cuadrilla", 403),
        ("ciudadano1", 403),
    ):
        r = client.post("/api/v1/cuadrillas", json=cuerpo, headers=como(quien))
        assert r.status_code == esperado, quien
    assert client.post("/api/v1/cuadrillas", json=cuerpo).status_code == 401


def test_el_decisor_lee_pero_no_escribe(client, como):
    c = _crear(client, como)
    for ruta in (
        "/api/v1/cuadrillas",
        f"/api/v1/cuadrillas/{c['id']}",
        "/api/v1/cuadrillas/plantillas",
    ):
        assert client.get(ruta, headers=como("decisor")).status_code == 200, ruta
        assert client.get(ruta, headers=como("ciudadano1")).status_code == 403, ruta
        assert client.get(ruta, headers=como("cuadrilla")).status_code == 403, ruta
    url = f"/api/v1/cuadrillas/{c['id']}"
    assert client.patch(url, json={"notas": "x" * 3}, headers=como("decisor")).status_code == 403
    assert client.delete(url, headers=como("decisor")).status_code == 403
    assert client.get("/api/v1/cuadrillas/99999999", headers=como("operador")).status_code == 404


def test_listado_incluye_integrantes_y_oculta_las_bajas(client, como, db):
    c = _crear(client, como)
    lista = client.get("/api/v1/cuadrillas", headers=como("operador")).json()
    mia = next(x for x in lista["cuadrillas"] if x["id"] == c["id"])
    assert len(mia["integrantes"]) == 3 and "plantillas" in lista
    # las cuadrillas que ya existían siguen con su forma anterior (extendida)
    demo = next(x for x in lista["cuadrillas"] if x["id"] == _cuadrilla_demo_id(db))
    assert demo["tipo_incidente"] == "humana" and demo["roles_faltantes"] is not None
    assert sum(i["es_encargado"] for i in demo["integrantes"]) == 1


# ---- plantillas ------------------------------------------------------------------------------------


def test_plantillas_por_tipo_operativo(client, como):
    r = client.get("/api/v1/cuadrillas/plantillas", headers=como("operador"))
    assert r.status_code == 200, r.text
    p = r.json()
    assert set(p["plantillas"]) == {
        "personas",
        "familias",
        "productores_ganado",
        "apicola",
        "bienes",
        "traslado_mixto",
    }
    for t in p["plantillas"].values():
        assert t["equipamiento"] and t["profesiones"]
        assert set(t["profesiones"]) <= set(p["profesiones"])
    assert "jaulas" in p["plantillas"]["productores_ganado"]["equipamiento"]
    assert "ruedas de auxilio" in p["plantillas"]["personas"]["equipamiento"]
    assert p["categoria"] == "SIMULADO" and "SUPUESTO" in p["fuente"]
    assert "medicina" in p["profesiones"] and "4x4" in p["vehiculos"]


# ---- actualización -------------------------------------------------------------------------------


def test_patch_de_cuadrilla(client, como):
    c = _crear(client, como, base={"lat": -26.19, "lon": -58.18})
    url = f"/api/v1/cuadrillas/{c['id']}"
    h = como("operador")
    r = client.patch(
        url,
        json={
            "nombre": "Nombre nuevo",
            "tipo_operativo": "productores_ganado",
            "cantidad_integrantes": 6,
            "vehiculo": "camion_jaula",
            "equipamiento": ["jaulas", "forraje", "JAULAS"],
            "notas": "otra nota",
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    n = r.json()
    assert n["nombre"] == "Nombre nuevo" and n["tipo_incidente"] == "ganadera"
    assert n["cantidad_integrantes"] == 6 and n["vehiculo"] == "camion_jaula"
    assert n["equipamiento"] == ["jaulas", "forraje"] and n["base"] == c["base"]
    # null explícito borra el vehículo y la base
    r = client.patch(url, json={"vehiculo": None, "base": None, "notas": None}, headers=h)
    assert r.json()["vehiculo"] is None and r.json()["base"] is None and r.json()["notas"] is None
    # la cantidad no puede quedar por debajo de los integrantes cargados
    assert client.patch(url, json={"cantidad_integrantes": 2}, headers=h).status_code == 422
    assert client.patch(url, json={"tipo_incidente": "humana"}, headers=h).status_code == 200
    assert (
        client.patch(
            url, json={"tipo_operativo": "apicola", "tipo_incidente": "humana"}, headers=h
        ).status_code
        == 422
    )
    assert client.patch(url, json={"estado": "ocupada"}, headers=h).status_code == 422
    assert (
        client.patch("/api/v1/cuadrillas/99999999", json={"notas": "xxx"}, headers=h).status_code
        == 404
    )


# ---- integrantes ---------------------------------------------------------------------------------


def test_integrantes_alta_cambio_de_encargado_y_baja(client, como):
    c = _crear(client, como)
    base = f"/api/v1/cuadrillas/{c['id']}/integrantes"
    h = como("operador")
    r = client.post(base, json={"profesion": "enfermeria"}, headers=h)
    assert r.status_code == 201, r.text
    nuevo = next(i for i in r.json()["integrantes"] if i["profesion"] == "enfermeria")
    assert nuevo["rol_operativo"] == "sipec" and nuevo["es_encargado"] is False
    assert r.json()["cantidad_integrantes"] == 4  # la cantidad acompaña a los integrantes
    # el nuevo toma el cargo: el anterior deja de ser encargado (siempre uno solo)
    r = client.patch(f"{base}/{nuevo['id']}", json={"es_encargado": True}, headers=h)
    assert r.status_code == 200, r.text
    assert [i["id"] for i in r.json()["integrantes"] if i["es_encargado"]] == [nuevo["id"]]
    # cambiar la profesión conserva el rol del catálogo; cambiar el rol la sigue
    r = client.patch(f"{base}/{nuevo['id']}", json={"profesion": "medicina"}, headers=h)
    cambiado = next(i for i in r.json()["integrantes"] if i["id"] == nuevo["id"])
    assert cambiado["profesion"] == "medicina" and cambiado["rol_operativo"] == "sipec"
    r = client.patch(f"{base}/{nuevo['id']}", json={"rol_operativo": "policia"}, headers=h)
    cambiado = next(i for i in r.json()["integrantes"] if i["id"] == nuevo["id"])
    assert cambiado["rol_operativo"] == "policia" and cambiado["profesion"] == "policia"
    # no se puede dejar la cuadrilla sin encargado ni quitar al encargado con otros integrantes
    assert (
        client.patch(f"{base}/{nuevo['id']}", json={"es_encargado": False}, headers=h).status_code
        == 409
    )
    assert client.delete(f"{base}/{nuevo['id']}", headers=h).status_code == 409
    # quitar a un integrante común baja la cantidad declarada
    otro = next(i for i in r.json()["integrantes"] if not i["es_encargado"])
    r = client.delete(f"{base}/{otro['id']}", headers=h)
    assert r.status_code == 200 and len(r.json()["integrantes"]) == 3
    assert r.json()["cantidad_integrantes"] == 3
    assert client.delete(f"{base}/{otro['id']}", headers=h).status_code == 404
    # un integrante de otra cuadrilla no se toca desde esta
    ajena = _crear(client, como)
    ajeno = ajena["integrantes"][0]["id"]
    assert client.delete(f"{base}/{ajeno}", headers=h).status_code == 404
    assert (
        client.patch(
            f"{base}/{ajeno}", json={"profesion": "otra", "rol_operativo": "sipec"}, headers=h
        ).status_code
        == 404
    )


def test_integrantes_con_cuenta_vinculada_y_nombre_visible(client, como, token_admin, db):
    u = _usuario_cuadrilla(client, token_admin)
    c = _crear(client, como)
    base = f"/api/v1/cuadrillas/{c['id']}/integrantes"
    r = client.post(
        base, json={"profesion": "chofer", "usuario_id": u["id"]}, headers=como("operador")
    )
    assert r.status_code == 201, r.text
    mio = next(i for i in r.json()["integrantes"] if i["usuario_id"] == u["id"])
    # nombre_visible solo para los roles operativos (esta respuesta es de operador)
    assert mio["nombre_visible"] == "Integrante SIMULADO 1"
    assert all(
        i["nombre_visible"] is None for i in r.json()["integrantes"] if i["usuario_id"] is None
    )
    # repetir la cuenta: 409; cuentas que no son de cuadrilla o inexistentes: 422
    assert (
        client.post(
            base, json={"profesion": "chofer", "usuario_id": u["id"]}, headers=como("operador")
        ).status_code
        == 409
    )
    ciudadano = client.get("/api/v1/auth/yo", headers=como("ciudadano1")).json()["id"]
    for uid in (ciudadano, 99999999):
        r = client.post(
            base, json={"profesion": "chofer", "usuario_id": uid}, headers=como("operador")
        )
        assert r.status_code == 422, uid
    # dejar el puesto vacante
    r = client.patch(f"{base}/{mio['id']}", json={"usuario_id": None}, headers=como("operador"))
    assert next(i for i in r.json()["integrantes"] if i["id"] == mio["id"])["usuario_id"] is None
    # el decisor no administra integrantes
    assert (
        client.post(base, json={"profesion": "chofer"}, headers=como("decisor")).status_code == 403
    )


def test_el_nombre_visible_no_llega_a_la_ciudadania(client, como, token_admin):
    c = _cuadrilla_con_miembro(client, como, token_admin)
    assert (
        "Integrante SIMULADO 1"
        in client.get(f"/api/v1/cuadrillas/{c['c']['id']}", headers=como("operador")).text
    )
    for quien in ("ciudadano1", "productor1", "cuadrilla"):
        r = client.get("/api/v1/cuadrillas", headers=como(quien))
        assert r.status_code == 403 and "Integrante SIMULADO" not in r.text
    for ruta in ("/api/v1/mi/pedidos", "/api/v1/mi/seguimiento", "/api/v1/mi/notificaciones"):
        for quien in ("ciudadano1", "productor1"):
            r = client.get(ruta, headers=como(quien))
            assert "Integrante SIMULADO" not in r.text and "nombre_visible" not in r.text, ruta
    # el resumen de cuadrillas (operativo) nunca llevó nombres
    assert (
        "nombre_visible"
        not in client.get("/api/v1/cuadrillas/resumen", headers=como("operador")).text
    )


# ---- baja ----------------------------------------------------------------------------------------


def test_cuadrilla_sin_historial_se_elimina(client, como):
    c = _crear(client, como)
    r = client.delete(f"/api/v1/cuadrillas/{c['id']}", headers=como("operador"))
    assert r.status_code == 200, r.text
    assert r.json() == {
        "id": c["id"],
        "estado": "eliminada",
        "eliminada": True,
        "tareas_sin_cuadrilla": 0,
    }
    assert client.get(f"/api/v1/cuadrillas/{c['id']}", headers=como("operador")).status_code == 404
    assert (
        client.delete(f"/api/v1/cuadrillas/{c['id']}", headers=como("operador")).status_code == 404
    )


def test_cuadrilla_con_tarea_en_curso_no_se_da_de_baja(client, como, db):
    c = _crear(client, como)
    _tarea(db, c["id"], "en_curso")
    r = client.delete(f"/api/v1/cuadrillas/{c['id']}", headers=como("admin"))
    assert r.status_code == 409
    assert (
        client.get(f"/api/v1/cuadrillas/{c['id']}", headers=como("operador")).json()["estado"]
        != "baja"
    )


def test_cuadrilla_con_historial_queda_de_baja_y_libera_sus_tareas(client, como, db):
    c = _crear(client, como)
    cerrada = _tarea(db, c["id"], "completada")
    pendiente = _tarea(db, c["id"], "pendiente")
    r = client.delete(f"/api/v1/cuadrillas/{c['id']}", headers=como("operador"))
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "baja" and r.json()["eliminada"] is False
    assert r.json()["tareas_sin_cuadrilla"] == 1
    db.expire_all()
    assert db.get(Tarea, cerrada).cuadrilla_id == c["id"]  # el historial se conserva
    t = db.get(Tarea, pendiente)
    assert t.cuadrilla_id is None and t.requiere_atencion is True  # vuelve al operador
    # visible solo con incluir_bajas; fuera del resumen, de los reparto de órdenes y del panel
    h = como("operador")
    visibles = client.get("/api/v1/cuadrillas", headers=h).json()["cuadrillas"]
    assert c["id"] not in [x["id"] for x in visibles]
    con_bajas = client.get("/api/v1/cuadrillas?incluir_bajas=true", headers=h).json()["cuadrillas"]
    assert next(x for x in con_bajas if x["id"] == c["id"])["estado"] == "baja"
    assert c["id"] not in [
        x["id"] for x in client.get("/api/v1/cuadrillas/resumen", headers=h).json()["items"]
    ]
    assert client.get(f"/api/v1/cuadrillas/{c['id']}", headers=h).json()["estado"] == "baja"
    # una baja es idempotente y no admite cambios ni integrantes ni avisos
    assert client.delete(f"/api/v1/cuadrillas/{c['id']}", headers=h).json()["estado"] == "baja"
    assert (
        client.patch(f"/api/v1/cuadrillas/{c['id']}", json={"notas": "xxx"}, headers=h).status_code
        == 409
    )
    assert (
        client.post(
            f"/api/v1/cuadrillas/{c['id']}/integrantes", json={"profesion": "chofer"}, headers=h
        ).status_code
        == 409
    )
    aviso = {"tipo": "instruccion", "texto": "Texto del aviso"}
    assert (
        client.post(f"/api/v1/cuadrillas/{c['id']}/avisos", json=aviso, headers=h).status_code
        == 409
    )
    # se puede reactivar
    r = client.patch(f"/api/v1/cuadrillas/{c['id']}", json={"estado": "disponible"}, headers=h)
    assert r.status_code == 200 and r.json()["estado"] == "disponible"


def test_la_orden_no_asigna_tareas_a_una_cuadrilla_de_baja(client, como, db):
    c = _crear(client, como, tipo_operativo="apicola")
    _tarea(db, c["id"], "completada")
    client.delete(f"/api/v1/cuadrillas/{c['id']}", headers=como("operador"))
    from app.servicios import ordenes

    assert ordenes.cuadrilla_menos_cargada(db, "apicola") != c["id"]


# ---- avisos --------------------------------------------------------------------------------------


def test_avisos_crear_listar_y_marcar_leido(client, como, token_admin, db):
    c = _cuadrilla_con_miembro(client, como, token_admin)
    cid = c["c"]["id"]
    tarea = _tarea(db, cid, "pendiente")
    base = f"/api/v1/cuadrillas/{cid}/avisos"
    r = client.post(
        base,
        json={
            "tipo": "desvio",
            "texto": "Camino anegado: tomen el desvío",
            "geometria": DESVIO,
            "tarea_id": tarea,
        },
        headers=como("operador"),
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert set(a) >= {
        "id",
        "cuadrilla_id",
        "tarea_id",
        "tipo",
        "texto",
        "items",
        "geometria",
        "creado_en",
        "creado_por_rol",
        "leido_en",
        "leido_por_rol",
    }
    assert a["geometria"] == DESVIO and a["leido_en"] is None and a["tarea_id"] == tarea
    assert a["creado_por_rol"] == "coordinador_sector"  # el rol, nunca el nombre
    eq = client.post(
        base,
        json={
            "tipo": "equipamiento",
            "texto": "Qué llevar",
            "items": ["Palas", "ruedas de auxilio"],
        },
        headers=como("admin"),
    ).json()
    assert eq["items"] == ["Palas", "ruedas de auxilio"] and eq["geometria"] is None
    # los operativos y los integrantes leen; la más nueva primero
    for h in (como("operador"), como("decisor"), c["h"]):
        items = client.get(base, headers=h).json()["items"]
        assert [x["id"] for x in items[:2]] == [eq["id"], a["id"]]
    assert client.get(base + "?solo_sin_leer=true", headers=c["h"]).json()["items"]
    # quien no integra la cuadrilla no la ve
    otra = _cuadrilla_con_miembro(client, como, token_admin)
    assert client.get(base, headers=otra["h"]).status_code == 403
    assert client.get(base, headers=como("ciudadano1")).status_code == 403
    assert (
        client.get("/api/v1/cuadrillas/99999999/avisos", headers=como("operador")).status_code
        == 404
    )
    # leer: solo un integrante; queda el rol de quien lo leyó
    url = f"/api/v1/avisos/{a['id']}/leido"
    assert client.post(url, headers=otra["h"]).status_code == 403
    assert client.post(url, headers=como("operador")).status_code == 403
    assert client.post(url, headers=como("ciudadano1")).status_code == 403
    assert client.post("/api/v1/avisos/99999999/leido", headers=c["h"]).status_code == 404
    r = client.post(url, headers=c["h"])
    assert r.status_code == 200, r.text
    assert r.json()["leido_en"] and r.json()["leido_por_rol"] == "veterinario"
    assert (
        client.post(url, headers=c["h"]).json()["leido_en"] == r.json()["leido_en"]
    )  # idempotente
    sin_leer = client.get(base + "?solo_sin_leer=true", headers=c["h"]).json()["items"]
    assert [x["id"] for x in sin_leer] == [eq["id"]]
    assert (
        client.get(f"/api/v1/cuadrillas/{cid}", headers=como("operador")).json()["avisos_sin_leer"]
        == 1
    )
    acciones = (
        db.execute(
            select(AuditoriaAcceso.accion).where(
                AuditoriaAcceso.recurso.like(f"cuadrillas/{cid}/avisos/%")
            )
        )
        .scalars()
        .all()
    )
    assert "aviso_cuadrilla_creado" in acciones and "aviso_cuadrilla_leido" in acciones


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"tipo": "desvio", "texto": "Desvío sin geometría"},
        {"tipo": "equipamiento", "texto": "Sin ítems", "items": []},
        {
            "tipo": "desvio",
            "texto": "Fuera de rango",
            "geometria": {"type": "Point", "coordinates": [-58, -95]},
        },
        {
            "tipo": "desvio",
            "texto": "Tipo inválido",
            "geometria": {"type": "Polygon", "coordinates": []},
        },
        {
            "tipo": "desvio",
            "texto": "Línea corta",
            "geometria": {"type": "LineString", "coordinates": [[-58, -26]]},
        },
        {
            "tipo": "desvio",
            "texto": "Coordenada rota",
            "geometria": {"type": "Point", "coordinates": ["a", "b"]},
        },
        {
            "tipo": "desvio",
            "texto": "Con extras",
            "geometria": {"type": "Point", "coordinates": [-58, -26], "x": 1},
        },
        {"tipo": "urgente", "texto": "Tipo desconocido"},
        {"tipo": "instruccion", "texto": "ab"},
        {"tipo": "instruccion", "texto": "Texto", "extra": 1},
        {"tipo": "instruccion", "texto": "Tarea ajena", "tarea_id": 99999999},
    ],
)
def test_aviso_invalido_422(client, como, cuerpo):
    c = _crear(client, como)
    r = client.post(f"/api/v1/cuadrillas/{c['id']}/avisos", json=cuerpo, headers=como("operador"))
    assert r.status_code == 422, r.text


def test_aviso_con_punto_y_roles_de_escritura(client, como):
    c = _crear(client, como)
    base = f"/api/v1/cuadrillas/{c['id']}/avisos"
    punto = {
        "tipo": "seguridad",
        "texto": "Zona con agua alta",
        "geometria": {"type": "Point", "coordinates": [-58.14, -26.18]},
    }
    assert client.post(base, json=punto, headers=como("operador")).status_code == 201
    for quien in ("decisor", "cuadrilla", "ciudadano1"):
        assert client.post(base, json=punto, headers=como(quien)).status_code == 403, quien
    assert (
        client.post(
            "/api/v1/cuadrillas/99999999/avisos", json=punto, headers=como("operador")
        ).status_code
        == 404
    )


def test_ws_el_aviso_llega_a_los_operativos_y_a_los_integrantes_solamente():
    d = Difusor()
    ws = lambda: object()  # noqa: E731
    d._conexiones = [
        _Conexion(ws(), 1, "operador", 9e12),
        _Conexion(ws(), 2, "decisor", 9e12),
        _Conexion(ws(), 3, "admin", 9e12),
        _Conexion(ws(), 4, "cuadrilla", 9e12),  # integrante de la cuadrilla avisada
        _Conexion(ws(), 5, "cuadrilla", 9e12),  # de otra cuadrilla
        _Conexion(ws(), 6, "ciudadano", 9e12),
        _Conexion(ws(), 7, "productor", 9e12),
    ]
    elegidos = d._destinatarios("aviso_cuadrilla", None, frozenset({4}))
    assert {c.usuario_id for c in elegidos} == {1, 2, 3, 4}
    # sin destinatarios: solo los roles operativos
    assert {c.usuario_id for c in d._destinatarios("aviso_cuadrilla", None, None)} == {1, 2, 3}


def test_ws_se_publica_con_ids_y_sin_texto(client, como, token_admin, monkeypatch):
    c = _cuadrilla_con_miembro(client, como, token_admin)
    publicados = []
    from app.api.v1 import cuadrillas as api

    monkeypatch.setattr(api.difusor, "publicar", lambda *a, **k: publicados.append((a, k)))
    r = client.post(
        f"/api/v1/cuadrillas/{c['c']['id']}/avisos",
        json={"tipo": "instruccion", "texto": "Texto que no debe viajar por WS"},
        headers=como("operador"),
    )
    assert r.status_code == 201
    (tipo, datos), kw = publicados[-1]
    assert (
        tipo == "aviso_cuadrilla" and datos["tipo"] == "instruccion" and datos["accion"] == "creado"
    )
    assert "texto" not in datos and kw["destinatarios"] == {c["u"]["id"]}
    client.post(f"/api/v1/avisos/{r.json()['id']}/leido", headers=c["h"])
    (_, datos), _ = publicados[-1]
    assert datos["accion"] == "leido"


# ---- seguimiento: posiciones con ruta y destino ------------------------------------------------


def test_posiciones_traen_ruta_y_destino_hacia_la_tarea_en_curso(
    client, como, db, sin_red, monkeypatch
):  # noqa: F811
    base = {"lat": -26.215, "lon": -58.19}
    c = _crear(client, como, base=base, vehiculo="4x4")
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    p = _pedido_con_tarea(client, como, db, cuadrilla_id=c["id"])
    r = client.patch(
        f"/api/v1/tareas/{p['tarea_id']}", json={"estado": "en_curso"}, headers=como("operador")
    )
    assert r.status_code == 200, r.text
    items = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador")).json()[
        "posiciones"
    ]
    mia = next(i for i in items if i["cuadrilla_id"] == c["id"])
    assert mia["simulada"] is True and mia["vehiculo"] == "4x4"
    assert mia["tipo_operativo"] == "familias"
    assert (
        mia["destino"]["tarea_id"] == p["tarea_id"]
        and mia["destino"]["solicitud_id"] == p["solicitud_id"]
    )
    assert mia["destino"]["sector_id"] == "S4"
    ruta = mia["ruta"]
    assert set(ruta) == {
        "coordenadas",
        "distancia_km",
        "llegada_estimada_min",
        "metodo",
        "simulada",
        "progreso",
        "velocidad_kmh",
        "calculada_en",
    }
    assert ruta["simulada"] is True and ruta["metodo"] == "aproximado" and 0 <= ruta["progreso"] < 1
    # sale de la base propia de la cuadrilla y termina en el pedido
    assert ruta["coordenadas"][0] == [base["lon"], base["lat"]]
    assert ruta["coordenadas"][-1] == [mia["destino"]["lon"], mia["destino"]["lat"]]
    # y la ciudadanía ve la misma ruta en su pedido
    mi = client.get("/api/v1/mi/pedidos", headers=p["h"]).json()["items"][0]["seguimiento"]
    assert mi["ruta"]["coordenadas"][0] == [base["lon"], base["lat"]]
    # solo los operativos
    for quien in ("cuadrilla", "ciudadano1"):
        assert client.get("/api/v1/cuadrillas/posiciones", headers=como(quien)).status_code == 403


def test_posicion_real_con_ruta_hacia_el_destino(client, como, db, pedido_en_curso, sin_red):  # noqa: F811
    r = client.post("/api/v1/cuadrillas/mi-posicion", json=POS, headers=como("cuadrilla"))
    assert r.status_code == 200, r.text
    items = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador")).json()[
        "posiciones"
    ]
    mia = next(i for i in items if i["cuadrilla_id"] == _cuadrilla_demo_id(db))
    assert mia["simulada"] is False and mia["lat"] == POS["lat"]
    assert mia["ruta"]["simulada"] is False and mia["ruta"]["progreso"] == 0
    assert mia["ruta"]["coordenadas"][0] == [POS["lon"], POS["lat"]]
    assert mia["destino"]["tarea_id"] == pedido_en_curso["tarea_id"]


def test_posicion_sin_pedido_ubicado_no_tiene_ruta(client, como, db, sin_red, monkeypatch):  # noqa: F811
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    c = _crear(client, como)
    _tarea(db, c["id"], "en_curso")  # tarea de una orden: sin pedido ni ubicación
    db.add(
        PosicionCuadrilla(
            cuadrilla_id=c["id"], geom="SRID=4326;POINT(-58.15 -26.19)", registrada_en=ahora()
        )
    )
    db.commit()
    items = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador")).json()[
        "posiciones"
    ]
    mia = next(i for i in items if i["cuadrilla_id"] == c["id"])
    assert mia["ruta"] is None and mia["destino"] is None


# ---- evidencia multimedia en los partes ----------------------------------------------------------


def _subir(client, h, tarea, parte, contenido, tipo="image/jpeg", nombre="evidencia"):
    return client.post(
        f"/api/v1/tareas/{tarea}/partes/{parte}/adjuntos",
        files={"archivo": (nombre, contenido, tipo)},
        headers=h,
    )


@pytest.fixture
def parte_con_miembro(client, como, token_admin, db):
    c = _cuadrilla_con_miembro(client, como, token_admin)
    tarea = _tarea(db, c["c"]["id"], "en_curso")
    parte = _parte(db, tarea, c["c"]["id"])
    return {**c, "tarea": tarea, "parte": parte}


def test_adjuntos_foto_valida_y_descarga(client, como, parte_con_miembro, carpeta_adjuntos, db):
    p = parte_con_miembro
    r = _subir(client, p["h"], p["tarea"], p["parte"], JPEG, nombre="../../etc/passwd")
    assert r.status_code == 201, r.text
    assert r.json() == {
        "n": 1,
        "tipo": "imagen",
        "mime": "image/jpeg",
        "bytes": len(JPEG),
        "parte_id": p["parte"],
    }
    # el servidor genera el nombre: nunca el que declaró el cliente
    guardado = carpeta_adjuntos / "partes" / str(p["tarea"]) / str(p["parte"]) / "1.jpg"
    assert guardado.read_bytes() == JPEG
    assert [f.name for f in guardado.parent.iterdir()] == ["1.jpg"]
    assert _subir(client, p["h"], p["tarea"], p["parte"], PNG, "image/png").json()["n"] == 2
    assert (
        _subir(client, p["h"], p["tarea"], p["parte"], WEBP, "image/webp").json()["mime"]
        == "image/webp"
    )
    v = _subir(client, p["h"], p["tarea"], p["parte"], MP4, "video/mp4")
    assert v.status_code == 201 and v.json()["tipo"] == "video" and v.json()["n"] == 4
    assert (guardado.parent / "4.mp4").exists()
    # cada parte devuelve sus adjuntos sin rutas ni huellas
    for h in (p["h"], como("operador"), como("decisor")):
        partes = client.get(f"/api/v1/tareas/{p['tarea']}/partes", headers=h).json()["items"]
        adj = partes[0]["adjuntos"]
        assert [(a["n"], a["tipo"]) for a in adj] == [
            (1, "imagen"),
            (2, "imagen"),
            (3, "imagen"),
            (4, "video"),
        ]
        assert set(adj[0]) == {"n", "tipo", "mime", "bytes"}
    # los otros listados de partes también traen el campo
    rec = client.get("/api/v1/partes/recientes", headers=como("operador")).json()["items"]
    assert any(x["id"] == p["parte"] and len(x["adjuntos"]) == 4 for x in rec)
    # descarga: integrantes y operativos
    url = f"/api/v1/tareas/{p['tarea']}/partes/{p['parte']}/adjuntos"
    for h in (p["h"], como("operador"), como("decisor"), como("admin")):
        g = client.get(f"{url}/1", headers=h)
        assert (
            g.status_code == 200 and g.content == JPEG and g.headers["content-type"] == "image/jpeg"
        )
        assert g.headers["x-content-type-options"] == "nosniff"
    assert client.get(f"{url}/4", headers=p["h"]).headers["content-type"] == "video/mp4"
    assert client.get(f"{url}/9", headers=p["h"]).status_code == 404
    assert client.get(f"{url}/1").status_code == 401
    assert client.get(f"{url}/1", headers=como("ciudadano1")).status_code == 403
    acciones = (
        db.execute(
            select(AuditoriaAcceso.accion).where(
                AuditoriaAcceso.recurso.like(f"tareas/{p['tarea']}/partes/%")
            )
        )
        .scalars()
        .all()
    )
    assert "adjunto_subido" in acciones and "lectura_datos_personales" in acciones


def test_adjuntos_se_valida_el_contenido_real(client, parte_con_miembro):
    p = parte_con_miembro
    args = (client, p["h"], p["tarea"], p["parte"])
    # declara MP4 pero no lo es
    assert _subir(*args, b"esto no es un video, es texto plano" * 3, "video/mp4").status_code == 415
    assert _subir(*args, b"\x00\x00\x00\x18ftyp", "video/mp4").status_code == 415  # truncado
    # declara imagen pero es ejecutable o HTML
    assert _subir(*args, b"MZ\x90\x00" + b"\x00" * 50).status_code == 415
    assert _subir(*args, b"<html><script>1</script></html>", "image/png").status_code == 415
    # el contenido es video y declara imagen (y al revés)
    assert _subir(*args, MP4, "image/jpeg").status_code == 415
    assert _subir(*args, JPEG, "video/mp4").status_code == 415
    # tipo declarado no permitido
    assert _subir(*args, JPEG, "application/pdf").status_code == 415
    assert _subir(*args, b"", "image/jpeg").status_code == 422
    # nada de lo anterior quedó guardado
    partes = client.get(f"/api/v1/tareas/{p['tarea']}/partes", headers=p["h"]).json()["items"]
    assert partes[0]["adjuntos"] == []


def test_adjuntos_tamano_maximo_por_tipo(client, parte_con_miembro):
    p = parte_con_miembro
    args = (client, p["h"], p["tarea"], p["parte"])
    cinco_mb = 5 * 1024 * 1024
    grande = PNG + b"\x00" * (cinco_mb - len(PNG) + 1)  # 1 byte más que el tope de una foto
    assert _subir(*args, grande, "image/png").status_code == 413
    justo = PNG + b"\x00" * (cinco_mb - len(PNG))
    assert _subir(*args, justo, "image/png").status_code == 201
    veinte_mb = 20 * 1024 * 1024
    video = MP4 + b"\x00" * (veinte_mb - len(MP4))
    assert _subir(*args, video, "video/mp4").status_code == 201  # un video llega hasta 20 MB
    assert _subir(*args, video + b"\x01", "video/mp4").status_code == 413


def test_adjuntos_maximo_cinco_por_parte_y_reintento_idempotente(client, parte_con_miembro):
    p = parte_con_miembro
    args = (client, p["h"], p["tarea"], p["parte"])
    for i in range(5):
        r = _subir(*args, JPEG + bytes([i]))
        assert r.status_code == 201 and r.json()["n"] == i + 1, r.text
    # el mismo archivo reenviado (cola sin señal) no duplica
    r = _subir(*args, JPEG + bytes([2]))
    assert r.status_code == 200 and r.json()["n"] == 3 and r.json()["duplicado"] is True
    r = _subir(*args, JPEG + b"\xff")
    assert r.status_code == 409
    partes = client.get(f"/api/v1/tareas/{p['tarea']}/partes", headers=p["h"]).json()["items"]
    assert len(partes[0]["adjuntos"]) == 5


def test_adjuntos_solo_los_integrantes_suben(client, como, token_admin, parte_con_miembro, db):
    p = parte_con_miembro
    ajeno = _cuadrilla_con_miembro(client, como, token_admin)
    assert _subir(client, ajeno["h"], p["tarea"], p["parte"], JPEG).status_code == 403
    for quien in ("operador", "decisor", "admin", "ciudadano1", "productor1"):
        assert _subir(client, como(quien), p["tarea"], p["parte"], JPEG).status_code == 403, quien
    assert _subir(client, p["h"], p["tarea"], p["parte"], JPEG).status_code == 201
    url = f"/api/v1/tareas/{p['tarea']}/partes/{p['parte']}/adjuntos/1"
    assert client.get(url, headers=ajeno["h"]).status_code == 403  # tampoco lo lee otra cuadrilla
    # el parte debe ser de esa tarea; la tarea y el parte deben existir
    otra_tarea = _tarea(db, p["c"]["id"], "pendiente")
    assert _subir(client, p["h"], otra_tarea, p["parte"], JPEG).status_code == 404
    assert _subir(client, p["h"], p["tarea"], 99999999, JPEG).status_code == 404
    assert _subir(client, p["h"], 99999999, p["parte"], JPEG).status_code == 404
    assert client.get(url.replace(str(p["parte"]), "99999999"), headers=p["h"]).status_code == 404


def test_el_ultimo_parte_del_resumen_trae_sus_adjuntos(client, como, parte_con_miembro):
    p = parte_con_miembro
    _subir(client, p["h"], p["tarea"], p["parte"], JPEG)
    resumen = client.get("/api/v1/cuadrillas/resumen", headers=como("operador")).json()["items"]
    mio = next(c for c in resumen if c["id"] == p["c"]["id"])
    assert mio["ultimo_parte"]["adjuntos"] == [
        {"n": 1, "tipo": "imagen", "mime": "image/jpeg", "bytes": len(JPEG)}
    ]


# ---- migración --------------------------------------------------------------------------------------


def test_migracion_0011_aplicada(db):
    from sqlalchemy import inspect

    ins = inspect(db.get_bind())
    cols = {c["name"] for c in ins.get_columns("cuadrillas")}
    assert {"tipo_operativo", "cantidad_integrantes", "equipamiento", "base", "notas"} <= cols
    assert {"profesion", "es_encargado"} <= {
        c["name"] for c in ins.get_columns("integrantes_cuadrilla")
    }
    assert "adjuntos" in {c["name"] for c in ins.get_columns("partes_tarea")}
    assert "avisos_cuadrilla" in ins.get_table_names()
    assert db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() >= "0011"


def test_los_datos_existentes_quedaron_migrados(db):
    """Las cuadrillas de demo (anteriores a 0011) tienen tipo operativo, profesión y un encargado."""
    demo = db.get(Cuadrilla, _cuadrilla_demo_id(db))
    assert demo.tipo_operativo == "personas" and demo.cantidad_integrantes == 4
    from app.db.modelos import IntegranteCuadrilla

    integrantes = (
        db.execute(select(IntegranteCuadrilla).where(IntegranteCuadrilla.cuadrilla_id == demo.id))
        .scalars()
        .all()
    )
    assert {i.profesion for i in integrantes} == {
        "logistica",
        "medicina",
        "trabajo_social",
        "chofer",
    }
    assert [i.rol_operativo for i in integrantes if i.es_encargado] == ["encargado_cuadrilla"]


def test_semilla_de_demostracion_equipos_y_avisos(client, como, db):
    lista = client.get("/api/v1/cuadrillas", headers=como("operador")).json()["cuadrillas"]
    equipos = [c for c in lista if c["nombre"].startswith("Equipo interdisciplinario SIMULADO")]
    assert len(equipos) == 3
    assert {c["tipo_operativo"] for c in equipos} == {
        "familias",
        "productores_ganado",
        "traslado_mixto",
    }
    for c in equipos:
        assert (
            c["base"] and c["vehiculo"] and c["equipamiento"] and c["notas"].startswith("SIMULADO")
        )
        assert sum(i["es_encargado"] for i in c["integrantes"]) == 1
        assert c["cantidad_integrantes"] >= len(c["integrantes"])
        assert len({i["profesion"] for i in c["integrantes"]}) >= 3  # equipo interdisciplinario
    # dos avisos de demostración para la cuadrilla de la cuenta de demo: un desvío y qué llevar
    avisos = client.get(
        f"/api/v1/cuadrillas/{_cuadrilla_demo_id(db)}/avisos", headers=como("cuadrilla")
    ).json()["items"]
    tipos = {a["tipo"] for a in avisos}
    assert {"desvio", "equipamiento"} <= tipos
    desvio = next(a for a in avisos if a["tipo"] == "desvio")
    assert desvio["geometria"]["type"] == "LineString"
    # idempotente
    from app.db.seed import sembrar_avisos_demo, sembrar_cuadrillas

    assert sembrar_avisos_demo(db) == 0 and sembrar_cuadrillas(db) == 0
    assert db.execute(select(AvisoCuadrilla.id).where(AvisoCuadrilla.tipo == "desvio")).first()


def test_pasado_el_tiempo_el_modo_demostracion_llega_al_destino(
    client, como, db, sin_red, monkeypatch
):  # noqa: F811
    from app.servicios import seguimiento as srv_seguimiento

    c = _crear(client, como, base={"lat": -26.215, "lon": -58.19}, vehiculo="4x4")
    monkeypatch.setattr(rs, "demo_activo", lambda: True)
    p = _pedido_con_tarea(client, como, db, cuadrilla_id=c["id"])
    client.patch(
        f"/api/v1/tareas/{p['tarea_id']}", json={"estado": "en_curso"}, headers=como("operador")
    )
    monkeypatch.setattr(srv_seguimiento, "ahora", lambda: ahora() + timedelta(hours=8))
    items = client.get("/api/v1/cuadrillas/posiciones", headers=como("operador")).json()[
        "posiciones"
    ]
    mia = next(i for i in items if i["cuadrilla_id"] == c["id"])
    assert mia["ruta"]["progreso"] == 1 and mia["ruta"]["llegada_estimada_min"] == 0
    assert (mia["lon"], mia["lat"]) == pytest.approx((mia["destino"]["lon"], mia["destino"]["lat"]))


MOV = b"\x00\x00\x00\x14ftypqt  \x00\x00\x00\x00qt  " + b"\x00" * 60


def test_video_quicktime_de_iphone(client, parte_con_miembro):
    p = parte_con_miembro
    r = _subir(client, p["h"], p["tarea"], p["parte"], MOV, "video/quicktime")
    assert r.status_code == 201, r.text
    assert r.json()["tipo"] == "video" and r.json()["mime"] == "video/quicktime"
    g = client.get(f"/api/v1/tareas/{p['tarea']}/partes/{p['parte']}/adjuntos/1", headers=p["h"])
    assert g.headers["content-type"] == "video/quicktime" and g.content == MOV
    # el contenido sigue validándose
    falso = _subir(client, p["h"], p["tarea"], p["parte"], b"texto plano" * 5, "video/quicktime")
    assert falso.status_code == 415
    grande = MOV + b"\x00" * (20 * 1024 * 1024)
    assert _subir(client, p["h"], p["tarea"], p["parte"], grande, "video/quicktime").status_code == 413


def test_mi_cuadrilla_y_detalle_propio_sin_nombres(client, como, token_admin):
    c = _cuadrilla_con_miembro(client, como, token_admin)
    cid = c["c"]["id"]
    r = client.get("/api/v1/mi/cuadrilla", headers=c["h"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] == cid and d["avisos_sin_leer"] == 0 and len(d["integrantes"]) == 2
    assert all(i["nombre_visible"] is None for i in d["integrantes"])
    assert {i["profesion"] for i in d["integrantes"]} == {"veterinaria", "chofer"}
    assert "Integrante SIMULADO" not in r.text
    client.post(
        f"/api/v1/cuadrillas/{cid}/avisos",
        json={"tipo": "instruccion", "texto": "Aviso de prueba"},
        headers=como("operador"),
    )
    assert client.get("/api/v1/mi/cuadrilla", headers=c["h"]).json()["avisos_sin_leer"] == 1
    # el detalle de la propia cuadrilla, sin nombres; el de otra, 403
    own = client.get(f"/api/v1/cuadrillas/{cid}", headers=c["h"])
    assert own.status_code == 200 and "Integrante SIMULADO" not in own.text
    otra = _cuadrilla_con_miembro(client, como, token_admin)
    assert client.get(f"/api/v1/cuadrillas/{cid}", headers=otra["h"]).status_code == 403
    # los mandos siguen viendo el nombre; otros roles no tienen /mi/cuadrilla
    assert "Integrante SIMULADO" in client.get(f"/api/v1/cuadrillas/{cid}", headers=como("operador")).text
    for quien in ("operador", "ciudadano1"):
        assert client.get("/api/v1/mi/cuadrilla", headers=como(quien)).status_code == 403


def test_mi_cuadrilla_sin_cuadrilla_404(client, token_admin):
    u = _usuario_cuadrilla(client, token_admin)
    assert client.get("/api/v1/mi/cuadrilla", headers=u["h"]).status_code == 404
