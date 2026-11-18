"""Esquemas Pydantic de autenticación y usuarios."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config.settings import get_settings

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def _validar_email(valor: str) -> str:
    valor = valor.strip().lower()
    if len(valor) > 254 or not _EMAIL.match(valor):
        raise ValueError("Correo electrónico inválido")
    return valor


def _validar_password(valor: str) -> str:
    minimo = get_settings().password_min_longitud
    if len(valor) < minimo:
        raise ValueError(f"La contraseña debe tener al menos {minimo} caracteres")
    if len(valor) > 128:
        raise ValueError("La contraseña no puede superar los 128 caracteres")
    return valor


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _Credenciales(_Base):
    email: str
    password: str
    nombre_visible: str = Field(min_length=2, max_length=120)

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str) -> str:
        return _validar_email(v)

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        return _validar_password(v)


class _ConConsentimiento(_Base):
    consentimiento: bool = Field(
        description="Consentimiento informado (Ley 25.326); debe ser true."
    )

    @field_validator("consentimiento")
    @classmethod
    def debe_aceptar(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("Se requiere el consentimiento informado (Ley 25.326)")
        return v


class RegistroCiudadano(_Credenciales, _ConConsentimiento):
    integrantes: int = Field(default=1, ge=1, le=40)
    menores: int = Field(default=0, ge=0, le=40)
    mayores: int = Field(default=0, ge=0, le=40)
    mascotas: int = Field(default=0, ge=0, le=100)
    telefono: str | None = Field(default=None, max_length=30)
    lon: float | None = Field(default=None, ge=-180, le=180)
    lat: float | None = Field(default=None, ge=-90, le=90)


class StockIn(_Base):
    especie: str = Field(min_length=2, max_length=40)
    categoria_animal: str = Field(min_length=2, max_length=60)
    cantidad: int = Field(ge=0, le=100000)


class EstablecimientoIn(_Base):
    nombre: str = Field(min_length=2, max_length=160)
    renspa: str | None = Field(default=None, max_length=30)
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    stock: list[StockIn] = Field(default_factory=list, max_length=50)


class RegistroProductor(_Credenciales, _ConConsentimiento):
    establecimiento: EstablecimientoIn


class LoginIn(_Base):
    email: str
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str) -> str:
        return _validar_email(v)


class RefreshIn(_Base):
    refresh_token: str | None = None


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    nombre_visible: str
    rol: str
    rol_operativo: str | None = None
    estado: str
    creado_en: datetime
    ultimo_login: datetime | None = None


class SesionOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    usuario: UsuarioOut
    refresh_token: str | None = None  # solo si el cliente envía X-Cliente: movil


class UsuarioCrear(_Credenciales):
    rol: Literal["cuadrilla", "operador", "decisor", "admin"]
    rol_operativo: str | None = Field(default=None, max_length=60)


class UsuarioActualizar(_Base):
    nombre_visible: str | None = Field(default=None, min_length=2, max_length=120)
    rol: Literal["cuadrilla", "operador", "decisor", "admin"] | None = None
    rol_operativo: str | None = Field(default=None, max_length=60)
    estado: Literal["activo", "inactivo"] | None = None
    password: str | None = None

    @field_validator("password")
    @classmethod
    def validar_pw(cls, v: str | None) -> str | None:
        return None if v is None else _validar_password(v)
