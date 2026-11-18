/**
 * Geometría del esquema de la cuenca (ilustrativo, no a escala cartográfica).
 *
 * Los cursos están digitalizados a mano con coordenadas aproximadas. El módulo está pensado
 * para reemplazarse por cursos de agua del IGN: `cursosDesdeGeoJSON` convierte un
 * FeatureCollection de LineString (EPSG:4326) en `Curso[]` con la misma forma.
 *
 * Relaciones verificadas contra K7 (esquema a auditar):
 *  - el Pilcomayo desemboca en el Paraguay (no en el Bermejo); se dibuja sin Bermejo;
 *  - orden de estaciones aguas abajo, por latitud de K3: Asunción, Puerto Pilcomayo, Puerto Formosa;
 *  - el Paraguay confluye con el Paraná y este continúa hacia el Río de la Plata.
 */

export type LonLat = [number, number];

export type Curso = {
  id: "paraguay" | "pilcomayo" | "parana" | string;
  nombre: string;
  /** Puntos en el sentido del flujo. */
  puntos: LonLat[];
};

export type Hito = {
  id: string;
  nombre: string;
  lon: number;
  lat: number;
  /** K3 = coordenadas oficiales del catálogo INA; aprox = ubicación aproximada para el esquema. */
  origen: "K3" | "aprox";
  principal?: boolean;
};

export const CURSOS_APROXIMADOS: Curso[] = [
  {
    id: "paraguay",
    nombre: "río Paraguay",
    puntos: [
      [-57.5, -17.8],
      [-57.75, -18.9],
      [-58.1, -19.8],
      [-58.17, -20.23],
      [-57.9, -21.5],
      [-57.45, -22.6],
      [-57.43, -23.4],
      [-57.55, -24.3],
      [-57.63, -25.28],
      [-57.65, -25.367],
      [-57.85, -25.75],
      [-58.0, -26.0],
      [-58.183, -26.183],
      [-58.28, -26.55],
      [-58.4, -26.9],
      [-58.57, -27.3],
    ],
  },
  {
    id: "pilcomayo",
    nombre: "río Pilcomayo",
    puntos: [
      [-60.2, -23.6],
      [-59.2, -24.5],
      [-58.3, -25.0],
      [-57.68, -25.33],
    ],
  },
  {
    id: "parana",
    nombre: "río Paraná",
    puntos: [
      [-55.9, -27.4],
      [-57.0, -27.15],
      [-58.57, -27.3],
      [-58.85, -27.55],
      [-59.05, -28.4],
    ],
  },
];

export const HITOS: Hito[] = [
  { id: "pantanal", nombre: "Pantanal", lon: -57.5, lat: -17.8, origen: "aprox" },
  { id: "asuncion", nombre: "Asunción", lon: -57.63, lat: -25.28, origen: "aprox" },
  { id: "pilcomayo", nombre: "Puerto Pilcomayo", lon: -57.65, lat: -25.367, origen: "K3" },
  { id: "formosa", nombre: "Puerto Formosa", lon: -58.183, lat: -26.183, origen: "K3", principal: true },
  { id: "confluencia", nombre: "Confluencia con el Paraná", lon: -58.57, lat: -27.3, origen: "aprox" },
];

/** Convierte un GeoJSON de cursos (por ejemplo, del IGN recortado) al formato del esquema. */
export function cursosDesdeGeoJSON(fc: {
  features: { properties?: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
}): Curso[] {
  const salida: Curso[] = [];
  fc.features.forEach((f, i) => {
    const nombre = String(f.properties?.nombre ?? f.properties?.name ?? `curso ${i + 1}`);
    const id = String(f.properties?.id ?? nombre.toLowerCase().replace(/\s+/g, "-"));
    if (f.geometry.type === "LineString") {
      salida.push({ id, nombre, puntos: f.geometry.coordinates as LonLat[] });
    } else if (f.geometry.type === "MultiLineString") {
      (f.geometry.coordinates as LonLat[][]).forEach((l, j) => salida.push({ id: `${id}-${j}`, nombre, puntos: l }));
    }
  });
  return salida;
}

const LAT0 = -22.5;
const KM_POR_GRADO = 111.32;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);

/** Proyección plana local (equirrectangular) en kilómetros: x hacia el este, y hacia el norte. */
export function proyectar(lon: number, lat: number): [number, number] {
  return [(lon + 58) * COS0 * KM_POR_GRADO, (lat - LAT0) * KM_POR_GRADO];
}

export function proyectarCurso(c: Curso): [number, number][] {
  return c.puntos.map(([lon, lat]) => proyectar(lon, lat));
}

/** Rectángulo (km) que contiene todos los cursos e hitos, con margen. */
export function limites(cursos: Curso[] = CURSOS_APROXIMADOS, margen = 80) {
  const pts = [...cursos.flatMap(proyectarCurso), ...HITOS.map((h) => proyectar(h.lon, h.lat))];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    xMin: Math.min(...xs) - margen,
    xMax: Math.max(...xs) + margen,
    yMin: Math.min(...ys) - margen,
    yMax: Math.max(...ys) + margen,
  };
}

/** Orden de las estaciones aguas abajo según su latitud (el flujo va de norte a sur). */
export function ordenAguasAbajo(ids: string[]): string[] {
  const lat = new Map(HITOS.map((h) => [h.id, h.lat]));
  return [...ids].sort((a, b) => (lat.get(b) ?? 0) - (lat.get(a) ?? 0));
}
