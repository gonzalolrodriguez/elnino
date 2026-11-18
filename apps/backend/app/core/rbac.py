"""Autenticación por Bearer JWT y control de acceso por rol y por recurso."""

from __future__ import annotations

from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import auditoria
from app.core.seguridad import decodificar_token_acceso
from app.db.modelos import Usuario
from app.db.sesion import get_db

ROLES_AUTOREGISTRO = ("ciudadano", "productor")
ROLES_INSTITUCIONALES = ("cuadrilla", "operador", "decisor", "admin")
TODOS_LOS_ROLES = ROLES_AUTOREGISTRO + ROLES_INSTITUCIONALES

_esquema = HTTPBearer(auto_error=False)


def ip_cliente(request: Request) -> str | None:
    return request.client.host if request.client else None


def usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_esquema),
    db: Session = Depends(get_db),
) -> Usuario:
    cabeceras = {"WWW-Authenticate": "Bearer"}
    if credenciales is None:
        raise HTTPException(401, "Falta el token de acceso", headers=cabeceras)
    try:
        claims = decodificar_token_acceso(credenciales.credentials)
        usuario = db.get(Usuario, int(claims["sub"]))
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(401, "Token de acceso inválido o vencido", headers=cabeceras) from exc
    if usuario is None or usuario.estado != "activo":
        raise HTTPException(401, "Usuario inexistente o inactivo", headers=cabeceras)
    return usuario


def requiere_rol(*roles: str) -> Callable[..., Usuario]:
    """Dependencia que exige alguno de los roles indicados (403 en caso contrario)."""
    desconocidos = set(roles) - set(TODOS_LOS_ROLES)
    if desconocidos:
        raise ValueError(f"Roles desconocidos: {desconocidos}")

    def dependencia(
        request: Request,
        usuario: Usuario = Depends(usuario_actual),
        db: Session = Depends(get_db),
    ) -> Usuario:
        if usuario.rol not in roles:
            auditoria.registrar(
                db,
                "acceso_denegado",
                f"{request.method} {request.url.path}",
                usuario.id,
                ip_cliente(request),
                f"rol={usuario.rol}",
            )
            db.commit()
            raise HTTPException(403, "No tenés permisos para esta operación")
        return usuario

    return dependencia


def exigir_propietario_o_rol(
    actual: Usuario, propietario_id: int, roles_permitidos: tuple[str, ...] = ("admin",)
) -> None:
    """Control por recurso: solo el dueño del dato o un rol autorizado (403 si no)."""
    if actual.id != propietario_id and actual.rol not in roles_permitidos:
        raise HTTPException(403, "No tenés permisos sobre este recurso")
