# Panel personal del ciudadano y seguimiento del pedido (rama `dev-ciudadano`)

**Pedido del usuario (20/11/2026):** que el ciudadano vea en Mi cuenta, como un panel, el estado de su sector, sus pedidos con su línea de tiempo, la cuadrilla asignada (por rol) y el vehículo en camino, y que pueda confirmar con más detalle si fue asistido; mapa para marcar la ubicación; landing distinta con sesión; corregir la fecha 30/10 y "Personas: 0". Agentes en paralelo sin pisarse.

**Modo:** ODD sin TDD (memoria `flujo-odd-tests-al-final`). Rama `dev-ciudadano` desde `main` (`51d9447`). Sin merge a `main` sin OK del usuario.

## Contrato acordado (lo implementa C1; C3 y C5 lo consumen)

- `POST /mi/confirmaciones` y respuesta de la consulta: `respuesta` ∈ `completa | parcial | no_encontraron | no_vinieron | otro_problema`. Se siguen aceptando `si` → `completa`, `no` → `no_vinieron`, `problema` → `otro_problema` (compatibilidad con SMS y datos viejos). `completa` verifica el traslado; el resto lo marca con discrepancia.
- `cuadrillas.vehiculo` (SIMULADO, opcional): `4x4 | camion_jaula | colectivo | lancha | moto`.
- `GET /mi/pedidos` (ciudadano y productor; solo los propios, más nuevo primero):
  `{ "categoria": "SIMULADO", "items": [ { "id", "tipo", "personas", "estado", "origen", "creada_en", "lat", "lon", "sector_id", "linea_tiempo": [ { "estado": "recibida|verificada|asignada|en_curso|resuelta", "en": iso|null } ], "tarea": null | { "id", "estado", "cuadrilla": { "id", "tipo_incidente", "rol_encargado": str|null, "vehiculo": str|null }, "iniciada_en", "cerrada_en" }, "seguimiento": null | <mismo ítem que GET /mi/seguimiento>, "confirmacion": null | { "solicitud_id", "respondida", "respuesta", "comentario" }, "centro": null | { "id", "nombre", "lat", "lon" } } ] }`.
  Sin nombres de personas: la cuadrilla se identifica por rol y tipo.

## Tareas

| ID | Tarea | Agente y archivos | Estado |
|---|---|---|---|
| C1 | Backend: contrato de arriba, migración 0009, seed, tests, contrato_api, openapi, ficha_fuentes | backend (`apps/backend`, `docs/`) | Pendiente |
| C2 | Web: componente `ElegirEnMapa` (MapLibre, sectores K10) en Pedir ayuda, Editar grupo y los dos registros; "Personas" arranca en el grupo familiar | web-formularios | Pendiente |
| C3 | Web: Mi cuenta como panel personal (estado del sector, Mi pedido con línea de tiempo y mapa en vivo, confirmación de 5 opciones, avisos, centro, historial, datos plegados); corregir fecha 30/10 | web-micuenta | Pendiente |
| C4 | Web: landing según sesión y rol; "Recorrer el río" plegado en escritorio; panel Evacuaciones con las 5 respuestas | web-landing-panel | Pendiente |
| C5 | App: Mis pedidos con línea de tiempo, cuadrilla y vehículo; confirmación de 5 opciones | app | Pendiente |
| C6 | Integración: merges, tests completos, prueba contra backend real, push y PR | coordinador | Pendiente |

Reglas para no pisarse: cada agente toca solo sus archivos; nadie edita `src/test/utils.ts`, `theme.ts` (solo C3), `docs/` (solo C1) ni este archivo (solo el coordinador).

## Progreso

- 20/11: rama `dev-ciudadano` creada desde `main` (`51d9447`). Cinco agentes lanzados en paralelo.
