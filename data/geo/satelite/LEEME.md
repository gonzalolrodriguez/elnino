# Agua observada por satélite (Sentinel-1 y Sentinel-2)

> PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial

Categoría: **DOCUMENTO DE REFERENCIA (imagen) · producto derivado (máscara de agua)**. La imagen original es DOCUMENTO DE REFERENCIA; la máscara de agua es un producto derivado calculado por el equipo con el método de abajo. Generado el 2026-11-20 con `apps/backend/scripts/descargar_satelite.py`.

## Archivos

- `agua_<sensor>_<fecha>.geojson`: una `Feature` MultiPolygon (EPSG:4326) por escena, con las propiedades `sensor`, `escena_id`, `fecha_escena`, `nube_pct`, `metodo`, `umbral`, `altura_k1_m`, `fecha_k1`, `area_agua_km2`, `categoria`, `incertidumbre`, `atribucion`.
- `agua_<sensor>_<fecha>.png`: vista previa (agua en azul; nube y sombra en magenta; el resto, el índice en grises).
- `resumen.csv`: fecha, sensor, área de agua en la zona (km2), altura K1 del día más cercano.
- `manifiesto.json`: fuentes, escenas, URLs, licencias y parámetros.

## Escenas

| Fecha | Sensor | Evento | Agua en la zona (km2) | K1 (m, día) | Nube | Cobertura |
|---|---|---|---|---|---|---|
| 2016-01-09 | Sentinel-1 | Pico de 2016 (cuatro días después del máximo del 05/01) | 243,07 | 9,80 (2016-01-09) | n/c | 80.2 % |
| 2016-01-23 | Sentinel-2 | Descenso posterior al pico de 2016 (18 días después del máximo; la escena del 10/01 no cubre la zona) | 208,22 | 9,40 (2016-01-23) | 0.1 % | 99.4 % |
| 2019-05-28 | Sentinel-1 | Subida previa al pico de 2019 | 277,6 | 9,64 (2019-05-28) | n/c | 100.0 % |
| 2019-06-03 | Sentinel-2 | Pico de 2019 (un día después del máximo del 02/06) | 141,75 | 9,72 (2019-06-03) | 28.2 % | 46.4 % |
| 2019-10-07 | Sentinel-1 | Línea de base de aguas bajas (octubre de 2019) | 71,96 | 2,07 (2019-10-07) | n/c | 100.0 % |
| 2019-10-09 | Sentinel-2 | Línea de base de aguas bajas (octubre de 2019) | 67,13 | 2,07 (2019-10-09) | 0.0 % | 99.9 % |
| 2026-10-25 | Sentinel-1 | Octubre de 2026 (previo al corte) | 79,84 | 5,40 (2026-10-25) | n/c | 100.0 % |
| 2026-10-26 | Sentinel-2 | Octubre de 2026 (previo al corte) | 42,63 | 5,44 (2026-10-26) | 24.7 % | 47.1 % |

## Fuente y licencia

- Microsoft Planetary Computer, catálogo STAC público (`https://planetarycomputer.microsoft.com/api/stac/v1`), con token SAS anónimo; colecciones `sentinel-2-l2a` y `sentinel-1-rtc`.
- Sentinel-1 y Sentinel-2: datos del programa Copernicus de la Unión Europea, de acceso libre y gratuito. Atribución obligatoria: **"Contiene datos Copernicus Sentinel modificados [año]"** (cada archivo trae su año). `sentinel-1-rtc` es un producto de Microsoft (CC BY 4.0) derivado de Sentinel-1 GRD.
- Zona de trabajo: lon -58.4..-57.95, lat -26.4..-25.95 (corredor de Puerto Formosa, incluye los sectores K10 y el río Paraguay), rejilla UTM 21S a 20 m.

## Método

1. Se leen por ventanas los COG remotos y se remuestrean a la rejilla de 20 m (promedio).
2. Sentinel-2: MNDWI = (B03 - B11) / (B03 + B11), con reflectancia corregida por el desfase de los baselines desde 04.00; se enmascaran las clases SCL sin dato, saturado, sombra de nube, nube y cirrus. Umbral de Otsu acotado a [-0.15, 0.15].
3. Sentinel-1: VV en dB, filtro de mediana 3x3 contra el moteado (speckle), umbral de Otsu acotado a [-21.0, -14.0] dB; es agua lo que queda por debajo.
4. Se vectoriza, se descartan polígonos y huecos de menos de ~0,5 ha y se simplifica la geometría (15 m o más según el tamaño; está en el manifiesto). Si el archivo supera 500 KB se aumenta la simplificación.

## Límites (leer antes de usar)

- **No es un pronóstico**: describe lo que vio el satélite ese día, no lo que pasará.
- **Sin validación a campo**: el umbral es automático (Otsu); la incertidumbre de la extensión es de varios píxeles (decenas de metros) en el borde y mayor en bañados.
- **Falsos positivos**: suelo muy húmedo, sombras de relieve o de nube mal enmascaradas, bañados y lagunas permanentes.
- **Falsos negativos**: vegetación inundada (monte, pajonal) que el radar en VV y el MNDWI no siempre detectan; agua turbia puede subestimarse en MNDWI.
- **SAR**: moteado (speckle), viento sobre el agua que la hace brillar, y suelos arenosos secos que pueden confundirse con agua.
- **Nubes** (Sentinel-2): las zonas enmascaradas figuran como "sin agua" en el GeoJSON; el porcentaje está en `nube_pct`. Algunas escenas no cubren toda la zona (`cobertura_aoi_pct`); en ese caso el área de agua es parcial.
- **Fechas**: la imagen no coincide exactamente con el pico del río; `altura_k1_m` es la máxima diaria de K1 (OBSERVADO) del día más cercano a la imagen (`fecha_k1`).
- Ningún dato es posterior al corte del 31/10/2026. No se cruza con los sectores K10 (SIMULADO): no se calculan porcentajes de sector anegado.
