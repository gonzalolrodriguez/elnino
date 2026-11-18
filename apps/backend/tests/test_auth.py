"""Registro, login, bloqueo, refresh rotativo, logout y /auth/yo."""

import os
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.config.settings import get_settings
from app.db.modelos import Establecimiento, GrupoFamiliar, Usuario
from tests.conftest import (
    PASSWORD_VALIDA,
    bearer,
    correo_unico,
    datos_ciudadano,
    iniciar_sesion,
)

REGISTRO_C = "/api/v1/auth/registro/ciudadano"
REGISTRO_P = "/api/v1/auth/registro/productor"


# ---------------------------------------------------------------- registro


def test_registro_ciudadano_ok_sin_exponer_credenciales(client, db):
    datos = datos_ciudadano(telefono="000-0000099", lon=-58.18, lat=-26.185, integrantes=3)
    r = client.post(REGISTRO_C, json=datos)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["rol"] == "ciudadano" and cuerpo["email"] == datos["email"]
    assert "password" not in cuerpo and "hash_password" not in cuerpo

    usuario = db.execute(select(Usuario).where(Usuario.email == datos["email"])).scalar_one()
    assert usuario.hash_password.startswith("$argon2id$")
    assert usuario.consentimiento_en is not None
    grupo = db.execute(
        select(GrupoFamiliar).where(GrupoFamiliar.usuario_id == usuario.id)
    ).scalar_one()
    assert grupo.sector_id == "S2"
    assert grupo.telefono_cifrado and "0000099" not in grupo.telefono_cifrado


def test_registro_sin_consentimiento_devuelve_422(client):
    datos = datos_ciudadano(consentimiento=False)
    r = client.post(REGISTRO_C, json=datos)
    assert r.status_code == 422
    assert r.json()["error"]["codigo"] == "validacion"
    faltante = datos_ciudadano()
    del faltante["consentimiento"]
    assert client.post(REGISTRO_C, json=faltante).status_code == 422


def test_registro_con_contrasena_corta_devuelve_422(client):
    r = client.post(REGISTRO_C, json=datos_ciudadano(password="corta123"))
    assert r.status_code == 422
    campos = [d["campo"] for d in r.json()["error"]["detalle"]]
    assert "body.password" in campos


def test_registro_con_correo_invalido_o_campo_extra_devuelve_422(client):
    assert client.post(REGISTRO_C, json=datos_ciudadano(email="no-es-un-correo")).status_code == 422
    assert client.post(REGISTRO_C, json=datos_ciudadano(rol="admin")).status_code == 422


def test_registro_con_correo_repetido_devuelve_409(client):
    datos = datos_ciudadano()
    assert client.post(REGISTRO_C, json=datos).status_code == 201
    r = client.post(REGISTRO_C, json=datos)
    assert r.status_code == 409
    assert r.json()["error"]["codigo"] == "conflicto"


def test_registro_productor_ubica_el_establecimiento_en_s4(client, db):
    datos = {
        "email": correo_unico("prod"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Productor de Prueba",
        "consentimiento": True,
        "establecimiento": {
            "nombre": "Establecimiento de prueba",
            "lon": -58.139,
            "lat": -26.18,
            "stock": [{"especie": "bovino", "categoria_animal": "vaca con cría", "cantidad": 5}],
        },
    }
    r = client.post(REGISTRO_P, json=datos)
    assert r.status_code == 201, r.text
    usuario = db.execute(select(Usuario).where(Usuario.email == datos["email"])).scalar_one()
    est = db.execute(
        select(Establecimiento).where(Establecimiento.productor_id == usuario.id)
    ).scalar_one()
    assert est.sector_id == "S4"


def test_registro_productor_sin_establecimiento_devuelve_422(client):
    datos = datos_ciudadano()
    assert client.post(REGISTRO_P, json=datos).status_code == 422


# ---------------------------------------------------------------- login


def test_login_ok_entrega_access_y_cookie_httponly(client):
    datos = datos_ciudadano()
    client.post(REGISTRO_C, json=datos)
    r = iniciar_sesion(client, datos["email"], datos["password"], movil=False)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["token_type"] == "bearer" and cuerpo["expires_in"] == 15 * 60
    assert "refresh_token" not in cuerpo  # el refresh de la web solo viaja en la cookie
    cookie = r.headers["set-cookie"].lower()
    assert "refresh_token=" in cookie and "httponly" in cookie and "samesite=strict" in cookie
    claims = jwt.decode(cuerpo["access_token"], get_settings().jwt_secret, algorithms=["HS256"])
    assert claims["rol"] == "ciudadano" and claims["exp"] - claims["iat"] == 15 * 60


def test_login_movil_devuelve_refresh_en_el_cuerpo(client):
    datos = datos_ciudadano()
    client.post(REGISTRO_C, json=datos)
    r = iniciar_sesion(client, datos["email"], datos["password"], movil=True)
    assert r.status_code == 200 and r.json()["refresh_token"]


def test_login_con_usuario_inexistente_devuelve_401(client):
    r = iniciar_sesion(client, correo_unico("nadie"), PASSWORD_VALIDA)
    assert r.status_code == 401
    assert r.json()["error"]["codigo"] == "no_autenticado"


def test_contrasena_erronea_repetida_bloquea_con_429(client):
    datos = datos_ciudadano()
    client.post(REGISTRO_C, json=datos)
    maximo = get_settings().login_max_intentos
    estados = [
        iniciar_sesion(client, datos["email"], "contraseña-incorrecta").status_code
        for _ in range(maximo)
    ]
    assert estados == [401] * (maximo - 1) + [429]
    # Bloqueada: ni siquiera la contraseña correcta entra mientras dure el bloqueo.
    r = iniciar_sesion(client, datos["email"], datos["password"])
    assert r.status_code == 429
    assert r.json()["error"]["codigo"] == "demasiados_intentos"


def test_intentos_fallidos_se_reinician_con_un_login_correcto(client):
    datos = datos_ciudadano()
    client.post(REGISTRO_C, json=datos)
    for _ in range(get_settings().login_max_intentos - 1):
        assert iniciar_sesion(client, datos["email"], "incorrecta-xyz").status_code == 401
    assert iniciar_sesion(client, datos["email"], datos["password"]).status_code == 200
    assert iniciar_sesion(client, datos["email"], "incorrecta-xyz").status_code == 401


def test_rate_limit_de_registro_devuelve_429(client, monkeypatch):
    from app.core.limitador import limiter

    monkeypatch.setattr(get_settings(), "rate_limit_registro", "2/minute")
    limiter.reset()
    limiter.enabled = True
    try:
        estados = [client.post(REGISTRO_C, json=datos_ciudadano()).status_code for _ in range(3)]
    finally:
        limiter.enabled = False
        limiter.reset()
    assert estados == [201, 201, 429]


# ---------------------------------------------------------------- refresh


def _login_movil(client):
    datos = datos_ciudadano()
    client.post(REGISTRO_C, json=datos)
    return datos, iniciar_sesion(client, datos["email"], datos["password"], movil=True).json()


def test_refresh_rota_el_token_y_detecta_reutilizacion(client):
    _, sesion = _login_movil(client)
    refresh_1 = sesion["refresh_token"]
    cabeceras = {"X-Cliente": "movil"}

    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_1}, headers=cabeceras)
    assert r2.status_code == 200, r2.text
    refresh_2 = r2.json()["refresh_token"]
    assert refresh_2 != refresh_1
    assert (
        client.get("/api/v1/auth/yo", headers=bearer(r2.json()["access_token"])).status_code == 200
    )

    # Reutilizar el token ya rotado: 401 y toda la familia queda revocada.
    r_reuso = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_1}, headers=cabeceras
    )
    assert r_reuso.status_code == 401
    r_hijo = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_2}, headers=cabeceras
    )
    assert r_hijo.status_code == 401


def test_refresh_por_cookie_en_la_web(client):
    datos = datos_ciudadano()
    client.post(REGISTRO_C, json=datos)
    assert iniciar_sesion(client, datos["email"], datos["password"], movil=False).status_code == 200
    r = client.post("/api/v1/auth/refresh")  # sin cuerpo: usa la cookie
    assert r.status_code == 200, r.text
    assert "refresh_token" not in r.json()


def test_refresh_invalido_o_ausente_devuelve_401(client):
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": "x" * 40}).status_code == 401
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_revoca_el_refresh(client):
    _, sesion = _login_movil(client)
    refresh = sesion["refresh_token"]
    r = client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 401


# ---------------------------------------------------------------- /auth/yo


def test_yo_con_y_sin_token(client):
    datos, sesion = _login_movil(client)
    r = client.get("/api/v1/auth/yo", headers=bearer(sesion["access_token"]))
    assert r.status_code == 200 and r.json()["email"] == datos["email"]

    sin = client.get("/api/v1/auth/yo")
    assert sin.status_code == 401 and sin.json()["error"]["codigo"] == "no_autenticado"
    assert client.get("/api/v1/auth/yo", headers=bearer("token.invalido.xyz")).status_code == 401


def test_yo_rechaza_token_vencido_y_firmado_con_otra_clave(client):
    _, sesion = _login_movil(client)
    uid = sesion["usuario"]["id"]
    ahora = datetime.now(UTC)
    vencido = jwt.encode(
        {"sub": str(uid), "type": "access", "exp": ahora - timedelta(minutes=1)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    ajeno = jwt.encode(
        {"sub": str(uid), "type": "access", "exp": ahora + timedelta(minutes=5)},
        "otra-clave-distinta-" + "x" * 32,
        algorithm="HS256",
    )
    de_refresh = jwt.encode(
        {"sub": str(uid), "type": "refresh", "exp": ahora + timedelta(minutes=5)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    for token in (vencido, ajeno, de_refresh):
        assert client.get("/api/v1/auth/yo", headers=bearer(token)).status_code == 401


# ---------------------------------------------------------------- usuarios (admin)


def test_ciudadano_no_puede_usar_usuarios_admin(client):
    _, sesion = _login_movil(client)
    h = bearer(sesion["access_token"])
    r = client.get("/api/v1/usuarios", headers=h)
    assert r.status_code == 403
    assert r.json()["error"]["codigo"] == "prohibido"
    nuevo = {
        "email": correo_unico("op"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Operador X",
        "rol": "operador",
    }
    assert client.post("/api/v1/usuarios", json=nuevo, headers=h).status_code == 403
    assert client.get("/api/v1/usuarios").status_code == 401


def test_admin_crea_lista_y_modifica_usuarios_institucionales(client, token_admin):
    h = bearer(token_admin)
    nuevo = {
        "email": correo_unico("op"),
        "password": PASSWORD_VALIDA,
        "nombre_visible": "Operador de Prueba",
        "rol": "operador",
        "rol_operativo": "coordinador_sector",
    }
    r = client.post("/api/v1/usuarios", json=nuevo, headers=h)
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    assert r.json()["rol"] == "operador"

    assert any(u["id"] == uid for u in client.get("/api/v1/usuarios?limite=200", headers=h).json())
    assert iniciar_sesion(client, nuevo["email"], nuevo["password"]).status_code == 200

    r = client.patch(f"/api/v1/usuarios/{uid}", json={"estado": "inactivo"}, headers=h)
    assert r.status_code == 200 and r.json()["estado"] == "inactivo"
    assert iniciar_sesion(client, nuevo["email"], nuevo["password"]).status_code == 401


def test_admin_no_puede_crear_ciudadanos_ni_roles_desconocidos(client, token_admin):
    h = bearer(token_admin)
    base = {"email": correo_unico("x"), "password": PASSWORD_VALIDA, "nombre_visible": "Usuario X"}
    assert (
        client.post("/api/v1/usuarios", json={**base, "rol": "ciudadano"}, headers=h).status_code
        == 422
    )
    r = client.post(
        "/api/v1/usuarios",
        json={**base, "rol": "operador", "rol_operativo": "inexistente"},
        headers=h,
    )
    assert r.status_code == 422
    assert (
        client.patch("/api/v1/usuarios/99999999", json={"estado": "activo"}, headers=h).status_code
        == 404
    )


def test_admin_no_puede_desactivarse_a_si_mismo(client, token_admin):
    h = bearer(token_admin)
    yo = client.get("/api/v1/auth/yo", headers=h).json()
    r = client.patch(f"/api/v1/usuarios/{yo['id']}", json={"estado": "inactivo"}, headers=h)
    assert r.status_code == 409


def test_login_de_usuarios_demo_usa_la_contrasena_configurada(client):
    for correo in ("decisor", "operador", "cuadrilla", "ciudadano1", "productor1"):
        r = iniciar_sesion(
            client, f"{correo}@demo.evacuaciones.invalid", os.environ["DEMO_PASSWORD"]
        )
        assert r.status_code == 200, correo
