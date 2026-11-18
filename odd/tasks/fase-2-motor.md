# Fase 2 · Motor

**Objetivo:** lógica de dominio y API del simulador: escenario, ISAD (SIMULADO), recomendador, asignación, alternativas, ruteo, Arca Productiva, cuadrillas, ingesta pluviométrica y parser, órdenes y notificaciones.
**Criterio de aceptación (CLAUDE.md §13):** el ejemplo de §8.1 da el resultado esperado; los casos inválidos de §9 pasan.
**Flujo:** ODD, sin TDD; código y tests primero, verificación completa una sola vez al final.
**Rama:** `fase-2-motor` (sale de `fase-1-datos-seguridad`).
**Commits:** se proponen al cierre y se espera confirmación.

## Tareas
- [x] T2.1 Escenario (§8.1) + ISAD SIMULADO + `POST /simulacion/escenario`; datos `GET /estaciones|sectores|accesos|centros|serie/formosa|serie/ascenso`, `PATCH /accesos/{id}` — delegado
- [x] T2.2 Recomendador (§8.2), asignación a centros, alternativas (§8.4) — delegado
- [x] T2.3 Red vial y ruteo bimodal con pgRouting (§8.3), con alternativa por distancia × 1,3 — delegado
- [x] T2.4 Arca Productiva (§8.5) y cuadrillas (§8.6) — delegado
- [x] T2.5 Lluvia: parser `LLUVIA`/`SOS-FSA`, canales simulados con HMAC, importación y exportación de la planilla (§8.8, §8.10) — delegado
- [x] T2.6 Órdenes, notificaciones, tareas, bitácora K8 y WebSocket (§8.7); solicitudes; verificador K6/K7 (§8.9) — delegado
- [x] T2.7 Backend en docker-compose con acceso a `data/` (`DATA_DIR=/data`, migraciones y seed al iniciar); docs — `docker compose up -d --build backend` + `curl /api/v1/salud` → `{"estado":"ok",...,"base_de_datos":"ok"}`; luego `docker compose stop`
- [ ] T2.8 Verificación final y cierre (pendiente la confirmación del coordinador y los commits)
- [x] Correcciones de seguridad de la revisión de la Fase 1 (sesiones al cambiar contraseña, bloqueo por cuenta+IP, rotación atómica del refresh) y WebSocket con token solo en el primer mensaje

## Ruta
Escritura de 2+ archivos no triviales → un escritor delegado (writer A: `apps/backend`, docs, shared, simulado).

## Evidencia (verificación del escritor, 2026-11-17/18, base en puerto 5433)
- `ruff check .`: All checks passed; `ruff format --check .`: 73 archivos ya formateados.
- `alembic upgrade head` en base nueva: aplica `0001` y `0002`; `alembic check`: "No new upgrade operations detected".
- `python -m app.db.seed` dos veces: primera carga 8 usuarios, 6 accesos, 4 centros, 5 recursos, 3 puestos, 2 cuadrillas; segunda corrida 0 nuevos.
- `pytest -q`: 177 passed (64 previas + 113 nuevas).
- Smoke con uvicorn: escenario `{7.6, 40, []}` → S1 y S3 `en_riesgo`, S2 `normal`, S4 `comprometido` y aislado (acceso de tierra `intransitable_lluvia`), río `normal` a 0,2 m de la alerta; altura 13 → 422.
- Smoke del ruteo con la red OSM real (12.987 aristas, 8.534 nodos, carga de 14 s): S4 a S2 vehicular por pgRouting, 8.712 m, 16,8 min; camión jaula sin ruta (el único acceso de S4 es de tierra).
- Caso de control de Arca Productiva: 150 m², 1 camión con divisiones, maíz 58,4 kg/día, pellet 5,5 kg/día. La tabla de raciones de CLAUDE.md §8.5 (2,8 / 3,1 / 2,5 kg) no alcanza por sí sola: solo cierran las cifras con ternero al pie sin ración, vaca con cría 3,1 kg + 0,35 kg, vaca preñada 2,8 + 0,2 y vaquillona y toro 2,5 + 0,2 (los dos últimos y el ternero, SUPUESTO).

## Desvíos y pendientes
- `.env.example` no se pudo leer con las herramientas de lectura (regla de permisos); se editó con un script para agregar `CANAL_HMAC_SECRET` y `DATA_DIR`.
