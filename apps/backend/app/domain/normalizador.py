"""Normalizador de texto libre de los canales sin datos (SMS, WhatsApp, IVR). Lógica pura.

Cuando un mensaje no sigue el formato estricto (``SOS-FSA|...``, ``LLUVIA ...``), se extraen con
reglas (expresiones regulares y números en palabras) las personas, los animales (y su especie), el
estado del acceso y una referencia de ubicación (paraje, camino, ruta). **No se inventa nada**: lo
que el mensaje no dice queda en ``faltantes`` y la solicitud se crea "a verificar por el operador".

También resuelve el menú de palabras clave por SMS (``AYUDA``, ``INFO``, ``SOS``).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from app.domain import ganaderia

FUENTE_EMERGENCIAS = "https://www.argentina.gob.ar/tema/emergencias"
FECHA_CONSULTA_EMERGENCIAS = "19/11/2026"
NUMEROS = (
    ("103", "Defensa Civil"),
    ("106", "Prefectura Naval"),
    ("911", "Policía y emergencias"),
    ("105", "Emergencias ambientales"),
)
_LISTA_NUMEROS = ", ".join(f"{n} {nombre}" for n, nombre in NUMEROS)
_PIE = (
    f"Números de emergencia (DOCUMENTO DE REFERENCIA, {FUENTE_EMERGENCIAS}, consultado el "
    f"{FECHA_CONSULTA_EMERGENCIAS}): {_LISTA_NUMEROS}. Prototipo: no es una herramienta oficial."
)
_COMO_ENVIAR = (
    "Para pedir ayuda mandá: SOS-FSA|lat,lon|CIUDADANO|FAM:personas|BOV:animales|texto. "
    "Ejemplo: SOS-FSA|-26.18,-58.14|CIUDADANO|FAM:4|BOV:20|camino cortado. "
    "Sin coordenadas, escribí cuántas personas y animales son y en qué paraje o camino estás."
)
RESPUESTAS_MENU = {
    "AYUDA": (
        "AYUDA. Si hay peligro inmediato, llamá al 103. Qué hacer: ir a un lugar alto y seco, "
        "llevar documentos, agua y medicación, no cruzar caminos anegados y avisar a vecinos. "
        f"{_COMO_ENVIAR} Escribí INFO para más datos. {_PIE}"
    ),
    "INFO": (
        "INFO. Este servicio es un prototipo de práctica (AI LAB Misión: Código Formosa): no es "
        "una herramienta oficial y no reemplaza a Defensa Civil. Las decisiones de evacuar las "
        f"toman las autoridades. Escribí AYUDA o SOS para saber cómo pedir ayuda. {_PIE}"
    ),
    "SOS": f"SOS. {_COMO_ENVIAR} Si hay peligro inmediato, llamá al 103. {_PIE}",
}
RESPUESTA_NO_ENTENDIDO = (
    "No pudimos entender el mensaje y no se registró ningún pedido. "
    f"{_COMO_ENVIAR} Escribí AYUDA para ver las opciones. {_PIE}"
)


def _plano(texto: str) -> str:
    """Minúsculas y sin tildes, **conservando el largo** (para mapear posiciones al original)."""
    return "".join(unicodedata.normalize("NFD", c)[0] for c in texto).lower()


def palabra_clave(texto: str) -> str | None:
    """``AYUDA``/``INFO``/``SOS`` si el mensaje entero es esa palabra; ``None`` si no."""
    limpio = re.sub(r"[^a-z]", "", _plano(texto))
    if limpio in ("ayuda", "info", "informacion", "sos", "ayudame"):
        return {"informacion": "INFO", "ayudame": "AYUDA"}.get(limpio, limpio.upper())
    return None


# ---- números en palabras ---------------------------------------------------------------------

_UNIDADES = {
    "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6,
    "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12, "trece": 13,
    "catorce": 14, "quince": 15, "dieciseis": 16, "diecisiete": 17, "dieciocho": 18,
    "diecinueve": 19, "veinte": 20, "veintiun": 21, "veintiuno": 21, "veintiuna": 21,
    "veintidos": 22, "veintitres": 23, "veinticuatro": 24, "veinticinco": 25, "veintiseis": 26,
    "veintisiete": 27, "veintiocho": 28, "veintinueve": 29,
}  # fmt: skip
_DECENAS = {
    "treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80,
    "noventa": 90,
}  # fmt: skip
_CENTENAS = {
    "cien": 100, "ciento": 100, "doscientos": 200, "doscientas": 200, "trescientos": 300,
    "trescientas": 300, "cuatrocientos": 400, "cuatrocientas": 400, "quinientos": 500,
    "quinientas": 500,
}  # fmt: skip
_PALABRA_NUM = "|".join(sorted([*_UNIDADES, *_DECENAS, *_CENTENAS], key=len, reverse=True))
# número en cifras o en palabras (con "y" entre decenas y unidades: "treinta y cinco")
_NUM = (
    rf"(?:\d{{1,5}}|(?:(?:{_PALABRA_NUM})(?:\s+y\s+(?:{_PALABRA_NUM}))?(?:\s+(?:{_PALABRA_NUM}))?))"
)


def _clase(v: int) -> int:
    return 3 if v >= 100 else 2 if v >= 20 else 1


def _a_entero(token: str) -> int | None:
    """Cifras o palabras ("treinta y cinco" -> 35). ``None`` si la secuencia no es un número."""
    token = token.strip()
    if token.isdigit():
        return int(token)
    total, ultima = 0, 4
    for p in token.split():
        if p == "y":
            continue
        v = _UNIDADES.get(p) or _DECENAS.get(p) or _CENTENAS.get(p)
        if v is None or _clase(v) >= ultima:  # "cinco y seis" no es un número compuesto
            return None
        total += v
        ultima = _clase(v)
    return total or None


_PERSONAS = (
    r"personas?|adultos?|ninos?|ninas?|menores|chicos?|chicas?|bebes?|abuelos?|abuelas?|"
    r"ancianos?|ancianas?|familiares|integrantes|miembros|vecinos?|habitantes|hijos?|hijas?"
)
_ANIMALES = {
    r"vacas?|vacunos?|bovinos?|terneros?|terneras?|toros?|novillos?|vaquillonas?": "bovino",
    r"ovejas?|ovinos?|corderos?|carneros?": "ovino",
    r"cabras?|caprinos?|chivos?|cabritos?": "caprino",
    r"chanchos?|cerdos?|cerdas?|porcinos?|lechones?": "porcino",
    r"caballos?|yeguas?|equinos?|potrillos?": "equino",
    r"colmenas?|abejas?": "apicultura",
}
_GENERICOS = r"animales|cabezas|bichos|hacienda|ganado"
_ACCESO = re.compile(
    r"(?:camino|ruta|acceso|calle|puente|picada|huella)\s+(?:\w+\s+){0,2}"
    r"(?:cortad[oa]s?|anegad[oa]s?|inundad[oa]s?|intransitable|cerrad[oa]s?|tapad[oa]s?|"
    r"bajo\s+(?:el\s+)?agua|con\s+agua)|no\s+se\s+puede\s+(?:salir|pasar|entrar)|"
    r"(?:estamos|quedamos|estoy)\s+(?:aislad[oa]s?|incomunicad[oa]s?|rodead[oa]s?\s+de\s+agua)"
)
_REFERENCIA = re.compile(
    r"\b(?:paraje|barrio|colonia|comunidad|localidad|ruta(?:\s+(?:nacional|provincial))?|"
    r"camino(?:\s+(?:a|de|al|vecinal))?|km|kilometro|cerca\s+de|estoy\s+en|estamos\s+en|"
    r"vivo\s+en|vivimos\s+en|sobre\s+(?:la\s+)?ruta|entrando\s+por)\s+"
    r"(?!(?:esta|estan|es|se|no|ya|tiene|quedo|cortad\w*|anegad\w*|inundad\w*|cerrad\w*|"
    r"tapad\w*|intransitable|bajo|con)\b)"
    r"([a-z0-9][^,.;\n]{1,60})"
)
_CORTE_REF = re.compile(r"\s+(?:y|pero|que|con|donde|hay|somos|tenemos|necesit\w+|el|esta)\s+.*$")


@dataclass
class MensajeLibre:
    personas: int | None = None
    animales: int | None = None
    especie: str | None = None
    acceso: str | None = None
    referencia_ubicacion: str | None = None
    texto: str = ""
    faltantes: list[str] = field(default_factory=list)

    @property
    def util(self) -> bool:
        """Hay algo concreto que registrar (si no, no se crea un pedido vacío)."""
        return bool(self.personas or self.animales or self.acceso)


def normalizar(texto: str) -> MensajeLibre:
    """Extrae personas, animales, acceso y referencia de ubicación de un texto libre."""
    original = re.sub(r"[\x00-\x1f\x7f]", " ", texto).strip()[:500]
    p = _plano(original)
    r = MensajeLibre(texto=original)

    # "somos cinco" / "familia de 4" mandan; si no, se suman los grupos ("2 adultos y 3 niños").
    total = re.search(
        rf"\b(?:somos|familia\s+de)\s+({_NUM})\b(?!\s+(?:{_ANIMALES_RE()}|{_GENERICOS}))", p
    )
    if total and (n := _a_entero(total.group(1))) is not None:
        r.personas = n
    else:
        suma = 0
        for m in re.finditer(rf"\b({_NUM})\s+(?:{_PERSONAS})\b", p):
            n = _a_entero(m.group(1))
            if n is not None:
                suma += n
        r.personas = suma or None

    # Animales: se suman por especie; la especie es la más numerosa.
    por_especie: dict[str, int] = {}
    for patron, especie in _ANIMALES.items():
        for m in re.finditer(rf"\b({_NUM})\s+(?:{patron})\b", p):
            n = _a_entero(m.group(1))
            if n is not None:
                por_especie[especie] = por_especie.get(especie, 0) + n
    genericos = 0
    for m in re.finditer(rf"\b({_NUM})\s+(?:{_GENERICOS})\b", p):
        n = _a_entero(m.group(1))
        if n is not None:
            genericos += n
    if por_especie:
        r.animales = sum(por_especie.values()) + genericos
        r.especie = max(por_especie, key=por_especie.get)
        if ganaderia.especie_canonica(r.especie) is None:  # defensa: vocabulario cerrado
            r.especie = None
    elif genericos:
        r.animales = genericos  # hay animales pero el mensaje no dice de qué especie

    if (m := _ACCESO.search(p)) is not None:
        r.acceso = original[m.start() : m.end()].strip()[:60]

    if (m := _REFERENCIA.search(p)) is not None:
        cola = _CORTE_REF.sub("", m.group(1))
        ref = original[m.start() : m.start(1) + len(cola)].strip(" -:")
        if len(ref) >= 4:
            r.referencia_ubicacion = ref[:120]

    if r.personas is None:
        r.faltantes.append("personas")
    if r.animales is None:
        r.faltantes.append("animales")
    if r.referencia_ubicacion is None:
        r.faltantes.append("referencia_ubicacion")
    return r


def _ANIMALES_RE() -> str:  # noqa: N802
    return "|".join(_ANIMALES)
