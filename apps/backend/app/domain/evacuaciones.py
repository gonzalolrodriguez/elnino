"""Estado de una evacuación y códigos de confirmación (CLAUDE.md §8.7). Lógica pura, sin I/O.

Una evacuación es una tarea de cuadrilla. Su estado se **deriva** de la tarea, de la constancia de
cierre y de la confirmación del evacuado; nunca se guarda:

- ``pendiente`` / ``en_curso``: la tarea todavía no se cerró.
- ``cerrada_cuadrilla``: la cuadrilla cerró con constancia y nadie contradijo nada (sin confirmar).
- ``verificada``: el evacuado confirmó (``completa``) y el destino está cerca del centro elegido.
- ``con_discrepancia``: el evacuado respondió otra cosa (``parcial``, ``no_encontraron``,
  ``no_vinieron`` u ``otro_problema``; antes ``no`` o ``problema``), o el destino quedó a más
  de ``distancia_max_destino_m`` del centro elegido. Es una marca para revisar, no una acusación.
"""

from __future__ import annotations

import re
import secrets
import unicodedata
from dataclasses import dataclass

ESTADOS = ("pendiente", "en_curso", "cerrada_cuadrilla", "verificada", "con_discrepancia")
RESPUESTAS = ("completa", "parcial", "no_encontraron", "no_vinieron", "otro_problema")
# Valores anteriores (SMS y datos viejos): se normalizan al valor canónico.
RESPUESTAS_LEGADO = {"si": "completa", "no": "no_vinieron", "problema": "otro_problema"}

MOTIVO_NO = "evacuado_dice_no"
MOTIVO_PROBLEMA = "evacuado_reporta_problema"
MOTIVO_PARCIAL = "evacuado_parcial"
MOTIVO_NO_ENCONTRARON = "evacuado_no_encontraron"
MOTIVO_LEJOS = "destino_lejos_del_centro"
_MOTIVO_POR_RESPUESTA = {
    "no_vinieron": MOTIVO_NO,
    "otro_problema": MOTIVO_PROBLEMA,
    "parcial": MOTIVO_PARCIAL,
    "no_encontraron": MOTIVO_NO_ENCONTRARON,
}


def normalizar_respuesta(respuesta: str | None) -> str | None:
    """Valor canónico de una respuesta (acepta los valores anteriores ``si|no|problema``)."""
    if respuesta is None:
        return None
    return RESPUESTAS_LEGADO.get(respuesta, respuesta)

# Sin vocales ni 0/1/O/I/L: el código no forma palabras y se dicta sin confusión.
_LETRAS = "BCDFGHJKMNPQRSTVWXYZ"
_DIGITOS = "23456789"
LARGO_CODIGO = 8


def generar_codigo() -> str:
    """Código corto para responder por SMS: 8 caracteres con al menos una letra y un dígito.

    El dígito obligatorio permite distinguirlo de una palabra cualquiera del texto libre
    (``NO QUEDAN víveres`` no es una confirmación).
    """
    while True:
        codigo = "".join(secrets.choice(_LETRAS + _DIGITOS) for _ in range(LARGO_CODIGO))
        if any(c in _DIGITOS for c in codigo) and any(c in _LETRAS for c in codigo):
            return codigo


def motivos_discrepancia(
    respuesta: str | None, distancia_m: float | None, distancia_max_m: float
) -> list[str]:
    motivos: list[str] = []
    motivo = _MOTIVO_POR_RESPUESTA.get(normalizar_respuesta(respuesta) or "")
    if motivo:
        motivos.append(motivo)
    if distancia_m is not None and distancia_m > distancia_max_m:
        motivos.append(MOTIVO_LEJOS)
    return motivos


def estado_evacuacion(
    tarea_estado: str,
    respuesta: str | None,
    distancia_m: float | None,
    distancia_max_m: float,
) -> tuple[str | None, list[str]]:
    """Devuelve ``(estado, motivos)``; el estado es ``None`` para una tarea cancelada."""
    if tarea_estado == "cancelada":
        return None, []
    if tarea_estado == "pendiente":
        return "pendiente", []
    if tarea_estado == "en_curso":
        return "en_curso", []
    motivos = motivos_discrepancia(respuesta, distancia_m, distancia_max_m)
    if motivos:
        return "con_discrepancia", motivos
    if normalizar_respuesta(respuesta) == "completa":
        return "verificada", []
    return "cerrada_cuadrilla", []


# ---- respuesta por SMS --------------------------------------------


@dataclass(frozen=True)
class RespuestaSMS:
    respuesta: str
    codigo: str
    comentario: str | None


_SMS = re.compile(
    rf"^\s*(si|no|problema|parcial)\s+((?=[a-z]*\d)[a-z0-9]{{{LARGO_CODIGO}}})(?:\s+(.*))?$",
    re.DOTALL,
)


def _plano(texto: str) -> str:
    """Minúsculas y sin tildes, conservando el largo (para ubicar el comentario en el original)."""
    return "".join(unicodedata.normalize("NFD", c)[0] for c in texto).lower()


def parsear_respuesta_sms(texto: str) -> RespuestaSMS | None:
    """``SI <codigo>``, ``NO <codigo>`` o ``PROBLEMA <codigo> <texto>``; ``None`` si no lo es."""
    m = _SMS.match(_plano(texto))
    if m is None:
        return None
    comentario = texto[m.start(3) : m.end(3)].strip() if m.group(3) else ""
    return RespuestaSMS(
        normalizar_respuesta(m.group(1)) or m.group(1), m.group(2).upper(), comentario[:500] or None
    )


# ---- teléfonos --------------------------------------------


def normalizar_telefono(texto: str | None) -> str:
    """Solo los dígitos (``+54 9 370 412-3456`` -> ``5493704123456``)."""
    return "".join(c for c in (texto or "") if c.isdigit())


def clave_telefono(texto: str | None) -> str | None:
    """Forma canónica del teléfono: sus últimos 10 dígitos (tolera prefijo de país, 9 y 0/15).

    Es la **única** forma que se usa para comparar y para armar claves de límite. Un número de
    menos de 8 dígitos no identifica a nadie: ``None``.
    """
    digitos = normalizar_telefono(texto)
    return digitos[-10:] if len(digitos) >= 8 else None


def telefonos_coinciden(a: str | None, b: str | None) -> bool:
    ca, cb = clave_telefono(a), clave_telefono(b)
    return ca is not None and ca == cb
