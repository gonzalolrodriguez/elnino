"""Cabeceras de seguridad HTTP."""

from fastapi import Request

_RUTAS_DOCS = ("/docs", "/redoc", "/openapi.json")

_BASE = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Cross-Origin-Resource-Policy": "same-site",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}
_CSP_API = "default-src 'none'; frame-ancestors 'none'"


async def cabeceras_de_seguridad(request: Request, call_next):
    respuesta = await call_next(request)
    for nombre, valor in _BASE.items():
        respuesta.headers.setdefault(nombre, valor)
    ruta = request.url.path
    if not ruta.startswith(_RUTAS_DOCS):
        respuesta.headers.setdefault("Content-Security-Policy", _CSP_API)
    if ruta.startswith("/api/v1/auth") or ruta.startswith("/api/v1/usuarios"):
        respuesta.headers["Cache-Control"] = "no-store"
    return respuesta
