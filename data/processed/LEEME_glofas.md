# Caudal modelado GloFAS (data/processed/glofas_*.json)

Generado por `apps/backend/scripts/descargar_glofas.py` el 2026-11-20T22:44:49+00:00.

* Fuente: GloFAS v4 (Copernicus Emergency Management Service) vía Open-Meteo Flood API (https://open-meteo.com/en/docs/flood-api).
* Licencia / atribución: CC BY 4.0 · GloFAS / Copernicus Emergency Management Service (datos) y Open-Meteo (API). Uso no comercial.
* Categoría: DOCUMENTO DE REFERENCIA (datos globales modelados; no observados ni pronóstico oficial).
* Variable: `river_discharge`, caudal diario en m³/s. No es altura de escala: no hay curva
  altura-caudal oficial en el kit, así que no se convierte a metros.
* Período `modelado`: 01/01/2006 a 31/10/2026 (corte). Zona horaria GMT.
* Celdas usadas: formosa: lat -26.175, lon -58.174995, elevación 61.0 m; pilcomayo: lat -25.374996, lon -57.674995, elevación 54.0 m
* `posterior_al_corte`: la API no ofrece el pronóstico tal como se emitió el 31/10/2026, solo la
  ejecución vigente al descargar. Esas fechas se guardan aparte y el backend las expone solo con
  `PERMITIR_DATOS_POST_CORTE=true`, rotuladas con la fecha y hora de descarga.
