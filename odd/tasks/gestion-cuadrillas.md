# Gestión completa de cuadrillas (rama `dev-app`)

**Pedido del usuario (20/11/2026, noche):** que armar una cuadrilla sea un apartado completo: nombre, cantidad de integrantes, encargado, profesión de cada integrante (equipo interdisciplinario), vehículo y equipamiento; seguimiento geográfico de todas las cuadrillas para los operativos (recorrido como el que ve el ciudadano); avisos del operativo a la cuadrilla (desvíos de camino, qué llevar: ruedas, palas, etc.); evidencia multimedia en los partes; CRUD completo. Todo lo que involucra una evacuación: personas, familias, productores, animales, bienes materiales y traslados.

**Decisión sobre personas (CLAUDE.md §0.5 y §2):** no se publican nombres reales. Cada integrante se identifica por **rol operativo y profesión**; si está vinculado a una cuenta institucional, el panel muestra su `nombre_visible` **solo a operador, decisor y admin**, nunca al ciudadano. Los datos de demostración usan nombres ficticios rotulados SIMULADO.

**Modo:** ODD sin TDD. Cuatro agentes en paralelo con archivos separados. Sin merge a `main` sin OK del usuario.

## Contrato (lo implementa G1; G2, G3 y G4 lo consumen)

- **Cuadrilla:** `{ "id", "nombre", "tipo_operativo": "personas|familias|productores_ganado|apicola|bienes|traslado_mixto", "tipo_incidente" (se mantiene por compatibilidad), "cantidad_integrantes", "vehiculo", "equipamiento": [str], "estado", "base": {lat, lon} | null, "notas": str|null, "integrantes": [Integrante], "creado_en" }`.
- **Integrante:** `{ "id", "usuario_id": int|null, "rol_operativo", "profesion": "medicina|enfermeria|veterinaria|zootecnia|trabajo_social|policia|bomberos|defensa_civil|prefectura|chofer|tecnico_energia|logistica|otra", "es_encargado": bool, "nombre_visible": str|null (solo para roles operativos) }`. Exactamente un encargado por cuadrilla.
- **CRUD:** `GET /cuadrillas` (lista con integrantes), `POST /cuadrillas`, `GET /cuadrillas/{id}`, `PATCH /cuadrillas/{id}`, `DELETE /cuadrillas/{id}` (409 si tiene una tarea en curso; si tiene historial, baja lógica `estado: "baja"`). `POST /cuadrillas/{id}/integrantes`, `PATCH /cuadrillas/{id}/integrantes/{integrante_id}`, `DELETE ...`. Roles: operador y admin escriben; decisor lee.
- **Plantillas de equipamiento:** `GET /cuadrillas/plantillas` → por `tipo_operativo`: equipamiento sugerido (p. ej. ruedas de auxilio, palas, cadenas, sogas, chalecos salvavidas, botiquín, linternas, bidones de agua, forraje, bebederos, mangas portátiles, jaulas, lonas, generador) y profesiones sugeridas. Valores en `supuestos.yaml` como SUPUESTO.
- **Avisos del operativo a la cuadrilla:** `POST /cuadrillas/{id}/avisos` `{ "tipo": "desvio|equipamiento|instruccion|seguridad", "texto", "items": [str] (para equipamiento), "geometria": GeoJSON LineString|Point|null (para desvío), "tarea_id": int|null }`; `GET /cuadrillas/{id}/avisos` (operativos y los integrantes de esa cuadrilla); `POST /avisos/{id}/leido` (integrante de la cuadrilla) → `leido_en`, `leido_por_rol`. Evento WebSocket `aviso_cuadrilla` para los integrantes y los operativos.
- **Seguimiento para operativos:** `GET /cuadrillas/posiciones` agrega por cuadrilla `ruta` (misma forma que en `/mi/pedidos`: `coordenadas`, `distancia_km`, `llegada_estimada_min`, `metodo`, `simulada`, `progreso`, `velocidad_kmh`) hacia su tarea en curso, y `destino`.
- **Evidencia multimedia en partes:** `POST /tareas/{id}/partes/{parte_id}/adjuntos` (integrante; imágenes JPEG/PNG/WebP hasta 5 MB y video MP4 hasta 20 MB, validando el tipo real del archivo, nombres generados por el servidor, máximo 5 por parte); `GET .../adjuntos/{n}` (operativos e integrantes). Cada parte devuelve `adjuntos: [{n, tipo, bytes}]`.
- Migración `0011`.

## Tareas

| ID | Tarea | Agente y archivos | Estado |
|---|---|---|---|
| G1 | Backend del contrato, migración 0011, seed (3 cuadrillas interdisciplinarias SIMULADAS), tests, docs | backend (`apps/backend`, `docs/`) | Pendiente |
| G2 | Panel: módulo de cuadrillas (alta/edición en pasos, baja, detalle), mapa de seguimiento de todas las cuadrillas con recorrido animado, avisos con dibujo de desvío y equipamiento, galería de evidencia | web-panel (`src/panel/paginas/Cuadrillas.tsx`, `src/panel/cuadrillas/*`, rutas del panel) | Pendiente |
| G3 | Web de la cuadrilla: avisos recibidos (marcar leído, desvío en mapa, lista de qué llevar) y adjuntos en los partes | web-cuadrilla (`src/pages/Cuadrilla.tsx`, `src/pages/cuadrilla/*`) | Pendiente |
| G4 | App, modo cuadrilla: avisos, desvío en el mapa abierto, lista de qué llevar, adjuntar fotos y video a los partes (con cola sin señal) | app (`apps/mobile/**`) | Pendiente |
| G5 | Integración, tests, capturas, PR | coordinador | Pendiente |

## Progreso

- 20/11: plan y contrato. Cuatro agentes lanzados.
