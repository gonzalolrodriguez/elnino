"""Cuadrillas (CLAUDE.md §8.6): plantillas por tipo de incidente. Lógica pura.

El sistema sugiere la composición; el operador confirma y asigna. Los roles son los del catálogo
``roles_operativos`` (sin nombres de funcionarios).
"""

from __future__ import annotations

TIPOS = ("humana", "ganadera", "apicola")

PLANTILLAS: dict[str, list[str]] = {
    "humana": [
        "encargado_cuadrilla",
        "sipec",
        "trabajo_social",
        "policia",
        "transporte",
        "prefectura",
        "tecnico_energia",
    ],
    "ganadera": ["encargado_cuadrilla", "veterinario", "transporte", "policia", "senasa"],
    "apicola": ["encargado_cuadrilla", "veterinario", "transporte", "inta"],
}

CHECKLISTS: dict[str, list[str]] = {
    "humana": [
        "Verificar el estado de los accesos del sector",
        "Confirmar el centro de recepción asignado y su cupo",
        "Relevar personas con movilidad reducida o necesidades de salud",
        "Registrar a las personas evacuadas (por rol y número, sin datos innecesarios)",
        "Informar al Comando la finalización del traslado",
    ],
    "ganadera": [
        "Verificar la tranquera, el albardón y el predio de destino",
        "Revisión veterinaria de aptitud para el traslado",
        "Cargar por categoría respetando las divisiones del camión",
        "Ofrecer agua y forraje en destino",
        "Control sanitario a los 7 días",
    ],
    "apicola": [
        "Cerrar las piqueras y trasladar de noche",
        "Ubicar las colmenas en un albardón seco",
        "Registrar colmenas vivas y muertas",
    ],
}


def plantilla(tipo: str) -> list[str]:
    if tipo not in PLANTILLAS:
        raise ValueError(f"Tipo de incidente desconocido: {tipo}")
    return list(PLANTILLAS[tipo])


def checklist(tipo: str) -> list[dict]:
    if tipo not in CHECKLISTS:
        raise ValueError(f"Tipo de incidente desconocido: {tipo}")
    return [{"item": t, "hecho": False} for t in CHECKLISTS[tipo]]


def roles_faltantes(tipo: str, roles_presentes: list[str]) -> list[str]:
    """Roles de la plantilla que aún no tiene la cuadrilla (cada rol cuenta una vez)."""
    presentes = list(roles_presentes)
    faltan = []
    for rol in plantilla(tipo):
        if rol in presentes:
            presentes.remove(rol)
        else:
            faltan.append(rol)
    return faltan


def tipos_necesarios(hay_personas: bool, bovinos: int, colmenas: int) -> list[str]:
    """Tipos de cuadrilla que sugiere una operación según lo expuesto en el sector."""
    tipos = []
    if hay_personas:
        tipos.append("humana")
    if bovinos > 0:
        tipos.append("ganadera")
    if colmenas > 0:
        tipos.append("apicola")
    return tipos
