# Fase 3 · Panel operativo web

**Objetivo:** panel operativo para mandos (`/comando/*`, roles operador, decisor y admin) y administración de usuarios (`/admin`): monitor, mapa con capas oficiales, simulador, recomendador y comparador, Arca Productiva, cuadrillas, solicitudes, lluvia, órdenes, bitácora K8, Centinela, tiempo real y panel de límites.
**Criterio de aceptación (CLAUDE.md §13 y §14):** pasos 2 a 6 del guion de demo.
**Flujo:** ODD, sin TDD; código y tests primero, verificación completa una sola vez al final. Sin commits (los propone el coordinador).
**Rama:** `fase-3-panel`.
**Ruta:** escritura de muchos archivos no triviales → un escritor delegado (writer P3: `apps/frontend`, `apps/backend`, `docs`, `README.md`, `packages/shared`).
**TDD:** desactivado (decisión del usuario). Corredor de pruebas: vitest (web) y pytest (backend).

## Tareas
- [x] T3.1 Dependencias (maplibre-gl, deck.gl), capas oficiales recortadas en `public/capas/` con manifiesto y fechas (`preparar-datos.mjs`)
- [x] T3.2 Base del panel: layout con navegación lateral, contexto de escenario compartido, hook de carga, cliente de API tipado, token reactivo en `AuthContext`
- [x] T3.3 Tiempo real: `WS /ws` con el token como primer mensaje, avisos (toasts) y reconexión al renovar el token
- [x] T3.4 Monitor: serie K1 con umbrales y picos, lluvia por origen, ascenso y "¿cuánto tiempo queda?"
- [x] T3.5 Mapa MapLibre + Deck.gl (sectores, accesos, centros, estaciones, capas oficiales con fuente y fecha, ruteo) y marcado de caminos no transitables
- [x] T3.6 Simulador (deslizadores, caminos cerrados, estado por sector, ISAD) y recomendador + comparador de alternativas
- [x] T3.7 Arca Productiva, cuadrillas y tareas, solicitudes, parte de lluvia, importación y exportación de la planilla
- [x] T3.8 Órdenes (solo decisor) y bitácora K8 (listado, alta, completar borrador, exportar Markdown)
- [x] T3.9 Centinela: auditoría de la limpieza de K1, verificador K6 y K7 (K7 contra la capa de cursos de agua del IGN en el backend)
- [x] T3.10 Panel Límites y `/admin` (usuarios institucionales)
- [x] T3.11 Pruebas (web y K7), documentación (`contrato_api.md`, `ficha_fuentes.md`, README) y verificación final

- [x] T3.12 (pedido del coordinador) Adjuntos de solicitudes, `Idempotency-Key` en `POST /solicitudes` y geometría y coordenadas de centros en `GET /mi/sector`

## Evidencia (verificación del escritor, 2026-11-18)
- `pnpm install`: Done. `pnpm -r typecheck`: shared, frontend y mobile sin errores. Frontend `lint`: sin avisos. `test`: 6 archivos, 53 pruebas pasadas (39 previas + 14 nuevas). `build`: OK; chunk del panel `Panel` 120,6 kB (38,3 kB gzip), `MapaGL` (maplibre-gl + deck.gl, lazy) 2.003,8 kB (550,8 kB gzip), `index` 558,8 kB.
- Backend con `docker compose up -d --wait db` (puerto 5433): `ruff check .` y `ruff format --check .` sin hallazgos; `alembic upgrade head` + `alembic check`: "No new upgrade operations detected"; `pytest -q`: 202 passed (187 previas + 7 de K7 + 8 de adjuntos, idempotencia y `/mi/sector`).
- Humo con uvicorn en 8000 y `vite preview` en 5173: login del decisor demo por curl; escenario {7,6; 40} → S4 comprometido y aislado, S1 y S3 en riesgo, S2 normal; K7 → 1 VERDADERA, 2 FALSA, 5 FALSA, 4 y 7 no verificables con la capa; altura 13 → 422; `/comando` y `/capas/capas.json` responden 200 en el preview. No se pudo hacer clic en un navegador.

## Desvíos y pendientes
- `ADJUNTOS_DIR`, `ADJUNTO_MAX_BYTES` y `ADJUNTOS_MAX_POR_SOLICITUD` no se agregaron a `.env.example` (regla de permisos); tienen valores por defecto. Se agregó `uploads/` al `.gitignore` raíz.
- Revisión visual del mapa, de los gráficos y del diseño responsive pendiente en un navegador.

## Evidencia posterior al merge con fase-5-movil (2026-11-18)
- Causa raíz de TS2786 en la web: `react-router`/`react-router-dom` no declaran `@types/react` como peer, así que pnpm los resolvía desde el hoisting privado `node_modules/.pnpm/node_modules/@types/react` (19.3.0, de la app móvil) en vez del 18.3.31 de la web. Corrección: `packageExtensions` en `pnpm-workspace.yaml` (peer opcional `@types/react`), sin `node-linker=hoisted` y sin pasar la web a React 19.
- `pnpm install`: Done. `pnpm -r typecheck`: sin errores. Frontend `lint`: sin avisos; `test`: 6 archivos, 53 pruebas pasadas; `build`: OK.
- Backend (`docker compose up -d --wait db`): `ruff check .`: All checks passed; `pytest -q`: 202 passed; `docker compose stop db` ejecutado.
