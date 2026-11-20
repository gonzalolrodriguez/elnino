# Seguimiento de la cuadrilla ("Cuadrilla en camino") · tarea S1

**Pedido (20/11/2026):** cuando una tarea de cuadrilla ligada a un pedido de asistencia está `en_curso`, quien pidió ayuda ve "Cuadrilla en camino" con la distancia y una llegada estimada; la cuadrilla comparte su posición desde la app; el panel operativo ve dónde está cada cuadrilla.

Base: la feature de constancias (`odd/tasks/constancias-evacuacion.md`).

## Decisiones

- **Retención mínima y privada:** una sola fila por cuadrilla en `posiciones_cuadrilla` (migración `0008`), sin historial; se pisa en cada envío y se borra cuando la cuadrilla ya no tiene tareas en curso (`liberar_si_sin_tareas`). Las lecturas solo devuelven posiciones de cuadrillas con tarea en curso.
- **Rate limit** por cuadrilla en el servicio (fila bloqueada, 10 s, SUPUESTO `intervalo_min_posicion_s`) y no por IP: no depende del limitador global, que se desactiva en pruebas.
- **WebSocket:** el evento `posicion_cuadrilla` se filtra a operador, decisor y admin (la infraestructura lo permite) y lleva solo ids; el panel igual consulta por polling (20 s).
- **Supuestos nuevos** (`supuestos.yaml`): `velocidad_cuadrilla_kmh` 40, `posicion_vieja_minutos` 5, `intervalo_min_posicion_s` 10; se reutiliza `factor_desvio` 1,3.
- **App:** envío cada 30 s solo en primer plano, con `expo-location` y un único buffer de "última posición" (se descarta si tiene más de 90 s para no reenviarla como si fuera actual).
- Sin semilla de posición SIMULADO: el seed no tiene tareas `en_curso` y crear una cambiaría el estado que asumen otras pruebas.

## Tareas

| ID | Tarea | Estado |
|---|---|---|
| S1.1 | Backend: migración, endpoints, WS filtrado, supuestos, tests | Hecha |
| S1.2 | Docs: contrato, OpenAPI, seguridad, ficha de fuentes | Hecha |
| S1.3 | Web: tarjeta en `/mi-cuenta`, capa "Cuadrillas" en el mapa, "Compartir mi ubicación" en `/cuadrilla`, pruebas | Hecha |
| S1.4 | App: compartir posición (cuadrilla) y tarjeta "Cuadrilla en camino" (ciudadanía y productores), pruebas | Hecha |

## Evidencia (20/11/2026)

- Backend: `ruff check .` limpio; `pytest -q` 320 pasadas (29 nuevas en `tests/test_seguimiento.py`), contra una base PostGIS descartable propia.
- Web: `tsc --noEmit` y `eslint src` sin errores; `vitest run` 205 pasadas (13 nuevas).
- App: `tsc --noEmit` sin errores; `jest` 237 pasadas (17 nuevas).
- No verificado: contra el backend en marcha con dispositivo real ni capturas; la capa de cuadrillas del mapa no se probó con deck.gl real (jsdom); `expo export` no se corrió.
- Límite: la app envía la posición mientras está abierta en primer plano, aunque el usuario cambie de pestaña (las pestañas de expo-router quedan montadas).
