"""Órdenes, notificaciones, tareas, solicitudes, bitácora K8, verificadores, /mi y WebSocket."""

import os

import pytest
from sqlalchemy import select

from app.db.modelos import BitacoraDecision, Notificacion, Tarea
from tests.conftest import (
    DEMO,
    PASSWORD_VALIDA,
    bearer,
    correo_unico,
    iniciar_sesion,
)

FUNDAMENTO = "Compromiso previsto de S4 antes de la alerta de Puerto Formosa."
S4 = {"lon": -58.139, "lat": -26.18}


def _usuario_nuevo(client, tipo: str = "ciudadano", **extra) -> tuple[str, dict]:
    email = correo_unico(tipo[:3])
    cuerpo = {
        "email": email,
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Usuario Prueba",
        "consentimiento": True,
    }
    if tipo == "ciudadano":
        cuerpo |= {"integrantes": 2, **extra}
        assert client.post("/api/v1/auth/registro/ciudadano", json=cuerpo).status_code == 201
    else:
        cuerpo["establecimiento"] = extra
        assert client.post("/api/v1/auth/registro/productor", json=cuerpo).status_code == 201
    r = iniciar_sesion(client, email, PASSWORD_VALIDA)
    return email, bearer(r.json()["access_token"])


# ---------------------------------------------------------------- órdenes


def test_ciudadano_no_puede_emitir_orden_403(client, como):
    r = client.post(
        "/api/v1/ordenes",
        json={"tipo": "evacuacion_preventiva", "sectores": ["S4"], "fundamento": FUNDAMENTO},
        headers=como("ciudadano1"),
    )
    assert r.status_code == 403
    for rol in ("operador", "productor1", "cuadrilla"):
        assert (
            client.post(
                "/api/v1/ordenes",
                headers=como(rol),
                json={"tipo": "alerta", "sectores": ["S4"], "fundamento": FUNDAMENTO},
            ).status_code
            == 403
        )
    assert client.post("/api/v1/ordenes", json={}).status_code == 401


def test_orden_crea_notificaciones_tareas_y_borrador_de_bitacora(client, como, db):
    _, h_fam = _usuario_nuevo(client, "ciudadano", lon=S4["lon"], lat=S4["lat"])
    _, h_otro = _usuario_nuevo(client, "ciudadano", lon=-58.18, lat=-26.185)  # S2: no se notifica
    r = client.post(
        "/api/v1/ordenes",
        json={"tipo": "evacuacion_preventiva", "sectores": ["S4"], "fundamento": FUNDAMENTO},
        headers=como("decisor"),
    )
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["tipo"] == "evacuacion_preventiva" and o["emitida_por_rol"] == "defensa_civil"
    assert o["notificaciones_creadas"] >= 2  # productor1 y la familia nueva, al menos
    assert o["tareas_creadas"] >= 2  # humana y ganadera (hay bovinos en S4)
    assert o["bitacora_borrador_id"]

    mias = client.get("/api/v1/mi/notificaciones", headers=h_fam).json()
    assert mias["no_leidas"] == 1 and "S4" in mias["notificaciones"][0]["mensaje"]
    assert "PROTOTIPO" in mias["notificaciones"][0]["mensaje"]
    assert client.get("/api/v1/mi/notificaciones", headers=h_otro).json()["notificaciones"] == []
    assert (
        client.get("/api/v1/mi/notificaciones", headers=como("productor1")).json()["no_leidas"] >= 1
    )

    tareas = db.execute(select(Tarea).where(Tarea.orden_id == o["id"])).scalars().all()
    assert {t.sector_id for t in tareas} == {"S4"} and len(tareas) == o["tareas_creadas"]
    assert all(t.checklist and t.estado == "pendiente" for t in tareas)

    borrador = db.get(BitacoraDecision, o["bitacora_borrador_id"])
    assert borrador.estado == "borrador" and borrador.orden_id == o["id"]
    assert borrador.responsable_rol == "defensa_civil"
    assert "PENDIENTE" in borrador.limites and "K1" in borrador.evidencia

    # el decisor completa el borrador con los seis campos
    b = client.patch(
        f"/api/v1/bitacora/{borrador.id}",
        json={
            "decision": "Evacuar S4",
            "evidencia": "K1 5,60 m (31/10/2026)",
            "limites": "Sin lluvia observada",
            "riesgos": "Falsa alarma vs. demora",
            "gatillos": "Alerta 7,80 m (K3)",
            "fecha_simulada": "2026-11-17",
        },
        headers=como("decisor"),
    )
    assert b.status_code == 200 and b.json()["estado"] == "completa"
    again = client.patch(
        f"/api/v1/bitacora/{borrador.id}",
        headers=como("decisor"),
        json={
            "decision": "x",
            "evidencia": "x",
            "limites": "x",
            "riesgos": "x",
            "gatillos": "x",
            "fecha_simulada": "2026-11-17",
        },
    )
    assert again.status_code == 409


def test_alerta_no_crea_tareas_y_listado_por_rol(client, como):
    r = client.post(
        "/api/v1/ordenes",
        json={"tipo": "alerta", "sectores": ["S3", "S3"], "fundamento": FUNDAMENTO},
        headers=como("decisor"),
    )
    assert (
        r.status_code == 201 and r.json()["tareas_creadas"] == 0 and r.json()["sectores"] == ["S3"]
    )
    todas = client.get("/api/v1/ordenes", headers=como("operador")).json()["ordenes"]
    assert any(x["id"] == r.json()["id"] for x in todas)
    # ciudadano2 vive en S3: ve la alerta; ciudadano1 (S2) no
    assert any(
        x["id"] == r.json()["id"]
        for x in client.get("/api/v1/ordenes", headers=como("ciudadano2")).json()["ordenes"]
    )
    assert not any(
        x["id"] == r.json()["id"]
        for x in client.get("/api/v1/ordenes", headers=como("ciudadano1")).json()["ordenes"]
    )


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"tipo": "evacuacion", "sectores": [], "fundamento": FUNDAMENTO},
        {"tipo": "evacuacion", "sectores": ["S9"], "fundamento": FUNDAMENTO},
        {"tipo": "bombardeo", "sectores": ["S4"], "fundamento": FUNDAMENTO},
        {"tipo": "evacuacion", "sectores": ["S4"], "fundamento": "corto"},
    ],
)
def test_orden_invalida_422(client, como, cuerpo):
    assert client.post("/api/v1/ordenes", json=cuerpo, headers=como("decisor")).status_code == 422


def test_marcar_notificacion_leida_solo_la_propia(client, como, db):
    _, h = _usuario_nuevo(client, "ciudadano", lon=S4["lon"], lat=S4["lat"])
    client.post(
        "/api/v1/ordenes",
        headers=como("decisor"),
        json={"tipo": "alerta", "sectores": ["S4"], "fundamento": FUNDAMENTO},
    )
    n = client.get("/api/v1/mi/notificaciones", headers=h).json()["notificaciones"][0]
    assert (
        client.patch(
            f"/api/v1/mi/notificaciones/{n['id']}/leida", headers=como("ciudadano1")
        ).status_code
        == 404
    )
    assert (
        client.patch(f"/api/v1/mi/notificaciones/{n['id']}/leida", headers=h).json()["leida"]
        is True
    )
    assert db.get(Notificacion, n["id"]).leida is True


# ---------------------------------------------------------------- cuadrillas y tareas


def test_cuadrillas_listado_y_creacion_con_roles_faltantes(client, como):
    h = como("operador")
    lista = client.get("/api/v1/cuadrillas", headers=h).json()
    assert {c["tipo_incidente"] for c in lista["cuadrillas"]} >= {"humana", "ganadera"}
    r = client.post(
        "/api/v1/cuadrillas",
        headers=h,
        json={
            "nombre": "Cuadrilla apícola de prueba",
            "tipo_incidente": "apicola",
            "integrantes": [{"rol_operativo": "encargado_cuadrilla"}, {"rol_operativo": "inta"}],
        },
    )
    assert r.status_code == 201
    assert r.json()["roles_faltantes"] == ["veterinario", "transporte"]
    assert (
        client.post(
            "/api/v1/cuadrillas",
            headers=h,
            json={
                "nombre": "X cuadrilla",
                "tipo_incidente": "humana",
                "integrantes": [{"rol_operativo": "rey_del_mundo"}],
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/cuadrillas",
            headers=como("ciudadano1"),
            json={"nombre": "X cuadrilla", "tipo_incidente": "humana"},
        ).status_code
        == 403
    )


def test_tareas_cuadrilla_actualiza_las_suyas_y_transiciones(client, como, db):
    client.post(
        "/api/v1/ordenes",
        headers=como("decisor"),
        json={"tipo": "evacuacion", "sectores": ["S4"], "fundamento": FUNDAMENTO},
    )
    mis = client.get("/api/v1/tareas", headers=como("cuadrilla")).json()["tareas"]
    assert mis, "la cuadrilla de demo (humana) debe recibir tareas"
    t = mis[0]
    r = client.patch(
        f"/api/v1/tareas/{t['id']}", headers=como("cuadrilla"), json={"estado": "completada"}
    )
    assert r.status_code == 409  # pendiente -> completada no es válido
    r = client.patch(
        f"/api/v1/tareas/{t['id']}", headers=como("cuadrilla"), json={"estado": "en_curso"}
    )
    assert r.status_code == 200 and r.json()["estado"] == "en_curso"
    check = [{"item": i["item"], "hecho": True} for i in t["checklist"]]
    r = client.patch(
        f"/api/v1/tareas/{t['id']}", headers=como("cuadrilla"), json={"checklist": check}
    )
    assert r.json()["checklist"][0]["hecho"] is True
    bad = client.patch(
        f"/api/v1/tareas/{t['id']}", headers=como("cuadrilla"), json={"checklist": [{"x": 1}]}
    )
    assert bad.status_code == 422
    # una tarea de la cuadrilla ganadera no es de este usuario
    todas = client.get("/api/v1/tareas", headers=como("operador")).json()["tareas"]
    ajena = next(
        x
        for x in todas
        if x["id"]
        not in {
            y["id"]
            for y in client.get("/api/v1/tareas", headers=como("cuadrilla")).json()["tareas"]
        }
    )
    assert (
        client.patch(
            f"/api/v1/tareas/{ajena['id']}", headers=como("cuadrilla"), json={"estado": "en_curso"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            "/api/v1/tareas/999999", headers=como("operador"), json={"estado": "en_curso"}
        ).status_code
        == 404
    )
    assert client.get("/api/v1/tareas", headers=como("ciudadano1")).status_code == 403


# ---------------------------------------------------------------- solicitudes


def test_solicitud_ciudadano_ve_solo_las_suyas_y_maquina_de_estados(client, como):
    h1, h2 = como("ciudadano1"), como("ciudadano2")
    r = client.post(
        "/api/v1/solicitudes",
        headers=h1,
        json={
            "tipo": "evacuacion",
            "personas": 4,
            "lon": S4["lon"],
            "lat": S4["lat"],
            "texto": "Estamos aislados",
            "origen": "app",
        },
    )
    assert (
        r.status_code == 201 and r.json()["estado"] == "recibida" and r.json()["sector_id"] == "S4"
    )
    sid = r.json()["id"]
    assert sid in [
        s["id"] for s in client.get("/api/v1/solicitudes", headers=h1).json()["solicitudes"]
    ]
    assert sid not in [
        s["id"] for s in client.get("/api/v1/solicitudes", headers=h2).json()["solicitudes"]
    ]
    assert client.get(f"/api/v1/solicitudes/{sid}", headers=h2).status_code == 404
    assert client.get(f"/api/v1/solicitudes/{sid}", headers=h1).status_code == 200
    mandos = client.get("/api/v1/solicitudes", headers=como("operador")).json()["solicitudes"]
    assert sid in [s["id"] for s in mandos]

    op = como("operador")
    # no se puede saltar estados ni un ciudadano cambiarlos
    assert (
        client.patch(
            f"/api/v1/solicitudes/{sid}", json={"estado": "en_curso"}, headers=op
        ).status_code
        == 409
    )
    assert (
        client.patch(
            f"/api/v1/solicitudes/{sid}", json={"estado": "verificada"}, headers=h1
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/solicitudes/{sid}", json={"estado": "verificada"}, headers=op
        ).json()["estado"]
        == "verificada"
    )
    cuadrilla_id = client.get("/api/v1/cuadrillas", headers=op).json()["cuadrillas"][0]["id"]
    asig = client.patch(
        f"/api/v1/solicitudes/{sid}",
        json={"estado": "asignada", "cuadrilla_id": cuadrilla_id},
        headers=op,
    )
    assert asig.json()["estado"] == "asignada"
    for estado in ("en_curso", "resuelta"):
        assert (
            client.patch(f"/api/v1/solicitudes/{sid}", json={"estado": estado}, headers=op).json()[
                "estado"
            ]
            == estado
        )
    assert (
        client.patch(
            f"/api/v1/solicitudes/{sid}", json={"estado": "resuelta"}, headers=op
        ).status_code
        == 409
    )
    tareas = client.get("/api/v1/tareas", headers=op).json()["tareas"]
    assert any(t["solicitud_id"] == sid for t in tareas)


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"tipo": "evacuacion", "lon": 0, "lat": 0},  # sin personas, animales ni texto
        {"tipo": "otra", "personas": 1, "lon": 0, "lat": 0},
        {"tipo": "evacuacion", "personas": -1, "lon": 0, "lat": 0},
        {"tipo": "evacuacion", "personas": 1, "lon": 999, "lat": 0},
    ],
)
def test_solicitud_invalida_422(client, como, cuerpo):
    assert (
        client.post("/api/v1/solicitudes", json=cuerpo, headers=como("ciudadano1")).status_code
        == 422
    )
    assert client.post("/api/v1/solicitudes", json=cuerpo).status_code == 401


# ---------------------------------------------------------------- bitácora K8


@pytest.mark.parametrize("campo", ["decision", "evidencia", "limites", "riesgos", "gatillos"])
def test_bitacora_campo_vacio_422(client, como, campo):
    cuerpo = {
        "decision": "d",
        "evidencia": "e",
        "limites": "l",
        "riesgos": "r",
        "gatillos": "g",
        "fecha_simulada": "2026-11-17",
    }
    cuerpo[campo] = "   "
    assert client.post("/api/v1/bitacora", json=cuerpo, headers=como("decisor")).status_code == 422
    del cuerpo[campo]
    assert client.post("/api/v1/bitacora", json=cuerpo, headers=como("decisor")).status_code == 422


def test_bitacora_crear_exportar_markdown_y_permisos(client, como):
    cuerpo = {
        "decision": "Esperar",
        "evidencia": "K1 5,60 m (31/10/2026)",
        "limites": "Sin pronóstico > 15 días",
        "riesgos": "Demora vs. falsa alarma",
        "gatillos": "7,80 m (K3)",
        "fecha_simulada": "2026-11-17",
    }
    r = client.post("/api/v1/bitacora", json=cuerpo, headers=como("decisor"))
    assert r.status_code == 201 and r.json()["responsable_rol"] == "defensa_civil"
    bid = r.json()["id"]
    md = client.get(f"/api/v1/bitacora/{bid}/export", headers=como("operador"))
    assert md.status_code == 200 and md.headers["content-type"].startswith("text/markdown")
    for titulo in (
        "## Decisión",
        "## Evidencia",
        "## Límites",
        "## Riesgos",
        "## Gatillos de cambio",
    ):
        assert titulo in md.text
    assert "PROTOTIPO" in md.text and "Esperar" in md.text
    assert client.post("/api/v1/bitacora", json=cuerpo, headers=como("operador")).status_code == 403
    assert client.get("/api/v1/bitacora/999999/export", headers=como("operador")).status_code == 404
    mal_rol = client.post(
        "/api/v1/bitacora", json={**cuerpo, "responsable_rol": "rey"}, headers=como("decisor")
    )
    assert mal_rol.status_code == 422
    assert bid in [
        b["id"] for b in client.get("/api/v1/bitacora", headers=como("operador")).json()["entradas"]
    ]


# ---------------------------------------------------------------- verificadores


def test_verificador_k6_refuta_10_7_y_supero_la_evacuacion(client):
    r = client.get("/api/v1/verificador/k6").json()
    por_id = {a["id"]: a for a in r["afirmaciones"]}
    assert len(por_id) == 8
    diez_siete = por_id["K6-3"]
    assert diez_siete["veredicto"] == "REFUTADA" and diez_siete["valores"]["maximo_2016_m"] == 9.81
    assert "9,81" in diez_siete["evidencia"]
    octubre = por_id["K6-4"]
    assert octubre["veredicto"] == "REFUTADA" and octubre["valores"]["maximo_octubre_m"] == 5.6
    assert por_id["K6-5"]["veredicto"] == "RESPALDADA COMO PROMEDIO"
    assert por_id["K6-5"]["valores"]["tasa_promedio_m_dia"] == pytest.approx(0.1077, abs=0.001)
    assert por_id["K6-6"]["veredicto"] == "NO VERIFICABLE"
    assert por_id["K6-7"]["veredicto"] == "NO VERIFICABLE"
    assert por_id["K6-8"]["veredicto"] == "REFUTADA" and "Prefectura" in por_id["K6-8"]["evidencia"]
    assert (
        por_id["K6-1"]["veredicto"] == "RESPALDADA" and por_id["K6-2"]["veredicto"] == "RESPALDADA"
    )
    assert all(a["categoria"] and a["fuente"] for a in r["afirmaciones"])


def test_verificador_k7_siete_relaciones_con_orden_de_estaciones_calculado(client):
    r = client.get("/api/v1/verificador/k7").json()
    rel = {x["id"]: x for x in r["relaciones"]}
    assert len(rel) == 7
    assert rel["K7-3"]["veredicto"] == "FALSA" and rel["K7-3"]["verificado_con"] == "K3 (calculado)"
    assert "Puerto Pilcomayo → Puerto Formosa" in rel["K7-3"]["correccion"]
    assert rel["K7-6"]["veredicto"] == "VERDADERA"
    assert (
        rel["K7-2"]["veredicto"] == "FALSA"
        and rel["K7-2"]["verificado_con"] == "IGN cursos de agua (calculado)"
    )


# ---------------------------------------------------------------- /mi


def test_mi_grupo_familiar_cifrado_y_auditoria(client, como, db):
    _, h = _usuario_nuevo(client, "ciudadano")
    assert (
        client.get("/api/v1/mi/grupo-familiar", headers=h).status_code == 200
    )  # creado al registrarse
    r = client.put(
        "/api/v1/mi/grupo-familiar",
        headers=h,
        json={
            "integrantes": 4,
            "menores": 2,
            "mayores": 1,
            "mascotas": 1,
            "telefono": "000-0000999",
            "salud": "SIMULADO: asma",
            "vulnerabilidad": "SIMULADO: adulto mayor",
            "lon": -58.196,
            "lat": -26.215,
        },
    )
    assert r.status_code == 200, r.text
    g = r.json()
    assert (
        g["sector_id"] == "S3" and g["salud"] == "SIMULADO: asma" and g["telefono"] == "000-0000999"
    )
    from app.db.modelos import GrupoFamiliar

    fila = (
        db.execute(
            select(GrupoFamiliar).where(
                GrupoFamiliar.salud_cifrado.is_not(None), GrupoFamiliar.integrantes == 4
            )
        )
        .scalars()
        .first()
    )
    assert fila is not None and "asma" not in fila.salud_cifrado  # se guarda cifrado
    assert (
        client.get("/api/v1/mi/grupo-familiar", headers=h).json()["vulnerabilidad"]
        == "SIMULADO: adulto mayor"
    )
    # validaciones y permisos
    assert (
        client.put(
            "/api/v1/mi/grupo-familiar",
            headers=h,
            json={"integrantes": 2, "menores": 2, "mayores": 2},
        ).status_code
        == 422
    )
    assert (
        client.put(
            "/api/v1/mi/grupo-familiar", headers=h, json={"integrantes": 2, "lon": -58.1}
        ).status_code
        == 422
    )
    assert client.get("/api/v1/mi/grupo-familiar", headers=como("operador")).status_code == 403
    assert client.get("/api/v1/mi/grupo-familiar").status_code == 401


def test_mi_establecimientos_stock_y_solicitud_de_logistica(client, como):
    _, h = _usuario_nuevo(client, "productor", nombre="Campo uno", lon=S4["lon"], lat=S4["lat"])
    lista = client.get("/api/v1/mi/establecimientos", headers=h).json()["establecimientos"]
    assert len(lista) == 1 and lista[0]["sector_id"] == "S4"
    eid = lista[0]["id"]
    stock = {
        "stock": [
            {"especie": "bovino", "categoria_animal": "vaca preñada", "cantidad": 8},
            {"especie": "bovino", "categoria_animal": "vaca con cría", "cantidad": 10},
            {"especie": "bovino", "categoria_animal": "ternero al pie", "cantidad": 10},
            {"especie": "bovino", "categoria_animal": "vaquillona", "cantidad": 1},
            {"especie": "bovino", "categoria_animal": "toro", "cantidad": 1},
        ]
    }
    assert (
        client.put(f"/api/v1/mi/establecimientos/{eid}/stock", json=stock, headers=h).status_code
        == 200
    )
    r = client.post(
        "/api/v1/mi/solicitudes-logistica",
        headers=h,
        json={"establecimiento_id": eid, "texto": "Traslado"},
    )
    assert r.status_code == 201, r.text
    c = r.json()["calculo"]
    assert (
        c["racion_diaria"]["maiz_kg"] == pytest.approx(58.4)
        and c["transporte"]["camiones_jaula"] == 1
    )
    assert r.json()["animales"] == 30
    nuevo = client.post(
        "/api/v1/mi/establecimientos",
        headers=h,
        json={"nombre": "Campo dos", "lon": -58.18, "lat": -26.185, "stock": []},
    )
    assert nuevo.status_code == 201 and nuevo.json()["sector_id"] == "S2"
    upd = client.put(
        f"/api/v1/mi/establecimientos/{nuevo.json()['id']}",
        headers=h,
        json={"nombre": "Campo dos bis", "lon": -58.18, "lat": -26.185},
    )
    assert upd.json()["nombre"] == "Campo dos bis"
    # otro productor no ve ni toca este establecimiento; un ciudadano no es productor
    h2 = como("productor2")
    assert (
        client.put(f"/api/v1/mi/establecimientos/{eid}/stock", json=stock, headers=h2).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/mi/solicitudes-logistica", headers=h2, json={"establecimiento_id": eid}
        ).status_code
        == 404
    )
    assert client.get("/api/v1/mi/establecimientos", headers=como("ciudadano1")).status_code == 403
    assert (
        client.put(
            f"/api/v1/mi/establecimientos/{eid}/stock",
            headers=h,
            json={"stock": [{"especie": "bovino", "categoria_animal": "toro", "cantidad": -1}]},
        ).status_code
        == 422
    )


def test_mi_sector_con_estado_altura_y_centro_sugerido(client, como):
    r = client.get("/api/v1/mi/sector", headers=como("productor1")).json()
    assert r["altura_referencia"]["altura_m"] == 5.6
    assert r["altura_referencia"]["categoria"] == "DATO OBSERVADO"
    assert r["sectores"][0]["id"] == "S4" and r["sectores"][0]["estado"] == "normal"
    assert r["centro_asignado"]["animales"]["tipo"] == "predio_alto"
    c = client.get("/api/v1/mi/sector", headers=como("ciudadano1")).json()
    assert c["sectores"][0]["id"] == "S2" and c["centro_asignado"]["personas"]["nombre"]
    assert client.get("/api/v1/mi/sector", headers=como("operador")).json()["sectores"] == []


# ---------------------------------------------------------------- WebSocket


def test_websocket_exige_token_y_recibe_eventos(client, como):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"token": "invalido"})
            ws.receive_json()
    assert exc.value.code == 1008
    # el token por query param ya no se acepta: sin primer mensaje válido se cierra igual
    with pytest.raises(WebSocketDisconnect) as exc2:
        with client.websocket_connect("/api/v1/ws?token=cualquiera") as ws:
            ws.send_json({"hola": 1})
            ws.receive_json()
    assert exc2.value.code == 1008

    r = iniciar_sesion(client, DEMO["operador"], os.environ["DEMO_PASSWORD"])
    token = r.json()["access_token"]
    ciud = iniciar_sesion(client, DEMO["ciudadano1"], os.environ["DEMO_PASSWORD"]).json()[
        "access_token"
    ]
    with (
        client.websocket_connect(f"/api/v1/ws?token={token}") as ws_op,
        client.websocket_connect("/api/v1/ws") as ws_ciu,
    ):
        ws_op.send_json({"token": token})
        assert ws_op.receive_json()["tipo"] == "conectado"
        ws_ciu.send_json({"token": ciud})  # primer mensaje con el token
        assert ws_ciu.receive_json()["tipo"] == "conectado"

        client.post(
            "/api/v1/simulacion/escenario", json={"altura_formosa_m": 7.6}, headers=como("operador")
        )
        assert ws_op.receive_json()["tipo"] == "escenario"

        o = client.post(
            "/api/v1/ordenes",
            headers=como("decisor"),
            json={"tipo": "alerta", "sectores": ["S4"], "fundamento": FUNDAMENTO},
        )
        assert o.status_code == 201
        evento = ws_op.receive_json()
        assert evento["tipo"] == "orden" and evento["datos"]["id"] == o.json()["id"]
        # la ciudadanía recibe la orden, pero no el evento del escenario (que llegó antes)
        evento_ciu = ws_ciu.receive_json()
        assert evento_ciu["tipo"] == "orden"
