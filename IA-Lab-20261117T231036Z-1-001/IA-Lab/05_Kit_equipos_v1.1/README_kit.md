# Kit de la misión · AI LAB Misión: Código Formosa · Operación Agua — Cinco herramientas para El Niño
Fecha de corte de datos: 31/10/2026 · Preparado por el CITF – Clúster de Innovación Tecnológica Formosa

Materiales de referencia para los proyectos. Cada equipo selecciona los insumos pertinentes al tema y documenta las fuentes adicionales necesarias. Cada archivo tiene una categoría: **Dato observado** (series y umbrales oficiales), **Documento de referencia** (reportes, boletines, cartografía) o **Simulado** (material creado para la actividad). Las herramientas deben mostrar la categoría de cada dato que usan.

| Código | Archivo | Categoría | Contenido | Disponibilidad |
|---|---|---|---|---|
| K1 | `kit/P1_DATA_INTEGRITY_dataset_participantes_v1.csv` + `kit/LEEME_P1_PARTICIPANTES.txt` | Dato observado | Serie de altura hidrométrica de Puerto Formosa 2006 → 31/10/2026 (descarga INA preparada por Push Software, 8.347 registros), tal como se entrega: con filas repetidas, un tramo en otra unidad, fechas en formatos distintos, huecos, al menos un valor imposible y comas decimales. También tiene valores negativos y días con varias mediciones, que son reales. Limpiarla y documentar la limpieza es parte del trabajo. | **Listo** |
| K2 | `kit/K2_pilcomayo_alturas.csv` | Dato observado | Serie de Puerto Pilcomayo (siteCode 55), mismo período, limpia. | Pendiente: misma descarga de la API con siteCode=55 (URL en K9), sin alteraciones |
| K3 | `kit/K3_estaciones_umbrales.json` | Dato observado | Código, nombre, coordenadas y niveles de aguas bajas, alerta y evacuación de ambas estaciones (catálogo INA, consultado el 29/10/2026). | **Listo** |
| K4 | `kit/K4_reporte_INA_2026-10-31.pdf` | Documento de referencia | Reporte diario del INA del día de corte. | Descargar de la URL indicada en K9 |
| K5 | `kit/K5_boletin_ENSO.pdf` | Documento de referencia | Boletín SMN/DNPHyCF N.º 1 (4/9/2026) + extracto de la discusión NOAA (8/10/2026). | Descargar de las URL indicadas en K9 y unir en un PDF |
| K6 | `kit/K6_informe_IA.pdf` | Simulado | Informe sobre el río “generado por IA” con afirmaciones ciertas, falsas y no verificables. | **Listo** |
| K7 | `kit/K7_red_hidrografica.pdf` | Simulado (el mapa base IGN es de referencia) | Esquema de la red hidrográfica con siete relaciones a auditar y enlaces a la cartografía oficial. | **Listo** |
| K8 | `kit/K8_escenarios.pdf` | Simulado | Recomendación genérica de IA, escenarios A/B/C del Comité de la Misión, sectores simulados y campos de la bitácora. | **Listo** |
| K9 | `kit/K9_fuentes.md` | Documento de referencia | Lista de fuentes admitidas con URL y fecha de consulta. | **Listo** |
| K10 | `kit/K10_sectores_simulados.geojson` | Simulado | Cuatro polígonos ficticios con altura de escala de compromiso, población y acceso simulados (EPSG:4326). | **Listo · a validar por la mesa** |

## Cómo completar K2, K4 y K5 (una sola vez, en una máquina con internet)
- **K2:** abrir en el navegador la URL de la API indicada en K9 con `siteCode=55`, guardar como `K2_pilcomayo_alturas.csv` (sin alteraciones; conservar el archivo tal cual). Opcional: `python3 src/preparar_kit.py descargar --corte 2026-10-31` baja ambas estaciones y el catálogo en `original/`.
- **K4:** descargar el reporte diario del INA del 31/10/2026 (URL en K9) y guardarlo como `K4_reporte_INA_2026-10-31.pdf`.
- **K5:** descargar el boletín SMN/DNPHyCF del 4/9/2026 (COHIFE) y guardar la discusión ENSO de la NOAA del 8/10/2026 como PDF; unir ambos en `K5_boletin_ENSO.pdf`.

## Claves (no van a los equipos)
El archivo `claves_K1_P4.json`, la serie limpia de referencia y la serie diaria se entregan por separado al CITF, a la mesa evaluadora y a Push para la revisión de entregas del 21/11.

## Para publicar el kit
1. Completar K1–K5.
2. Calcular el SHA-256 de cada archivo y anotarlo en la tabla de la plataforma.
3. Subir `kit/` completo a la plataforma de Push; los equipos lo reciben al iniciar el desarrollo el 16/11.

## Plantillas de entrega (carpeta `plantillas/`)
- `ficha_tecnica.md` · una página por herramienta: usuario, qué funciona, qué falta, cómo está hecha, límites.
- `ficha_fuentes.md` · cada cifra, umbral y capa con su fuente y categoría.
- `registro_limpieza.md` · qué se encontró en K1 y cómo se resolvió.

## Reglas que viajan con el kit
- Toda pantalla, video y ficha lleva la leyenda “PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial”.
- Ningún dato del kit se altera; si se limpia, se documenta.
- Nada se publica con datos posteriores al 31/10/2026 sin decisión de la mesa.

## Temas sugeridos

- Atajaderos
- Imágenes satelitales
- Evacuaciones
- Reportes y detección de incidentes
- Reporte pluvial
- Reservorios
- Predicción de afectaciones
- Datos de caudales
- Altura de riachos
- Nivel de sedimento del río Pilcomayo

El kit contiene series y ejemplos educativos específicos. El README identifica los archivos pendientes. Cada equipo declara las fuentes y datos disponibles para su tema.

## Entrega de software

Frontend y backend en un monorepo GitHub, stack libre. Entregar URL y commit o tag, README de ejecución, datos de ejemplo, video y fichas. Consultar 07_Entrega_Tecnica_Software.pdf.

## Calendario y cierre

16/11 al 21/11: desarrollo de los proyectos.
Miércoles 18/11: mentoría técnica sobre software.
Jueves 19/11: mentoría técnica sobre el fenómeno El Niño.
Los horarios de ambas mentorías se confirmarán internamente.
Sábado 21/11 desde las 10:00: cierre con exposición de póster y pitch de 3 minutos por equipo. Horarios de Formosa.

El cierre de entrega es el 21/11. Cada equipo presenta póster, pitch de 3 minutos y los materiales de software indicados en el documento base.
