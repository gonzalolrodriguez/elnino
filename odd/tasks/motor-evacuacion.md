# Motor de evacuación · diagnóstico y mejoras (rama `dev-cabrera`)

**Objetivo:** pulir el algoritmo que organiza la evacuación (recomendador, asignación a centros, ruteo y tiempos), que es el problema del Desafío 06. La hidrometría queda como insumo: el escenario se dispara con la altura de Puerto Formosa (K1/K3) y no se profundiza en su análisis, porque lo cubre otro grupo.

**Alcance acordado (19/11/2026):** mejoras de lógica del motor (M1 a M5) y su documentación. No se modifican los sectores K10 (D8) ni los datos de demo. El reemplazo de centros y puestos genéricos por lugares reales (C4, brecha D7) queda pendiente de decisión del equipo.

## Cómo funcionaba (antes de esta rama)

`app/servicios/recomendacion.py`:
1. Calcula el escenario (estado de sectores y accesos).
2. Ordena los sectores no normales por riesgo o por población.
3. Reparte personas y animales con un algoritmo voraz: cada sector, en orden, llena los centros más cercanos **en línea recta** desde su centroide.
4. Estima viajes, rondas y tiempos con distancia en línea recta × factor de desvío 1,3, y acumula el tiempo de todos los sectores en secuencia.
5. Calcula aparte los días hasta el compromiso de cada sector (proyección lineal con las tasas de K1).

## Diagnóstico

Verificado leyendo el código y, para el ruteo, con la red vial real cargada en la base local.

| # | Problema | Efecto |
|---|---|---|
| 1 | **No responde "¿alcanza el tiempo?"**. Calcula el tiempo de traslado y los días hasta el compromiso, pero nunca los compara. | La pregunta central del comité (K8: "¿cuánto tiempo queda?", "¿qué sectores primero?") no tiene respuesta directa. |
| 2 | **El recomendador no usa el ruteo**: distancias en línea recta desde el centroide. pgRouting solo lo usa `POST /ruteo`. | Un centro "cercano" al otro lado de un camino cortado o de una zona anegada se considera accesible; los tiempos no dependen de la superficie real. |
| 3 | **La red vial real no se carga por defecto** (`data/geo/red_vial.geojson`, 12.987 tramos OSM). | Aun con ruteo, se cae siempre en la estimación aproximada. |
| 4 | **La lluvia no cierra tramos de la red**: el umbral de 30 mm (tierra) y 80 mm (ripio) solo se aplica a los accesos simulados. | Con 40 mm el ruteo vehicular saca gente de S4 por caminos de tierra mientras el escenario dice que S4 está aislado. Contradicción. |
| 5 | **No se excluyen centros dentro de sectores comprometidos o en riesgo**. | Hoy no ocurre por la ubicación de los centros demo; ocurriría con cualquier centro real (escuela) dentro de un sector. |
| 6 | **Flota en secuencia global**: el tiempo de todos los sectores se suma, aunque usen vehículos distintos (colectivo, 4x4, lancha) que operan en paralelo. Los camiones jaula no tienen tiempo. | Sobrestima el tiempo total y no estima el traslado del ganado. |
| 7 | **Reparto voraz**: depende del orden y no minimiza el tiempo total. | Un sector de menor prioridad puede quedar con un centro lejano aunque otro reparto atienda a las mismas personas en menos tiempo. |
| 8 | **La "ventana seca" no es explícita**: no hay forma de decir "en N horas llueven X mm" y ver qué caminos se cierran antes de terminar. | La Idea 1 del equipo (evacuar antes de que la lluvia corte los caminos) no se puede simular. |

## Tareas

| ID | Tarea | Estado |
|---|---|---|
| M0 | Este documento | Hecho |
| M1 | **Factibilidad temporal** por sector: plazo (río, con rango de tasas; y ventana seca si se informa un pronóstico de lluvia SIMULADO), tiempo para completar, hora límite de inicio y veredicto `alcanza` / `justo` / `no_alcanza` / `ya_comprometido` / `sin_estimacion`. Ganado: plazo menos la anticipación de 24 a 48 h. | Pendiente |
| M2 | **Flota por tipo de vehículo**: cada tipo tiene su propia línea de tiempo (los sectores que usan el mismo tipo van en secuencia; tipos distintos, en paralelo). Tiempo de los camiones jaula. | Pendiente |
| M3 | **Lluvia en la red vial**: en los perfiles con ruedas, los tramos de tierra (y superficie desconocida) se cierran con lluvia ≥ umbral de tierra y los de ripio con ≥ umbral de ripio. El arreo no cambia. | Pendiente |
| M4 | **Tiempos por red en el recomendador**: matriz sector → centro con `pgr_dijkstraCost` (una consulta por grupo de orígenes), respaldo en línea recta × 1,3 con el método indicado por par. Centros excluidos con su motivo (dentro de un sector comprometido o en riesgo; inalcanzables). Carga de la red real al levantar Docker si la tabla está vacía. | Pendiente |
| M5 | **Reparto por flujo de costo mínimo**: respeta la prioridad de los sectores (un sector de mayor prioridad nunca queda sin lugar para darle lugar a uno de menor) y, con eso fijo, minimiza personas × minutos. | Pendiente |
| M6 | Pruebas, contrato API, `docs/decisiones.md`, `supuestos.yaml` y `ficha_fuentes.md` | Pendiente |

## Criterios de aceptación

- El ejemplo de CLAUDE.md §8.1 (7,60 m, 40 mm) sigue dando S4 aislado, S1 y S3 en riesgo y S2 normal.
- Cada sector a evacuar trae su veredicto de factibilidad con plazo mínimo y máximo, tiempo para completar y supuestos.
- Con un pronóstico de lluvia SIMULADO que cierra el acceso de tierra antes de terminar, el sector da `no_alcanza` por ventana seca.
- Un centro dentro de un sector comprometido no recibe evacuados y aparece en `centros_descartados`.
- Con cupo insuficiente, el sector de mayor prioridad se atiende primero (igual que antes); con cupo de sobra, el tiempo total no es peor que el del voraz.
- Sin red cargada, todo sigue funcionando con la estimación aproximada y lo dice.
- Los campos existentes de la respuesta no cambian de nombre (la web los usa); los nuevos se agregan.
- `ruff check .` y `pytest -q` en verde; `tsc`, `eslint` y `vitest` de la web en verde si se toca la web.

## Supuestos nuevos (van a `supuestos.yaml`)

- `margen_seguridad_horas`: horas de holgura para que un plan "alcanza" (si termina dentro del plazo mínimo pero sin esa holgura, es "justo"). SUPUESTO.
- `centro_excluir_en_riesgo`: si los centros dentro de sectores en riesgo también se excluyen (además de los comprometidos). SUPUESTO.

## Pendiente de decisión del equipo

- **C4 · lugares reales**: escuelas del Mapa Educativo como candidatas a centro (capacidad SIMULADO) y puestos de lluvia en localidades BAHRA. Cambia lo que se ve en la demo.
- **Familias sin partir**: el reparto trabaja con la población agregada de cada sector (K10 + registradas); no garantiza que un grupo familiar vaya entero a un mismo centro. Requiere trabajar por familia registrada.
