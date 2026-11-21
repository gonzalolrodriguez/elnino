# Ficha de fuentes · AI LAB Misión: Código Formosa
Herramienta: Plataforma de Gestión de Evacuaciones (backend, portal público, panel operativo y app móvil) · Equipo: Equipo 3 · Instituto Politécnico Formosa

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Cada cifra, umbral, serie o capa que la herramienta muestra, con su fuente y su categoría. Regla: si no está acá, no se muestra. Estado: **entrega (Fase 6)**: incluye el motor, las capas de `data/geo/`, el portal público, el panel, la app móvil y la auditoría final de cifras (última sección); se amplió en cada fase.

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
| Frase de estado de la portada ("Faltan 2,20 m para la alerta") | 2,20 m = 7,80 m (alerta) - 5,60 m (corte); se calcula en pantalla con las constantes del kit | K3 (alerta) y K1 limpio (corte), cálculo propio | Observado (derivado) | 31/10/2026 |
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
| Holgura para que una evacuación "alcanza" a tiempo | 25 % del plazo más corto | SUPUESTO (`margen_seguridad_fraccion`) | Simulado | 19/11/2026 |
| Anticipación del traslado de ganado usada en la factibilidad | 48 h antes del compromiso (extremo conservador de 24 a 48 h) | SUPUESTO (`ventana_inicio_ganado_horas`) | Simulado | 19/11/2026 |
| Centros de recepción dentro de un sector en riesgo | No reciben evacuados (dentro de uno comprometido, nunca) | SUPUESTO (`centro_excluir_en_riesgo`) | Simulado | 19/11/2026 |
| Distancia adicional para enganchar un punto a un camino usable | 500 m | SUPUESTO (`ruteo_enganche_usable_m`) | Simulado | 19/11/2026 |
| Tamaño de los hogares del set separado de K10 | 1 persona 15 %, 2: 20 %, 3: 20 %, 4: 18 %, 5: 12 %, 6: 8 %, 7: 4 %, 8: 3 % (promedio 3,5) | SUPUESTO (`hogar_tamano_distribucion`). El cuadro del Censo 2022 de hogares por cantidad de personas de Formosa no se pudo obtener: los cuadros provisionales de INDEC no lo traen y la página de resultados definitivos (censo.gob.ar) no abrió por un certificado TLS incompleto | Simulado | 19/11/2026 |
| Hogares SIMULADOS de K10 (`data/simulado/hogares_k10.json`) | S1: 340 hogares; S2: 1.008; S3: 239; S4: 43 (suman exactamente la población de K10) | Generados con semilla fija por `python -m app.ingest.hogares_simulados`; solo se usan con `poblacion_k10_en_hogares` | Simulado | 19/11/2026 |
| Lluvia prevista para la ventana seca | La que ingrese el operador (mm y horas) | Entrada del operador; no es un pronóstico | Simulado | — |
| Veredicto de factibilidad, plazos y tiempos de traslado | Los calcula la API por sector | Tiempos por la red vial de OpenStreetMap (DOCUMENTO DE REFERENCIA) o aproximados; plazos con las tasas de K1 (proyección lineal); supuestos de esta tabla | Simulado | 19/11/2026 |

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
- En la Fase 1 no se consultaron fuentes externas. Las capas oficiales (IGN, BAHRA/Georef, Mapa Educativo, REFES, OSM) se descargaron el 17/11/2026 y figuran, con su URL, licencia y fecha, en la sección "Capas territoriales oficiales (`data/geo/`)". Población INDEC por radio censal y catastro parcelario siguen pendientes (CLAUDE.md §10.1).


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
| Verificador de K7 | 7 relaciones; la 3 (orden de estaciones) y la 6 (umbrales de Puerto Pilcomayo) se calculan con K3; la 1, la 2 y la 5 se miden sobre la capa de cursos de agua del IGN (ver "Fase 3"); la 4 y la 7 quedan "no verificables con la capa disponible" | K3, K7, IGN y BAHRA | Referencia | 31/10/2026 |
| Red vial para el ruteo | Se carga con `python -m app.ingest.red_vial`; las pruebas usan una red sintética rotulada SIMULADO. La red real (OSM, `data/geo/red_vial.geojson`) la documenta la capa de datos geográficos con su licencia y fecha | OpenStreetMap (ODbL), ver `data/geo/` | Referencia | según la capa |
| Estimación sin red | Distancia al acceso más cercano más línea recta por 1,3 | Supuesto `factor_desvio`; se informa como `limitacion` | Simulado | 17/11/2026 |
| Soluciones de ruteo y tiempos de las alternativas | Flota compartida, sectores en secuencia, ida y vuelta | Cálculo propio con los supuestos anteriores | Simulado | 17/11/2026 |


## Capas territoriales oficiales (`data/geo/`)

Lugares reales de fuentes oficiales o abiertas (decisión D7). Detalle por capa (URL, licencia, conteos, bbox y notas) en `data/geo/manifiesto.json` y `data/geo/LEEME.md`; se regeneran con `python apps/backend/scripts/descargar_capas.py`. Sistema de coordenadas EPSG:4326. Qué establecimiento educativo es centro de recepción y su capacidad no figuran en estas capas: lo define la autoridad y la capacidad es `SIMULADO`.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Límite provincial, departamentos y municipios de Formosa | `provincia.geojson`, `departamentos.geojson`, `municipios.geojson` | IGN, Capas SIG, servicio WFS (`wms.ign.gob.ar/geoserver/ows`) | Referencia | descarga 17/11/2026 |
| Localidades, parajes y asentamientos de Formosa | `localidades_parajes.geojson` (centroide declarado por BAHRA, no punto catastral) | BAHRA / INDEC vía API Georef (`apis.datos.gob.ar/georef/api/asentamientos`), CC BY 4.0 | Referencia | descarga 17/11/2026 |
| Red vial del corredor RN 11 - río Paraguay | `red_vial.geojson`, tramos partidos en cada nodo; `superficie` tomada literalmente del tag `surface` de OSM (parte queda `desconocida`) | OpenStreetMap vía Overpass API (ODbL 1.0, © colaboradores de OpenStreetMap) | Referencia | descarga 17/11/2026 |
| Cursos de agua de Formosa | `cursos_agua.geojson` (perennes e intermitentes; esquema ilustrativo, no sirve para cotas ni inundación) | IGN, Capas SIG, WFS | Referencia | descarga 17/11/2026 |
| Establecimientos educativos de Formosa (ubicación; no es centro de recepción) | `establecimientos_educativos.geojson` | Mapa Educativo Nacional, WFS `publico:establecimiento_educativo`, CC BY 4.0 | Referencia | descarga 17/11/2026 |
| Establecimientos de salud de Formosa (ubicación por localidad) | `establecimientos_salud.geojson` (centroide de la localidad censal; varios comparten punto) | REFES, Ministerio de Salud (datos.gob.ar), archivo del 27/12/2024, CC BY 4.0; centroides de localidad: API Georef | Referencia | descarga 17/11/2026 |
| Comisarías y destacamentos (complemento) | `comisarias_destacamentos.geojson` (OSM parcial; no sustituye el listado oficial) | OpenStreetMap (`amenity=police`), ODbL 1.0 | Referencia | descarga 17/11/2026 |

Pendientes declarados: catastro parcelario (P12), población por radio censal (INDEC 2022) y puestos del parte pluviométrico de la Policía. Ninguno se muestra.

## Relieve y planialtimetría (`data/geo/relieve/`)

Landing 3D y 2D, mapa operativo (`/comando/mapa`) y mapa de sectores de `/informacion`. Se regenera con `python apps/backend/scripts/descargar_relieve.py` (sin claves; detalle por capa en `data/geo/manifiesto.json`, ids `relieve_cuenca` y `relieve_local`). Todo es `DOCUMENTO DE REFERENCIA`: no son cotas de inundación ni reemplazan la altura de escala de K10 (`SIMULADO`), que sigue siendo el único disparador del simulador.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Altitud de la cuenca (modelo de elevación, tinte hipsométrico y malla 3D) | De 39 a 892 m sobre el nivel del mar en el recuadro lon -62,8 a -54,0 y lat -28,0 a -14,2 (valores suavizados; es el rango de la leyenda). Celdas de ~1 km (zoom 7); error vertical de varios metros | AWS Terrain Tiles, formato terrarium: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`. Mosaico de varias fuentes; en la región, SRTM (NASA/USGS). Atribución en `data/geo/LEEME.md` | Referencia | descarga 18/11/2026 |
| Curvas de nivel de la cuenca | Cada 25 m hasta 200 m y cada 100 m por encima; maestras en 100, 200, 300, 500, 700 y 1.000 m (13 niveles entre 50 y 800 m). Suavizadas; no sirven para cotas | Derivadas del mismo modelo (`curvas_cuenca.geojson`, propiedad `elev_m`) | Referencia (derivado) | 18/11/2026 |
| Exageración vertical de la escena 3D | ×60 (los desniveles se amplían 60 veces para que se vean); se rotula en la leyenda. La vista 2D no exagera | Decisión de diseño (`EXAGERACION_VERTICAL` en `apps/frontend/src/relieve/datos.ts`) | Referencia (convención de representación) | 18/11/2026 |
| Relieve local y curvas del corredor de los sectores K10 | De 50 a 78 m (suavizado) en el recuadro lon -58,40 a -57,95 y lat -26,40 a -25,95; curvas cada 2 m (maestras cada 10 m); rampa de color propia (54 a 71 m, percentiles 2 y 98). Celdas de ~75 m; ruido del modelo de ~2 m y error vertical de varios metros: muestra el gradiente regional de la llanura, no cotas de inundación | AWS Terrain Tiles terrarium, zoom 11 (`curvas_local.geojson`, `tinte_local_mercator.png`) | Referencia | descarga 18/11/2026 |
| Río Paraguay (y Pilcomayo) en la landing | Línea del tronco desde las nacientes (Mato Grosso) hasta la confluencia con el Paraná, escala 1:10.000.000; puede apartarse varios kilómetros del cauce real. En esa fuente el tronco Paraguay-Paraná figura bajo un solo rasgo rotulado "Paraná" | Natural Earth 10m rivers + lake centerlines, dominio público: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson | Referencia | descarga 18/11/2026 |
| Límite provincial y nueve departamentos de Formosa sobre el relieve | `provincia.geojson`, `departamentos.geojson` (Bermejo, Formosa, Laishí, Matacos, Patiño, Pilagás, Pilcomayo, Pirané y Ramón Lista), simplificados a ~50 m | IGN, Capas SIG (WFS), descarga del 17/11/2026 (ver sección anterior) | Referencia | 17/11/2026 |
| Relieve fino de los sectores K10 (visualización de inundación de `/informacion`) | De 49,6 a 68,3 m (suavizado) en el recuadro lon -58,214 a -58,119 y lat -26,231 a -26,141 (los cuatro sectores más ~1 km de margen). Malla de 191 x 181 celdas de 0,0005° (~55 m), muestreada de tiles de zoom 14 (25 tiles) con suavizado gaussiano de 2 celdas. Son cotas del modelo (sobre el nivel del mar), no de la escala de Puerto Formosa; error vertical de varios metros (diferencia crudo-suavizado: 1,5 m) | AWS Terrain Tiles terrarium z14 (Mapzen Terrain Tiles; SRTM NASA/USGS y otras fuentes), `python apps/backend/scripts/descargar_relieve.py --sectores` → `data/geo/relieve/dem_sectores.json` y `apps/frontend/public/relieve/dem_sectores.json` | Referencia | descarga 20/11/2026 |
| Terrazas de color y curvas de nivel de la visualización de inundación | Una terraza (y una curva) cada 1 m de elevación del modelo; con un error vertical de varios metros, las terrazas muestran el orden relativo del terreno dentro de cada sector, no cotas exactas | Decisión de visualización (`INTERVALO_TERRAZA_M` en `apps/frontend/src/informacion/inundacion.ts`) | Referencia (convención de representación) | 20/11/2026 |
| Exageración vertical de la visualización de inundación | ×40; se rotula en la leyenda del bloque | Decisión de visualización (`EXAGERACION_INUNDACION`, mismo archivo) | Referencia (convención de representación) | 20/11/2026 |
| Tramo de llenado de cada sector | El agua de un sector empieza a dibujarse a (altura de compromiso K10 − 0,50 m) y cubre todo el sector a (compromiso + 1,00 m). El margen de 0,50 m es el SUPUESTO ya usado en el estado «en riesgo» (`supuestos.yaml`); el tramo de +1,00 m es un SUPUESTO de visualización (`TRAMO_VISUAL_M`). Dentro del sector se anegan primero las celdas de menor elevación del modelo. Ni la fracción anegada ni la profundidad son resultados hidráulicos | K10 v1.0 (altura_escala_compromiso_m) + supuestos de visualización; el relieve solo ordena dónde avanza el agua | Simulado | 20/11/2026 |
| Cauce dibujado como agua | Trazado de los cursos de agua del IGN (`cursos_agua.geojson`) en una franja de ±1 celda (~55 m, `RADIO_CAUCE_CELDAS`) con profundidad ilustrativa fija de 0,50 m: no cambia con la altura simulada y no representa el ancho real del río | IGN, Capas SIG (cursos de agua), descarga del 17/11/2026 | Referencia | 17/11/2026 |
| Profundidad mínima y grosor de la película de agua | Profundidad mínima visual de 0,15 m por celda anegada; la película se dibuja pegada al terreno con un grosor máximo de 0,5 m (ya exagerado) y el color indica la profundidad relativa (hasta 2,5 m). Solo ilustración | Decisión de visualización (`PROFUNDIDAD_MIN_M`, `GROSOR_VISUAL_M`) | Simulado | 20/11/2026 |
| Duración de «Reproducir crecida» | De 5,60 m (observado al corte) a 8,30 m (umbral de evacuación K3) en 8 s; es una animación del escenario SIMULADO, no un pronóstico de velocidad de ascenso | Decisión de visualización (`SectoresInundacion.tsx`) | Simulado | 20/11/2026 |

## Agua observada por satélite (`data/geo/satelite/`, capa del mapa operativo)

Imagen: Copernicus Sentinel-1/2 vía Planetary Computer (catálogo STAC, `sentinel-1-rtc` y `sentinel-2-l2a`; licencia de Copernicus, libre y gratuita; `sentinel-1-rtc` CC BY 4.0 de Microsoft), descarga del 20/11/2026 con `apps/backend/scripts/descargar_satelite.py`. La imagen es `DOCUMENTO DE REFERENCIA`; la **máscara de agua es un producto derivado** del equipo (Otsu sobre VV en dB para Sentinel-1; MNDWI con máscara de nubes SCL para Sentinel-2; resolución de trabajo de 20 m), sin validación a campo: puede confundir suelo húmedo, bañados o vegetación inundada, y las áreas de S1 y S2 no son comparables entre sí. «Agua» es el área de agua dentro de la zona de trabajo (lon -58,40 a -57,95; lat -26,40 a -25,95), no el área de un sector. La altura de K1 es el máximo diario de Puerto Formosa del día de la imagen (`DATO OBSERVADO`). Ninguna escena es posterior al corte del 31/10/2026.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Agua observada 09/01/2016 (Sentinel-1, radar): pico de 2016, cuatro días después del máximo | 243,07 km²; K1 9,80 m; nube n/c (radar); cobertura de la zona 80,2 % | `data/geo/satelite/agua_s1_2016-01-09.geojson`; Planetary Computer, `sentinel-1-rtc` | Referencia (imagen) · producto derivado (máscara) | 09/01/2016 |
| Agua observada 23/01/2016 (Sentinel-2, óptico): descenso posterior al pico | 208,22 km²; K1 9,40 m; nube 0,1 %; cobertura 99,4 % | `agua_s2_2016-01-23.geojson`; Planetary Computer, `sentinel-2-l2a` | Referencia (imagen) · producto derivado (máscara) | 23/01/2016 |
| Agua observada 28/05/2019 (Sentinel-1): subida previa al pico de 2019 | 277,60 km²; K1 9,64 m; nube n/c; cobertura 100,0 % | `agua_s1_2019-05-28.geojson`; `sentinel-1-rtc` | Referencia (imagen) · producto derivado (máscara) | 28/05/2019 |
| Agua observada 03/06/2019 (Sentinel-2): pico de 2019, un día después del máximo | 141,75 km² (parcial); K1 9,72 m; nube 28,2 %; cobertura 46,4 % | `agua_s2_2019-06-03.geojson`; `sentinel-2-l2a` | Referencia (imagen) · producto derivado (máscara) | 03/06/2019 |
| Agua observada 07/10/2019 (Sentinel-1): línea de base de aguas bajas | 71,96 km²; K1 2,07 m; nube n/c; cobertura 100,0 % | `agua_s1_2019-10-07.geojson`; `sentinel-1-rtc` | Referencia (imagen) · producto derivado (máscara) | 07/10/2019 |
| Agua observada 09/10/2019 (Sentinel-2): línea de base de aguas bajas | 67,13 km²; K1 2,07 m; nube 0,0 %; cobertura 99,9 % | `agua_s2_2019-10-09.geojson`; `sentinel-2-l2a` | Referencia (imagen) · producto derivado (máscara) | 09/10/2019 |
| Agua observada 25/10/2026 (Sentinel-1): octubre de 2026, previo al corte | 79,84 km²; K1 5,40 m; nube n/c; cobertura 100,0 % | `agua_s1_2026-10-25.geojson`; `sentinel-1-rtc` | Referencia (imagen) · producto derivado (máscara) | 25/10/2026 |
| Agua observada 26/10/2026 (Sentinel-2): octubre de 2026, previo al corte | 42,63 km² (parcial); K1 5,44 m; nube 24,7 %; cobertura 47,1 % | `agua_s2_2026-10-26.geojson`; `sentinel-2-l2a` | Referencia (imagen) · producto derivado (máscara) | 26/10/2026 |
| Resumen por fecha que muestra el selector de la capa | Los mismos valores, generados por `apps/frontend/scripts/preparar-datos.mjs` desde `resumen.csv` y `manifiesto.json` (sin recalcular) | `data/geo/satelite/resumen.csv`, `manifiesto.json` | Referencia (imagen) · producto derivado (máscara) | 20/11/2026 |

## Portal público: Información (El Niño) y esquema de la cuenca (`apps/frontend`)

Cifras verificadas el 18/11/2026 contra los archivos fuente (`K9_fuentes.md`; boletín SMN N.º 8 en PDF; pronóstico agroclimático en PPTX). Los datos de contacto de la fuente del pronóstico agroclimático no se reproducen.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| El SMN confirma la fase El Niño | 100 % de probabilidad para septiembre-noviembre | SMN / DNPHyCF, Boletín N.º 1 sobre El Niño, vía K9 (`K9_fuentes.md`): https://www.cohife.org.ar/wp-content/uploads/2026/09/INFORME-el-Nino-Nro1-040926.pdf | Referencia | 04/09/2026 |
| Probabilidad de evento fuerte o muy fuerte | 83 % en octubre-diciembre, con persistencia hasta el verano | NOAA, Climate Prediction Center, Discusión ENSO (versión en español), vía K9: https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc_Sp.shtml | Referencia | 08/10/2026 |
| Permanencia en fase El Niño | 100 % de probabilidad de permanencia en octubre-noviembre-diciembre de 2026 | SMN y COHIFE (Dirección Nacional de Política Hídrica y Coordinación Federal), Boletín El Niño N.º 8, publicado el 22/10/2026, pronósticos emitidos al 20/10/2026 (PDF `BOLETIN el Niño_22-10-2026.pdf`, carpeta IA-Lab) | Referencia | 22/10/2026 |
| Pronóstico agroclimático estacional 2026/27 Formosa: modelo y período | CFS v2 (NOAA), ensamble de 20 miembros (corridas), período noviembre de 2026 a julio de 2027 | Informe "Pronóstico Climático Estacional 2026/27 Formosa", emisión 29/10/2026 (`20261029 Formosa.pptx`, carpeta IA-Lab; informe de un tercero, orientativo y probabilístico) | Referencia | 29/10/2026 |
| Precipitación proyectada CFS v2 (Nov 2026 – Jul 2027) y serie mensual | Acumulado proyectado 1.623 mm frente a normal histórica 1.229 mm (+394 mm). Serie mensual proyectada / normal (mm): Nov 198/160 (+38), Dic 214/168 (+46), Ene 216/172 (+44), Feb 245/162 (+83), Mar 308/175 (+133, pico), Abr 246/182 (+64), May 80/110 (-30), Jun 68/58 (+10), Jul 48/42 (+6) | Mismo informe (`20261029 Formosa.pptx`, tabla de precipitación mensual proyectada vs. normal histórica 1991-2020) | Referencia | 29/10/2026 |
| Índice ONI proyectado | Pico estimado +2,2; probabilidad de ONI >= +2,0 °C: 93 % (SON-OND-NDJ) | Mismo informe, diapositiva "Contexto ENSO". La diapositiva de análogos históricos del mismo informe indica +2,3 y 99 %; el portal usa la cifra de la diapositiva de contexto | Referencia | 29/10/2026 |
| Campañas El Niño y tercio húmedo en Formosa | 8 de 14 campañas Niño en el tercio húmedo y una sola en el seco (45 campañas, 1981/82 a 2025/26); la fase ENOS cambia las probabilidades, no decide la campaña | Mismo informe, diapositiva "La fase ENSO cambia las probabilidades" | Referencia | 29/10/2026 |
| Hitos de la cuenca (landing 3D y alternativa 2D) | Pantanal (-57,50; -17,80, posición aproximada sobre el río), Mato Grosso (nacientes del Paraguay, extremo norte de la línea de Natural Earth: -55,08; -14,32), Asunción (-57,63; -25,28, aproximada), confluencia con el Paraná (-58,57; -27,30, aproximada). Las estaciones usan las coordenadas oficiales de K3 | `apps/frontend/src/landing/geometria.ts`; relaciones hidrográficas auditadas contra K7 | Referencia (ubicación aproximada de los hitos) | 18/11/2026 |
| Esquema de respaldo de la cuenca | Esquema ilustrativo (cursos digitalizados a mano), que solo se muestra si no cargan los archivos de relieve; se rotula "Esquema ilustrativo, no a escala cartográfica" | `apps/frontend/src/landing/geometria.ts` | Simulado (esquema ilustrativo, no cartografía) | 18/11/2026 |

## Fase 3: panel operativo (`apps/frontend`)

Cada cifra del panel muestra su categoría y, cuando corresponde, su fuente y fecha. El panel no agrega cifras propias: muestra lo que devuelve la API (K1, K3, K10 y los supuestos de la Fase 2) y estas.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Monitor: última lectura, umbrales de alerta y evacuación, picos | 5,60 m (31/10/2026); 7,80 m y 8,30 m; 9,81 m (2016) y 9,72 m (2019) | K1 limpio y K3, vía `GET /serie/formosa` | Observado | 31/10/2026 |
| Monitor: velocidades de ascenso y tiempo restante | Mayores subas en 1 y 7 días, cruces de umbrales y rango de días hasta cada umbral, vía `GET /serie/ascenso`; proyección lineal a tasa constante | K1 y K3; compromisos de K10 | Observado (series y umbrales) y simulado (proyección y compromisos K10) | 31/10/2026 |
| Auditoría de la limpieza de K1 (Centinela) | 12 duplicados, 40 fechas en otro formato, 3 comas decimales, 7 valores en cm, 1 valor imposible en cuarentena, 141 negativos, 432 días con varias mediciones, 25 días de hueco en 2018, 131 días sin dato en total; 8335 registros finales | `docs/registro_limpieza.md` (resumen en `apps/frontend/src/datos/auditoriaK1.ts`) | Observado (con alteraciones pedagógicas) | 31/10/2026 |
| Capas oficiales del mapa (recorte lon -58,60 a -57,80 y lat -26,50 a -25,85) | Red vial OSM (12.987 tramos), localidades y parajes (22), escuelas (349), establecimientos de salud (149), comisarías y destacamentos (26) y cursos de agua (108 entidades); cada capa se muestra con su fuente, licencia y fecha de actualización (17/11/2026) | Copias recortadas en `apps/frontend/public/capas/` generadas por `scripts/preparar-datos.mjs` desde `data/geo/` (IGN, BAHRA/INDEC, Mapa Educativo, REFES, OpenStreetMap; ver sección anterior) | Referencia | descarga 17/11/2026 |
| Establecimientos de salud en el mapa | Ubicación aproximada: centroide de la localidad, porque REFES no publica coordenadas | REFES, Ministerio de Salud (27/12/2024), centroides de Georef | Referencia | descarga 17/11/2026 |
| Sectores, accesos, centros de recepción y su capacidad, rutas, escenario, ISAD, recomendaciones y alternativas | Los devuelve la API; K10 sin cambios; todo lo demás con los supuestos de `supuestos.yaml` | K10 y supuestos de la Fase 2 | Simulado | 12/11/2026 (K10) |
| Verificador de K7 sobre la capa del IGN | El Pilcomayo y el Bermejo están a 142,1 km en su punto más cercano; el Pilcomayo termina a 5,6 km del trazo del Paraguay; el Bermejo llega al Paraguay a la latitud -26,866 (Puerto Formosa está en -26,183, aguas arriba); Clorinda está a 1,7 km del Pilcomayo y a 14,4 km del trazo del Paraguay | `data/geo/cursos_agua.geojson` (IGN) y `localidades_parajes.geojson` (BAHRA), distancias calculadas por `app/domain/hidrografia.py` con proyección equirrectangular local; la capa de Formosa no incluye el Paraná ni Corrientes | Referencia | descarga 17/11/2026 |


## Fase 6: auditoría final de cifras visibles (web, app y API)

Se recorrieron las fuentes de la web (`apps/frontend/src`), de la app (`apps/mobile/src`) y las respuestas del backend en busca de cifras escritas a mano o devueltas al usuario. Las que no figuraban se agregan abajo. Las demás cifras ya estaban cubiertas por las secciones anteriores.

| Qué muestra la herramienta | Valor o rango | Fuente (archivo del kit o URL) | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Horizonte máximo de la proyección del tiempo restante | 60 días | Supuesto `dias_proyeccion_horizonte` (`supuestos.yaml`); el INA no pronostica a más de 15 días | Simulado | 17/11/2026 |
| Rango de los controles del simulador | Altura de 0 a 12 m (validación del backend); lluvia de 0 a 200 mm en el deslizador (el backend admite de 0 a 1.000 mm) | CLAUDE.md §8.1 (rango de entrada); no son datos | Simulado | 17/11/2026 |
| Ubicación de ejemplo en el formulario de registro de productores | Longitud -58,139 y latitud -26,18 (dentro de S4) | Punto de ejemplo elegido por el equipo dentro del polígono K10 de S4; no corresponde a una parcela ni a una persona | Simulado | 17/11/2026 |
| Límites de validación de formularios | Integrantes 1 a 40; menores y mayores 0 a 40; mascotas 0 a 100; contraseña mínimo 10 caracteres; nombre de establecimiento 2 a 160 caracteres; cantidad de hacienda 0 a 100.000; planilla UPCA hasta 5 MB y 5.000 filas; foto hasta 2 MB y 5 por solicitud (JPEG, PNG o WebP) | Reglas de validación del equipo (`esquemas.py`, `settings.py`); no son datos | Simulado | 17/11/2026 |
| Checklist en destino de Arca Productiva | Revisar el potrero por mío-mío, ofrecer agua y forraje, acostumbramiento gradual al grano, sales minerales con fósforo y calcio, lotes de hasta 200 cabezas, prevención de leptospirosis, rabia paresiante, pietín y tristeza bovina | Documento base del equipo ("Plataforma de Evacuación en Formosa.docx", sección de damnificado tipo 3A, que cita fuentes INTA y SENASA); a verificar. El plazo "control sanitario a los 7 días" no figura en ese documento: es una pauta del equipo, SUPUESTO | Simulado | 17/11/2026 |
| Apicultura en el cálculo ganadero | Colmenas vivas y muertas; traslado vehicular (cubierto y ventilado) o a pie (grupos reducidos por corredores altos); no hay cifras propias | Documento base del equipo, sección de apicultura; a verificar | Simulado | 17/11/2026 |
| Descripción del proceso de llegada del agua (página Información, tema El Niño) | El Pantanal retiene y entrega el agua con demora; el remanso del Paraná frena el desagüe en la confluencia; la lluvia local sobre suelos arcillosos de muy baja pendiente anega caminos y campos | Documento base del equipo ("Plataforma de Evacuación en Formosa.docx", capítulo hidrológico: retardo amortiguador del Pantanal, remanso del Paraná y amenazas endógenas); no es una fuente oficial del kit y no sirve para fechar una crecida | Referencia (documento del equipo, a verificar) | 18/11/2026 |

### Afirmaciones sin fuente verificada (declaradas, no se inventó una fuente)

Estas frases aparecen en la página `/informacion` (`apps/frontend/src/pages/Informacion.tsx`; la ruta anterior `/el-nino` redirige a ella) y no tienen una fuente oficial del kit que las respalde con esa precisión. Hasta resolverlas, deben leerse como descripción general del equipo:

1. **"rezago de semanas a meses"** entre la lluvia y la crecida en Puerto Formosa. El documento base del equipo habla de una demora de 3 a 4 meses del pico dentro del Pantanal y de respuesta "de días a pocas semanas" aguas abajo; el rango "semanas a meses" es una síntesis del equipo, sin cifra oficial.
2. ~~"avisa con semanas de anticipación"~~ — **corregida**: ahora dice "se sigue con las escalas del INA, que no publica pronósticos a más de 15 días (K9)". Fuente: K9 (DOCUMENTO DE REFERENCIA).
3. ~~"anega caminos y campos en horas"~~ — **corregida**: ahora dice "con muy poco margen de aviso (alrededor de 24 horas según el documento base del equipo)". Fuente: documento base del equipo (`DocumentoBase-IA-Lab-Evacuaciones.docx`); es una estimación del equipo, no una cifra oficial.

Fuentes externas consultadas en la Fase 6: ninguna nueva (solo los archivos del kit, la carpeta `IA-Lab` y el documento base del equipo, ya citados).

## Números de emergencia (app móvil y respuestas por SMS)

| Qué muestra la herramienta | Valor | Fuente (URL) | Categoría | Fecha de consulta |
|---|---|---|---|---|
| Defensa Civil | 103 | https://www.argentina.gob.ar/tema/emergencias | Documento de referencia | 19/11/2026 |
| Prefectura Naval Argentina (emergencia náutica) | 106 | https://www.argentina.gob.ar/tema/emergencias | Documento de referencia | 19/11/2026 |
| Policía / emergencias | 911 | https://www.argentina.gob.ar/tema/emergencias | Documento de referencia | 19/11/2026 |
| Emergencias ambientales | 105 | https://www.argentina.gob.ar/tema/emergencias | Documento de referencia | 19/11/2026 |

## Seguimiento de la cuadrilla ("Cuadrilla en camino")

| Qué muestra la herramienta | Valor | Fuente | Categoría | Fecha |
|---|---|---|---|---|
| Velocidad media de la cuadrilla para estimar la llegada | 40 km/h | Supuesto `velocidad_cuadrilla_kmh` (`supuestos.yaml`); sin fuente pública, mezcla pavimento, ripio y tierra | Simulado (SUPUESTO) | 20/11/2026 |
| Factor de desvío de la distancia por calle | 1,3 | Supuesto `factor_desvio` (`supuestos.yaml`, ya citado en el ruteo) | Simulado (SUPUESTO) | 20/11/2026 |
| Minutos para avisar que la posición es vieja | 5 min | Supuesto `posicion_vieja_minutos` (`supuestos.yaml`) | Simulado (SUPUESTO) | 20/11/2026 |
| Minutos tras los que la posición de la cuadrilla vence (no se muestra y se borra) | 30 min | Supuesto `posicion_vencida_minutos` (`supuestos.yaml`); retención mínima (Ley 25.326) | Simulado (SUPUESTO) | 20/11/2026 |
| Modo demostración del seguimiento (el servidor simula la posición de la cuadrilla en camino) | activado | Supuesto `seguimiento_demo` (`supuestos.yaml`); rotulado `SIMULADO` en pantalla; la posición real siempre gana; se apaga con `false` | Simulado | 20/11/2026 |
| Base de salida SIMULADA de las cuadrillas | lon -58,176; lat -26,200 | Supuesto `base_cuadrillas_simulada` (`supuestos.yaml`): punto en el ejido urbano de Formosa, no es una institución real | Simulado (SUPUESTO) | 20/11/2026 |
| Método de la ruta de la cuadrilla al pedido | `red_vial` o `aproximado` | pgRouting sobre `red_vial` (OSM, ODbL, `DOCUMENTO DE REFERENCIA`) con el perfil del vehículo y los caminos cerrados; sin red, recta por `factor_desvio`; la lancha, recta a `velocidad_lancha_kmh` (15 km/h, SUPUESTO) | Simulado (SUPUESTO) | 20/11/2026 |
| Intervalo mínimo entre posiciones de una cuadrilla | 10 s | Supuesto `intervalo_min_posicion_s` (`supuestos.yaml`); límite de frecuencia del backend | Simulado (SUPUESTO) | 20/11/2026 |
| Intervalo de envío de la posición desde la app y de refresco de las pantallas | 30 s (envío) y 20 s (refresco) | Decisión de diseño del equipo, no un dato | Simulado (SUPUESTO) | 20/11/2026 |
| Distancia y llegada estimada que ve el solicitante ("unos 12 min") | Calculadas con los supuestos anteriores | Posición compartida por la cuadrilla (SIMULADO en la demo); es una estimación, no una promesa | Simulado (SUPUESTO) | 20/11/2026 |


## Lámina de agua ilustrativa del simulador (`apps/frontend/src/panel/lamina.ts`)

La lámina no es un modelo hidráulico: dibuja cuánto supera la altura de Puerto Formosa elegida en el simulador la altura de compromiso de cada sector. Todo lo que muestra es `SIMULADO`.

| Qué muestra la herramienta | Valor | Fuente | Categoría | Fecha |
|---|---|---|---|---|
| Excedente por sector (altura elegida menos compromiso) | S1 8,10 m · S2 8,60 m · S3 7,90 m · S4 7,50 m de compromiso | K10 (alturas ya citadas arriba); resta con la altura del deslizador | Simulado | 20/11/2026 |
| Sector en riesgo (borde ámbar) | A 0,50 m o menos del compromiso | Supuesto `margen_riesgo_m` (ya citado arriba); el frontend lo repite para responder sin consultar al servidor en cada cambio | Simulado (SUPUESTO) | 20/11/2026 |
| Altura exagerada de la lámina | ×150 (150 m dibujados por cada metro de excedente) | Parámetro de visualización del equipo, no una medida; solo se nota al inclinar el mapa | Simulado (parámetro de visualización) | 20/11/2026 |
| Excedente en que el color deja de oscurecerse | 3 m | Parámetro de visualización del equipo, no una medida | Simulado (parámetro de visualización) | 20/11/2026 |
| Hitos de "Reproducir subida" | Dato del corte 5,60 m → compromiso de S4 7,50 m → alerta 7,80 m → evacuación 8,30 m | Corte: K1 (31/10/2026, Observado); 7,50 m: K10; 7,80 y 8,30 m: K3 | Observado (corte y umbrales) y Simulado (la subida) | 31/10/2026 |
| Duración de "Reproducir subida" | 7 s | Parámetro de visualización del equipo, no un pronóstico de tiempo | Simulado (parámetro de visualización) | 20/11/2026 |
| Accesos cortados (trazo rojo discontinuo) | Estado del acceso devuelto por `/simulacion/escenario`: tierra desde 30 mm y ripio desde 80 mm de lluvia, cerrado por el operador o anegado | Supuestos de lluvia por superficie ya citados arriba; no se recalculan en el frontend | Simulado (SUPUESTO) | 17/11/2026 |

## Panel personal del ciudadano (pedidos, vehículo y respuestas)

| Qué muestra la herramienta | Valor | Fuente | Categoría | Fecha |
|---|---|---|---|---|
| Vehículo de la cuadrilla en camino | `4x4`, `camion_jaula`, `colectivo`, `lancha` o `moto` (demo: 4x4 para la cuadrilla humana y camión jaula para la ganadera) | `data/simulado/cuadrillas.json`; no hay padrón público de vehículos de emergencia | Simulado | 20/11/2026 |
| Línea de tiempo de un pedido (recibida, verificada, asignada, en curso, resuelta) | Horas tomadas de los registros del sistema (alta del pedido, bitácora de cambios de estado, tarea y constancia); si un estado se alcanzó sin registro de hora, se muestra sin hora | Base de datos de la plataforma (pedidos de demostración, personas ficticias) | Simulado | 20/11/2026 |
| Rol de la cuadrilla asignada | `encargado_cuadrilla` u otro rol del catálogo, nunca el nombre de una persona | Catálogo `roles_operativos` (sin funcionarios reales) | Simulado | 20/11/2026 |
| Respuestas de confirmación del evacuado | `completa`, `parcial`, `no_encontraron`, `no_vinieron`, `otro_problema` | Decisión de diseño del equipo (20/11/2026); es una marca para revisar, no una acusación | Simulado | 20/11/2026 |

## Partes de las cuadrillas y panel de cuadrillas

| Qué muestra la herramienta | Valor | Fuente | Categoría | Fecha |
|---|---|---|---|---|
| Partes de una tarea (avance, dificultad, resultado `completa`, `parcial`, `no_realizada` o `reprogramada`) y su observación | Texto libre de la cuadrilla; el autor figura por su rol operativo, nunca por nombre. Los dos partes de demostración (una dificultad sin resolver y un resultado parcial, en S4) son datos de ejemplo | Base de datos de la plataforma (`data/`, seed `sembrar_partes_demo`); no hay padrón público de partes de campo | Simulado | 20/11/2026 |
| Cuadrillas, sus designados y la tarea actual | Rol operativo de cada integrante del catálogo `roles_operativos`; `usuario_id: null` es un rol sin persona designada | `data/simulado/cuadrillas.json` y altas hechas desde el panel (usuarios de demostración, sin personas reales) | Simulado | 20/11/2026 |
| Novedad de un pedido (`demora`, `dificultad`, `parcial`, `no_realizada`, `reprogramada`) | Se deriva de los partes de la tarea; `demora` se activa cuando la última posición compartida supera `posicion_vencida_minutos` (30 min, SUPUESTO) | Partes de la cuadrilla y `apps/backend/app/config/supuestos.yaml` | Simulado (SUPUESTO) | 20/11/2026 |

## Caudal modelado del río Paraguay (GloFAS) (`data/processed/glofas_*.json`)

Descargado el 20/11/2026 con `apps/backend/scripts/descargar_glofas.py` (Open-Meteo Flood API, datos GloFAS v4 del Copernicus Emergency Management Service, CC BY 4.0, uso no comercial). Es caudal **modelado** en m³/s: no es altura de escala ni un pronóstico oficial, y no se convierte a metros porque el kit no trae una curva altura-caudal oficial. La API no permite pedir el pronóstico tal como se emitió el 31/10/2026, por eso hasta el corte solo se muestra caudal modelado (sin banda de incertidumbre). Mostrado en el Monitor del panel y en Información.

| Qué muestra la herramienta | Valor | Fuente | Categoría (observado / referencia / simulado) | Fecha del dato |
|---|---|---|---|---|
| Caudal diario modelado en Puerto Formosa (celda 26,175° S, 58,175° O; el punto K3 es 26,183° S, 58,183° O y la API toma la celda más cercana de ~5 km) | Serie de 7.609 días, 01/01/2006 a 31/10/2026 | GloFAS v4 vía https://flood-api.open-meteo.com/v1/flood (`river_discharge`, `timezone=GMT`) | Referencia | 31/10/2026 (descarga 20/11/2026) |
| Caudal modelado al corte | 2.083,49 m³/s | Ídem | Referencia | 31/10/2026 |
| Pico modelado de 2016 | 15.738,83 m³/s (26/03/2016) | Ídem; máximo del año calculado sobre la serie | Referencia | 26/03/2016 |
| Pico modelado de 2019 | 9.637,29 m³/s (07/04/2019) | Ídem; máximo del año calculado sobre la serie | Referencia | 07/04/2019 |
| Caudal modelado en Puerto Pilcomayo (celda 25,375° S, 57,675° O) | 1.948,84 m³/s al 31/10/2026; picos 15.065,07 m³/s (26/03/2016) y 9.483,18 m³/s (07/04/2019) | Ídem | Referencia | 31/10/2026 |
| Fechas de los picos de caudal frente a las alturas de K1 (9,81 m el 05/01/2016; 9,72 m el 02/06/2019) | No coinciden: son series distintas (modelo de ~5 km frente a lectura de escala) y se muestran por separado, con su categoría | GloFAS; K1 | Referencia / Observado | — |
| Datos posteriores al corte (ensamble p25, p75, mín., máx., mediana, 01/11/2026 a 31/01/2027) | Apagados por defecto (`PERMITIR_DATOS_POST_CORTE=false`). Si se activan: ejecución vigente al 20/11/2026, no el pronóstico emitido el 31/10; la banda refleja solo la dispersión entre miembros del ensamble | Ídem | Referencia | Posterior al corte (descarga 20/11/2026) |

## Gestión completa de cuadrillas

| Qué muestra la herramienta | Valor | Fuente | Categoría | Fecha |
|---|---|---|---|---|
| Equipamiento sugerido por tipo operativo (ruedas de auxilio, palas, cadenas, sogas, chalecos salvavidas, botiquín, linternas, bidones de agua, forraje, bebederos, mangas portátiles, jaulas, lonas, generador, etc.) | Lista por tipo operativo (`personas`, `familias`, `productores_ganado`, `apicola`, `bienes`, `traslado_mixto`) | Supuesto `cuadrillas_plantillas` (`supuestos.yaml`); sin fuente normativa: el operador confirma la composición real | Simulado (SUPUESTO) | 20/11/2026 |
| Profesiones sugeridas por tipo operativo (equipo interdisciplinario) | Medicina, enfermería, veterinaria, zootecnia, trabajo social, policía, bomberos, defensa civil, prefectura, chofer, técnico de energía, logística | Supuesto `cuadrillas_plantillas`; la correspondencia profesión a rol del catálogo `roles_operativos` es del equipo (`app/domain/cuadrillas.py`) | Simulado (SUPUESTO) | 20/11/2026 |
| Los tres equipos interdisciplinarios de demostración (A, B y C): integrantes, profesiones, vehículo, equipamiento y base | Cada integrante figura por rol y profesión; sin nombres de personas; vehículo, equipamiento y base inventados | `data/simulado/cuadrillas.json`; no hay padrón público de cuadrillas de emergencia ni de sus vehículos | Simulado | 20/11/2026 |
| Base de cada cuadrilla de demostración | Un punto en el ejido urbano de Formosa (lon -58,183 a -58,170; lat -26,215 a -26,185) | `data/simulado/cuadrillas.json`; no es la ubicación de ninguna institución real | Simulado | 20/11/2026 |
| Avisos de demostración a la cuadrilla (un desvío de camino cerca del Sector Rural Este y qué llevar) | Texto, lista de ítems y trazo del desvío de ejemplo | `data/simulado/cuadrillas.json` (seed `sembrar_avisos_demo`); el trazo no es un camino real | Simulado | 20/11/2026 |
| Topes de la evidencia multimedia de un parte | Fotos JPEG, PNG o WebP de hasta 5 MB; video MP4 de hasta 20 MB; hasta 5 por parte | Supuesto `adjuntos_parte` (`supuestos.yaml`); decisión del equipo, sin norma | Simulado (SUPUESTO) | 20/11/2026 |
| Ruta y destino de cada cuadrilla en el mapa del panel | Ruta de la posición (o de la base) al pedido de su tarea en curso; método `red_vial` o `aproximado` | Misma fuente y supuestos que la "Cuadrilla en camino" (pgRouting sobre `red_vial`, `factor_desvio`, `velocidad_cuadrilla_kmh`, `seguimiento_demo`) | Simulado (SUPUESTO) | 20/11/2026 |
