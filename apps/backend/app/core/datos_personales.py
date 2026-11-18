"""Acceso a los campos sensibles del grupo familiar (cifrados) con control y auditoría."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core import auditoria, cifrado
from app.core.rbac import exigir_propietario_o_rol
from app.db.modelos import GrupoFamiliar, Usuario

CAMPOS_SENSIBLES = ("salud", "vulnerabilidad", "telefono")
_CONTEXTO = "grupos_familiares.{campo}"


def guardar_sensibles(grupo: GrupoFamiliar, **valores: str | None) -> None:
    """Cifra y asigna los campos sensibles indicados (``None`` los borra)."""
    for campo, valor in valores.items():
        if campo not in CAMPOS_SENSIBLES:
            raise ValueError(f"Campo no sensible o desconocido: {campo}")
        setattr(
            grupo,
            f"{campo}_cifrado",
            None if valor is None else cifrado.cifrar(valor, _CONTEXTO.format(campo=campo)),
        )


def leer_sensibles(
    db: Session, grupo: GrupoFamiliar, actual: Usuario, ip: str | None = None
) -> dict[str, str | None]:
    """Descifra los campos sensibles. Solo el titular, un operador/decisor o un admin.

    Cada lectura queda registrada en la bitácora de accesos con hash encadenado.
    """
    exigir_propietario_o_rol(actual, grupo.usuario_id, ("operador", "decisor", "admin"))
    auditoria.registrar(
        db, "lectura_datos_personales", f"grupos_familiares/{grupo.id}", actual.id, ip
    )
    resultado: dict[str, str | None] = {}
    for campo in CAMPOS_SENSIBLES:
        valor = getattr(grupo, f"{campo}_cifrado")
        resultado[campo] = (
            None if valor is None else cifrado.descifrar(valor, _CONTEXTO.format(campo=campo))
        )
    return resultado
