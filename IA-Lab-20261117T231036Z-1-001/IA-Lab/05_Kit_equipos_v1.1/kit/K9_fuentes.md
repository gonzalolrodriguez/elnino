# K9 · Fuentes admitidas
AI LAB Misión: Código Formosa · Operación Agua — Cinco herramientas para El Niño
Categoría: documento de referencia · Fecha de corte de datos: 31/10/2026 · Fecha de consulta de las URL: 29/10/2026

Esta es la lista de fuentes oficiales sobre las que se construyó el kit. Una cifra que la herramienta muestre debe poder rastrearse hasta un archivo del kit o hasta una de estas URL. Otras fuentes valen si se citan con URL y fecha de consulta.

## Datos hidrométricos
| Fuente | Qué aporta | URL | Acceso |
|---|---|---|---|
| INA – Sistema de Información y Alerta Hidrológico · API de datos | Altura hidrométrica diaria de Puerto Formosa (siteCode 57) y Puerto Pilcomayo (siteCode 55), red de escalas de Prefectura Naval, desde 2006 | https://alerta.ina.gob.ar/pub/datos/datos&timeStart=2006-01-01&timeEnd=2026-10-31&siteCode=57&varId=2&format=csv (cambiar siteCode=55 para Puerto Pilcomayo) | Público, sin registro |
| INA · Catálogo de estaciones | Código, nombre, coordenadas, niveles de aguas bajas, alerta y evacuación | https://alerta.ina.gob.ar/pub/datos/estaciones&format=json | Público |
| INA · Reporte diario | Alturas, tendencia y pronóstico a 7–15 días para las estaciones del Paraguay | https://alerta.ina.gob.ar/ina/06-INFORMES/diario/pdf/reporte_diario_2026-10-31.pdf (patrón de nombre: reporte_diario_AAAA-MM-DD.pdf) | Público |
| INA · Portal | Página de ingreso al sistema de alerta | https://alerta.ina.gob.ar/ | Público |

## Clima y El Niño
| Fuente | Qué aporta | URL |
|---|---|---|
| SMN / DNPHyCF · Boletín N.º 1 sobre El Niño (4/9/2026) | Fase El Niño confirmada, 100 % de probabilidad para septiembre-noviembre | https://www.cohife.org.ar/wp-content/uploads/2026/09/INFORME-el-Nino-Nro1-040926.pdf |
| NOAA – Climate Prediction Center · Discusión ENSO (8/10/2026, versión en español) | 83 % de probabilidad de evento fuerte o muy fuerte en octubre-diciembre; persistencia hasta el verano | https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc_Sp.shtml |
| SMN · Estado del ENOS | Página oficial del SMN sobre El Niño / La Niña | https://ws2.smn.gob.ar/enos |

## Cartografía
| Fuente | Qué aporta | URL |
|---|---|---|
| IGN · Capas SIG | Cursos de agua perennes e intermitentes; cuencas (COHIFE); descarga en SHP, KML, GeoJSON, CSV | https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG |
| IGN · Servicio WFS | Acceso programático a las capas (GeoServer) | https://wms.ign.gob.ar/geoserver/wfs?service=WFS&version=1.1.0&request=GetCapabilities |
| Banco Mundial (origen IGN 2017, CC BY 4.0) | Cursos de agua de Argentina, shapefile | https://datacatalogfiles.worldbank.org/ddh-published/0042027/1/DR0052528/001_cursos_de_agua.zip |

## Lo que el kit no incluye (y una herramienta honesta lo dice)
- Lluvia observada en Formosa: no forma parte del kit.
- Pronóstico hidrológico más allá de los 15 días que cubre el reporte del INA.
- Cotas, barrios o infraestructura reales: los sectores de K10 son simulados.
- Alturas máximas anteriores a 2006 (1983, 1992, 1998): no están en la serie del kit y las cifras que circulan no provienen de una fuente oficial verificada.
