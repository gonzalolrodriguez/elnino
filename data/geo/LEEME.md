# data/geo — capas territoriales de referencia

Todas las capas de esta carpeta son **lugares reales** de fuentes oficiales o abiertas (decisión D7) y se rotulan
`DOCUMENTO DE REFERENCIA` con su fuente y fecha de descarga. No contienen personas ni datos personales.
Sistema de coordenadas: **EPSG:4326 (WGS84)**; POSGAR 07 geográfico sería EPSG:5340 (no se usa aquí).
Fecha de descarga: **2026-11-17**. Detalle por capa (URL, licencia, conteos, bbox, notas): `manifiesto.json`.

## Regenerar

```bash
python apps/backend/scripts/descargar_capas.py            # todas las capas (~3 min, requiere internet)
python apps/backend/scripts/descargar_capas.py --solo vial,escuelas   # solo algunas
```

Dependencias: `httpx`, `shapely`, `openpyxl` (ya están en el venv del backend). La demo funciona sin internet
porque los resultados se versionan. `original/` guarda la respuesta de cada fuente (o su subconjunto de Formosa).
No se versiona ningún original mayor a 20 MB (ninguno lo superó).

## Archivos

| Archivo | Contenido | Fuente | Licencia |
|---|---|---|---|
| `provincia.geojson` | Límite de Formosa | IGN, Capas SIG (WFS `ign:provincia`) | IGN, datos abiertos |
| `departamentos.geojson` | 9 departamentos | IGN (WFS `ign:departamento`) | IGN, datos abiertos |
| `municipios.geojson` | Municipios y comisiones | IGN (WFS `ign:municipio`) | IGN, datos abiertos |
| `localidades_parajes.geojson` | Localidades, parajes y asentamientos (puntos) | BAHRA / INDEC vía API Georef `/asentamientos` | CC BY 4.0 |
| `red_vial.geojson` | Red vial del corredor RN 11 – río Paraguay (LineString) | OpenStreetMap vía Overpass | ODbL 1.0 |
| `cursos_agua.geojson` | Cursos de agua perennes e intermitentes | IGN, Capas SIG (WFS) | IGN, datos abiertos |
| `establecimientos_educativos.geojson` | Escuelas (CUE 34*) | Mapa Educativo Nacional (WFS) | CC BY 4.0 |
| `establecimientos_salud.geojson` | Establecimientos de salud | REFES, Ministerio de Salud (archivo del 27/12/2024) | CC BY 4.0 |
| `comisarias_destacamentos.geojson` | Comisarías y destacamentos (complemento) | OpenStreetMap (`amenity=police`) | ODbL 1.0 |
| `manifiesto.json` | Metadatos de cada capa | — | — |
| `verificacion_k10.json` | Lugares reales cerca de los sectores K10 | calculado | — |

Atribución obligatoria de OSM: «© colaboradores de OpenStreetMap, ODbL». Citar también IGN, INDEC/BAHRA, Ministerio de
Educación y Ministerio de Salud según la capa.

### Recortes

- Formosa: límite provincial del IGN. Cursos de agua se recortan exactamente al polígono provincial; los puntos
  (localidades, escuelas, salud, comisarías) se conservan si caen dentro de Formosa (localidades y comisarías con ~2 km de
  tolerancia por los centroides cercanos al límite).
- Red vial: corredor `bbox = (-58.40, -26.40, -57.95, -25.95)`. Cubre los cuatro sectores K10
  (lon −58.205…−58.128, lat −26.222…−26.150) con ~0,15° (~16 km) de margen al oeste, norte y sur, e incluye la RN 11 y la
  margen del río Paraguay. En la margen oriental hay caminos de Paraguay, que OSM también mapea; se conservan y no se
  distinguen por país.
- Simplificación: provincia, departamentos y municipios 0,0005° (~50 m); cursos de agua 0,0003° (~30 m).

## Red vial: propiedades exactas (para `app.ingest.red_vial`)

`red_vial.geojson` es una `FeatureCollection` de **`LineString`** (EPSG:4326). Las vías OSM se **parten en cada nodo
compartido con otra vía** (y en sus extremos), de modo que cada tramo es una arista de grafo lista para pgRouting sin
nodificar; el empalme se detecta por `nodo_ini` / `nodo_fin` (ids de nodos OSM), que coinciden con el primer y último vértice.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `osm_id` | int | id de la vía OSM de origen |
| `segmento` | int | índice del tramo dentro de la vía (`osm_id` + `segmento` es único) |
| `nodo_ini`, `nodo_fin` | int | ids de nodos OSM de los extremos del tramo |
| `highway` | str | clase vial OSM: `trunk`, `primary`, `secondary`, `tertiary`, `unclassified`, `residential`, `track`, `service` y `*_link` |
| `surface` | str o null | tag OSM `surface` sin modificar |
| `superficie` | str | `pavimento`, `ripio`, `tierra` o `desconocida` (campo a usar como superficie) |
| `nombre`, `ref` | str o null | nombre y referencia (p. ej. `RN11`) |
| `tracktype`, `oneway` | str o null | tags OSM sin modificar |

Regla de `superficie` (mapeo literal del tag `surface`; **no se infiere desde `highway`**):

- `pavimento`: `paved`, `asphalt`, `concrete`, `concrete:plates`, `concrete:lanes`, `paving_stones`, `sett`, `cobblestone`, `bricks`, `metal`
- `ripio`: `gravel`, `fine_gravel`, `compacted`, `pebblestone`, `crushed_stone`, `unhewn_cobblestone`
- `tierra`: `unpaved`, `dirt`, `earth`, `ground`, `mud`, `sand`, `grass`, `clay`, `soil`
- sin tag u otro valor: `desconocida`

Atención: en OSM `unpaved` es genérico (tierra o ripio) y aquí se mapea a `tierra`. `oneway` no se aplica al grafo; el
ruteo puede tratarlo como bidireccional (supuesto a documentar).

## Limitaciones conocidas

- **Salud (REFES) sin coordenadas propias:** la posición es el centroide de la localidad censal según Georef. Varios
  establecimientos comparten punto; precisión de localidad, no de edificio. La descarga de REFES se hizo sin verificar el
  certificado TLS porque `datos.salud.gob.ar` no entrega la cadena completa (contenido público).
- **Escuelas:** el servicio no publica dirección ni localidad. Qué edificio es centro de recepción lo define la autoridad;
  la capacidad es `SIMULADO` y no está en estas capas.
- **Localidades/parajes:** centroide declarado por BAHRA/Georef, no punto catastral. No hay catastro parcelario abierto (P12).
- **Red vial OSM:** cobertura y etiquetado de `surface` incompletos (parte de los tramos queda `desconocida`); sin cotas ni
  cierres reales. Incluye vías de servicio (`service`) urbanas.
- **Comisarías:** OSM es parcial; no sustituye el listado oficial ni los puestos del parte de lluvia de la Policía.
- **Cursos de agua:** esquema ilustrativo, no sirve para cotas ni inundación.
- **Población INDEC por radio censal:** pendiente (opcional, no se intentó); la población del MVP viene de K10 (`SIMULADO`).
- Los sectores K10 son simulados: que haya lugares reales cerca no los convierte en barrios reales.
- Respaldos previstos pero no ejercitados porque la fuente primaria respondió: Georef (centroides) para límites y Natural
  Earth 10m para cursos de agua.

## Relieve y planialtimetría (`relieve/`)

Generado por `apps/backend/scripts/descargar_relieve.py` (sin claves; solo `httpx`, `numpy` y `shapely`; el PNG se lee y
escribe con `zlib`). Los metadatos de cada capa están en `manifiesto.json` (ids `relieve_cuenca` y `relieve_local`) y las
rampas, rangos e intervalos que usa el frontend en `relieve/meta.json`.

```bash
python apps/backend/scripts/descargar_relieve.py        # ~1 min, requiere internet
cd apps/frontend && node scripts/preparar-datos.mjs      # copia a public/relieve/ y publica las capas del mapa
```

| Archivo | Contenido | Tamaño aprox. |
|---|---|---|
| `relieve/dem_cuenca_malla.json` | Malla de elevaciones de la cuenca (177 x 277 celdas de 0,05°, int16 en decímetros, base64) para el 3D | 128 KB |
| `relieve/curvas_cuenca.geojson` | Curvas de nivel de la cuenca (`elev_m`, `maestra`): cada 25 m hasta 200 m y cada 100 m por encima | 208 KB |
| `relieve/tinte_cuenca.png` | Tinte hipsométrico con sombreado, equirrectangular (3D y SVG) | 464 KB |
| `relieve/tinte_cuenca_mercator.png` | El mismo tinte en Web Mercator (capa de imagen de MapLibre) | 406 KB |
| `relieve/curvas_local.geojson` | Curvas de nivel del corredor de los sectores K10, cada 2 m (maestras cada 10 m) | 137 KB |
| `relieve/tinte_local_mercator.png` | Tinte del corredor con rampa propia (percentiles 2 a 98) | 212 KB |
| `relieve/rio_paraguay.geojson` | Río Paraguay (tronco Mato Grosso a confluencia) y Pilcomayo | 17 KB |
| `relieve/meta.json` | Rampas de color, rangos y atribución | 1 KB |

Los departamentos de Formosa se reutilizan de `departamentos.geojson` (IGN); no se vuelven a bajar.

**Fuentes y licencias**

- Elevaciones: AWS Terrain Tiles, formato `terrarium` (`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`,
  AWS Open Data / Mapzen; elevación = (R × 256 + G + B / 256) − 32768). Zoom 7 para la cuenca (24 tiles) y zoom 11 para el corredor (16 tiles).
  Los tiles no se versionan (se bajan en cada corrida); se versionan los derivados. Atribución (texto de `tilezen/joerd`,
  `docs/attribution.md`, párrafo que corresponde a esta región): «United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain
  data courtesy of the U.S. Geological Survey»; el conjunto incluye además ETOPO1 (NOAA), que no aplica a esta zona. En esta región el
  modelo proviene de SRTM.
- Río Paraguay y Pilcomayo: Natural Earth 10m rivers + lake centerlines, dominio público
  (`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson`).
  Se eligió Natural Earth y no la relación de OpenStreetMap porque Overpass respondió «at capacity» (502) en los intentos y NE es de
  dominio público y estable. En esa fuente el sistema Paraguay-Paraná es un solo rasgo (rivernum 36) rotulado «Paraná»; se toma su primer
  tramo (nacientes en Mato Grosso a la confluencia, 964 vértices), identificado por geometría y no por nombre.
- Departamentos y límite provincial: IGN (ver arriba).

**Decisiones**

- Recuadro de la cuenca: lon −62,8 a −54,0 y lat −28,0 a −14,2. El oeste incluye toda la provincia de Formosa (límite occidental ~−62,4),
  el este cubre las nacientes del Paraguay (~−55,1) y la meseta de Mato Grosso, el norte llega a las nacientes (~−14,3) y el sur pasa la
  confluencia con el Paraná (−27,3).
- Intervalos: 25 m por debajo de 200 m muestra los escalones de la llanura (39 a 200 m) sin ruido; 100 m por encima resume la meseta
  (hasta 892 m). Corredor local: 2 m, porque el desvío entre el modelo crudo y el suavizado es de ~2 m y 1 m sería sobreinterpretar el dato.
- Suavizado: gaussiano (σ de 1 celda en la cuenca, 4 celdas ≈ 300 m en el corredor) antes de trazar curvas.
- Exageración vertical del 3D: ×60 (se rotula en la leyenda). La llanura baja ~100 m en 1.500 km; sin exageración no se vería.

**Límites** (se repiten en la leyenda del frontend): modelo de ~1 km (cuenca) y ~75 m (corredor) con error vertical de varios metros;
en la llanura chaqueña es comparable al desnivel real. Las curvas muestran el gradiente regional, no cotas de terreno ni de
inundación. La línea del río es 1:10.000.000 y puede apartarse varios kilómetros del cauce. Categoría: `DOCUMENTO DE REFERENCIA`.

## Filas para `docs/ficha_fuentes.md`

| Dato | Fuente | Categoría | Fecha |
|---|---|---|---|
| Límite provincial, departamentos y municipios de Formosa | IGN, Capas SIG, servicio WFS (`wms.ign.gob.ar/geoserver/ows`) | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
| Localidades, parajes y asentamientos de Formosa | BAHRA / INDEC vía API Georef (`apis.datos.gob.ar/georef/api/asentamientos`), CC BY 4.0 | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
| Red vial del corredor RN 11 – río Paraguay | OpenStreetMap vía Overpass API (ODbL 1.0, © colaboradores de OpenStreetMap) | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
| Cursos de agua de Formosa | IGN, Capas SIG, WFS (perennes e intermitentes) | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
| Establecimientos educativos de Formosa (ubicación; no es centro de recepción) | Mapa Educativo Nacional, WFS `publico:establecimiento_educativo`, CC BY 4.0 | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
| Establecimientos de salud de Formosa (ubicación por localidad) | REFES, Ministerio de Salud (datos.gob.ar), archivo del 27/12/2024, CC BY 4.0; centroides de localidad: API Georef | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
| Comisarías y destacamentos (complemento) | OpenStreetMap (`amenity=police`), ODbL 1.0 | DOCUMENTO DE REFERENCIA | descarga 2026-11-17 |
