"""Punto de entrada del backend de la Plataforma de Gestión de Evacuaciones."""

import logging

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
    evacuaciones,
    lluvia,
    meta,
    mi,
    operacion,
    panel,
    partes,
    seguimiento,
    simulacion,
    solicitudes,
    usuarios,
    ws,
)
from app.config.settings import get_settings
from app.core import constantes
from app.core.cabeceras import cabeceras_de_seguridad
from app.core.cuerpo import LimiteCuerpo
from app.core.limitador import limiter
from app.servicios.contexto import ErrorSinLecturas

CODIGOS_HTTP = {
    400: "solicitud_invalida",
    401: "no_autenticado",
    403: "prohibido",
    404: "no_encontrado",
    405: "metodo_no_permitido",
    409: "conflicto",
    413: "cuerpo_demasiado_grande",
    415: "tipo_no_soportado",
    422: "validacion",
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
    cfg = get_settings()
    # En producción no se publican /docs, /redoc ni /openapi.json (el contrato vive en docs/).
    ocultar = cfg.es_produccion
    app = FastAPI(
        title="Plataforma de Gestión de Evacuaciones",
        version=constantes.VERSION,
        docs_url=None if ocultar else "/docs",
        redoc_url=None if ocultar else "/redoc",
        openapi_url=None if ocultar else "/openapi.json",
    )
    app.state.limiter = limiter

    # Orden: el último en agregarse es el más externo. El tope de cuerpo va por dentro del
    # middleware de cabeceras (que es BaseHTTPMiddleware) para que su excepción llegue intacta
    # al manejador de errores.
    app.add_middleware(LimiteCuerpo)
    app.middleware("http")(cabeceras_de_seguridad)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins_lista,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Cliente", "Idempotency-Key"],
        expose_headers=["Retry-After"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # El 404 genérico de Starlette ("Not Found") se traduce; el detalle propio se conserva.
        detalle = str(exc.detail)
        mensaje = "Recurso no encontrado" if detalle == "Not Found" else detalle
        return _error(
            exc.status_code,
            CODIGOS_HTTP.get(exc.status_code, "error_http"),
            mensaje,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RateLimitExceeded)
    async def limite_excedido(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        try:
            espera = int(exc.limit.limit.get_expiry())
        except Exception:
            espera = 60
        return _error(
            429,
            "demasiados_intentos",
            "Demasiadas solicitudes; esperá un momento e intentá de nuevo",
            headers={"Retry-After": str(max(espera, 1))},
        )

    @app.exception_handler(ErrorSinLecturas)
    async def sin_lecturas(_: Request, exc: ErrorSinLecturas) -> JSONResponse:
        return _error(503, "no_disponible", ErrorSinLecturas.mensaje)

    @app.exception_handler(Exception)
    async def error_inesperado(_: Request, exc: Exception) -> JSONResponse:
        # Sin trazas ni detalles internos hacia el cliente (el servidor ya registra la excepción).
        logging.getLogger("uvicorn.error").exception("Error no controlado", exc_info=exc)
        return _error(500, "error_interno", "Error interno del servidor; intentá más tarde")

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        detalle = [
            {"campo": ".".join(str(p) for p in e["loc"]), "mensaje": e["msg"]} for e in exc.errors()
        ]
        return _error(422, "validacion", "Datos de entrada inválidos", detalle)

    app.include_router(meta.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(usuarios.router, prefix="/api/v1")
    for modulo in (
        datos,
        lluvia,
        canales,
        operacion,
        partes,
        evacuaciones,
        seguimiento,
        solicitudes,
        mi,
        centinela,
        panel,
        ws,
    ):
        app.include_router(modulo.router, prefix="/api/v1")
    app.include_router(simulacion.router, prefix="/api/v1")
    app.include_router(simulacion.router_ruteo, prefix="/api/v1")
    return app


app = crear_app()
