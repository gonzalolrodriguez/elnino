"""Cifrado AES-GCM de campos sensibles (salud, vulnerabilidad, teléfono).

Formato almacenado: base64(nonce de 12 bytes || texto cifrado con etiqueta de autenticación).
La clave (32 bytes, base64) viene de FIELD_ENCRYPTION_KEY. ``contexto`` se autentica como
datos asociados (AAD): un valor cifrado para un campo no se puede copiar a otro.
"""

from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config.settings import get_settings

_NONCE_BYTES = 12


class ErrorDescifrado(Exception):
    pass


def generar_clave() -> str:
    """Clave nueva en base64, para FIELD_ENCRYPTION_KEY."""
    return base64.b64encode(AESGCM.generate_key(bit_length=256)).decode("ascii")


def cifrar(texto: str, contexto: str = "") -> str:
    nonce = os.urandom(_NONCE_BYTES)
    cifrado = AESGCM(get_settings().clave_cifrado()).encrypt(
        nonce, texto.encode("utf-8"), contexto.encode("utf-8")
    )
    return base64.b64encode(nonce + cifrado).decode("ascii")


def descifrar(valor: str, contexto: str = "") -> str:
    try:
        crudo = base64.b64decode(valor, validate=True)
        nonce, cifrado = crudo[:_NONCE_BYTES], crudo[_NONCE_BYTES:]
        claro = AESGCM(get_settings().clave_cifrado()).decrypt(
            nonce, cifrado, contexto.encode("utf-8")
        )
    except (InvalidTag, ValueError) as exc:
        raise ErrorDescifrado("No se pudo descifrar el campo") from exc
    return claro.decode("utf-8")
