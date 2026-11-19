"""Constancias de evacuación, confirmación del evacuado (app y SMS) y tablero de evacuaciones."""

from __future__ import annotations

import json
import os
import uuid

import pytest
from sqlalchemy import func, select

from app.api.v1.canales import firmar
from app.config.settings import get_settings
from app.db.modelos import AuditoriaAcceso, CentroRecepcion, IntegranteCuadrilla, Usuario
from app.domain import evacuaciones as dom
from tests.test_operacion import S4, _usuario_nuevo

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 60
SECRETO = os.environ["CANAL_HMAC_SECRET"]


@pytest.fixture(autouse=True)
def carpeta_adjuntos(tmp_path, monkeypatch):
    monkeypatch.setenv("ADJUNTOS_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


# ---- ayudas -----------------------------------------------------------------------------------


def _clave() -> dict:
    return {"Idempotency-Key": str(uuid.uuid4())}


def _centro(db) -> tuple[int, float, float]:
    c = db.execute(
        select(
            CentroRecepcion.id, func.ST_X(CentroRecepcion.geom), func.ST_Y(CentroRecepcion.geom)
        ).order_by(CentroRecepcion.id)
    ).first()
    return c[0], c[1], c[2]


def _cuadrilla_demo_id(db) -> int:
    return db.execute(
        select(IntegranteCuadrilla.cuadrilla_id)
        .join(Usuario, Usuario.id == IntegranteCuadrilla.usuario_id)
        .where(Usuario.email == "cuadrilla@demo.evacuaciones.invalid")
        .limit(1)
    ).scalar_one()


def _pedido_con_tarea(client, como, db, h_solicitante=None, cuadrilla_id=None) -> dict:
    """Solicitud de un usuario nuevo asignada a la cuadrilla de demo (o a otra)."""
    if h_solicitante is None:
        _, h_solicitante = _usuario_nuevo(client)
    s = client.post(
        "/api/v1/solicitudes",
        json={"tipo": "evacuacion", "personas": 3, **S4},
        headers=h_solicitante,
    ).json()
    for estado in ("verificada", "asignada"):
        r = client.patch(
            f"/api/v1/solicitudes/{s['id']}",
            json={"estado": estado, "cuadrilla_id": cuadrilla_id or _cuadrilla_demo_id(db)}
            if estado == "asignada"
            else {"estado": estado},
            headers=como("operador"),
        )
        assert r.status_code == 200, r.text
    tareas = client.get("/api/v1/tareas", headers=como("operador")).json()["tareas"]
    tarea = next(t for t in tareas if t["solicitud_id"] == s["id"])
    return {"solicitud_id": s["id"], "tarea_id": tarea["id"], "h": h_solicitante}


def _cierre(centro, **extra) -> dict:
    cid, x, y = centro
    return {
        "lat": y,
        "lon": x,
        "centro_id": cid,
        "personas_trasladadas": 3,
        "animales_trasladados": {"bovinos": 12},
        "nota": "Llegaron al centro por la ruta de ripio.",
        **extra,
    }


def _cerrar(client, como, db, quien="cuadrilla", **extra_cuerpo):
    p = _pedido_con_tarea(client, como, db)
    r = client.post(
        f"/api/v1/tareas/{p['tarea_id']}/cierre",
        json=_cierre(_centro(db), **extra_cuerpo),
        headers={**como(quien), **_clave()},
    )
    assert r.status_code == 201, r.text
    return p, r.json()


def _codigo(client, h) -> str:
    n = next(
        n
        for n in client.get("/api/v1/mi/notificaciones", headers=h).json()["notificaciones"]
        if n["tipo"] == "confirmacion_evacuacion"
    )
    return n["datos"]["codigo"]


def _estado(client, como, tarea_id) -> dict:
    items = client.get("/api/v1/evacuaciones?limite=500", headers=como("operador")).json()
    return next(e for e in items["evacuaciones"] if e["tarea_id"] == tarea_id)


def _sms(client, texto: str):
    cuerpo = json.dumps({"remitente": "+5400000000", "texto": texto}).encode()
    return client.post(
        "/api/v1/canales/sms-sim",
        content=cuerpo,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": firmar(cuerpo, SECRETO),
        },
    )


# ---- lógica pura ------------------------------------------------------------------------------


def test_estado_derivado_puro():
    f = dom.estado_evacuacion
    assert f("pendiente", None, None, 500) == ("pendiente", [])
    assert f("en_curso", None, None, 500) == ("en_curso", [])
    assert f("cancelada", None, None, 500) == (None, [])
    assert f("completada", None, 100, 500) == ("cerrada_cuadrilla", [])
    assert f("completada", "si", 100, 500) == ("verificada", [])
    assert f("completada", "si", 900, 500) == ("con_discrepancia", [dom.MOTIVO_LEJOS])
    assert f("completada", "no", 100, 500) == ("con_discrepancia", [dom.MOTIVO_NO])
    assert f("completada", "problema", None, 500)[0] == "con_discrepancia"


def test_parser_sms_y_codigos():
    c = dom.generar_codigo()
    assert len(c) == 6 and any(x.isdigit() for x in c) and any(x.isalpha() for x in c)
    r = dom.parsear_respuesta_sms(f"  Sí {c.lower()} ")
    assert r and r.respuesta == "si" and r.codigo == c and r.comentario is None
    r = dom.parsear_respuesta_sms(f"PROBLEMA {c} se cortó el camino")
    assert r and r.respuesta == "problema" and r.comentario == "se cortó el camino"
    # Texto libre que empieza con "no" no es una respuesta (el código exige un dígito).
    assert dom.parsear_respuesta_sms("no quedan víveres") is None
    assert dom.parsear_respuesta_sms("SI") is None
    assert dom.parsear_respuesta_sms(f"SI {c}x") is None


# ---- cierre con constancia ----------------------------------------------------------------------


def test_cierre_feliz_con_constancia_y_notificacion(client, como, db):
    p, j = _cerrar(client, como, db)
    c = j["constancia"]
    assert c["personas_trasladadas"] == 3 and c["animales_trasladados"] == {"bovinos": 12}
    assert c["destino"]["centro_id"] and c["destino"]["distancia_a_centro_m"] == 0
    assert c["rol_operativo"] and c["categoria"] == "SIMULADO"
    assert j["tarea"]["estado"] == "completada" and j["repetida"] is False
    assert j["evacuacion"] == {
        "estado": "cerrada_cuadrilla",
        "motivos_discrepancia": [],
        "confirmacion_solicitada": True,
    }
    # El solicitante recibe la consulta con el código y los ids.
    n = next(
        n
        for n in client.get("/api/v1/mi/notificaciones", headers=p["h"]).json()["notificaciones"]
        if n["tipo"] == "confirmacion_evacuacion"
    )
    assert (
        n["datos"]["solicitud_id"] == p["solicitud_id"] and n["datos"]["tarea_id"] == p["tarea_id"]
    )
    assert len(n["datos"]["codigo"]) == 6 and n["datos"]["codigo"] in n["mensaje"]
    # Los mandos la leen y la lectura queda auditada.
    antes = db.execute(
        select(func.count())
        .select_from(AuditoriaAcceso)
        .where(
            AuditoriaAcceso.recurso == f"tareas/{p['tarea_id']}/constancia",
            AuditoriaAcceso.accion == "lectura_datos_personales",
        )
    ).scalar_one()
    g = client.get(f"/api/v1/tareas/{p['tarea_id']}/constancia", headers=como("operador"))
    assert g.status_code == 200 and g.json()["constancia"]["id"] == c["id"]
    assert g.json()["origen"]["tipo"] == "solicitud"
    db.expire_all()
    despues = db.execute(
        select(func.count())
        .select_from(AuditoriaAcceso)
        .where(
            AuditoriaAcceso.recurso == f"tareas/{p['tarea_id']}/constancia",
            AuditoriaAcceso.accion == "lectura_datos_personales",
        )
    ).scalar_one()
    assert despues == antes + 1


def test_cierre_idempotente_devuelve_el_mismo(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    h = {**como("cuadrilla"), **_clave()}
    cuerpo = _cierre(_centro(db))
    a = client.post(f"/api/v1/tareas/{p['tarea_id']}/cierre", json=cuerpo, headers=h)
    b = client.post(f"/api/v1/tareas/{p['tarea_id']}/cierre", json=cuerpo, headers=h)
    assert a.status_code == 201 and b.status_code == 200
    assert b.json()["repetida"] is True
    assert a.json()["constancia"]["id"] == b.json()["constancia"]["id"]
    # Otra clave sobre la misma tarea: ya está cerrada.
    c = client.post(
        f"/api/v1/tareas/{p['tarea_id']}/cierre",
        json=cuerpo,
        headers={**como("cuadrilla"), **_clave()},
    )
    assert c.status_code == 409
    # La misma clave sobre otra tarea tampoco se acepta.
    otra = _pedido_con_tarea(client, como, db)
    d = client.post(f"/api/v1/tareas/{otra['tarea_id']}/cierre", json=cuerpo, headers=h)
    assert d.status_code == 409


def test_cierre_roles_y_validaciones(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    url = f"/api/v1/tareas/{p['tarea_id']}/cierre"
    cuerpo = _cierre(_centro(db))
    for rol in ("ciudadano1", "productor1", "decisor", "admin"):
        assert client.post(url, json=cuerpo, headers={**como(rol), **_clave()}).status_code == 403
    assert client.post(url, json=cuerpo, headers=_clave()).status_code == 401
    cuad = como("cuadrilla")
    # Sin Idempotency-Key, o con una que no es UUID.
    assert client.post(url, json=cuerpo, headers=cuad).status_code == 422
    assert (
        client.post(url, json=cuerpo, headers={**cuad, "Idempotency-Key": "x"}).status_code == 422
    )
    # Coordenadas inválidas, nada trasladado sin nota, centro inexistente, campo desconocido.
    for malo in (
        {"lat": 95},
        {"lon": -181},
        {"personas_trasladadas": 0, "animales_trasladados": {}, "nota": None},
        {"personas_trasladadas": -1},
        {"centro_id": 999999},
        {"inventado": 1},
    ):
        r = client.post(url, json={**cuerpo, **malo}, headers={**cuad, **_clave()})
        assert r.status_code == 422, (malo, r.text)
    # Tarea inexistente.
    assert (
        client.post(
            "/api/v1/tareas/999999/cierre", json=cuerpo, headers={**cuad, **_clave()}
        ).status_code
        == 404
    )
    # Tras los intentos fallidos la tarea sigue abierta y un operador puede cerrarla.
    assert (
        client.post(url, json=cuerpo, headers={**como("operador"), **_clave()}).status_code == 201
    )


def test_otra_cuadrilla_recibe_403(client, como, db):
    nueva = client.post(
        "/api/v1/cuadrillas",
        json={"nombre": "Cuadrilla sin integrantes", "tipo_incidente": "humana"},
        headers=como("operador"),
    ).json()
    p = _pedido_con_tarea(client, como, db, cuadrilla_id=nueva["id"])
    url = f"/api/v1/tareas/{p['tarea_id']}"
    cuerpo = _cierre(_centro(db))
    assert (
        client.post(
            f"{url}/cierre", json=cuerpo, headers={**como("cuadrilla"), **_clave()}
        ).status_code
        == 403
    )
    assert client.get(f"{url}/constancia", headers=como("cuadrilla")).status_code == 403
    assert (
        client.post(
            f"{url}/cierre/adjuntos",
            files={"archivo": ("f", JPEG, "image/jpeg")},
            headers=como("cuadrilla"),
        ).status_code
        == 403
    )


def test_tarea_cancelada_no_se_cierra(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    assert (
        client.patch(
            f"/api/v1/tareas/{p['tarea_id']}",
            json={"estado": "cancelada"},
            headers=como("operador"),
        ).status_code
        == 200
    )
    r = client.post(
        f"/api/v1/tareas/{p['tarea_id']}/cierre",
        json=_cierre(_centro(db)),
        headers={**como("cuadrilla"), **_clave()},
    )
    assert r.status_code == 409


# ---- fotos ---------------------------------------------------------------------------------------


def test_fotos_de_la_constancia(client, como, db, carpeta_adjuntos, monkeypatch):
    p, _ = _cerrar(client, como, db)
    t = p["tarea_id"]
    cuad = como("cuadrilla")
    url = f"/api/v1/tareas/{t}/cierre/adjuntos"

    def subir(contenido, tipo="image/jpeg", h=cuad):
        return client.post(url, files={"archivo": ("f", contenido, tipo)}, headers=h)

    r = subir(JPEG)
    assert r.status_code == 201 and r.json()["n"] == 1 and r.json()["tarea_id"] == t
    assert (carpeta_adjuntos / "constancias" / str(t) / "1.jpg").read_bytes() == JPEG
    dup = subir(JPEG)
    assert dup.status_code == 200 and dup.json()["duplicado"] is True and dup.json()["n"] == 1
    assert subir(PNG, "image/png").json()["n"] == 2
    assert subir(b"%PDF-1.4", "application/pdf").status_code == 415
    assert subir(b"no es una imagen", "image/jpeg").status_code == 415
    assert subir(b"", "image/jpeg").status_code == 422
    # Ciudadanía no sube ni descarga.
    assert subir(JPEG, h=p["h"]).status_code == 403
    assert client.get(f"{url}/1", headers=p["h"]).status_code == 403
    g = client.get(f"{url}/1", headers=como("operador"))
    assert g.status_code == 200 and g.content == JPEG
    assert g.headers["x-content-type-options"] == "nosniff"
    assert client.get(f"{url}/9", headers=como("operador")).status_code == 404
    meta = client.get(f"/api/v1/tareas/{t}/constancia", headers=como("operador")).json()
    assert [a["n"] for a in meta["constancia"]["adjuntos"]] == [1, 2]
    assert set(meta["constancia"]["adjuntos"][0]) == {"n", "mime", "bytes"}


def test_limites_de_fotos_y_foto_sin_constancia(client, como, db, monkeypatch):
    p = _pedido_con_tarea(client, como, db)
    url = f"/api/v1/tareas/{p['tarea_id']}/cierre/adjuntos"
    sin = client.post(url, files={"archivo": ("f", JPEG, "image/jpeg")}, headers=como("cuadrilla"))
    assert sin.status_code == 404  # todavía no hay constancia
    client.post(
        f"/api/v1/tareas/{p['tarea_id']}/cierre",
        json=_cierre(_centro(db)),
        headers={**como("cuadrilla"), **_clave()},
    )
    monkeypatch.setenv("ADJUNTO_MAX_BYTES", "100")
    monkeypatch.setenv("ADJUNTOS_MAX_POR_SOLICITUD", "2")
    get_settings.cache_clear()

    def subir(c):
        return client.post(
            url, files={"archivo": ("f", c, "image/jpeg")}, headers=como("cuadrilla")
        )

    assert subir(JPEG + b"\x00" * 100).status_code == 413
    assert subir(JPEG).status_code == 201
    assert subir(JPEG + b"\x01").status_code == 201
    assert subir(JPEG + b"\x02").status_code == 409


# ---- confirmación del evacuado ---------------------------------------------------------------------


def test_confirmacion_por_la_app_verifica(client, como, db):
    p, _ = _cerrar(client, como, db)
    assert _estado(client, como, p["tarea_id"])["estado"] == "cerrada_cuadrilla"
    pend = client.get("/api/v1/mi/confirmaciones", headers=p["h"]).json()
    assert pend["pendientes"] == 1 and pend["confirmaciones"][0]["centro_nombre"]
    assert "lat" not in str(pend) and "lon" not in str(pend)
    r = client.post(
        "/api/v1/mi/confirmaciones",
        json={"solicitud_id": p["solicitud_id"], "respuesta": "si"},
        headers=p["h"],
    )
    assert r.status_code == 201, r.text
    assert r.json()["respuesta"] == "si" and r.json()["canal"] == "app"
    e = _estado(client, como, p["tarea_id"])
    assert e["estado"] == "verificada" and e["confirmacion"]["respuesta"] == "si"
    assert e["discrepancia"] is None
    # Repetir la misma respuesta es inocuo; cambiarla da 409.
    again = client.post(
        "/api/v1/mi/confirmaciones",
        json={"solicitud_id": p["solicitud_id"], "respuesta": "si"},
        headers=p["h"],
    )
    assert again.status_code == 200 and again.json()["repetida"] is True
    cambio = client.post(
        "/api/v1/mi/confirmaciones",
        json={"solicitud_id": p["solicitud_id"], "respuesta": "no"},
        headers=p["h"],
    )
    assert cambio.status_code == 409
    assert client.get("/api/v1/mi/confirmaciones", headers=p["h"]).json()["pendientes"] == 0


def test_confirmacion_por_codigo_y_ajenos(client, como, db):
    p, _ = _cerrar(client, como, db)
    codigo = _codigo(client, p["h"])
    _, otro = _usuario_nuevo(client)
    url = "/api/v1/mi/confirmaciones"
    # Otra persona no puede responder por la solicitud ni con el código ajeno.
    assert (
        client.post(
            url, json={"solicitud_id": p["solicitud_id"], "respuesta": "si"}, headers=otro
        ).status_code
        == 404
    )
    assert (
        client.post(url, json={"codigo": codigo, "respuesta": "si"}, headers=otro).status_code
        == 404
    )
    assert (
        client.post(url, json={"codigo": "ZZZZZ9", "respuesta": "si"}, headers=p["h"]).status_code
        == 404
    )
    # Validaciones: falta un identificador, o vienen los dos; respuesta fuera de la lista.
    assert client.post(url, json={"respuesta": "si"}, headers=p["h"]).status_code == 422
    assert (
        client.post(
            url, json={"codigo": codigo, "solicitud_id": 1, "respuesta": "si"}, headers=p["h"]
        ).status_code
        == 422
    )
    assert (
        client.post(
            url, json={"codigo": codigo, "respuesta": "tal vez"}, headers=p["h"]
        ).status_code
        == 422
    )
    # Roles institucionales no responden.
    assert (
        client.post(
            url, json={"codigo": codigo, "respuesta": "si"}, headers=como("operador")
        ).status_code
        == 403
    )
    ok = client.post(
        url,
        json={"codigo": codigo.lower(), "respuesta": "problema", "comentario": "Falta agua"},
        headers=p["h"],
    )
    assert ok.status_code == 201
    e = _estado(client, como, p["tarea_id"])
    assert e["estado"] == "con_discrepancia" and e["discrepancia"]["motivos"] == [
        dom.MOTIVO_PROBLEMA
    ]
    assert e["confirmacion"]["comentario"] == "Falta agua"


def test_confirmacion_por_sms(client, como, db):
    p, _ = _cerrar(client, como, db)
    codigo = _codigo(client, p["h"])
    r = _sms(client, f"SI {codigo}")
    assert r.status_code == 201, r.text
    res = r.json()["resultados"][0]
    assert res["tipo"] == "confirmacion" and res["estado"] == "creado"
    assert "Gracias por confirmar" in res["respuesta"]
    e = _estado(client, como, p["tarea_id"])
    assert e["estado"] == "verificada" and e["confirmacion"]["canal"] == "sms_sim"
    # Repetido: respuesta fija de "ya registrada", sin cambiar nada.
    rep = _sms(client, f"NO {codigo}").json()["resultados"][0]
    assert rep["estado"] == "duplicado"
    assert _estado(client, como, p["tarea_id"])["estado"] == "verificada"
    # Código que no existe.
    mal = _sms(client, "SI ZZZZZ9").json()["resultados"][0]
    assert mal["estado"] == "codigo_invalido" and "No encontramos ese código" in mal["respuesta"]


def test_sms_no_y_problema_marcan_discrepancia(client, como, db):
    p, _ = _cerrar(client, como, db)
    cod = _codigo(client, p["h"])
    res = _sms(client, f"PROBLEMA {cod} el camino estaba cortado").json()["resultados"][0]
    assert res["estado"] == "creado" and "problema" in res["respuesta"]
    e = _estado(client, como, p["tarea_id"])
    assert e["estado"] == "con_discrepancia"
    assert e["confirmacion"]["comentario"] == "el camino estaba cortado"
    p2, _ = _cerrar(client, como, db)
    assert _sms(client, f"no {_codigo(client, p2['h'])}").status_code == 201
    assert _estado(client, como, p2["tarea_id"])["discrepancia"]["motivos"] == [dom.MOTIVO_NO]
    # Un texto libre que empieza con "no" sigue siendo un pedido, no una confirmación.
    libre = _sms(client, "no quedan viveres en el paraje").json()["resultados"][0]
    assert libre["tipo"] != "confirmacion"


def test_destino_lejos_del_centro_es_discrepancia_y_avisa_al_operador(client, como, db):
    cid, x, y = _centro(db)
    p, j = _cerrar(client, como, db, lon=x + 0.02, lat=y)  # ~2 km al este
    assert j["evacuacion"]["estado"] == "con_discrepancia"
    assert j["evacuacion"]["motivos_discrepancia"] == [dom.MOTIVO_LEJOS]
    assert j["constancia"]["destino"]["distancia_a_centro_m"] > 500
    avisos = client.get("/api/v1/mi/notificaciones", headers=como("operador")).json()[
        "notificaciones"
    ]
    aviso = next(
        n for n in avisos if n["tipo"] == "discrepancia" and n["datos"]["tarea_id"] == p["tarea_id"]
    )
    assert "no una acusación" in aviso["mensaje"] and aviso["datos"]["motivos"] == [
        dom.MOTIVO_LEJOS
    ]
    # Aunque el evacuado diga que sí, la distancia sigue marcada para revisar.
    client.post(
        "/api/v1/mi/confirmaciones",
        json={"solicitud_id": p["solicitud_id"], "respuesta": "si"},
        headers=p["h"],
    )
    assert _estado(client, como, p["tarea_id"])["estado"] == "con_discrepancia"


# ---- tablero y privacidad -------------------------------------------------------------------------


def test_listado_de_evacuaciones_filtros_y_privacidad(client, como, db):
    p, _ = _cerrar(client, como, db)
    r = client.get(
        "/api/v1/evacuaciones?estado=cerrada_cuadrilla&sector_id=S4", headers=como("decisor")
    )
    assert r.status_code == 200
    j = r.json()
    assert j["categoria"] == "SIMULADO" and j["total"] >= 1
    item = next(e for e in j["evacuaciones"] if e["tarea_id"] == p["tarea_id"])
    assert (
        item["origen"]["tipo"] == "solicitud" and item["constancia"]["destino"]["lat"] is not None
    )
    assert all(e["estado"] == "cerrada_cuadrilla" for e in j["evacuaciones"])
    pag = client.get("/api/v1/evacuaciones?limite=1&offset=0", headers=como("admin")).json()
    assert len(pag["evacuaciones"]) == 1 and pag["total"] >= 1 and pag["limite"] == 1
    assert (
        client.get("/api/v1/evacuaciones?estado=inventado", headers=como("operador")).status_code
        == 422
    )
    # Ciudadanía, productores y cuadrilla no leen el listado; sin sesión, 401.
    for rol in ("ciudadano1", "productor1", "cuadrilla"):
        assert client.get("/api/v1/evacuaciones", headers=como(rol)).status_code == 403
    assert client.get("/api/v1/evacuaciones", headers=p["h"]).status_code == 403
    assert client.get("/api/v1/evacuaciones").status_code == 401
    # Ni la constancia (con ubicaciones) la ve la ciudadanía.
    assert (
        client.get(f"/api/v1/tareas/{p['tarea_id']}/constancia", headers=p["h"]).status_code == 403
    )


def test_resumen_del_panel_incluye_evacuaciones(client, como, db):
    _cerrar(client, como, db)
    resumen = client.get("/api/v1/panel/resumen", headers=como("operador")).json()
    ev = resumen["evacuaciones"]
    assert ev["categoria"] == "SIMULADO" and ev["fuente"] and ev["fecha_dato"]
    assert set(ev["por_estado"]) == set(dom.ESTADOS)
    todos = client.get("/api/v1/evacuaciones?limite=500", headers=como("operador")).json()
    assert ev["total"] == todos["total"] == sum(ev["por_estado"].values())
    assert ev["personas_trasladadas"] == sum(
        e["constancia"]["personas_trasladadas"] for e in todos["evacuaciones"] if e["constancia"]
    )
    assert ev["animales_trasladados"].get("bovinos", 0) >= 12
    assert ev["discrepancias_abiertas"] == ev["por_estado"]["con_discrepancia"]
    assert "S4" in ev["por_sector"] and set(ev["por_sector"]["S4"]) == set(dom.ESTADOS)
    cerradas = sum(
        ev["por_estado"][k] for k in ("cerrada_cuadrilla", "verificada", "con_discrepancia")
    )
    assert ev["verificadas_pct"] == round(100 * ev["por_estado"]["verificada"] / cerradas, 1)
    # El resumen no expone ubicaciones de evacuados.
    assert "lat" not in json.dumps(ev)


def test_seed_deja_evacuaciones_de_demo(client, como):
    ev = client.get("/api/v1/panel/resumen", headers=como("operador")).json()["evacuaciones"]
    assert ev["por_estado"]["verificada"] >= 1
    assert ev["por_estado"]["cerrada_cuadrilla"] >= 1
    assert ev["por_estado"]["con_discrepancia"] >= 1
