"""Cifrado AES-GCM, auditoría con hash encadenado, control por recurso y cabeceras."""

import base64

import pytest
from fastapi import HTTPException
from sqlalchemy import select, text

from app.config.settings import get_settings
from app.core import auditoria, cifrado, datos_personales
from app.core.rbac import exigir_propietario_o_rol
from app.core.seguridad import hashear_password, verificar_password
from app.db.modelos import AuditoriaAcceso, GrupoFamiliar, Usuario
from tests.conftest import PASSWORD_VALIDA, datos_ciudadano

# ---------------------------------------------------------------- cifrado


def test_cifrado_ida_y_vuelta():
    original = "Requiere medicación diaria (dato de prueba)"
    cifrado_ = cifrado.cifrar(original, "grupos_familiares.salud")
    assert original not in cifrado_
    assert cifrado.descifrar(cifrado_, "grupos_familiares.salud") == original


def test_cifrado_usa_nonce_distinto_cada_vez():
    assert cifrado.cifrar("igual", "c") != cifrado.cifrar("igual", "c")


def test_descifrado_falla_con_contexto_distinto_o_dato_alterado():
    valor = cifrado.cifrar("secreto", "grupos_familiares.telefono")
    with pytest.raises(cifrado.ErrorDescifrado):
        cifrado.descifrar(valor, "grupos_familiares.salud")
    crudo = bytearray(base64.b64decode(valor))
    crudo[-1] ^= 0x01
    with pytest.raises(cifrado.ErrorDescifrado):
        cifrado.descifrar(base64.b64encode(bytes(crudo)).decode(), "grupos_familiares.telefono")


def test_descifrado_falla_con_otra_clave(monkeypatch):
    valor = cifrado.cifrar("secreto", "c")
    otra = base64.b64encode(b"z" * 32).decode()
    monkeypatch.setattr(get_settings(), "field_encryption_key", otra)
    with pytest.raises(cifrado.ErrorDescifrado):
        cifrado.descifrar(valor, "c")


def test_clave_de_cifrado_invalida_se_rechaza(monkeypatch):
    monkeypatch.setattr(get_settings(), "field_encryption_key", "CAMBIAR_clave")
    with pytest.raises(RuntimeError):
        cifrado.cifrar("x")


def test_password_argon2id_ida_y_vuelta():
    h = hashear_password(PASSWORD_VALIDA)
    assert h.startswith("$argon2id$")
    assert verificar_password(PASSWORD_VALIDA, h)
    assert not verificar_password("otra-clave-distinta", h)
    assert not verificar_password(PASSWORD_VALIDA, None)


# ---------------------------------------------------------------- auditoría


def test_cadena_de_auditoria_verifica_y_detecta_alteraciones(db):
    for i in range(3):
        auditoria.registrar(
            db, "prueba", f"recurso/{i}", usuario_id=None, ip="127.0.0.1", detalle="d"
        )
    db.commit()
    assert auditoria.verificar_cadena(db) == (True, None)

    filas = list(db.scalars(select(AuditoriaAcceso).order_by(AuditoriaAcceso.id)))
    assert filas[0].hash_anterior == auditoria.HASH_GENESIS
    assert all(filas[i + 1].hash_anterior == filas[i].hash for i in range(len(filas) - 1))

    # Alteración de una fila (sin confirmar): la cadena se rompe en esa fila.
    objetivo = filas[-2]
    db.execute(
        text("UPDATE auditoria_accesos SET detalle = 'alterado' WHERE id = :id"),
        {"id": objetivo.id},
    )
    db.expire_all()
    assert auditoria.verificar_cadena(db) == (False, objetivo.id)
    db.rollback()

    # Borrado de una fila intermedia (sin confirmar): también se detecta.
    db.execute(text("DELETE FROM auditoria_accesos WHERE id = :id"), {"id": objetivo.id})
    db.expire_all()
    ok, roto = auditoria.verificar_cadena(db)
    assert ok is False and roto == filas[-1].id
    db.rollback()

    assert auditoria.verificar_cadena(db) == (True, None)


def test_los_eventos_de_auth_quedan_auditados(client, db):
    datos = datos_ciudadano()
    client.post("/api/v1/auth/registro/ciudadano", json=datos)
    client.post("/api/v1/auth/login", json={"email": datos["email"], "password": "incorrecta-xyz"})
    client.post("/api/v1/auth/login", json={"email": datos["email"], "password": datos["password"]})
    uid = db.execute(select(Usuario.id).where(Usuario.email == datos["email"])).scalar_one()
    acciones = list(
        db.scalars(select(AuditoriaAcceso.accion).where(AuditoriaAcceso.usuario_id == uid))
    )
    assert {"registro", "login_fallido", "login_ok"} <= set(acciones)
    assert auditoria.verificar_cadena(db) == (True, None)


# ---------------------------------------------------------------- control por recurso


def _usuario(db, email: str) -> Usuario:
    return db.execute(select(Usuario).where(Usuario.email == email)).scalar_one()


def test_lectura_de_datos_sensibles_exige_titular_o_rol_y_audita(db):
    titular = _usuario(db, "ciudadano1@demo.evacuaciones.invalid")
    ajeno = _usuario(db, "ciudadano2@demo.evacuaciones.invalid")
    operador = _usuario(db, "operador@demo.evacuaciones.invalid")
    grupo = db.execute(
        select(GrupoFamiliar).where(GrupoFamiliar.usuario_id == titular.id)
    ).scalar_one()

    sensibles = datos_personales.leer_sensibles(db, grupo, titular, ip="127.0.0.1")
    assert sensibles["telefono"] == "000-0000001"
    assert sensibles["salud"].startswith("SIMULADO")

    assert datos_personales.leer_sensibles(db, grupo, operador)["telefono"] == "000-0000001"
    with pytest.raises(HTTPException) as exc:
        datos_personales.leer_sensibles(db, grupo, ajeno)
    assert exc.value.status_code == 403

    leidas = db.scalars(
        select(AuditoriaAcceso).where(
            AuditoriaAcceso.accion == "lectura_datos_personales",
            AuditoriaAcceso.recurso == f"grupos_familiares/{grupo.id}",
        )
    ).all()
    assert {f.usuario_id for f in leidas} >= {titular.id, operador.id}
    assert ajeno.id not in {f.usuario_id for f in leidas}
    db.commit()


def test_guardar_sensibles_rechaza_campos_desconocidos():
    with pytest.raises(ValueError):
        datos_personales.guardar_sensibles(GrupoFamiliar(), documento="123")


def test_exigir_propietario_o_rol(db):
    ciu = _usuario(db, "ciudadano1@demo.evacuaciones.invalid")
    admin = _usuario(db, "admin@demo.evacuaciones.invalid")
    exigir_propietario_o_rol(ciu, ciu.id)
    exigir_propietario_o_rol(admin, ciu.id)
    with pytest.raises(HTTPException):
        exigir_propietario_o_rol(ciu, admin.id)


# ---------------------------------------------------------------- cabeceras y rutas públicas


def test_cabeceras_de_seguridad_y_rutas_publicas(client):
    r = client.get("/api/v1/salud")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert client.get("/api/v1/meta").status_code == 200
    login = client.post("/api/v1/auth/login", json={"email": "a@b.cc", "password": "x"})
    assert login.headers["cache-control"] == "no-store"
