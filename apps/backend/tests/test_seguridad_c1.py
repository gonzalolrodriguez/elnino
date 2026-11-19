"""Seguridad de baja fricción (auditoría 19/11): gracia de refresh, 401 genérico, cuotas, tope de
cuerpo, canales, errores con sobre JSON y bandera de producción."""

import json
import os
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from starlette.websockets import WebSocketDisconnect

from app.api.v1.canales import firmar
from app.config.settings import get_settings
from app.core.limitador import limiter
from app.db.base import ahora
from app.db.modelos import AuditoriaAcceso, SesionRefresh
from app.main import app, crear_app
from tests.conftest import bearer, correo_unico, datos_ciudadano, iniciar_sesion
from tests.test_operacion import S4, _usuario_nuevo
from tests.test_seguridad_fase2 import _cliente_desde

REGISTRO = "/api/v1/auth/registro/ciudadano"
MOVIL = {"X-Cliente": "movil"}
SECRETO = os.environ["CANAL_HMAC_SECRET"]


def _refrescar(client, token):
    return client.post("/api/v1/auth/refresh", json={"refresh_token": token}, headers=MOVIL)


# ------------------------------------------------ gracia de rotación del refresh


def _sesion_movil(client):
    datos = datos_ciudadano()
    client.post(REGISTRO, json=datos)
    return datos, iniciar_sesion(client, datos["email"], datos["password"]).json()


def test_token_rotado_hace_instantes_recibe_sucesora_sin_revocar_la_familia(client):
    _, sesion = _sesion_movil(client)
    r1 = _refrescar(client, sesion["refresh_token"])
    r2 = _refrescar(client, sesion["refresh_token"])  # otra pestaña / reintento de red
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["refresh_token"] != r2.json()["refresh_token"]
    # La familia sigue viva: ambos sucesores y sus accesos funcionan.
    for r in (r1, r2):
        acceso = bearer(r.json()["access_token"])
        assert client.get("/api/v1/auth/yo", headers=acceso).status_code == 200
    assert _refrescar(client, r1.json()["refresh_token"]).status_code == 200


def test_reutilizar_fuera_de_la_gracia_revoca_la_familia(client, db):
    _, sesion = _sesion_movil(client)
    r1 = _refrescar(client, sesion["refresh_token"])
    assert r1.status_code == 200
    # Se envejece la rotación más allá de la ventana de gracia.
    viejo = ahora() - timedelta(seconds=get_settings().refresh_gracia_segundos + 60)
    db.execute(
        update(SesionRefresh)
        .where(SesionRefresh.reemplazado_por.is_not(None))
        .values(revocado_en=viejo)
    )
    db.commit()
    assert _refrescar(client, sesion["refresh_token"]).status_code == 401
    assert _refrescar(client, r1.json()["refresh_token"]).status_code == 401  # familia revocada


def test_despues_del_logout_la_gracia_no_reabre_la_sesion(client):
    _, sesion = _sesion_movil(client)
    r1 = _refrescar(client, sesion["refresh_token"])
    cierre = client.post("/api/v1/auth/logout", json={"refresh_token": r1.json()["refresh_token"]})
    assert cierre.status_code == 200
    assert _refrescar(client, sesion["refresh_token"]).status_code == 401


def test_logout_cierra_los_websockets_del_usuario(client):
    _, sesion = _sesion_movil(client)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"token": sesion["access_token"]})
            assert ws.receive_json()["tipo"] == "conectado"
            client.post("/api/v1/auth/logout", json={"refresh_token": sesion["refresh_token"]})
            ws.receive_json()
    assert exc.value.code == 1008


# ------------------------------------------------ login: 401 genérico y auditoría acotada


def test_login_correo_inexistente_y_contrasena_erronea_son_indistinguibles(client):
    datos = datos_ciudadano()
    client.post(REGISTRO, json=datos)
    inexistente = iniciar_sesion(client, correo_unico("nadie"), "x" * 12)
    erronea = iniciar_sesion(client, datos["email"], "x" * 12)
    assert inexistente.status_code == erronea.status_code == 401
    assert inexistente.json() == erronea.json()


def test_correos_inexistentes_no_escriben_una_fila_de_auditoria_por_intento(base_de_datos, db):
    c = _cliente_desde("198.51.100.77")
    for _ in range(6):
        assert iniciar_sesion(c, correo_unico("nadie"), "x" * 12).status_code == 401
    db.expire_all()
    filas = db.execute(
        select(func.count())
        .select_from(AuditoriaAcceso)
        .where(AuditoriaAcceso.ip == "198.51.100.77")
    ).scalar_one()
    assert filas == 1  # agregado: una fila por IP y ventana


def test_el_limitador_por_ip_devuelve_429_con_retry_after(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_login", "2/minute")
    limiter.reset()
    limiter.enabled = True
    try:
        rs = [iniciar_sesion(client, correo_unico("nadie"), "x" * 12) for _ in range(3)]
    finally:
        limiter.enabled = False
        limiter.reset()
    assert [r.status_code for r in rs] == [401, 401, 429]
    assert int(rs[2].headers["Retry-After"]) >= 1
    assert rs[2].json()["error"]["codigo"] == "demasiados_intentos"


# ------------------------------------------------ cuotas de solicitudes y adjuntos

CUERPO = {"tipo": "asistencia", "personas": 2, **S4, "texto": "Necesitamos ayuda"}
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60


def test_cuota_blanda_de_solicitudes_con_mensaje_y_retry_after(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "solicitudes_max_por_hora", 2)
    _, h = _usuario_nuevo(client)
    clave = "2f6c1c1e-8a0b-4a53-9c0c-7d6a5b1b9f10"
    con_clave = {**h, "Idempotency-Key": clave}
    primera = client.post("/api/v1/solicitudes", json=CUERPO, headers=con_clave)
    assert primera.status_code == 201
    assert client.post("/api/v1/solicitudes", json=CUERPO, headers=h).status_code == 201
    r = client.post("/api/v1/solicitudes", json=CUERPO, headers=h)
    assert r.status_code == 429
    assert "103" in r.json()["error"]["mensaje"] and int(r.headers["Retry-After"]) >= 1
    # Un reintento idempotente de la primera no cuenta contra la cuota: devuelve la original.
    repetida = client.post("/api/v1/solicitudes", json=CUERPO, headers=con_clave)
    assert repetida.status_code == 200 and repetida.json()["id"] == primera.json()["id"]


def test_tope_de_almacenamiento_de_adjuntos_por_usuario(client, monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "adjuntos_dir", str(tmp_path))
    monkeypatch.setattr(get_settings(), "adjuntos_max_bytes_por_usuario", len(JPEG) * 2)
    _, h = _usuario_nuevo(client)
    sid = client.post("/api/v1/solicitudes", json=CUERPO, headers=h).json()["id"]
    url = f"/api/v1/solicitudes/{sid}/adjuntos"

    def subir():
        return client.post(url, files={"archivo": ("f", JPEG, "image/jpeg")}, headers=h)

    assert subir().status_code == 201 and subir().status_code == 201
    r = subir()
    assert r.status_code == 413 and "fotos" in r.json()["error"]["mensaje"]


# ------------------------------------------------ tope global del cuerpo


def test_cuerpo_demasiado_grande_devuelve_413_con_sobre(client):
    grande = b"x" * (get_settings().cuerpo_max_bytes + 10)
    r = client.post(
        "/api/v1/auth/login", content=grande, headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 413 and r.json()["error"]["codigo"] == "cuerpo_demasiado_grande"


def test_cuerpo_por_partes_sin_content_length_tambien_se_corta(client):
    def trozos():
        for _ in range(5):
            yield b"x" * (get_settings().cuerpo_max_bytes // 2)

    r = client.post(
        "/api/v1/auth/login", content=trozos(), headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 413


# ------------------------------------------------ canales


def _firmado(client, ruta, cuerpo: dict, firma: str | bytes | None = None):
    crudo = json.dumps(cuerpo).encode()
    return client.post(
        ruta,
        content=crudo,
        headers={
            "X-Hub-Signature-256": firma if firma is not None else firmar(crudo, SECRETO),
            "Content-Type": "application/json",
        },
    )


def test_firma_con_caracteres_no_ascii_devuelve_401_no_500(client):
    r = _firmado(
        client,
        "/api/v1/canales/sms-sim",
        {"remitente": "x", "texto": "SOS"},
        "sha256=ñandú".encode(),
    )
    assert r.status_code == 401


def test_timestamp_invalido_o_desbordado_devuelve_422(client):
    def wa(ts):
        mensaje = {"timestamp": ts, "text": {"body": "SOS"}}
        return {"entry": [{"changes": [{"value": {"messages": [mensaje]}}]}]}

    assert _firmado(client, "/api/v1/canales/whatsapp-sim", wa("9" * 30)).status_code == 422
    assert _firmado(client, "/api/v1/canales/whatsapp-sim", wa("ayer")).status_code == 422


def test_content_length_grande_se_rechaza_antes_de_leer(client):
    r = client.post(
        "/api/v1/canales/sms-sim",
        content=b"x" * (70 * 1024),
        headers={"X-Hub-Signature-256": "sha256=00"},
    )
    assert r.status_code == 413


# ------------------------------------------------ checklist


def test_checklist_exige_item_con_largo_acotado(client, como):
    client.post(
        "/api/v1/ordenes",
        headers=como("decisor"),
        json={"tipo": "evacuacion", "sectores": ["S4"], "fundamento": "Compromiso previsto de S4."},
    )
    t = client.get("/api/v1/tareas", headers=como("cuadrilla")).json()["tareas"][0]
    url, h = f"/api/v1/tareas/{t['id']}", como("cuadrilla")
    assert client.patch(url, headers=h, json={"checklist": [{"hecho": True}]}).status_code == 422
    largo = [{"item": "x" * 201, "hecho": False}]
    assert client.patch(url, headers=h, json={"checklist": largo}).status_code == 422
    ok = [{"item": "Agua verificada", "hecho": True}]
    assert client.patch(url, headers=h, json={"checklist": ok}).json()["checklist"] == ok


# ------------------------------------------------ sobre de errores, CORS y producción


def test_sobre_de_errores_codigos_y_404_con_detalle(client, como):
    r = client.get("/api/v1/ruta-que-no-existe")
    assert r.status_code == 404 and r.json()["error"]["mensaje"] == "Recurso no encontrado"
    r = client.get("/api/v1/solicitudes/99999999", headers=como("operador"))
    assert r.status_code == 404 and r.json()["error"]["mensaje"] == "Solicitud no encontrada"
    _, h = _usuario_nuevo(client)
    sid = client.post("/api/v1/solicitudes", json=CUERPO, headers=h).json()["id"]
    r = client.post(
        f"/api/v1/solicitudes/{sid}/adjuntos",
        files={"archivo": ("a.txt", b"hola", "text/plain")},
        headers=h,
    )
    assert r.status_code == 415 and r.json()["error"]["codigo"] == "tipo_no_soportado"
    r = client.post("/api/v1/solicitudes", json={**CUERPO, "personas": 0, "texto": None}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["codigo"] == "validacion"


def test_error_inesperado_devuelve_sobre_json_sin_traza():
    async def explotar():
        raise RuntimeError("detalle interno secreto")

    app.add_api_route("/__boom", explotar)
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            r = c.get("/__boom")
    finally:
        app.router.routes.pop()
    assert r.status_code == 500
    assert r.json()["error"]["codigo"] == "error_interno"
    assert "secreto" not in r.text


def test_cors_permite_idempotency_key(client):
    r = client.options(
        "/api/v1/solicitudes",
        headers={
            "Origin": get_settings().cors_origins_lista[0],
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "idempotency-key,authorization",
        },
    )
    assert r.status_code == 200
    assert "idempotency-key" in r.headers["access-control-allow-headers"].lower()


def test_en_produccion_se_ocultan_docs_y_openapi(monkeypatch):
    with TestClient(crear_app()) as c:
        assert c.get("/openapi.json").status_code == 200
    monkeypatch.setattr(get_settings(), "entorno", "produccion")
    assert get_settings().cookie_segura is True
    with TestClient(crear_app()) as c:
        assert c.get("/openapi.json").status_code == 404
        assert c.get("/docs").status_code == 404


def test_semilla_no_crea_usuarios_demo_si_seed_demo_es_falso(db, monkeypatch):
    from app.db.seed import sembrar_todo

    monkeypatch.setattr(get_settings(), "seed_demo", False)
    resultado = sembrar_todo(db)
    assert resultado["usuarios_demo_nuevos"] == 0 and resultado["cuadrillas_nuevas"] == 0
