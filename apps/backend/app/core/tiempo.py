"""Fecha y hora de Argentina (UTC-3 fijo: no hay horario de verano desde 2009)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone

ARGENTINA = timezone(timedelta(hours=-3), "America/Argentina/Buenos_Aires")


def ahora_ar() -> datetime:
    return datetime.now(UTC).astimezone(ARGENTINA)


def hoy_ar() -> date:
    """Fecha local de Argentina (``date.today()`` usa la zona del servidor, normalmente UTC)."""
    return ahora_ar().date()
