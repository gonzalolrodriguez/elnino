"""Partes de las cuadrillas, panel de cuadrillas e integrantes (CLAUDE.md §8.6)."""

from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import select

from app.core.eventos import Difusor, _Conexion
from app.db.modelos import AuditoriaAcceso, ParteTarea, SolicitudAsistencia, Tarea
from tests.conftest import DEMO, bearer, correo_unico, iniciar_sesion
from tests.test_evacuaciones import (
    _centro,
    _cierre,
    _clave,
    _cuadrilla_demo_id,
    _pedido_con_tarea,
)
from tests.test_operacion import S4, _usuario_nuevo

PASSWORD = "ClaveInstitucional2026!"


# ---- ayudas ------------------------------------------------------------------------------------


def _tarea_simple(client, como, db) -> int:
    """Tarea de asistencia (no exige constancia) asignada a la cuadrilla de demo."""
    _, h = _usuario_nuevo(client)
    s = client.post(
        "/api/v1/solicitudes", json={"tipo": "asistencia", "personas": 2, **S4}, headers=h
    ).json()
    for estado in ("verificada", "asignada"):
        cuerpo = {"estado": estado}
        if estado == "asignada":
            cuerpo["cuadrilla_id"] = _cuadrilla_demo_id(db)
        r = client.patch(f"/api/v1/solicitudes/{s['id']}", json=cuerpo, headers=como("operador"))
        assert r.status_code == 200, r.text
    tareas = client.get("/api/v1/tareas", headers=como("operador")).json()["tareas"]
    return next(t["id"] for t in tareas if t["solicitud_id"] == s["id"])


def _parte(client, como, tarea_id: int, quien: str = "cuadrilla", **cuerpo):
    return client.post(f"/api/v1/tareas/{tarea_id}/partes", json=cuerpo, headers=como(quien))


def _tarea(client, como, tarea_id: int) -> dict:
    tareas = client.get("/api/v1/tareas", headers=como("operador")).json()["tareas"]
    return next(t for t in tareas if t["id"] == tarea_id)


def _cuadrilla_ajena(client, token_admin, db) -> dict:
    """Usuario con rol cuadrilla que integra otra cuadrilla (no la de demo)."""
    r = client.post(
        "/api/v1/usuarios",
        headers=bearer(token_admin),
        json={
            "email": correo_unico("cuad"),
            "password": PASSWORD,
            "nombre_visible": "Cuadrilla de Prueba",
            "rol": "cuadrilla",
        },
    )
    assert r.status_code == 201, r.text
    usuario = r.json()
    c = client.post(
        "/api/v1/cuadrillas",
        headers=bearer(token_admin),
        json={"nombre": f"Cuadrilla ajena {uuid.uuid4().hex[:6]}", "tipo_incidente": "apicola"},
    ).json()
    a = client.post(
        f"/api/v1/cuadrillas/{c['id']}/integrantes",
        headers=bearer(token_admin),
        json={"usuario_id": usuario["id"], "rol_operativo": "encargado_cuadrilla"},
    )
    assert a.status_code == 201, a.text
    h = bearer(iniciar_sesion(client, usuario["email"], PASSWORD).json()["access_token"])
    return {"usuario": usuario, "h": h, "cuadrilla_id": c["id"]}


# ---- crear partes ------------------------------------------------------------------------------


def test_integrante_puede_enviar_cada_tipo_de_parte(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    r = _parte(client, como, tarea_id, tipo="avance", observacion="Llegamos al domicilio")
    assert r.status_code == 201, r.text
    p = r.json()
    assert set(p) == {
        "id",
        "tarea_id",
        "cuadrilla_id",
        "tipo",
        "resultado",
        "observacion",
        "autor_rol",
        "creado_en",
        "resuelta",
        "adjuntos",
    }
    assert p["tipo"] == "avance" and p["adjuntos"] == []
    assert p["tipo"] == "avance" and p["resuelta"] is None and p["resultado"] is None
    assert p["autor_rol"] == "encargado_cuadrilla"  # rol operativo, nunca un nombre
    assert p["cuadrilla_id"] == _cuadrilla_demo_id(db)

    d = _parte(client, como, tarea_id, tipo="dificultad", observacion="Camino anegado").json()
    assert d["tipo"] == "dificultad" and d["resuelta"] is False

    # avance y dificultad no cambian el estado
    t = _tarea(client, como, tarea_id)
    assert t["estado"] == "pendiente" and t["requiere_atencion"] is False
    assert t["ultimo_parte"]["id"] == d["id"]

    c = _parte(client, como, tarea_id, tipo="resultado", resultado="completa")
    assert c.status_code == 201, c.text
    assert c.json()["observacion"] is None and c.json()["resuelta"] is None
    t = _tarea(client, como, tarea_id)
    assert t["estado"] == "completada" and t["requiere_atencion"] is False


def test_no_integrante_ciudadano_y_anonimo_no_pueden_enviar_partes(client, como, db, token_admin):
    tarea_id = _tarea_simple(client, como, db)
    cuerpo = {"tipo": "avance", "observacion": "Intento ajeno"}
    ajena = _cuadrilla_ajena(client, token_admin, db)
    r = client.post(f"/api/v1/tareas/{tarea_id}/partes", json=cuerpo, headers=ajena["h"])
    assert r.status_code == 403
    for quien in ("ciudadano1", "productor1", "operador", "decisor"):
        assert _parte(client, como, tarea_id, quien, **cuerpo).status_code == 403
    assert client.post(f"/api/v1/tareas/{tarea_id}/partes", json=cuerpo).status_code == 401
    assert _parte(client, como, 99999999, **cuerpo).status_code == 404
    assert db.execute(select(ParteTarea).where(ParteTarea.tarea_id == tarea_id)).first() is None


def test_observacion_obligatoria_y_validaciones_422(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    for cuerpo in (
        {"tipo": "dificultad"},
        {"tipo": "dificultad", "observacion": "  "},
        {"tipo": "dificultad", "observacion": "ab"},
        {"tipo": "resultado", "resultado": "parcial"},
        {"tipo": "resultado", "resultado": "no_realizada", "observacion": "no"},
        {"tipo": "resultado", "resultado": "reprogramada"},
        {"tipo": "resultado"},  # falta el resultado
        {"tipo": "avance", "resultado": "completa"},  # resultado solo en tipo resultado
        {"tipo": "avance", "observacion": "x" * 1001},
        {"tipo": "desconocido", "observacion": "abc"},
        {"tipo": "resultado", "resultado": "casi", "observacion": "abc"},
        {"tipo": "avance", "observacion": "abc", "autor_rol": "decisor"},  # extra=forbid
    ):
        r = _parte(client, como, tarea_id, **cuerpo)
        assert r.status_code == 422, (cuerpo, r.text)
    # el avance y la completa no exigen observación
    assert _parte(client, como, tarea_id, tipo="avance").status_code == 201
    assert _parte(client, como, tarea_id, tipo="resultado", resultado="completa").status_code == 201


@pytest.mark.parametrize("resultado", ["parcial", "no_realizada", "reprogramada"])
def test_resultado_no_completo_devuelve_a_pendiente_con_atencion(client, como, db, resultado):
    tarea_id = _tarea_simple(client, como, db)
    r = client.patch(
        f"/api/v1/tareas/{tarea_id}", json={"estado": "en_curso"}, headers=como("cuadrilla")
    )
    assert r.status_code == 200
    solicitud_id = _tarea(client, como, tarea_id)["solicitud_id"]
    p = _parte(
        client, como, tarea_id, tipo="resultado", resultado=resultado, observacion="Quedó la mitad"
    )
    assert p.status_code == 201, p.text
    t = _tarea(client, como, tarea_id)
    assert t["estado"] == "pendiente" and t["requiere_atencion"] is True
    assert t["ultimo_parte"]["resultado"] == resultado
    # el pedido no queda "en curso" ni "resuelto" mientras la tarea sigue abierta
    db.expire_all()
    assert db.get(SolicitudAsistencia, solicitud_id).estado == "asignada"

    # un operador que reasigna o cambia el estado limpia la marca
    r = client.patch(
        f"/api/v1/tareas/{tarea_id}",
        json={"cuadrilla_id": _cuadrilla_demo_id(db)},
        headers=como("operador"),
    )
    assert r.status_code == 200 and r.json()["requiere_atencion"] is False
    assert _tarea(client, como, tarea_id)["requiere_atencion"] is False


def test_completa_posterior_limpia_la_marca_de_atencion(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    _parte(client, como, tarea_id, tipo="resultado", resultado="parcial", observacion="A medias")
    assert _tarea(client, como, tarea_id)["requiere_atencion"] is True
    assert _parte(client, como, tarea_id, tipo="resultado", resultado="completa").status_code == 201
    t = _tarea(client, como, tarea_id)
    assert t["estado"] == "completada" and t["requiere_atencion"] is False


def test_completa_en_tarea_de_evacuacion_exige_constancia_409(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    r = _parte(client, como, p["tarea_id"], tipo="resultado", resultado="completa")
    assert r.status_code == 409
    assert "constancia" in r.json()["error"]["mensaje"]
    assert _tarea(client, como, p["tarea_id"])["estado"] == "pendiente"
    # lo demás sí se puede informar
    assert (
        _parte(client, como, p["tarea_id"], tipo="avance", observacion="En camino").status_code
        == 201
    )


def test_tarea_cerrada_no_admite_partes_409(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    assert _parte(client, como, tarea_id, tipo="resultado", resultado="completa").status_code == 201
    assert _parte(client, como, tarea_id, tipo="avance", observacion="Tarde").status_code == 409


def test_cierre_con_constancia_crea_parte_completa(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    r = client.post(
        f"/api/v1/tareas/{p['tarea_id']}/cierre",
        json=_cierre(_centro(db)),
        headers={**como("cuadrilla"), **_clave()},
    )
    assert r.status_code == 201, r.text
    partes = client.get(f"/api/v1/tareas/{p['tarea_id']}/partes", headers=como("operador")).json()
    assert len(partes["items"]) == 1
    parte = partes["items"][0]
    assert parte["tipo"] == "resultado" and parte["resultado"] == "completa"
    assert parte["autor_rol"] == "encargado_cuadrilla"
    # un segundo cierre es rechazado y no duplica el parte
    r2 = client.post(
        f"/api/v1/tareas/{p['tarea_id']}/cierre",
        json=_cierre(_centro(db)),
        headers={**como("cuadrilla"), **_clave()},
    )
    assert r2.status_code == 409
    items = client.get(f"/api/v1/tareas/{p['tarea_id']}/partes", headers=como("operador")).json()
    assert len(items["items"]) == 1


# ---- consultas y resolución --------------------------------------------------------------------


def test_listar_partes_por_tarea_acceso_y_orden(client, como, db, token_admin):
    tarea_id = _tarea_simple(client, como, db)
    a = _parte(client, como, tarea_id, tipo="avance", observacion="Primero").json()
    b = _parte(client, como, tarea_id, tipo="dificultad", observacion="Segundo").json()
    for quien in ("operador", "decisor", "admin", "cuadrilla"):
        r = client.get(f"/api/v1/tareas/{tarea_id}/partes", headers=como(quien))
        assert r.status_code == 200, quien
        assert [p["id"] for p in r.json()["items"]] == [b["id"], a["id"]]  # más nuevo primero
    assert (
        client.get(f"/api/v1/tareas/{tarea_id}/partes", headers=como("ciudadano1")).status_code
        == 403
    )
    ajena = _cuadrilla_ajena(client, token_admin, db)
    assert client.get(f"/api/v1/tareas/{tarea_id}/partes", headers=ajena["h"]).status_code == 403
    assert client.get("/api/v1/tareas/99999999/partes", headers=como("operador")).status_code == 404


def test_operador_resuelve_dificultad(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    d = _parte(client, como, tarea_id, tipo="dificultad", observacion="Sin combustible").json()
    av = _parte(client, como, tarea_id, tipo="avance", observacion="Esperando").json()
    # la cuadrilla y la ciudadanía no resuelven
    for quien in ("cuadrilla", "ciudadano1"):
        r = client.patch(f"/api/v1/partes/{d['id']}", json={"resuelta": True}, headers=como(quien))
        assert r.status_code == 403
    for cuerpo in ({"resuelta": False}, {}, {"resuelta": True, "otro": 1}):
        r = client.patch(f"/api/v1/partes/{d['id']}", json=cuerpo, headers=como("operador"))
        assert r.status_code == 422
    r = client.patch(f"/api/v1/partes/{d['id']}", json={"resuelta": True}, headers=como("operador"))
    assert r.status_code == 200 and r.json()["resuelta"] is True
    # solo las dificultades se resuelven
    r = client.patch(f"/api/v1/partes/{av['id']}", json={"resuelta": True}, headers=como("decisor"))
    assert r.status_code == 409
    assert (
        client.patch(
            "/api/v1/partes/99999999", json={"resuelta": True}, headers=como("operador")
        ).status_code
        == 404
    )
    acciones = db.execute(
        select(AuditoriaAcceso.accion).where(AuditoriaAcceso.recurso == f"partes/{d['id']}")
    ).scalars()
    assert "parte_tarea_resuelto" in list(acciones)


def test_partes_recientes_orden_y_campos(client, como, db):
    t1 = _tarea_simple(client, como, db)
    t2 = _tarea_simple(client, como, db)
    t3 = _tarea_simple(client, como, db)
    av = _parte(client, como, t1, tipo="avance", observacion="Avance viejo").json()
    resuelta = _parte(client, como, t1, tipo="dificultad", observacion="Ya resuelta").json()
    client.patch(
        f"/api/v1/partes/{resuelta['id']}", json={"resuelta": True}, headers=como("operador")
    )
    abierta = _parte(client, como, t2, tipo="dificultad", observacion="Sigue abierta").json()
    parcial = _parte(
        client, como, t3, tipo="resultado", resultado="parcial", observacion="A medias"
    ).json()
    nuevo_avance = _parte(client, como, t2, tipo="avance", observacion="Avance nuevo").json()

    r = client.get("/api/v1/partes/recientes?limite=100", headers=como("operador"))
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["items"]]
    # primero lo que pide atención (más nuevo primero), después el resto por fecha
    assert ids[:2] == [parcial["id"], abierta["id"]]
    assert ids.index(nuevo_avance["id"]) < ids.index(resuelta["id"]) < ids.index(av["id"])
    primero = r.json()["items"][0]
    assert set(primero) == {
        "id",
        "tarea_id",
        "cuadrilla_id",
        "tipo",
        "resultado",
        "observacion",
        "autor_rol",
        "creado_en",
        "resuelta",
        "adjuntos",
        "sector_id",
        "solicitud_id",
        "cuadrilla_nombre",
        "tarea_estado",
    }
    assert primero["sector_id"] == "S4" and primero["tarea_estado"] == "pendiente"
    assert primero["cuadrilla_nombre"]
    assert (
        len(client.get("/api/v1/partes/recientes?limite=2", headers=como("admin")).json()["items"])
        == 2
    )
    for quien in ("cuadrilla", "ciudadano1", "productor1"):
        assert client.get("/api/v1/partes/recientes", headers=como(quien)).status_code == 403
    assert (
        client.get("/api/v1/partes/recientes?limite=0", headers=como("operador")).status_code == 422
    )
    assert (
        client.get("/api/v1/partes/recientes?limite=101", headers=como("operador")).status_code
        == 422
    )


# ---- resumen e integrantes ---------------------------------------------------------------------


def test_resumen_de_cuadrillas_forma_y_sin_nombres(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    _parte(client, como, tarea_id, tipo="dificultad", observacion="Falta una 4x4")
    r = client.get("/api/v1/cuadrillas/resumen", headers=como("operador"))
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    mia = next(c for c in items if c["id"] == _cuadrilla_demo_id(db))
    assert set(mia) == {
        "id",
        "nombre",
        "tipo_incidente",
        "vehiculo",
        "estado",
        "integrantes",
        "tarea_actual",
        "ultimo_parte",
        "dificultades_abiertas",
    }
    assert mia["dificultades_abiertas"] >= 1
    assert mia["ultimo_parte"]["tipo"] == "dificultad"
    assert set(mia["tarea_actual"]) == {
        "id",
        "estado",
        "solicitud_id",
        "sector_id",
        "requiere_atencion",
    }
    for i in mia["integrantes"]:
        assert set(i) == {"usuario_id", "rol_operativo", "es_encargado"}
    assert any(i["es_encargado"] and i["usuario_id"] for i in mia["integrantes"])
    # ningún nombre ni correo de persona en la respuesta
    texto = r.text
    assert "@demo.evacuaciones.invalid" not in texto and "nombre_visible" not in texto
    for quien in ("cuadrilla", "ciudadano1", "productor1"):
        assert client.get("/api/v1/cuadrillas/resumen", headers=como(quien)).status_code == 403
    assert client.get("/api/v1/cuadrillas/resumen").status_code == 401


def test_resumen_tarea_actual_y_cuadrilla_sin_tareas(client, como, token_admin, db):
    ajena = _cuadrilla_ajena(client, token_admin, db)
    items = client.get("/api/v1/cuadrillas/resumen", headers=como("operador")).json()["items"]
    c = next(c for c in items if c["id"] == ajena["cuadrilla_id"])
    assert c["tarea_actual"] is None and c["ultimo_parte"] is None
    assert c["dificultades_abiertas"] == 0
    assert c["integrantes"] == [
        {
            "usuario_id": ajena["usuario"]["id"],
            "rol_operativo": "encargado_cuadrilla",
            "es_encargado": True,
        }
    ]


def test_integrantes_agregar_y_quitar(client, como, token_admin, db):
    cuadrilla_id = _cuadrilla_demo_id(db)
    r = client.post(
        "/api/v1/usuarios",
        headers=bearer(token_admin),
        json={
            "email": correo_unico("cuad"),
            "password": PASSWORD,
            "nombre_visible": "Cuadrilla de Prueba",
            "rol": "cuadrilla",
        },
    )
    nuevo = r.json()["id"]
    url = f"/api/v1/cuadrillas/{cuadrilla_id}/integrantes"
    # el rol sipec tiene una vacante sin persona en la cuadrilla de demo: se cubre
    r = client.post(
        url, json={"usuario_id": nuevo, "rol_operativo": "sipec"}, headers=como("operador")
    )
    assert r.status_code == 201, r.text
    mios = [i for i in r.json()["integrantes"] if i["usuario_id"] == nuevo]
    assert len(mios) == 1 and mios[0]["rol_operativo"] == "sipec"
    assert mios[0]["es_encargado"] is False and mios[0]["profesion"] == "medicina"
    # repetir: 409
    r = client.post(
        url, json={"usuario_id": nuevo, "rol_operativo": "sipec"}, headers=como("admin")
    )
    assert r.status_code == 409
    # quitar (por el id del integrante, que también sirve para los puestos vacantes)
    r = client.delete(f"{url}/{mios[0]['id']}", headers=como("operador"))
    assert r.status_code == 200
    assert all(i["usuario_id"] != nuevo for i in r.json()["integrantes"])
    assert client.delete(f"{url}/{mios[0]['id']}", headers=como("operador")).status_code == 404


def test_integrantes_solo_usuarios_cuadrilla_y_roles_validos(client, como, token_admin, db):
    url = f"/api/v1/cuadrillas/{_cuadrilla_demo_id(db)}/integrantes"
    ciudadano = client.get("/api/v1/auth/yo", headers=como("ciudadano1")).json()["id"]
    r = client.post(
        url, json={"usuario_id": ciudadano, "rol_operativo": "sipec"}, headers=como("operador")
    )
    assert r.status_code == 422
    r = client.post(
        url, json={"usuario_id": 99999999, "rol_operativo": "sipec"}, headers=como("operador")
    )
    assert r.status_code == 422
    cuad = client.get("/api/v1/auth/yo", headers=como("cuadrilla")).json()["id"]
    r = client.post(
        url, json={"usuario_id": cuad, "rol_operativo": "no_existe"}, headers=como("operador")
    )
    assert r.status_code == 422
    r = client.post(
        url, json={"usuario_id": cuad, "rol_operativo": "sipec", "x": 1}, headers=como("operador")
    )
    assert r.status_code == 422
    r = client.post(
        "/api/v1/cuadrillas/99999999/integrantes",
        json={"usuario_id": cuad, "rol_operativo": "sipec"},
        headers=como("operador"),
    )
    assert r.status_code == 404
    # permisos: ni cuadrilla, ni decisor, ni ciudadanía
    for quien in ("cuadrilla", "decisor", "ciudadano1"):
        r = client.post(
            url, json={"usuario_id": cuad, "rol_operativo": "sipec"}, headers=como(quien)
        )
        assert r.status_code == 403, quien
        assert client.delete(f"{url}/{cuad}", headers=como(quien)).status_code == 403


def test_integrante_nuevo_puede_enviar_partes_y_el_quitado_no(client, como, token_admin, db):
    ajena = _cuadrilla_ajena(client, token_admin, db)
    tarea_id = _tarea_simple(client, como, db)
    cuerpo = {"tipo": "avance", "observacion": "Hola"}
    assert (
        client.post(
            f"/api/v1/tareas/{tarea_id}/partes", json=cuerpo, headers=ajena["h"]
        ).status_code
        == 403
    )
    url = f"/api/v1/cuadrillas/{_cuadrilla_demo_id(db)}/integrantes"
    r = client.post(
        url,
        json={"usuario_id": ajena["usuario"]["id"], "rol_operativo": "transporte"},
        headers=como("operador"),
    )
    assert r.status_code == 201
    integrante_id = next(
        i["id"] for i in r.json()["integrantes"] if i["usuario_id"] == ajena["usuario"]["id"]
    )
    r = client.post(f"/api/v1/tareas/{tarea_id}/partes", json=cuerpo, headers=ajena["h"])
    assert r.status_code == 201 and r.json()["autor_rol"] == "transporte"
    client.delete(f"{url}/{integrante_id}", headers=como("operador"))
    assert (
        client.post(
            f"/api/v1/tareas/{tarea_id}/partes", json=cuerpo, headers=ajena["h"]
        ).status_code
        == 403
    )


# ---- /mi/pedidos: novedad ----------------------------------------------------------------------


def _pedido_de(client, h, solicitud_id: int) -> dict:
    items = client.get("/api/v1/mi/pedidos", headers=h).json()["items"]
    return next(p for p in items if p["id"] == solicitud_id)


def test_mi_pedidos_novedad_sin_texto_de_observacion(client, como, db):
    p = _pedido_con_tarea(client, como, db)
    assert _pedido_de(client, p["h"], p["solicitud_id"])["novedad"] is None

    # un avance no es una novedad (y su texto no se expone)
    _parte(client, como, p["tarea_id"], tipo="avance", observacion="TEXTO-INTERNO-AVANCE")
    assert _pedido_de(client, p["h"], p["solicitud_id"])["novedad"] is None

    d = _parte(
        client, como, p["tarea_id"], tipo="dificultad", observacion="TEXTO-INTERNO-DIFICULTAD"
    ).json()
    cuerpo = client.get("/api/v1/mi/pedidos", headers=p["h"])
    novedad = _pedido_de(client, p["h"], p["solicitud_id"])["novedad"]
    assert novedad["tipo"] == "dificultad" and novedad["en"] == d["creado_en"]
    assert set(novedad) == {"tipo", "en"}
    assert "TEXTO-INTERNO" not in cuerpo.text

    # resuelta la dificultad, la novedad desaparece
    client.patch(f"/api/v1/partes/{d['id']}", json={"resuelta": True}, headers=como("operador"))
    assert _pedido_de(client, p["h"], p["solicitud_id"])["novedad"] is None

    _parte(
        client,
        como,
        p["tarea_id"],
        tipo="resultado",
        resultado="reprogramada",
        observacion="TEXTO-INTERNO-REPROG",
    )
    cuerpo = client.get("/api/v1/mi/pedidos", headers=p["h"])
    assert _pedido_de(client, p["h"], p["solicitud_id"])["novedad"]["tipo"] == "reprogramada"
    assert "TEXTO-INTERNO" not in cuerpo.text

    # otra persona no ve la novedad de este pedido
    _, otro = _usuario_nuevo(client)
    assert client.get("/api/v1/mi/pedidos", headers=otro).json()["items"] == []


# ---- tiempo real y auditoría -------------------------------------------------------------------


def test_evento_parte_tarea_llega_a_los_mandos_sin_observacion(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    token = iniciar_sesion(client, DEMO["operador"], os.environ["DEMO_PASSWORD"]).json()[
        "access_token"
    ]
    with client.websocket_connect("/api/v1/ws") as ws:
        ws.send_json({"token": token})
        assert ws.receive_json()["tipo"] == "conectado"
        r = _parte(client, como, tarea_id, tipo="dificultad", observacion="TEXTO-INTERNO-WS")
        assert r.status_code == 201
        evento = ws.receive_json()
    assert evento["tipo"] == "parte_tarea"
    assert evento["datos"] == {
        "tarea_id": tarea_id,
        "cuadrilla_id": _cuadrilla_demo_id(db),
        "tipo": "dificultad",
        "resultado": None,
    }
    assert "TEXTO-INTERNO" not in str(evento)


def test_parte_tarea_solo_para_roles_operativos():
    class _WS:  # solo identidad: el difusor no lo usa para elegir destinatarios
        pass

    difusor = Difusor()
    conexiones = {
        rol: _Conexion(_WS(), i, rol, 9e12)
        for i, rol in enumerate(
            ("operador", "decisor", "admin", "cuadrilla", "ciudadano", "productor")
        )
    }
    difusor._conexiones = list(conexiones.values())
    elegidos = {c.rol for c in difusor._destinatarios("parte_tarea", None, None)}
    assert elegidos == {"operador", "decisor", "admin"}
    # los demás eventos de tarea siguen llegando también a la cuadrilla
    assert "cuadrilla" in {c.rol for c in difusor._destinatarios("tarea", None, None)}


def test_acciones_de_partes_quedan_auditadas(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    _parte(
        client,
        como,
        tarea_id,
        tipo="resultado",
        resultado="parcial",
        observacion="TEXTO-INTERNO-AUD",
    )
    filas = (
        db.execute(
            select(AuditoriaAcceso).where(AuditoriaAcceso.recurso == f"tareas/{tarea_id}/partes")
        )
        .scalars()
        .all()
    )
    assert [f.accion for f in filas] == ["parte_tarea_creado"]
    assert filas[0].detalle == "resultado:parcial"  # el texto de la observación no se audita
    assert filas[0].usuario_id is not None
    assert (
        db.execute(select(Tarea.requiere_atencion).where(Tarea.id == tarea_id)).scalar_one() is True
    )


def test_seed_deja_partes_de_demostracion(client, como):
    items = client.get("/api/v1/partes/recientes?limite=100", headers=como("operador")).json()[
        "items"
    ]
    demo = [p for p in items if p["sector_id"] == "S4" and p["tipo"] in ("dificultad", "resultado")]
    assert any(p["tipo"] == "dificultad" and p["resuelta"] is False for p in demo)
    assert any(p["resultado"] == "parcial" for p in demo)


# ---- idempotencia (cola sin conexión de la app) --------------------------------------------------


def test_parte_idempotente_con_idempotency_key(client, como, db):
    tarea_id = _tarea_simple(client, como, db)
    clave = str(uuid.uuid4())
    cuerpo = {"tipo": "dificultad", "observacion": "Camino anegado"}
    url = f"/api/v1/tareas/{tarea_id}/partes"
    h = como("cuadrilla")
    r1 = client.post(url, json=cuerpo, headers={**h, "Idempotency-Key": clave})
    assert r1.status_code == 201, r1.text
    r2 = client.post(url, json=cuerpo, headers={**h, "Idempotency-Key": clave})
    assert r2.status_code == 200 and r2.json() == r1.json()
    assert len(client.get(url, headers=como("operador")).json()["items"]) == 1
    # el reintento de un resultado ya aplicado devuelve el original aunque la tarea cambió de estado
    k2 = str(uuid.uuid4())
    c = {"tipo": "resultado", "resultado": "completa"}
    a = client.post(url, json=c, headers={**h, "Idempotency-Key": k2})
    assert a.status_code == 201
    b = client.post(url, json=c, headers={**h, "Idempotency-Key": k2})
    assert b.status_code == 200 and b.json()["id"] == a.json()["id"]
    # clave nueva sobre la tarea cerrada: 409; la misma clave en otra tarea: 409; clave inválida: 422
    nueva = {**h, "Idempotency-Key": str(uuid.uuid4())}
    assert client.post(url, json=cuerpo, headers=nueva).status_code == 409
    t2 = _tarea_simple(client, como, db)
    r = client.post(
        f"/api/v1/tareas/{t2}/partes", json=cuerpo, headers={**h, "Idempotency-Key": clave}
    )
    assert r.status_code == 409
    r = client.post(url, json=cuerpo, headers={**h, "Idempotency-Key": "no-es-uuid"})
    assert r.status_code == 422
