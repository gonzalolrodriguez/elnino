"""Evidencia multimedia de los partes de las cuadrillas: fotos (JPEG, PNG, WebP) y video MP4.

El tipo se decide por los primeros bytes del archivo, nunca por el ``Content-Type`` ni por el nombre
que declara el cliente (igual que los adjuntos de pedidos y constancias; para MP4 se exige la caja
``ftyp``). Los nombres de archivo los genera el servidor (``<n>.<ext>``). Topes en ``supuestos.yaml``.
"""

from __future__ import annotations

from app.config.settings import supuesto

_TOPES = supuesto("adjuntos_parte")
IMAGEN_MAX_BYTES = int(_TOPES["imagen_max_mb"]) * 1024 * 1024
VIDEO_MAX_BYTES = int(_TOPES["video_max_mb"]) * 1024 * 1024
MAX_POR_PARTE = int(_TOPES["max_por_parte"])

# mime -> (extensión, tipo público)
TIPOS = {
    "image/jpeg": ("jpg", "imagen"),
    "image/png": ("png", "imagen"),
    "image/webp": ("webp", "imagen"),
    "video/mp4": ("mp4", "video"),
    "video/quicktime": ("mov", "video"),  # videos de iPhone (.mov)
}


def tipo_por_firma(datos: bytes) -> str | None:
    """Tipo MIME según el contenido real (``None`` si no es un formato permitido)."""
    if datos.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if datos.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "image/webp"
    if len(datos) >= 12 and datos[4:8] == b"ftyp":
        return "video/quicktime" if datos[8:12] == b"qt  " else "video/mp4"
    return None


def adjunto_publico(a: dict) -> dict:
    """Forma pública de un adjunto (sin hash, sin nombre de archivo, sin quién lo subió)."""
    return {"n": a["n"], "tipo": a["tipo"], "mime": a["mime"], "bytes": a["bytes"]}
