"""Punto de entrada del backend de la Plataforma de Gestión de Evacuaciones."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import (
    auth,
    canales,
    centinela,
    datos,
    lluvia,
    meta,
    mi,
    operacion,
    simulacion,
    solicitudes,
    usuarios,
    ws,
)
from app.config.settings import get_settings
from app.core import constantes
from app.core.cabeceras import cabeceras_de_seguridad
from app.core.limitador import limiter

CODIGOS_HTTP = {
    401: "no_autenticado",
    403: "prohibido",
    404: "no_encontrado",
    405: "metodo_no_permitido",
    409: "conflicto",
    413: "cuerpo_demasiado_grande",
    429: "demasiados_intentos",
    503: "no_disponible",
}


def _error(status: int, codigo: str, mensaje: str, detalle=None, headers=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"codigo": codigo, "mensaje": mensaje, "detalle": detalle}},
        headers=headers,
    )


def crear_app() -> FastAPI:
    app = FastAPI(title="Plataforma de Gestión de Evacuaciones", version=constantes.VERSION)
    app.state.limiter = limiter

    app.middleware("http")(cabeceras_de_seguridad)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins_lista,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Cliente"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        mensaje = "Recurso no encontrado" if exc.status_code == 404 else str(exc.detail)
        return _error(
            exc.status_code,
            CODIGOS_HTTP.get(exc.status_code, "error_http"),
            mensaje,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RateLimitExceeded)
    async def limite_excedido(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return _error(429, "demasiados_intentos", "Demasiadas solicitudes; intentá más tarde")

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        detalle = [
            {"campo": ".".join(str(p) for p in e["loc"]), "mensaje": e["msg"]} for e in exc.errors()
        ]
        return _error(422, "validacion", "Datos de entrada inválidos", detalle)

    app.include_router(meta.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(usuarios.router, prefix="/api/v1")
    for modulo in (datos, lluvia, canales, operacion, solicitudes, mi, centinela, ws):
        app.include_router(modulo.router, prefix="/api/v1")
    app.include_router(simulacion.router, prefix="/api/v1")
    app.include_router(simulacion.router_ruteo, prefix="/api/v1")
    return app


app = crear_app()
