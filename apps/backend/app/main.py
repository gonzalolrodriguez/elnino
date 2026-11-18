"""Punto de entrada del backend de la Plataforma de Gestión de Evacuaciones."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import meta
from app.config.settings import get_settings
from app.core import constantes


def _error(status: int, codigo: str, mensaje: str, detalle=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"codigo": codigo, "mensaje": mensaje, "detalle": detalle}},
    )


def crear_app() -> FastAPI:
    app = FastAPI(title="Plataforma de Gestión de Evacuaciones", version=constantes.VERSION)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins_lista,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        codigos = {404: "no_encontrado", 405: "metodo_no_permitido", 401: "no_autenticado"}
        mensaje = "Recurso no encontrado" if exc.status_code == 404 else str(exc.detail)
        return _error(exc.status_code, codigos.get(exc.status_code, "error_http"), mensaje)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        detalle = [
            {"campo": ".".join(str(p) for p in e["loc"]), "mensaje": e["msg"]}
            for e in exc.errors()
        ]
        return _error(422, "validacion", "Datos de entrada inválidos", detalle)

    app.include_router(meta.router, prefix="/api/v1")
    return app


app = crear_app()
