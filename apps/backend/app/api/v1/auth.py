"""Autenticación: registro, login, refresh rotativo, logout y /auth/yo."""

import time

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from geoalchemy2 import WKTElement
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.esquemas import (
    LoginIn,
    RefreshIn,
    RegistroCiudadano,
    RegistroProductor,
    SesionOut,
    UsuarioOut,
)
from app.config.settings import get_settings
from app.core import auditoria, bloqueo, cifrado, sesiones
from app.core.bloqueo import clave_ip
from app.core.eventos import difusor
from app.core.limitador import limite_login, limite_registro, limiter
from app.core.rbac import ip_cliente, usuario_actual
from app.core.seguridad import crear_token_acceso, hashear_password, verificar_password
from app.db.base import SRID, ahora
from app.db.consultas import sector_de_punto
from app.db.modelos import (
    Establecimiento,
    GrupoFamiliar,
    SesionRefresh,
    StockProductivo,
    Usuario,
)
from app.db.sesion import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_REFRESH = "refresh_token"
RUTA_COOKIE = "/api/v1/auth"


def _credenciales() -> HTTPException:
    return HTTPException(401, "Correo o contraseña incorrectos")


# Correos inexistentes: no se escribe una fila de auditoría por intento (serializaría todo el
# sistema por el candado de la cadena y permitiría inflar la bitácora). Se agrega: como mucho una
# fila por IP y ventana, con el total de intentos acumulados.
_VENTANA_INEXISTENTES_S = 60.0
_inexistentes: dict[str, tuple[float, int]] = {}


def _auditar_correo_inexistente(db: Session, ip: str | None) -> None:
    ahora_s = time.monotonic()
    clave = ip or "desconocida"
    inicio, n = _inexistentes.get(clave, (ahora_s, 0))
    if ahora_s - inicio >= _VENTANA_INEXISTENTES_S:
        inicio, n = ahora_s, 0
    n += 1
    _inexistentes[clave] = (inicio, n)
    if n == 1:
        auditoria.registrar(
            db,
            "login_fallido",
            "auth",
            None,
            ip,
            f"usuario_inexistente (agregado {_VENTANA_INEXISTENTES_S:g}s)",
        )
        db.commit()
    if len(_inexistentes) > 5000:  # acota la memoria
        for k in [
            k for k, (t, _) in _inexistentes.items() if ahora_s - t >= _VENTANA_INEXISTENTES_S
        ]:
            _inexistentes.pop(k, None)


def _punto(lon: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=SRID)


def _es_movil(x_cliente: str | None) -> bool:
    return (x_cliente or "").strip().lower() == "movil"


def _abrir_sesion(
    db: Session, usuario: Usuario, response: Response, movil: bool, familia: str | None = None
) -> tuple[SesionOut, SesionRefresh]:
    """Emite access + refresh, fija la cookie HttpOnly y devuelve también la fila del refresh."""
    acceso, expira = crear_token_acceso(usuario.id, usuario.rol)
    refresh, fila = sesiones.emitir_refresh(db, usuario.id, "movil" if movil else "web", familia)
    s = get_settings()
    response.set_cookie(
        COOKIE_REFRESH,
        refresh,
        max_age=s.refresh_token_dias * 86400,
        httponly=True,
        secure=s.cookie_segura,
        samesite="strict",
        path=RUTA_COOKIE,
    )
    campos: dict = {}
    if movil:  # el móvil no usa cookies: recibe el refresh en el cuerpo
        campos["refresh_token"] = refresh
    salida = SesionOut(
        access_token=acceso,
        token_type="bearer",
        expires_in=expira,
        usuario=UsuarioOut.model_validate(usuario),
        **campos,
    )
    return salida, fila


def _crear_usuario(db: Session, datos, rol: str) -> Usuario:
    usuario = Usuario(
        email=datos.email,
        hash_password=hashear_password(datos.password),
        nombre_visible=datos.nombre_visible,
        rol=rol,
        consentimiento_en=ahora(),
    )
    db.add(usuario)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "El correo ya está registrado") from exc
    return usuario


@router.post("/registro/ciudadano", response_model=UsuarioOut, status_code=201)
@limiter.limit(limite_registro)
def registro_ciudadano(
    request: Request, datos: RegistroCiudadano, db: Session = Depends(get_db)
) -> Usuario:
    usuario = _crear_usuario(db, datos, "ciudadano")
    con_ubicacion = datos.lon is not None and datos.lat is not None
    db.add(
        GrupoFamiliar(
            usuario_id=usuario.id,
            integrantes=datos.integrantes,
            menores=datos.menores,
            mayores=datos.mayores,
            mascotas=datos.mascotas,
            telefono_cifrado=(
                cifrado.cifrar(datos.telefono, "grupos_familiares.telefono")
                if datos.telefono
                else None
            ),
            domicilio=_punto(datos.lon, datos.lat) if con_ubicacion else None,
            sector_id=sector_de_punto(db, datos.lon, datos.lat) if con_ubicacion else None,
        )
    )
    auditoria.registrar(db, "registro", "usuarios", usuario.id, ip_cliente(request), "ciudadano")
    db.commit()
    return usuario


@router.post("/registro/productor", response_model=UsuarioOut, status_code=201)
@limiter.limit(limite_registro)
def registro_productor(
    request: Request, datos: RegistroProductor, db: Session = Depends(get_db)
) -> Usuario:
    usuario = _crear_usuario(db, datos, "productor")
    est = datos.establecimiento
    establecimiento = Establecimiento(
        productor_id=usuario.id,
        nombre=est.nombre,
        renspa=est.renspa,
        geom_tranquera=_punto(est.lon, est.lat),
        sector_id=sector_de_punto(db, est.lon, est.lat),
    )
    db.add(establecimiento)
    db.flush()
    for item in est.stock:
        db.add(StockProductivo(establecimiento_id=establecimiento.id, **item.model_dump()))
    auditoria.registrar(db, "registro", "usuarios", usuario.id, ip_cliente(request), "productor")
    db.commit()
    return usuario


@router.post("/login", response_model=SesionOut, response_model_exclude_unset=True)
@limiter.limit(limite_login)
def login(
    request: Request,
    response: Response,
    datos: LoginIn,
    db: Session = Depends(get_db),
    x_cliente: str | None = Header(default=None),
) -> SesionOut:
    ip = ip_cliente(request)
    usuario = db.execute(select(Usuario).where(Usuario.email == datos.email)).scalar_one_or_none()
    # Se verifica siempre (hash de relleno si no existe) para igualar tiempos de respuesta.
    correcto = verificar_password(datos.password, usuario.hash_password if usuario else None)

    # Respuesta única (401 genérico) para correo inexistente, contraseña errónea, cuenta inactiva o
    # bloqueada: no se distingue ninguna de ellas (sin enumeración de cuentas). El 429 sale solo
    # del limitador por IP (``@limiter.limit``).
    if usuario is None:
        _auditar_correo_inexistente(db, ip)
        raise _credenciales()

    if bloqueo.esta_bloqueado(db, usuario.id, ip):
        auditoria.registrar(db, "login_bloqueado", "auth", usuario.id, ip)
        db.commit()
        raise _credenciales()

    # Límite por cuenta: con fallos masivos (muchas IP) solo pasan las redes con login previo.
    if bloqueo.cuenta_saturada(db, usuario.id) and not bloqueo.red_conocida(db, usuario.id, ip):
        auditoria.registrar(db, "login_bloqueado_cuenta", "auth", usuario.id, ip)
        db.commit()
        raise _credenciales()

    if not correcto or usuario.estado != "activo":
        intentos, bloqueado = bloqueo.registrar_fallo(db, usuario.id, ip)
        if bloqueado:
            auditoria.registrar(
                db, "cuenta_bloqueada", "auth", usuario.id, ip, f"intento={intentos}"
            )
        else:
            auditoria.registrar(db, "login_fallido", "auth", usuario.id, ip, f"intento={intentos}")
        db.commit()
        raise _credenciales()

    bloqueo.limpiar(db, usuario.id, ip)
    usuario.ultimo_login = ahora()
    salida, _ = _abrir_sesion(db, usuario, response, _es_movil(x_cliente))
    auditoria.registrar(db, "login_ok", "auth", usuario.id, ip)
    db.commit()
    return salida


@router.post("/refresh", response_model=SesionOut, response_model_exclude_unset=True)
@limiter.limit(limite_login)
def refresh(
    request: Request,
    response: Response,
    cuerpo: RefreshIn | None = None,
    db: Session = Depends(get_db),
    x_cliente: str | None = Header(default=None),
    cookie_refresh: str | None = Cookie(default=None, alias=COOKIE_REFRESH),
) -> SesionOut:
    token = (cuerpo.refresh_token if cuerpo else None) or cookie_refresh
    ip = ip_cliente(request)
    invalido = HTTPException(401, "Refresh token inválido o vencido")
    if not token:
        raise invalido
    sesion = sesiones.buscar_por_token(db, token)
    if sesion is None:
        raise invalido

    usuario = db.get(Usuario, sesion.usuario_id)
    if usuario is None or usuario.estado != "activo":
        raise invalido
    cliente = "movil" if _es_movil(x_cliente) else "web"

    if sesion.revocado_en is not None:
        # Token ya rotado: solo se tolera UN reintento inmediato (respuesta perdida) del mismo
        # cliente y red; cualquier otra reutilización se trata como robo.
        if sesiones.en_gracia(db, sesion, ip, cliente):
            return _sucesora(db, sesion, usuario, response, x_cliente, ip, invalido)
        return _reutilizado(db, sesion, ip, invalido)

    if sesion.expira_en <= ahora():
        raise invalido

    # Se marca el token como usado de forma atómica ANTES de emitir el nuevo: si dos solicitudes
    # llegan a la vez con el mismo refresh, solo una lo consume; la otra pasa por la gracia.
    if not sesiones.consumir(db, sesion.id):
        db.refresh(sesion)
        if sesion.revocado_en is not None and sesiones.en_gracia(db, sesion, ip, cliente):
            return _sucesora(db, sesion, usuario, response, x_cliente, ip, invalido)
        return _reutilizado(db, sesion, ip, invalido)
    salida, nueva = _abrir_sesion(
        db, usuario, response, _es_movil(x_cliente), familia=sesion.familia
    )
    sesion.reemplazado_por = nueva.id
    sesion.rotada_ip = clave_ip(ip)
    sesion.rotada_cliente = cliente
    auditoria.registrar(db, "refresh", "auth", usuario.id, ip)
    db.commit()
    return salida


def _sucesora(db, sesion, usuario, response, x_cliente, ip, invalido) -> SesionOut:
    """Reintento de gracia: reemplaza al sucesor (sin ramas paralelas) y emite su relevo."""
    if not sesiones.reemplazar_sucesor(db, sesion):  # otro pedido ya lo reemplazó: es reutilización
        return _reutilizado(db, sesion, ip, invalido)
    salida, nueva = _abrir_sesion(
        db, usuario, response, _es_movil(x_cliente), familia=sesion.familia
    )
    sesion.reemplazado_por = nueva.id
    auditoria.registrar(db, "refresh_gracia", "auth", usuario.id, ip)
    db.commit()
    return salida


def _reutilizado(db, sesion, ip, invalido):
    sesiones.revocar_familia(db, sesion.familia)
    auditoria.registrar(db, "refresh_reutilizado", "auth", sesion.usuario_id, ip)
    db.commit()
    difusor.desconectar_usuario(sesion.usuario_id)  # se asume robo: caen también los sockets
    raise invalido


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    cuerpo: RefreshIn | None = None,
    db: Session = Depends(get_db),
    cookie_refresh: str | None = Cookie(default=None, alias=COOKIE_REFRESH),
) -> dict:
    token = (cuerpo.refresh_token if cuerpo else None) or cookie_refresh
    if token:
        sesion = sesiones.buscar_por_token(db, token)
        if sesion is not None:
            sesiones.revocar_familia(db, sesion.familia)
            auditoria.registrar(db, "logout", "auth", sesion.usuario_id, ip_cliente(request))
            db.commit()
            difusor.desconectar_usuario(sesion.usuario_id)  # cierra también sus WebSockets
    response.delete_cookie(COOKIE_REFRESH, path=RUTA_COOKIE)
    return {"mensaje": "Sesión cerrada"}


@router.get("/yo", response_model=UsuarioOut)
def yo(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    return usuario
