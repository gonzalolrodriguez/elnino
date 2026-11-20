# SAPUKAY · distintivos para la entrega (rama `dev-gonzalo`)

**Pedido del usuario (20/11/2026, madrugada):** implementar las cuatro ideas del documento SAPUKAY que no existen en el sistema, en dos tandas de agentes en paralelo, sobre la rama `dev-gonzalo`. Plazo: sábado 21/11, 9:00.

**Fuente:** `SAPUKAY — Super-Sistema de Evacuación (Operación Agua · Desafío 6).docx` y su presentación HTML (escritorio del usuario, fuera del repo). Las cifras del documento sin fuente (1983/1992/1998, cupo gratuito de WhatsApp, Yacyretá, "retardo de 3 a 6 meses", ventana seca de 50 mm) **no** se usan.

**Modo:** ODD sin TDD (memoria `flujo-odd-tests-al-final`); tests y checks al cerrar cada tarea.

## Tareas

| ID | Tarea | Tanda | Ruta | Estado |
|---|---|---|---|---|
| S1 | Seguimiento de la cuadrilla ("Uber del rescate"): posición de la cuadrilla en tarea en curso, tarjeta "Cuadrilla en camino" con llegada estimada para el solicitante (app y web), capa de cuadrillas en el mapa del panel | A | agente escritor en worktree (backend + app + web) | Pendiente |
| S3 | Tres relojes (río, barro, Niño) en la landing y en el tablero del panel | A | agente escritor en worktree (web) | Pendiente |
| S2 | Brújula offline hacia el centro asignado o punto de encuentro, en la app | B | agente escritor en worktree (app) | Pendiente |
| S4 | Inundación ilustrativa de S1–S4 en el mapa del simulador, según la altura | B | agente escritor en worktree (web) | Hecha (ver progreso S4) |
| S5 | Integración: merge en `dev-gonzalo`, tests completos, docs (ficha técnica, ficha de fuentes), push y PR | — | coordinador | Pendiente |

## Criterios comunes

- Rotulado de categoría en cada cifra; toda cifra nueva en `docs/ficha_fuentes.md`; supuestos en `supuestos.yaml`.
- Sin personas reales; la cuadrilla se identifica por rol.
- Leyenda de prototipo visible; la plataforma no ordena ni decide.
- Tests del paquete tocado en verde; `tsc`/`eslint`/`ruff` limpios.

## Progreso

- 20/11 ~03:50: rama `dev-gonzalo` creada desde `main` (`8fd029a`). Tanda A lanzada.
- 20/11 S4 (lámina de agua ilustrativa): `lamina.ts` (lógica pura), `capasLamina.ts` (capas deck.gl y accesos cortados discontinuos), interruptor y "Reproducir subida" en el simulador, leyenda SIMULADO con exageración ×150, parámetros en `ficha_fuentes.md`. Checks: tsc, eslint y vitest completo (19 archivos, 232 tests) en verde. No verificado: el dibujo real de deck.gl en el navegador (jsdom no dibuja WebGL).
