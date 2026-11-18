"""Correcciones de seguridad de la revisión de la Fase 1: sesiones, bloqueo por cuenta+IP y refresh."""

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config.settings import get_settings
from app.core.bloqueo import clave_ip
from app.db.modelos import AuditoriaAcceso, IntentoLogin, SesionRefresh
from app.main import app
from tests.conftest import (
    PASSWORD_VALIDA,
    bearer,
    datos_ciudadano,
    iniciar_sesion,
)

REGISTRO = "/api/v1/auth/registro/ciudadano"


class _ConIp:
    """Envoltorio ASGI de prueba: toma la IP del cliente de la cabecera X-Test-IP."""

    def __init__(self, aplicacion):
        self.aplicacion = aplicacion

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            for nombre, valor in scope["headers"]:
                if nombre == b"x-test-ip":
                    scope["client"] = (valor.decode(), 50000)
        await self.aplicacion(scope, receive, send)


def _cliente_desde(ip: str) -> TestClient:
    return TestClient(_ConIp(app), headers={"X-Test-IP": ip})


# ------------------------------------------------ 1) cambio de contraseña revoca sesiones


def test_cambiar_la_contrasena_revoca_todas_las_sesiones_activas(client, token_admin, db):
    datos = datos_ciudadano()
    uid = client.post(REGISTRO, json=datos).json()["id"]
    refrescos = [
        iniciar_sesion(client, datos["email"], datos["password"]).json()["refresh_token"]
        for _ in range(2)
    ]
    r = client.patch(
        f"/api/v1/usuarios/{uid}",
        json={"password": "OtraClaveSegura-2027"},
        headers=bearer(token_admin),
    )
    assert r.status_code == 200
    db.expire_all()
    activas = (
        db.execute(
            select(SesionRefresh).where(
                SesionRefresh.usuario_id == uid, SesionRefresh.revocado_en.is_(None)
            )
        )
        .scalars()
        .all()
    )
    assert activas == []
    for token in refrescos:
        rr = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": token}, headers={"X-Cliente": "movil"}
        )
        assert rr.status_code == 401
    # con la contraseña nueva se puede volver a entrar
    assert iniciar_sesion(client, datos["email"], "OtraClaveSegura-2027").status_code == 200
    assert iniciar_sesion(client, datos["email"], datos["password"]).status_code == 401


def test_desactivar_un_usuario_tambien_cierra_sus_sesiones(client, token_admin):
    datos = datos_ciudadano()
    uid = client.post(REGISTRO, json=datos).json()["id"]
    refresh = iniciar_sesion(client, datos["email"], datos["password"]).json()["refresh_token"]
    client.patch(
        f"/api/v1/usuarios/{uid}", json={"estado": "inactivo"}, headers=bearer(token_admin)
    )
    rr = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh}, headers={"X-Cliente": "movil"}
    )
    assert rr.status_code == 401


# ------------------------------------------------ 2) bloqueo por cuenta + IP


def test_un_atacante_no_bloquea_a_la_victima_desde_otra_ip(base_de_datos, db):
    maximo = get_settings().login_max_intentos
    atacante, victima = _cliente_desde("203.0.113.7"), _cliente_desde("198.51.100.20")
    datos = datos_ciudadano()
    assert victima.post(REGISTRO, json=datos).status_code == 201

    estados = [
        iniciar_sesion(atacante, datos["email"], "contraseña-incorrecta").status_code
        for _ in range(maximo)
    ]
    assert estados == [401] * (maximo - 1) + [429]
    # el atacante queda bloqueado aunque acierte la contraseña...
    assert iniciar_sesion(atacante, datos["email"], datos["password"]).status_code == 429
    # ...pero la titular entra desde su IP
    assert iniciar_sesion(victima, datos["email"], datos["password"]).status_code == 200

    usuario_id = (
        db.execute(select(IntentoLogin.usuario_id).where(IntentoLogin.ip == "203.0.113.7"))
        .scalars()
        .first()
    )
    assert usuario_id is not None
    # la IP de la víctima no tiene un contador acumulado
    assert (
        db.execute(
            select(IntentoLogin).where(
                IntentoLogin.usuario_id == usuario_id, IntentoLogin.ip == "198.51.100.20"
            )
        ).scalar_one_or_none()
        is None
    )


def test_mismo_ip_sigue_devolviendo_429_tras_los_intentos_fallidos(base_de_datos):
    c = _cliente_desde("192.0.2.33")
    datos = datos_ciudadano()
    c.post(REGISTRO, json=datos)
    maximo = get_settings().login_max_intentos
    estados = [iniciar_sesion(c, datos["email"], "x" * 12).status_code for _ in range(maximo)]
    assert estados[-1] == 429
    r = iniciar_sesion(c, datos["email"], datos["password"])
    assert r.status_code == 429 and r.json()["error"]["codigo"] == "demasiados_intentos"


def test_login_correcto_reinicia_el_contador_del_par(base_de_datos, db):
    c = _cliente_desde("192.0.2.44")
    datos = datos_ciudadano()
    c.post(REGISTRO, json=datos)
    for _ in range(get_settings().login_max_intentos - 1):
        assert iniciar_sesion(c, datos["email"], "x" * 12).status_code == 401
    assert iniciar_sesion(c, datos["email"], datos["password"]).status_code == 200
    db.expire_all()
    assert db.execute(select(IntentoLogin).where(IntentoLogin.ip == "192.0.2.44")).first() is None


# ------------------------------------------------ 2b) límite por cuenta (todas las redes)


def test_muchas_ip_fallando_activan_el_limite_por_cuenta_y_la_titular_sigue_entrando(
    base_de_datos, db, monkeypatch
):
    monkeypatch.setattr(get_settings(), "login_cuenta_max_fallos", 6)
    victima = _cliente_desde("198.51.100.20")
    datos = datos_ciudadano()
    assert victima.post(REGISTRO, json=datos).status_code == 201
    # login correcto previo: deja la red de la titular como conocida
    assert iniciar_sesion(victima, datos["email"], datos["password"]).status_code == 200

    # Cada IP falla una sola vez: ningún par llega a LOGIN_MAX_INTENTOS.
    for n in range(6):
        c = _cliente_desde(f"203.0.113.{n + 1}")
        assert iniciar_sesion(c, datos["email"], "contraseña-incorrecta").status_code == 401

    # Cuenta saturada: una red nueva recibe 429 aunque acierte (sin oráculo de contraseña)...
    nueva = _cliente_desde("203.0.113.99")
    r = iniciar_sesion(nueva, datos["email"], datos["password"])
    assert r.status_code == 429 and r.json()["error"]["codigo"] == "demasiados_intentos"
    assert iniciar_sesion(nueva, datos["email"], "otra-incorrecta").status_code == 429
    # ...y no deja contador por par.
    db.expire_all()
    assert (
        db.execute(select(IntentoLogin).where(IntentoLogin.ip == "203.0.113.99")).first() is None
    )
    # La titular, desde la red con login previo, entra con la contraseña correcta.
    assert iniciar_sesion(victima, datos["email"], datos["password"]).status_code == 200
    # Con contraseña incorrecta desde su red conocida es un 401 normal.
    assert iniciar_sesion(victima, datos["email"], "contraseña-incorrecta").status_code == 401


def test_el_limite_por_cuenta_cede_al_salir_los_fallos_de_la_ventana(
    base_de_datos, db, monkeypatch
):
    from datetime import timedelta

    monkeypatch.setattr(get_settings(), "login_cuenta_max_fallos", 3)
    datos = datos_ciudadano()
    _cliente_desde("198.51.100.30").post(REGISTRO, json=datos)
    for n in range(3):
        iniciar_sesion(_cliente_desde(f"203.0.113.{100 + n}"), datos["email"], "x" * 12)
    nueva = _cliente_desde("203.0.113.150")
    assert iniciar_sesion(nueva, datos["email"], datos["password"]).status_code == 429

    # Los fallos envejecen fuera de la ventana: se simula moviendo su fecha hacia atrás
    # (la cadena de hashes de esas filas queda inconsistente; esta prueba no la verifica).
    minutos = get_settings().login_cuenta_ventana_minutos + 1
    db.execute(
        AuditoriaAcceso.__table__.update()
        .where(AuditoriaAcceso.accion == "login_fallido", AuditoriaAcceso.ip.like("203.0.113.10_"))
        .values(fecha=AuditoriaAcceso.fecha - timedelta(minutes=minutos))
    )
    db.commit()
    assert iniciar_sesion(nueva, datos["email"], datos["password"]).status_code == 200


def test_clave_ip_agrupa_ipv6_por_64_y_deja_ipv4_igual():
    assert clave_ip("203.0.113.7") == "203.0.113.7"
    assert clave_ip("2001:db8:1:2::1") == clave_ip("2001:db8:1:2:ffff:abcd:0:9")
    assert clave_ip("2001:db8:1:2::1") == "2001:db8:1:2::/64"
    assert clave_ip("2001:db8:1:3::1") != clave_ip("2001:db8:1:2::1")
    assert clave_ip("::ffff:203.0.113.7") == "203.0.113.7"
    assert clave_ip(None) == "desconocida"
    assert clave_ip("testclient") == "testclient"


def test_ipv6_del_mismo_64_comparten_el_contador_del_par(base_de_datos):
    datos = datos_ciudadano()
    _cliente_desde("198.51.100.40").post(REGISTRO, json=datos)
    a = _cliente_desde("2001:db8:aa:bb::1")
    b = _cliente_desde("2001:db8:aa:bb:dead:beef:0:2")
    maximo = get_settings().login_max_intentos
    estados = [
        iniciar_sesion(a if n % 2 == 0 else b, datos["email"], "x" * 12).status_code
        for n in range(maximo)
    ]
    assert estados == [401] * (maximo - 1) + [429]
    # Otro /64 no queda bloqueado.
    otro = _cliente_desde("2001:db8:aa:cc::1")
    assert iniciar_sesion(otro, datos["email"], datos["password"]).status_code == 200


# ------------------------------------------------ 3) rotación atómica del refresh


def test_dos_refresh_simultaneos_con_el_mismo_token_emiten_una_sola_sesion(client, db):
    datos = datos_ciudadano()
    client.post(REGISTRO, json=datos)
    token = iniciar_sesion(client, datos["email"], datos["password"]).json()["refresh_token"]
    uid = client.get(
        "/api/v1/auth/yo",
        headers=bearer(
            iniciar_sesion(client, datos["email"], datos["password"]).json()["access_token"]
        ),
    ).json()["id"]

    def refrescar(_):
        return client.post(
            "/api/v1/auth/refresh", json={"refresh_token": token}, headers={"X-Cliente": "movil"}
        ).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        estados = list(pool.map(refrescar, range(6)))
    assert estados.count(200) <= 1 and set(estados) <= {200, 401}
    assert estados.count(401) >= 5
    # nunca más de una sesión nueva derivada del token original
    db.expire_all()
    original = (
        db.execute(
            select(SesionRefresh).where(SesionRefresh.usuario_id == uid).order_by(SesionRefresh.id)
        )
        .scalars()
        .first()
    )
    derivadas = (
        db.execute(select(SesionRefresh).where(SesionRefresh.id == original.reemplazado_por))
        .scalars()
        .all()
    )
    assert len(derivadas) <= 1


def test_consumir_es_atomico_a_nivel_de_funcion(client, db):
    from app.core import sesiones
    from app.db.sesion import get_sessionmaker

    datos = datos_ciudadano()
    client.post(REGISTRO, json=datos)
    token = iniciar_sesion(client, datos["email"], datos["password"]).json()["refresh_token"]
    fila = sesiones.buscar_por_token(db, token)
    with get_sessionmaker()() as otra:
        assert sesiones.consumir(otra, fila.id) is True
        otra.commit()
    with get_sessionmaker()() as tercera:
        assert sesiones.consumir(tercera, fila.id) is False
    assert PASSWORD_VALIDA  # la contraseña de prueba sigue siendo la importada
