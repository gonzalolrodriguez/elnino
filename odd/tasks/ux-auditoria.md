# Mejoras de UX de la auditoría (rama `dev-ux`)

**Pedido del usuario (20/11/2026):** aplicar los puntos 1 a 8 y los arreglos rápidos de la auditoría UX/UI (cuatro agentes de solo lectura: panel, parte pública, app, consistencia visual y accesibilidad), sin detenerse. Plazo: sábado 21/11, 9:00.

**Modo:** ODD sin TDD (memoria `flujo-odd-tests-al-final`); tests y checks al cerrar cada tarea. Rama `dev-ux` desde `main` (`e44d72c`). Sin merge a `main` sin OK del usuario.

## Tareas

| ID | Tarea | Ruta | Estado |
|---|---|---|---|
| U1 | Panel: botón "Preparar orden con estos sectores" en Recomendación → Órdenes con sectores precargados (la orden la sigue emitiendo el decisor) | agente web (worktree) | Hecha: b5e00aa |
| U2 | Panel: control compacto de altura y lluvia del escenario en la cabecera del panel, en todas las páginas | agente web | Hecha: dc87416 |
| U3 | Panel: menú reordenado Situación → Decidir → Ejecutar → Respaldo y registro | agente web | Hecha: 15149d9 |
| U4 | Landing móvil: texto, altura y CTA antes de la escena; mapa 2D mientras carga el 3D | agente web | Hecha: 94d9a6d |
| U5 | Landing: frase de estado en lenguaje llano, tres acciones y "Emergencia: 103" bajo el hero | agente web | Hecha: 5bf1bb0 |
| U6 | Landing: selector de perfil compacto justo después del hero | agente web | Hecha: 5bf1bb0 |
| U7 | App: "Necesito ayuda ahora" en un toque (GPS automático, detalles después, con confirmación) | agente app (worktree) | Hecha: 4a577e9 |
| U8 | App: barra fija con 103 y estado de conexión; acceso directo a la brújula, también para cuadrilla | agente app | Hecha: 0690a1a |
| U9 | Arreglos rápidos web: fecha dd/mm/aaaa en leyenda de relieve, texto mínimo 12 px, enlaces del pie con área táctil, aria-label en tabla del monitor, carga unificada | agente web | Hecha: 7467f66 |
| U10 | Integración: merge en `dev-ux`, tests completos, push y PR | coordinador | Hecha: merges a9ba547 y ab012ea, push y PR (sin merge a main) |

## Criterios comunes

- Leyenda fija y categoría visible en cada cifra; toda cifra nueva en `docs/ficha_fuentes.md`.
- La plataforma no ordena ni decide; sin personas reales.
- Tests del paquete tocado en verde; `tsc`/`eslint` limpios. Vitest con `--no-file-parallelism` (las corridas en paralelo fallan por tiempo bajo carga).

## Progreso

- 20/11: rama `dev-ux` creada desde `main` (`e44d72c`). Agentes web y app lanzados en paralelo.
- 20/11: U7 y U8 (app móvil) hechas en worktree: tsc limpio; jest --runInBand 19 suites / 265 tests en verde. Sin probar en dispositivo (GPS real, cuenta regresiva, llamada al 103 y apertura del SMS).
- 20/11: agente web hizo U1-U6 y U9. tsc y eslint limpios; vitest 20 archivos / 237 tests en verde (--no-file-parallelism). Sin capturas de pantalla.
- 20/11: integración en `dev-ux`. Web: tsc y eslint limpios, vitest 237/237 (20 archivos, en serie). App: tsc limpio, jest 265/265 (19 suites). Landing vista en navegador a 375 y 1440 px: texto antes de la escena en móvil, franja de estado con 103 y selector compacto tras el hero. Panel sin ver en navegador (requiere sesión). Pendiente humano: barra de escenario del panel (posición bajo la leyenda), app en dispositivo.
