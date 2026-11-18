"""Hash de contraseñas (Argon2id), JWT de acceso y tokens de refresh."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config.settings import get_settings

_hasher = PasswordHasher()  # Argon2id con parámetros por defecto de argon2-cffi
ALGORITMO_JWT = "HS256"

# Hash de relleno para igualar tiempos cuando el correo no existe.
_HASH_FALSO = _hasher.hash("relleno-para-igualar-tiempos")


def hashear_password(password: str) -> str:
    return _hasher.hash(password)


def verificar_password(password: str, hash_guardado: str | None) -> bool:
    try:
        return _hasher.verify(hash_guardado or _HASH_FALSO, password) and hash_guardado is not None
    except (VerificationError, InvalidHashError):
        return False


def crear_token_acceso(usuario_id: int, rol: str) -> tuple[str, int]:
    """Devuelve (JWT, segundos de vigencia)."""
    s = get_settings()
    ahora = datetime.now(UTC)
    vigencia = timedelta(minutes=s.access_token_minutos)
    claims = {
        "sub": str(usuario_id),
        "rol": rol,
        "type": "access",
        "jti": uuid.uuid4().hex,
        "iat": ahora,
        "exp": ahora + vigencia,
    }
    return jwt.encode(claims, s.secreto_jwt(), algorithm=ALGORITMO_JWT), int(
        vigencia.total_seconds()
    )


def decodificar_token_acceso(token: str) -> dict:
    """Valida firma, expiración y tipo. Lanza ``jwt.PyJWTError`` si no es válido."""
    claims = jwt.decode(
        token,
        get_settings().secreto_jwt(),
        algorithms=[ALGORITMO_JWT],
        options={"require": ["exp", "sub", "type"]},
    )
    if claims.get("type") != "access":
        raise jwt.InvalidTokenError("tipo de token incorrecto")
    return claims


def generar_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
