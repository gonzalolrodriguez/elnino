/**
 * Relieve real de la cuenca: modelos de datos, carga y utilidades de color y elevación.
 * Los archivos salen de `apps/backend/scripts/descargar_relieve.py` (data/geo/relieve/) y se copian a
 * `public/relieve/` con `scripts/preparar-datos.mjs`. Categoría: DOCUMENTO DE REFERENCIA.
 */

export type LonLat = [number, number];
export type Bbox = [number, number, number, number]; // oeste, sur, este, norte
export type Rampa = [number, string][];

export type FeatureGeo = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};
export type ColeccionGeo = { type: "FeatureCollection"; features: FeatureGeo[] };

export type MetaRelieve = {
  categoria: string;
  fecha_descarga: string;
  atribucion: string;
  cuenca: { bbox: Bbox; zoom: number; min_m: number; max_m: number; rampa: Rampa; intervalo: string };
  local: { bbox: Bbox; zoom: number; min_m: number; max_m: number; rampa: Rampa; intervalo_m: number; ruido_dem_m: number };
};

export type DatosRelieve = {
  meta: MetaRelieve;
  curvas: ColeccionGeo;
  rio: ColeccionGeo;
  departamentos: ColeccionGeo;
  provincia: ColeccionGeo;
};

export type Malla = { bbox: Bbox; nx: number; ny: number; z: Float32Array; min: number; max: number };

/** Exageración vertical de la escena 3D (se rotula en la leyenda). */
export const EXAGERACION_VERTICAL = 60;

export const urlRelieve = (archivo: string) => `${import.meta.env.BASE_URL}relieve/${archivo}`;

async function json<T>(archivo: string): Promise<T> {
  const r = await fetch(urlRelieve(archivo));
  if (!r.ok) throw new Error(`No se pudo cargar ${archivo} (${r.status})`);
  return (await r.json()) as T;
}

/** Capas livianas (curvas, río, departamentos): sirven al respaldo 2D y a la escena 3D. */
export async function cargarRelieve(): Promise<DatosRelieve> {
  const [meta, curvas, rio, departamentos, provincia] = await Promise.all([
    json<MetaRelieve>("meta.json"),
    json<ColeccionGeo>("curvas_cuenca.geojson"),
    json<ColeccionGeo>("rio_paraguay.geojson"),
    json<ColeccionGeo>("departamentos.geojson"),
    json<ColeccionGeo>("provincia.geojson"),
  ]);
  const coleccion = (c: ColeccionGeo | undefined) => Array.isArray(c?.features);
  if (!meta?.cuenca?.bbox || ![curvas, rio, departamentos, provincia].every(coleccion)) throw new Error("Datos de relieve incompletos");
  return { meta, curvas, rio, departamentos, provincia };
}

/** Malla de elevaciones para el 3D (int16 en decímetros, base64, filas de norte a sur). */
export async function cargarMalla(): Promise<Malla> {
  const j = await json<{ bbox: Bbox; nx: number; ny: number; min_m: number; max_m: number; datos_b64: string }>("dem_cuenca_malla.json");
  return decodificarMalla(j);
}

export function decodificarMalla(j: { bbox: Bbox; nx: number; ny: number; min_m: number; max_m: number; datos_b64: string }): Malla {
  const bin = atob(j.datos_b64);
  const vista = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) vista.setUint8(i, bin.charCodeAt(i));
  const z = new Float32Array(j.nx * j.ny);
  for (let i = 0; i < z.length; i++) z[i] = vista.getInt16(i * 2, true) / 10;
  return { bbox: j.bbox, nx: j.nx, ny: j.ny, z, min: j.min_m, max: j.max_m };
}

/** Elevación (m) en lon/lat por interpolación bilineal; fuera de la malla devuelve el valor del borde. */
export function elevEn(m: Malla, lon: number, lat: number): number {
  const [o, s, e, n] = m.bbox;
  const fx = Math.min(Math.max(((lon - o) / (e - o)) * (m.nx - 1), 0), m.nx - 1.000001);
  const fy = Math.min(Math.max(((n - lat) / (n - s)) * (m.ny - 1), 0), m.ny - 1.000001);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const v = (x: number, y: number) => m.z[y * m.nx + x];
  return v(x0, y0) * (1 - tx) * (1 - ty) + v(x0 + 1, y0) * tx * (1 - ty) + v(x0, y0 + 1) * (1 - tx) * ty + v(x0 + 1, y0 + 1) * tx * ty;
}

// ------------------------------------------------------------------------------ geometría

export function lineasDe(f: FeatureGeo): LonLat[][] {
  const { type, coordinates } = f.geometry;
  if (type === "LineString") return [coordinates as LonLat[]];
  if (type === "MultiLineString") return coordinates as LonLat[][];
  return [];
}

/** Anillos exteriores de un Polygon o MultiPolygon. */
export function anillosDe(f: FeatureGeo): LonLat[][] {
  const { type, coordinates } = f.geometry;
  if (type === "Polygon") return [(coordinates as LonLat[][])[0]];
  if (type === "MultiPolygon") return (coordinates as LonLat[][][]).map((p) => p[0]);
  return [];
}

/** Todos los anillos (exterior e interiores) como líneas, para dibujar el borde. */
export function bordesDe(f: FeatureGeo): LonLat[][] {
  const { type, coordinates } = f.geometry;
  if (type === "Polygon") return coordinates as LonLat[][];
  if (type === "MultiPolygon") return (coordinates as LonLat[][][]).flat();
  return [];
}

/** Centroide por área del anillo exterior más grande. */
export function centroide(f: FeatureGeo): LonLat {
  const anillo = anillosDe(f).sort((a, b) => b.length - a.length)[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < anillo.length - 1; i++) {
    const [x0, y0] = anillo[i];
    const [x1, y1] = anillo[i + 1];
    const k = x0 * y1 - x1 * y0;
    a += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  }
  if (Math.abs(a) < 1e-12) return anillo[0];
  return [cx / (3 * a), cy / (3 * a)];
}

export function nombreDepartamento(f: FeatureGeo): string {
  return String(f.properties.nombre ?? "");
}

// ------------------------------------------------------------------------------- colores

const aRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const aHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Color de la rampa hipsométrica (interpolación lineal entre paradas) para una elevación en metros. */
export function colorRampa(rampa: Rampa, elev: number): string {
  if (elev <= rampa[0][0]) return rampa[0][1];
  for (let i = 1; i < rampa.length; i++) {
    const [e1, c1] = rampa[i];
    if (elev <= e1) {
      const [e0, c0] = rampa[i - 1];
      const t = (elev - e0) / (e1 - e0);
      const a = aRgb(c0);
      const b = aRgb(c1);
      return aHex(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return rampa[rampa.length - 1][1];
}

export type MarcaLeyenda = { valor: number; color: string; pos: number; rotulo: boolean };

/** Paradas de la leyenda: extremos reales del área y las paradas de la rampa en medio, equiespaciadas. */
export function marcasLeyenda(rampa: Rampa, min: number, max: number, rotular: number[]): MarcaLeyenda[] {
  const medio = rampa.map((p) => p[0]).filter((v) => v > min && v < max);
  const valores = [min, ...medio, max];
  return valores.map((v, i) => ({
    valor: v,
    color: colorRampa(rampa, v),
    pos: i / (valores.length - 1),
    rotulo: i === 0 || i === valores.length - 1 || rotular.includes(v),
  }));
}

export function fmtM(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}
