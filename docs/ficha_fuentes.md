# Ficha de fuentes · AI LAB Misión: Código Formosa
Herramienta: Plataforma de Gestión de Evacuaciones (backend, Fase 2) · Equipo: Equipo 3 · Instituto Politécnico Formosa

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Cada cifra, umbral, serie o capa que la herramienta muestra, con su fuente y su categoría. Regla: si no está acá, no se muestra. Estado: **Fase 2** (motor); se amplía en cada fase.

## Datos observados (K1, K3)

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Puerto Formosa: aguas bajas | 1,60 m | K3 · `K3_estaciones_umbrales.json` (INA, siteCode 57) | Observado | 31/10/2026 |
| Puerto Formosa: nivel de alerta | 7,80 m | K3 · `K3_estaciones_umbrales.json` | Observado | 31/10/2026 |
| Puerto Formosa: nivel de evacuación | 8,30 m | K3 · `K3_estaciones_umbrales.json` | Observado | 31/10/2026 |
| Puerto Pilcomayo: aguas bajas / alerta / evacuación | 1,40 m / 5,35 m / 6,00 m | K3 · `K3_estaciones_umbrales.json` (INA, siteCode 55) | Observado | 31/10/2026 |
| Ubicación de las estaciones | Formosa (-58,183; -26,183) · Pilcomayo (-57,650; -25,367) | K3 · `K3_estaciones_umbrales.json` | Observado | 31/10/2026 |
| Serie de altura de Puerto Formosa (lecturas limpias) | 8.335 registros (8.334 válidos + 1 en cuarentena), 2006-01-01 a 2026-10-31 | K1 · `P1_DATA_INTEGRITY_dataset_participantes_v1.csv`, limpiado según `registro_limpieza.md` (dataset pedagógico con alteraciones deliberadas) | Observado | 31/10/2026 |
| Máximo de la serie | 9,81 m (05 y 06/01/2016) | K1 limpio (`data/processed/k1_limpio.csv`) | Observado | 06/01/2016 |
| Pico de 2019 | 9,72 m (02/06/2019 00:00 en la serie; otros documentos citan el 03/06 por huso horario) | K1 limpio | Observado | 02/06/2019 |
| Altura al inicio de octubre de 2026 | 2,37 m | K1 limpio | Observado | 01/10/2026 |
| Altura al corte | 5,60 m | K1 limpio | Observado | 31/10/2026 |
| Valor mínimo de la serie | -0,86 m (141 lecturas negativas conservadas) | K1 limpio | Observado | 07/11/2024 |
| Valor imposible en cuarentena | 98,1 (2012-07-15), no se reemplaza ni se usa | K1 · `registro_limpieza.md` | Observado | 15/07/2012 |
| Cobertura de 2018 | 25 días sin dato (sin interpolar) | K1 limpio (`data/processed/k1_diario.csv`) | Observado | 2018 |
| Días sin dato en toda la serie | 131 | K1 limpio (`k1_diario.csv`) | Observado | 31/10/2026 |
| Velocidad de ascenso 2015-16 (ventana 2015-06-01 a 2016-03-31) | mayor suba en 1 día 0,29 m (05/12/2015); en 7 días 1,25 m (10/12/2015) | Cálculo propio sobre K1 limpio (`app/domain/ascenso.py`); la ventana es un SUPUESTO | Observado (derivado) | 2015 |
| Cruces 2015-16 | 7,50 m el 18/06/2015 · 7,80 m el 01/08/2015 · 8,30 m el 18/12/2015 | Cálculo propio sobre K1 limpio | Observado (derivado) | 2015 |
| Velocidad de ascenso 2019 (ventana 2019-01-01 a 2019-07-31) | mayor suba en 1 día 0,36 m (20/03/2019); en 7 días 1,37 m (25/03/2019) | Cálculo propio sobre K1 limpio; la ventana es un SUPUESTO | Observado (derivado) | 2019 |
| Cruces 2019 | 7,50 m el 14/04/2019 · 7,80 m el 17/04/2019 · 8,30 m el 27/04/2019 | Cálculo propio sobre K1 limpio | Observado (derivado) | 2019 |
| Velocidad de ascenso octubre de 2026 | mayor suba en 1 día 0,28 m (12/10/2026); en 7 días 1,53 m (17/10/2026); sin cruce de 7,50 m | Cálculo propio sobre K1 limpio | Observado (derivado) | 2026 |

## Sectores simulados (K10)

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Sector Norte (S1): altura de compromiso / población / acceso | 8,10 m / 1.200 / un solo acceso, ripio | K10 · `K10_sectores_simulados.geojson` v1.0 | Simulado | 12/11/2026 |
| Sector Centro (S2) | 8,60 m / 3.500 / dos accesos pavimentados | K10 | Simulado | 12/11/2026 |
| Sector Sur (S3) | 7,90 m / 800 / un acceso pavimentado y uno de ripio | K10 | Simulado | 12/11/2026 |
| Sector Rural Este (S4) | 7,50 m / 150 + producción ganadera / camino de tierra, intransitable con lluvia | K10 | Simulado | 12/11/2026 |
| Geometría de los sectores | Polígonos tal como los armó la mesa (sin cambios) | K10 | Simulado | 12/11/2026 |
| Población simulada total | 5.650 personas (1.200 + 3.500 + 800 + 150) | K10 (suma) | Simulado | 12/11/2026 |
| Margen entre S4 y la alerta | S4 se compromete 0,30 m antes de 7,80 m; al corte (5,60 m) está a 1,90 m | K10 y K3 (diferencias) | Simulado | 12/11/2026 |

## Supuestos del modelo (`apps/backend/app/config/supuestos.yaml`)

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Margen de riesgo de un sector | 0,50 m por debajo de la altura de compromiso | SUPUESTO | Simulado | 17/11/2026 |
| Lluvia que vuelve intransitable un camino de tierra | 30 mm | SUPUESTO | Simulado | 17/11/2026 |
| Lluvia que vuelve intransitable un camino de ripio | 80 mm | SUPUESTO | Simulado | 17/11/2026 |
| Factor de desvío (distancia en línea recta a distancia por camino) | 1,3 | SUPUESTO | Simulado | 17/11/2026 |
| Bovinos por camión jaula | 30 | SUPUESTO (pendiente tabla del Anexo II de la Res. SENASA 581/2014) | Simulado | 17/11/2026 |
| Capacidad de vehículo categoría B (animales menores) | 40 | SUPUESTO | Simulado | 17/11/2026 |
| Cota máxima física plausible para marcar un valor como imposible | 15 m | SUPUESTO (la serie válida llega a 9,81 m) | Simulado | 17/11/2026 |

## Datos de prueba de la Fase 1 (`data/simulado/`)

Los nombres genéricos ("SIMULADO 1", "Puesto pluviométrico SIMULADO A") se reemplazarán por lugares reales tomados de fuentes oficiales (BAHRA/IGN, Mapa Educativo, REFES, parte policial UPCA) cuando se descarguen esas capas (decisión D7). Hasta entonces ningún lugar mostrado es real.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Accesos por sector (6 tramos) | S1: 1 ripio · S2: 2 pavimentados · S3: 1 pavimentado y 1 ripio · S4: 1 tierra; trazas ilustrativas | `data/simulado/accesos.geojson`, coherentes con `acceso_simulado` de K10 | Simulado | 17/11/2026 |
| Centros de recepción | Capacidades de 400, 250 y 600 personas y un predio alto para 300 animales; ubicaciones ilustrativas | `data/simulado/centros_recepcion.json` | Simulado | 17/11/2026 |
| Recursos disponibles | 6 colectivos (40 personas), 10 camionetas 4x4 (5), 4 camiones jaula (30 bovinos), 3 vehículos categoría B (40 animales menores), 3 lanchas (12 personas) | `data/simulado/recursos.json` | Simulado | 17/11/2026 |
| Puestos pluviométricos | 3 puestos genéricos (PLUV-SIM-A, B y C) | `data/simulado/puestos_pluviometricos.json` | Simulado | 17/11/2026 |
| Roles operativos | Catálogo de 18 roles, sin nombres de funcionarios | `data/simulado/roles_operativos.json` | Simulado | 17/11/2026 |
| Usuarios, grupos familiares y establecimientos de demostración | 8 usuarios ficticios; productor 1 en S4 con 8 vacas preñadas, 10 con cría, 10 terneros, 1 vaquillona y 1 toro; sin parcela (P12, opción b); teléfonos y salud son marcadores de prueba | `data/simulado/usuarios_demo.json` | Simulado | 17/11/2026 |

## Lo que el kit no tiene (se declara en la plataforma)

Lluvia observada, pronóstico hidrológico más allá de 15 días, cotas, barrios, caminos o centros reales y alturas anteriores a 2006 (1983, 1992 y 1998 no se muestran).

Fuentes externas usadas (URL y fecha de consulta):
- En la Fase 1 no se consultaron fuentes externas. Las capas oficiales (IGN/Georef, BAHRA, Mapa Educativo, REFES, OSM, INDEC) se incorporan en fases posteriores con su URL, licencia y fecha de descarga (CLAUDE.md §10.1).


## Fase 2: motor de simulación

Todo lo que calcula el motor se rotula `SIMULADO` (entradas simuladas, supuestos o proyecciones), salvo lo que se deriva directamente de K1 o K3, que se rotula `DATO OBSERVADO` (derivado).

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Estado de sectores (comprometido, en riesgo, normal) | Compromiso de K10; en riesgo a 0,50 m o menos del compromiso | K10 y supuesto `margen_riesgo_m` | Simulado | 12/11/2026 |
| Estado del río y distancia a los umbrales | Alerta 7,80 m y evacuación 8,30 m | K3 (`GET /simulacion/escenario`) | Observado (umbral); la altura de entrada es simulada | 31/10/2026 |
| Accesos `intransitable_lluvia` | Tierra con 30 mm o más; ripio con 80 mm o más | Supuestos `umbral_lluvia_camino_*` | Simulado | 17/11/2026 |
| ISAD (índice relativo 0 a 1) | Pesos: lluvia 0,30, humedad 0,20, concavidad 0,20, río 0,30; lluvia de saturación 100 mm; humedad por defecto 0,5; concavidad S1 0,4, S2 0,2, S3 0,5, S4 0,8 | Supuestos `isad_*` (el kit no tiene cotas ni humedad). No reemplaza el criterio de K10 | Simulado | 17/11/2026 |
| Velocidades de ascenso, cruces y tasas m/día | 0,36 m/día (máxima diaria, 2019); 1,25, 1,37 y 1,53 m por semana; promedio de octubre 2026 (5,60 - 2,37) / 30 = 0,1077 m/día | Cálculo propio sobre K1 limpio (`app/domain/ascenso.py`) | Observado (derivado) | 31/10/2026 |
| Tiempo restante a un umbral | Rango en días entre la tasa más alta y la más baja; p. ej. de 5,60 a 7,80 m: 6,1 a 20,4 días | Proyección lineal a tasa constante, SUPUESTO; el INA no pronostica a más de 15 días | Simulado | 31/10/2026 |
| Población por sector en el recomendador | K10 más las familias registradas dentro del polígono (por `ST_Intersects`) | K10 y registros de demostración | Simulado | 17/11/2026 |
| Capacidad de centros, vehículos y camiones | 3 centros (400, 250 y 600 personas) y un predio alto (300 animales); 6 colectivos de 40, 10 camionetas 4x4 de 5, 4 camiones jaula, 3 vehículos categoría B, 3 lanchas de 12 | `data/simulado/` | Simulado | 17/11/2026 |
| Velocidades por superficie y perfil | Vehicular 60 / 40 / 20 km/h (pavimento / ripio / tierra); camión jaula 45 / 30 (no usa tierra); arreo 4 / 4 / 3; superficie desconocida cuesta como tierra; lancha 15 km/h | Supuesto `velocidad_kmh`, `velocidad_lancha_kmh` | Simulado | 17/11/2026 |
| Penalización del arreo en zonas comprometidas | Costo x 3 | Supuesto `arreo_penalizacion_zona_comprometida` | Simulado | 17/11/2026 |
| Distancia máxima del origen o destino a la red vial | 5.000 m (si se supera, estimación aproximada) | Supuesto `ruteo_distancia_maxima_a_red_m` | Simulado | 17/11/2026 |
| Ventana de inicio del traslado de ganado | 24 a 48 h antes del compromiso previsto | Supuesto `ventana_inicio_ganado_horas` | Simulado | 17/11/2026 |
| Dormidero | 5 m² por bovino | INTA (4 a 5 m² por animal; se usa el máximo; a verificar), supuesto `dormidero_m2_por_bovino` | Simulado | 17/11/2026 |
| Lotes en destino | Hasta 200 cabezas; toros con vacas preñadas y vacías; vaquillonas aparte; vacas con cría con sus terneros | INTA (a verificar), supuesto `lote_maximo_cabezas` | Simulado | 17/11/2026 |
| Ración diaria por cabeza | Vaca preñada 2,8 kg de maíz + 0,2 kg de pellet de girasol; vaca con cría 3,1 + 0,35; vaquillona y toro 2,5 + 0,2 (SUPUESTO); ternero al pie sin ración propia (SUPUESTO) | INTA (a verificar, 3,0 a 3,2 kg y 0,2 a 0,5 kg para vaca con cría); supuesto `racion_diaria_kg` | Simulado | 17/11/2026 |
| Caso de control de Arca Productiva | 8 preñadas + 10 con cría + 10 terneros + 1 vaquillona + 1 toro: 150 m², 1 camión con divisiones, 58,4 kg de maíz y 5,5 kg de pellet por día | Cálculo con los supuestos anteriores (`tests/test_ganaderia_y_parser.py`) | Simulado | 17/11/2026 |
| Cuadrillas | Plantillas humana, ganadera y apícola con roles del catálogo (sin nombres de funcionarios) | CLAUDE.md §8.6 y `data/simulado/cuadrillas.json` | Simulado | 17/11/2026 |
| Lecturas de lluvia | Siempre con origen (`parte_policial`, `carga_manual`, `planilla_upca`, `simulado`); celda vacía = sin medición; son `SIMULADO` si el puesto, el origen o la fecha (posterior al corte) lo son | `POST /lluvia`, planilla UPCA y canales simulados; el kit no trae lluvia observada | Simulado | 17/11/2026 |
| Validación de lluvia | Máximo 500 mm por turno; comparación con puestos a menos de 30 km (advertencia si la diferencia supera 40 mm) | Supuestos `lluvia_max_mm_turno`, `lluvia_vecinos` | Simulado | 17/11/2026 |
| Verificador de K6 | 8 afirmaciones: máximo de 2016 en K1 9,81 m; máximo de octubre 2026 5,60 m; tasa 0,1077 m/día; fuente de la escala (K3: red de Prefectura); SMN 4/9/2026 y NOAA 83 % (K9) | K1, K3 y K9 | Observado (derivado) y referencia | 31/10/2026 |
| Verificador de K7 | 7 relaciones; la 3 (orden de estaciones) y la 6 (umbrales de Puerto Pilcomayo) se calculan con K3; las demás son conocimiento geográfico general, pendientes de contraste con los cursos de agua del IGN | K3, K7 e IGN (pendiente) | Referencia | 31/10/2026 |
| Red vial para el ruteo | Se carga con `python -m app.ingest.red_vial`; las pruebas usan una red sintética rotulada SIMULADO. La red real (OSM, `data/geo/red_vial.geojson`) la documenta la capa de datos geográficos con su licencia y fecha | OpenStreetMap (ODbL), ver `data/geo/` | Referencia | según la capa |
| Estimación sin red | Distancia al acceso más cercano más línea recta por 1,3 | Supuesto `factor_desvio`; se informa como `limitacion` | Simulado | 17/11/2026 |
| Soluciones de ruteo y tiempos de las alternativas | Flota compartida, sectores en secuencia, ida y vuelta | Cálculo propio con los supuestos anteriores | Simulado | 17/11/2026 |
