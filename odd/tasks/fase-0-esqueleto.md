# Fase 0 · Decisiones y esqueleto

**Objetivo:** monorepo levantable con backend `/salud`, web y app Expo que muestran la leyenda obligatoria y "backend OK".
**Criterio de aceptación (CLAUDE.md §13):** todo levanta según el README; web y app muestran "backend OK".
**TDD:** desactivado (no configurado); se corren checks funcionales: pytest + ruff (backend), `tsc --noEmit` + vitest (web), `tsc --noEmit` (mobile).
**Commits:** según CLAUDE.md §0.2, se proponen al cierre de la fase y se esperan confirmación.

## Tareas
- [x] T0.1 Confirmar decisiones P1–P12 (todas por defecto; P12 = opción b) — inline
- [x] T0.2 Copiar kit original a `data/kit/` sin modificar — inline
- [x] T0.3 Raíz: `.gitignore`, `.env.example`, `docker-compose.yml` (PostGIS + pgRouting), `README.md` — delegado
- [x] T0.4 Backend FastAPI: `/api/v1/salud`, `/api/v1/meta`, settings, test + ruff — delegado
- [x] T0.5 Web Vite+React+TS+Chakra: leyenda fija + estado del backend + test — delegado
- [x] T0.6 Mobile Expo+expo-router+TS: leyenda fija + estado del backend — delegado
- [x] T0.7 `packages/shared`: constantes (leyenda, categorías, roles) — delegado
- [x] T0.8 Verificación y resumen de cierre de fase (control de pytest repetido por el orquestador: 3 passed)

## Ruta
Escritura de 2+ archivos no triviales → un escritor delegado (disparador de escritura).

## Evidencia
- backend: `ruff check .`: All checks passed; `pytest -q`: 3 passed.
- smoke uvicorn con DB: `/api/v1/salud` -> `{"estado":"ok",...,"base_de_datos":"ok"}`; `/api/v1/meta` OK; ruta inexistente -> 404 con sobre de error.
- docker: tag `pgrouting/pgrouting:16-3.4-3.6.1` existe; `docker compose config` OK; `db` healthy; `SELECT postgis_version(), pgr_version()` -> 3.4 / 3.6.1. (Puerto 5432 ocupado por un Postgres local de Windows; verificado en 5433.)
- web: `tsc --noEmit` OK; `eslint src` OK; vitest 3 passed.
- mobile: `tsc --noEmit` OK. shared: `tsc --noEmit` OK.
