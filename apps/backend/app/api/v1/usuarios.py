"""Gestión de usuarios institucionales (solo admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.esquemas import UsuarioActualizar, UsuarioCrear, UsuarioOut
from app.core import auditoria
from app.core.rbac import ROLES_INSTITUCIONALES, ip_cliente, requiere_rol
from app.core.seguridad import hashear_password
from app.db.modelos import RolOperativo, Usuario
from app.db.sesion import get_db

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _validar_rol_operativo(db: Session, codigo: str | None) -> None:
    if codigo is not None and db.get(RolOperativo, codigo) is None:
        raise HTTPException(422, f"rol_operativo desconocido: {codigo}")


@router.get("", response_model=list[UsuarioOut])
def listar(
    request: Request,
    limite: int = Query(default=50, ge=1, le=200),
    desplazamiento: int = Query(default=0, ge=0),
    admin: Usuario = Depends(requiere_rol("admin")),
    db: Session = Depends(get_db),
) -> list[Usuario]:
    auditoria.registrar(db, "lectura_datos_personales", "usuarios", admin.id, ip_cliente(request))
    db.commit()
    return list(
        db.execute(
            select(Usuario).order_by(Usuario.id).limit(limite).offset(desplazamiento)
        ).scalars()
    )


@router.post("", response_model=UsuarioOut, status_code=201)
def crear(
    request: Request,
    datos: UsuarioCrear,
    admin: Usuario = Depends(requiere_rol("admin")),
    db: Session = Depends(get_db),
) -> Usuario:
    _validar_rol_operativo(db, datos.rol_operativo)
    usuario = Usuario(
        email=datos.email,
        hash_password=hashear_password(datos.password),
        nombre_visible=datos.nombre_visible,
        rol=datos.rol,
        rol_operativo=datos.rol_operativo,
    )
    db.add(usuario)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "El correo ya está registrado") from exc
    auditoria.registrar(
        db, "usuario_creado", f"usuarios/{usuario.id}", admin.id, ip_cliente(request), datos.rol
    )
    db.commit()
    return usuario


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def actualizar(
    usuario_id: int,
    request: Request,
    datos: UsuarioActualizar,
    admin: Usuario = Depends(requiere_rol("admin")),
    db: Session = Depends(get_db),
) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(404, "Usuario no encontrado")
    cambios = datos.model_dump(exclude_unset=True)
    if "rol_operativo" in cambios:
        _validar_rol_operativo(db, cambios["rol_operativo"])
    if "rol" in cambios and usuario.rol not in ROLES_INSTITUCIONALES:
        raise HTTPException(409, "Solo se puede cambiar el rol de usuarios institucionales")
    if usuario.id == admin.id and (
        cambios.get("estado") == "inactivo" or cambios.get("rol", "admin") != "admin"
    ):
        raise HTTPException(409, "Un admin no puede desactivarse ni quitarse el rol a sí mismo")
    password = cambios.pop("password", None)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    if password is not None:
        usuario.hash_password = hashear_password(password)
        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
    auditoria.registrar(
        db,
        "usuario_modificado",
        f"usuarios/{usuario.id}",
        admin.id,
        ip_cliente(request),
        ",".join(sorted(list(cambios) + (["password"] if password else []))),
    )
    db.commit()
    return usuario
