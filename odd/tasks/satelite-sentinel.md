# Agua observada por satélite (Sentinel-1/2) · propuesta pendiente de decisión

**Estado:** solo investigación (19/11/2026). No se implementa sin la decisión del equipo, porque CLAUDE.md §15 deja la teledetección SAR fuera del MVP.

## Verificado (consultas STAC anónimas del 19/11/2026)

- **Fuente principal:** Microsoft Planetary Computer, sin cuenta (token SAS anónimo). Tiene S2 L2A desde 2015-12, S1 GRD/RTC y Landsat C2 L2.
- **Respaldo:** Earth Search (AWS). Tiene S2 recién desde 2019.
- **Escenas sobre Puerto Formosa:**

| Evento | Altura K1 | Escenas |
|---|---|---|
| Pico de 2016 | 9,81 m el 05/01 | S1A del 09/01/2016; S2A del 10/01/2016 (34 % de nube) |
| Subida de diciembre de 2015 | 8,63 m | S2A del 21/12/2015 (4 % de nube) |
| Pico de 2019 | 9,72 m el 02/06 | S2A del 03/06/2019 (7–8 % de nube); S1B del 28/05 y del 09/06 |
| Octubre de 2026 | — | S2A del 26/10 (9 % de nube); S1C del 25/10 |

Ninguna fecha es posterior al corte.

## Propuesta de MVP (M, 6–10 h)

- **Fechas:** 3 o 4, incluida una de aguas bajas como línea de base.
- **Método:**
  - S1 con máscara de agua (VV, umbral de Otsu).
  - S2 con MNDWI y máscara de nubes SCL.
- **Salidas:** GeoJSON en `data/geo/satelite/`, generado por el script reproducible `apps/backend/scripts/descargar_satelite.py`.
- **En la web:** conmutador "Agua observada por satélite" en el mapa del panel, con selector de fecha y la altura K1 de ese día.
- **Rotulado:** la imagen es DOCUMENTO DE REFERENCIA. La máscara es un producto derivado, con su método, la nube y la incertidumbre (suelo húmedo, bañados, vegetación inundada).
- **Ficha de fuentes:** una fila por escena en `ficha_fuentes.md`.

## Decisiones del equipo

1. ¿Planetary Computer como fuente principal?
2. ¿Qué fecha de aguas bajas se usa como línea de base (octubre de 2019 con 2,07 m, o septiembre de 2020 con 0,60 m)?
3. ¿Se acepta S1 del 09/01/2016, cuatro días después del pico?
4. ¿Solo Sentinel, o también Landsat?
5. ¿Se cruza con los sectores K10? La recomendación es no hacerlo, porque K10 es SIMULADO.
6. ¿El umbral se valida a ojo o queda con Otsu y la advertencia?

## Estado al 19/11/2026, 11:25

- **Decisiones tomadas (modificables):**
  - Fuente: Planetary Computer.
  - Línea de base: aguas bajas de octubre de 2019.
  - Radar S1 del 09/01/2016 (4 días después del pico).
  - Solo Sentinel.
  - Sin porcentajes por sector K10.
  - Umbral de Otsu con advertencia de incertidumbre.
- **Hecho:**
  - Script reproducible `apps/backend/scripts/descargar_satelite.py`, con dependencias en `scripts/requirements-satelite.txt`.
  - Pruebas unitarias en `tests/test_satelite_script.py` (11 en verde): Otsu, MNDWI, altura de K1 más cercana y bloqueo de fechas posteriores al corte.
- **Capas sin generar.** Durante el procesamiento se detectaron y corrigieron falsos "parches de agua" en los bordes de las escenas. La última corrida se detuvo por falta de tiempo (el usuario tenía que apagar la PC), así que `data/geo/satelite/` quedó vacío.
- **Para generarlas** (unos 30–40 min en una laptop de 8 GB):
  ```
  cd apps/backend
  pip install -r scripts/requirements-satelite.txt
  python scripts/descargar_satelite.py
  ```
  Antes de publicar las capas, revisar las vistas previas PNG por si quedan artefactos en los bordes.
- **Pendiente después de generar:**
  - Filas por escena en `docs/ficha_fuentes.md`.
  - Botón "Agua observada por satélite" en el mapa del panel.
  - Línea en la ficha técnica.
- **Observado en la corrida anterior (no publicado):** la escena óptica de 2016 usable fue la del 23/01/2016, porque la del 10/01 tenía 34 % de nube. Esa imagen es de casi tres semanas después del pico.
