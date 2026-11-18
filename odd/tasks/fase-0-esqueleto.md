# Fase 0 · Decisiones y esqueleto

**Objetivo:** monorepo levantable con backend `/salud`, web y app Expo que muestran la leyenda obligatoria y "backend OK".
**Criterio de aceptación (CLAUDE.md §13):** todo levanta según el README; web y app muestran "backend OK".
**TDD:** desactivado (no configurado); se corren checks funcionales: pytest + ruff (backend), `tsc --noEmit` + vitest (web), `tsc --noEmit` (mobile).
**Commits:** según CLAUDE.md §0.2, se proponen al cierre de la fase y se esperan confirmación.

## Tareas
- [x] T0.1 Confirmar decisiones P1–P12 (todas por defecto; P12 = opción b) — inline
- [x] T0.2 Copiar kit original a `data/kit/` sin modificar — inline
- [ ] T0.3 Raíz: `.gitignore`, `.env.example`, `docker-compose.yml` (PostGIS + pgRouting), `README.md` — delegado
- [ ] T0.4 Backend FastAPI: `/api/v1/salud`, `/api/v1/meta`, settings, test + ruff — delegado
- [ ] T0.5 Web Vite+React+TS+Chakra: leyenda fija + estado del backend + test — delegado
- [ ] T0.6 Mobile Expo+expo-router+TS: leyenda fija + estado del backend — delegado
- [ ] T0.7 `packages/shared`: constantes (leyenda, categorías, roles) — delegado
- [ ] T0.8 Verificación y resumen de cierre de fase

## Ruta
Escritura de 2+ archivos no triviales → un escritor delegado (disparador de escritura).

## Evidencia
(pendiente)
