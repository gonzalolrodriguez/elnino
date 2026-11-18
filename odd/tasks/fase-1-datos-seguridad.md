# Fase 1 · Datos y seguridad base

**Objetivo:** datos del kit limpios y cargados, modelo de datos con migraciones, autenticación con roles y auditoría de accesos.
**Criterio de aceptación (CLAUDE.md §13):** tests de limpieza y de auth/RBAC en verde.
**Flujo:** ODD, sin TDD; se escriben código y tests, y la verificación completa se corre una sola vez al final (preferencia del usuario).
**Rama:** `fase-1-datos-seguridad` (sale de `fase-0-esqueleto`, cuyo PR aún no está mergeado).
**Commits:** se proponen al cierre y se espera confirmación (CLAUDE.md §0.2).

## Tareas
- [x] T1.1 Limpieza K1 → `data/processed/k1_limpio.csv`, `k1_diario.csv`, `docs/registro_limpieza.md`; velocidades de ascenso — delegado
- [x] T1.2 Modelo de datos (SQLAlchemy 2 + GeoAlchemy2) y migración Alembic inicial (§7) — delegado
- [x] T1.3 Carga K3, K10 (sin cambios, SIMULADO), lecturas K1; accesos, centros, recursos, puestos y usuarios de demo SIMULADOS — delegado
- [x] T1.4 Auth: registro ciudadano/productor, login, refresh rotativo, logout, /auth/yo; Argon2id, JWT, bloqueo y rate limit — delegado
- [x] T1.5 RBAC, cifrado AES-GCM de campos sensibles, auditoría de accesos con hash encadenado — delegado
- [x] T1.6 `docs/ficha_fuentes.md` inicial, `docs/seguridad.md`, contrato de auth en `docs/contrato_api.md` — delegado
- [x] T1.7 Verificación final y cierre (pytest completo repetido por el escritor y por el coordinador: 64 passed; commit pendiente de confirmación)

## Ruta
Escritura de 2+ archivos no triviales → un escritor delegado (un solo escritor para T1.1–T1.6).

## Evidencia (verificación del escritor, 2026-11-17, base en puerto 5433)
- `ruff check .`: All checks passed (y `ruff format --check`: 39 archivos ya formateados).
- `alembic upgrade head` sobre esquema vacío: aplica `0001`; `alembic check`: "No new upgrade operations detected".
- `python -m app.ingest.limpieza_k1`: 8.347 filas → 12 duplicados idénticos, 40 fechas (20 + 20), 3 comas, 7 cm, 1 cuarentena, 141 negativos, 432 días con varias mediciones, 8.335 finales (8.334 válidos), 25 días sin dato en 2018 (131 en toda la serie), máximo 9,81 m (05–06/01/2016), pico 2019 9,72 m, 2026-10-01 = 2,37 m, 2026-10-31 = 5,60 m. Coincide con CLAUDE.md §4.5.
- `python -m app.db.seed` dos veces: primera carga 8 usuarios, 6 accesos, 4 centros, 5 recursos, 3 puestos; segunda corrida 0 nuevos (idempotente). Base: 8.335 lecturas, 4 sectores.
- `pytest -q` (base `evacuaciones_test` recreada por la sesión): 64 passed (3 de Fase 0 + 61 nuevos). Tras un ajuste solo de texto en el registro de limpieza se reejecutaron únicamente `test_limpieza_k1`, `test_ascenso` y `test_meta` (20 passed; sin base disponible en ese momento).
- Smoke con uvicorn: `/salud` ok; registro 201; registro sin consentimiento 422; login (móvil) 200; `/auth/yo` 200; logout 200; refresh tras logout 401; `/auth/yo` sin token 401.
- Web: `pnpm --filter frontend test` 3 passed; `pnpm typecheck` sin errores (shared, frontend, mobile).
- Contenedor de base detenido (volumen conservado).

## Desvíos y pendientes
- Ventanas de ascenso (2015-16: 2015-06-01..2016-03-31; 2019: 2019-01-01..2019-07-31) son SUPUESTO; con el año calendario completo la mayor suba de 7 días cae en otros episodios. Con esas ventanas la tabla coincide exacta con CLAUDE.md §4.5.
- Dockerfile copia `alembic/`, pero el servicio `backend` de compose aún no tiene los datos de `data/` (la ruta del repo se resuelve por `parents[4]`); la siembra se corre en local.
