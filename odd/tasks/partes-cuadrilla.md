# Partes de las cuadrillas, panel de cuadrillas y rediseño visual del panel (rama `dev-cuadrillas`)

**Pedido del usuario (20/11/2026):** que los integrantes de las cuadrillas den feedback al sistema sobre sus tareas (hecha, pendiente, a medias, con observación previa), un apartado donde se vean las cuadrillas y sus designados, y aplicar al panel operativo el mismo tratamiento visual que a Mi cuenta. Cinco agentes en paralelo sin pisarse.

**Modo:** ODD sin TDD (memoria `flujo-odd-tests-al-final`). Rama `dev-cuadrillas` desde `dev-ciudadano` (`6781bf8`). Sin merge a `main` sin OK del usuario.

## Contrato acordado (lo implementa K1; K2, K3 y K4 lo consumen)

- **Parte de tarea:** `{ "id", "tarea_id", "cuadrilla_id", "tipo": "avance|dificultad|resultado", "resultado": null | "completa|parcial|no_realizada|reprogramada", "observacion": str|null, "autor_rol": str|null, "creado_en", "resuelta": bool|null }`. Sin nombres de personas: el autor se identifica por su rol operativo.
  - `observacion` obligatoria (3 a 1000 caracteres) si `tipo` es `dificultad`, o si `tipo` es `resultado` y `resultado` no es `completa`.
  - `resuelta` solo aplica a `dificultad` (empieza en `false`).
- `POST /tareas/{id}/partes` (rol `cuadrilla`, solo integrantes de la cuadrilla de esa tarea; 403 si no) → 201 con el parte.
  - `resultado=completa` → tarea `completada`. Si la tarea exige constancia de cierre (evacuación), responde 409 con el mensaje "Cerrá la tarea con constancia"; además, el cierre con constancia existente crea su parte `resultado=completa` automáticamente.
  - `parcial | no_realizada | reprogramada` → tarea vuelve a `pendiente` con `requiere_atencion=true`.
  - `avance` y `dificultad` no cambian el estado (una `dificultad` con la tarea `pendiente` la deja igual).
- `GET /tareas/{id}/partes` (operador, decisor, admin, e integrantes de esa cuadrilla) → `{ "items": [parte...] }`, más nuevo primero.
- `PATCH /partes/{id}` `{ "resuelta": true }` (operador, decisor, admin; solo dificultades) → parte.
- `GET /partes/recientes?limite=20` (operador, decisor, admin) → `{ "items": [parte + { "sector_id", "solicitud_id", "cuadrilla_nombre", "tarea_estado" }] }`. Primero las dificultades sin resolver y los resultados no completos, después por fecha.
- `GET /cuadrillas/resumen` (operador, decisor, admin) → `{ "items": [ { "id", "nombre", "tipo_incidente", "vehiculo", "estado", "integrantes": [ { "usuario_id", "rol_operativo", "es_encargado" } ], "tarea_actual": null | { "id", "estado", "solicitud_id", "sector_id", "requiere_atencion" }, "ultimo_parte": null | parte, "dificultades_abiertas": int } ] }`.
- `POST /cuadrillas/{id}/integrantes` `{ "usuario_id", "rol_operativo" }` y `DELETE /cuadrillas/{id}/integrantes/{usuario_id}` (operador, admin). Solo usuarios con rol `cuadrilla`.
- `GET /tareas` agrega `requiere_atencion` y `ultimo_parte` en cada tarea.
- WebSocket: evento `parte_tarea` `{ "tarea_id", "cuadrilla_id", "tipo", "resultado" }` solo para operador, decisor y admin (sin observación).
- `GET /mi/pedidos`: cada ítem agrega `"novedad": null | { "tipo": "demora|dificultad|parcial|no_realizada|reprogramada", "en" }` (la última novedad relevante, sin el texto de la observación).
- Migración `0010`.

## Contrato del recorrido animado (lo implementa R1; R2 lo consume)

- En `GET /mi/pedidos`, `seguimiento` agrega `"ruta": null | { "coordenadas": [[lon, lat], ...], "distancia_km", "llegada_estimada_min", "metodo": "red_vial|aproximado", "simulada": bool, "progreso": 0..1, "velocidad_kmh", "calculada_en" }`. `distancia_km` y `llegada_estimada_min` de `seguimiento` pasan a calcularse sobre la ruta cuando hay red vial.
- Ruta por pgRouting sobre `red_vial` desde la posición de la cuadrilla hasta el pedido, excluyendo caminos cerrados y anegados del escenario vigente; si no hay red, línea recta × factor de desvío (`metodo: aproximado`).
- Modo demostración (`seguimiento_demo` en `supuestos.yaml`, SIMULADO): con la tarea `en_curso` y sin posición real fresca, el servidor ubica al móvil sobre la ruta según el tiempo transcurrido desde el inicio de la tarea y la velocidad supuesta, saliendo de una base SIMULADA; `simulada: true`.


| ID | Tarea | Agente y archivos | Estado |
|---|---|---|---|
| K1 | Backend: contrato de arriba, migración 0010, tests, contrato_api, openapi, seguridad | backend (`apps/backend`, `docs/`) | Hecha (PR #8) |
| K2 | Panel: página "Cuadrillas" (Ejecutar), componente `NovedadesCuadrillas`, partes en Operación | web-panel-cuadrillas | Hecha (PR #8) |
| K3 | Web: página de la cuadrilla con partes (avance, dificultad, resultado) e historial; novedad en Mi cuenta | web-cuadrilla | Hecha (PR #8) |
| K4 | App: partes en el modo cuadrilla; novedad en Mis pedidos | app | Hecha (PR #8) |
| K5 | Rediseño visual del panel (layout, primitivas, Tablero) | web-panel-visual | Hecha (PR #8) |
| R1 | Backend: ruta de la cuadrilla al pedido por la red vial y modo demostración | backend-ruta | Hecha (PR #8) |
| R2 | Web: mapa animado estilo seguimiento de vehículo en Mi cuenta | web-ruta | Hecha (PR #8) |
| K6 | Integración: merges, insertar `NovedadesCuadrillas` en el Tablero, tests, capturas, PR | coordinador | Hecha (PR #8) |

Reglas para no pisarse: cada agente toca solo sus archivos; nadie edita `src/test/utils.ts` ni este archivo (solo el coordinador); `docs/` solo K1.

## Progreso

- 20/11: rama `dev-cuadrillas` creada desde `dev-ciudadano` (`6781bf8`). Cinco agentes lanzados en paralelo.
- 20/11: integrado en `dev-cuadrillas` y PR #8 abierto (sin merge a main). Backend 426/426, web 329/329 (en serie), app 314/314. Pendiente humano: app en teléfono, CSP en build, worker de MapLibre en vite dev.
