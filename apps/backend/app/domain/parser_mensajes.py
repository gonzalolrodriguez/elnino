"""Parser de mensajes de los canales (CLAUDE.md §8.8 y §8.10). Lógica pura.

Formatos:
- ``LLUVIA <CODIGO_PUESTO> <MM>``  (p. ej. ``LLUVIA PLUV-SIM-A 12,5``)
- ``SOS-FSA|lat,lon|PERFIL|FAM:n|BOV:n(detalle)|ACC:texto|texto libre``

Un mensaje mal formado lanza ``ErrorParseo`` (la API responde 422). No se completan datos faltantes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.config.settings import supuesto


class ErrorParseo(ValueError):
    pass


_CODIGO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]{1,39}$")
_MM = re.compile(r"^\d{1,4}(?:[.,]\d{1,2})?$")
_PERFILES = {
    "CIUDADANO": "ciudadano",
    "CIU": "ciudadano",
    "PRODUCTOR": "productor",
    "PRO": "productor",
}
_BOV = re.compile(r"^BOV:(\d{1,5})(?:\(([^()]{0,80})\))?$", re.IGNORECASE)
_FAM = re.compile(r"^FAM:(\d{1,3})$", re.IGNORECASE)
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
MAX_TEXTO = 500


@dataclass(frozen=True)
class MensajeLluvia:
    codigo_puesto: str
    mm: float


@dataclass(frozen=True)
class MensajeSOS:
    lat: float
    lon: float
    perfil: str
    familiares: int
    bovinos: int
    detalle_bovinos: str | None
    acceso: str | None
    texto: str | None


def parsear_lluvia(mensaje: str) -> MensajeLluvia:
    partes = mensaje.strip().split()
    if len(partes) != 3 or partes[0].upper() != "LLUVIA":
        raise ErrorParseo("Formato esperado: LLUVIA <CODIGO_PUESTO> <MM>")
    codigo, valor = partes[1], partes[2]
    if not _CODIGO.match(codigo):
        raise ErrorParseo("Código de puesto inválido")
    if not _MM.match(valor):
        raise ErrorParseo("Los milímetros deben ser un número no negativo (p. ej. 12 o 12,5)")
    mm = float(valor.replace(",", "."))
    maximo = float(supuesto("lluvia_max_mm_turno"))
    if mm > maximo:
        raise ErrorParseo(f"Los milímetros superan el máximo admitido ({maximo:g} mm por turno)")
    return MensajeLluvia(codigo.upper(), mm)


def parsear_sos(mensaje: str) -> MensajeSOS:
    partes = [p.strip() for p in mensaje.strip().split("|")]
    if len(partes) < 3 or partes[0].upper() != "SOS-FSA":
        raise ErrorParseo("Formato esperado: SOS-FSA|lat,lon|PERFIL|FAM:n|BOV:n(...)|ACC:...|texto")
    try:
        lat_txt, lon_txt = partes[1].split(",")
        lat, lon = float(lat_txt), float(lon_txt)
    except ValueError as exc:
        raise ErrorParseo("Coordenadas inválidas: se espera lat,lon") from exc
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ErrorParseo("Coordenadas fuera de rango")
    perfil = _PERFILES.get(partes[2].upper())
    if perfil is None:
        raise ErrorParseo("PERFIL debe ser CIUDADANO o PRODUCTOR")

    familiares = bovinos = 0
    detalle: str | None = None
    acceso: str | None = None
    libres: list[str] = []
    for token in partes[3:]:
        if not token:
            continue
        if (m := _FAM.match(token)) is not None:
            familiares = int(m.group(1))
        elif token.upper().startswith("BOV:"):
            m = _BOV.match(token)
            if m is None:
                raise ErrorParseo("BOV inválido: se espera BOV:n o BOV:n(detalle)")
            bovinos, detalle = int(m.group(1)), (m.group(2) or None)
        elif token.upper().startswith("FAM:"):
            raise ErrorParseo("FAM inválido: se espera FAM:n")
        elif token.upper().startswith("ACC:"):
            acceso = token[4:].strip()[:60] or None
        else:
            libres.append(token)
    texto = _CONTROL.sub(" ", " ".join(libres)).strip()[:MAX_TEXTO] or None
    if familiares == 0 and bovinos == 0 and texto is None:
        raise ErrorParseo("El mensaje no informa personas (FAM), animales (BOV) ni texto")
    return MensajeSOS(lat, lon, perfil, familiares, bovinos, detalle, acceso, texto)


def clasificar(mensaje: str) -> str:
    """``lluvia`` o ``sos`` según el prefijo; ``ErrorParseo`` si no se reconoce."""
    inicio = mensaje.strip().upper()
    if inicio.startswith("LLUVIA"):
        return "lluvia"
    if inicio.startswith("SOS-FSA"):
        return "sos"
    raise ErrorParseo("Mensaje no reconocido: usar LLUVIA <CODIGO> <MM> o SOS-FSA|...")
