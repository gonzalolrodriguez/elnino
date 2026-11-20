import type { StyleSpecification } from "maplibre-gl";

/** Fondo OpenStreetMap (DOCUMENTO DE REFERENCIA, ODbL) para los mapas de elegir ubicación. */
export const ATRIBUCION_OSM = "© colaboradores de OpenStreetMap (ODbL)";

export const ESTILO_OSM: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: ATRIBUCION_OSM },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** Vista inicial: ciudad de Formosa, como [lon, lat]. */
export const CENTRO_FORMOSA: [number, number] = [-58.18, -26.18];
export const ZOOM_INICIAL = 12;
