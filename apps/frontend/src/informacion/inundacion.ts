/**
 * Lógica pura de la visualización de inundación de `/informacion` (sin React ni WebGL).
 *
 * Regla de honestidad: el kit no trae cotas de los sectores y las alturas de K10 están en la escala de Puerto Formosa,
 * no sobre el nivel del mar. Por eso:
 *  - CUÁNDO se compromete cada sector lo decide K10 (`estadoSector`): altura >= compromiso; en riesgo desde compromiso - margen.
 *  - DÓNDE avanza el agua dentro del sector lo decide el relieve real (DEM): las celdas se llenan en orden ascendente de
 *    elevación, a medida que la altura simulada pasa de (compromiso - margen) a (compromiso + tramo visual).
 *  - Fuera de los sectores no se inventan inundaciones; solo se dibuja el cauce (trazado IGN), con ancho ilustrativo.
 */
import { MARGEN_RIESGO_M } from "../datos/kit";
import type { Malla } from "../relieve/datos";

/** Equidistancia de las terrazas de color (m de elevación del DEM). Decisión de visualización. */
export const INTERVALO_TERRAZA_M = 1;
/** Exageración vertical de la escena 3D (los desniveles se amplían N veces; se rotula en la leyenda). */
export const EXAGERACION_INUNDACION = 40;
/** Tramo de altura (m) tras el compromiso hasta el que el sector termina de llenarse. SUPUESTO de visualización. */
export const TRAMO_VISUAL_M = 1;
/** Profundidad mínima visual (m) de una celda anegada, para que la primera celda se vea. */
export const PROFUNDIDAD_MIN_M = 0.15;
/** Profundidad ilustrativa (m) del cauce; no varía con la altura simulada. */
export const PROFUNDIDAD_CAUCE_M = 0.5;
/** Radio (en celdas de ~55 m) alrededor del trazo del río que se pinta como cauce. SUPUESTO de visualización. */
export const RADIO_CAUCE_CELDAS = 1;

export type LonLat = [number, number];
export type SectorGeo = { id: string; compromiso_m: number; anillo: number[][] };

/** Estado de un sector según K10 (misma regla que la tabla y el mapa esquemático). */
export type EstadoSector = "normal" | "en_riesgo" | "comprometido";
export function estadoSector(s: { compromiso_m: number }, altura: number, margen = MARGEN_RIESGO_M): EstadoSector {
  if (altura >= s.compromiso_m) return "comprometido";
  if (altura >= s.compromiso_m - margen) return "en_riesgo";
  return "normal";
}

/** Fracción (0 a 1) de las celdas de un sector que están anegadas a una altura dada. */
export function fraccionLlenado(altura: number, compromiso: number, margen = MARGEN_RIESGO_M, tramo = TRAMO_VISUAL_M): number {
  const f = (altura - (compromiso - margen)) / (margen + tramo);
  return f <= 0 ? 0 : f >= 1 ? 1 : f;
}

// ------------------------------------------------------------------------------ geometría de la malla

export const lonDe = (m: Malla, i: number) => m.bbox[0] + (i * (m.bbox[2] - m.bbox[0])) / (m.nx - 1);
export const latDe = (m: Malla, j: number) => m.bbox[3] - (j * (m.bbox[3] - m.bbox[1])) / (m.ny - 1);

export function puntoEnAnillo(lon: number, lat: number, anillo: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Marca (1) las celdas que caen a menos de `radio` celdas del trazo de los cursos de agua. */
export function mascaraCauce(m: Malla, lineas: LonLat[][], radio = RADIO_CAUCE_CELDAS): Uint8Array {
  const mask = new Uint8Array(m.nx * m.ny);
  const dx = (m.bbox[2] - m.bbox[0]) / (m.nx - 1);
  const dy = (m.bbox[3] - m.bbox[1]) / (m.ny - 1);
  const marcar = (lon: number, lat: number) => {
    const ci = Math.round((lon - m.bbox[0]) / dx);
    const cj = Math.round((m.bbox[3] - lat) / dy);
    for (let j = cj - radio; j <= cj + radio; j++) {
      for (let i = ci - radio; i <= ci + radio; i++) {
        if (i < 0 || j < 0 || i >= m.nx || j >= m.ny) continue;
        if ((i - ci) ** 2 + (j - cj) ** 2 <= radio * radio + 0.01) mask[j * m.nx + i] = 1;
      }
    }
  };
  for (const ln of lineas) {
    for (let k = 0; k < ln.length - 1; k++) {
      const [x0, y0] = ln[k];
      const [x1, y1] = ln[k + 1];
      const pasos = Math.max(1, Math.ceil(Math.hypot((x1 - x0) / dx, (y1 - y0) / dy) * 2));
      for (let s = 0; s <= pasos; s++) marcar(x0 + ((x1 - x0) * s) / pasos, y0 + ((y1 - y0) * s) / pasos);
    }
  }
  return mask;
}

export type OrdenSector = {
  id: string;
  compromiso_m: number;
  /** Índices de celda (fila * nx + columna) dentro del sector, de la más baja a la más alta. Excluye el cauce. */
  celdas: Int32Array;
};

/** Celdas de cada sector ordenadas por elevación real ascendente (desempate por índice, determinista). */
export function ordenarCeldas(m: Malla, sectores: SectorGeo[], cauce?: Uint8Array): OrdenSector[] {
  return sectores.map((s) => {
    const xs = s.anillo.map((p) => p[0]);
    const ys = s.anillo.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const lista: number[] = [];
    for (let j = 0; j < m.ny; j++) {
      const lat = latDe(m, j);
      if (lat < y0 || lat > y1) continue;
      for (let i = 0; i < m.nx; i++) {
        const lon = lonDe(m, i);
        if (lon < x0 || lon > x1) continue;
        const k = j * m.nx + i;
        if (cauce?.[k]) continue;
        if (puntoEnAnillo(lon, lat, s.anillo)) lista.push(k);
      }
    }
    lista.sort((a, b) => m.z[a] - m.z[b] || a - b);
    return { id: s.id, compromiso_m: s.compromiso_m, celdas: Int32Array.from(lista) };
  });
}

/** Cuántas celdas de un sector están anegadas a esa altura. */
export function celdasAnegadas(orden: OrdenSector, altura: number): number {
  return Math.round(fraccionLlenado(altura, orden.compromiso_m) * orden.celdas.length);
}

/**
 * Profundidad (m) por celda: 0 = seco. En un sector con `n` celdas anegadas, el nivel del agua es la cota de la celda
 * número `n` (la más alta anegada) más la profundidad mínima visual; la profundidad de cada celda es nivel - cota.
 * El cauce lleva una profundidad ilustrativa fija. Devuelve también el nivel (m) por sector.
 */
export function calcularAgua(
  m: Malla,
  ordenes: OrdenSector[],
  altura: number,
  cauce: Uint8Array | undefined,
  salida?: Float32Array,
): { prof: Float32Array; niveles: Record<string, number | null> } {
  const prof = salida ?? new Float32Array(m.nx * m.ny);
  prof.fill(0);
  if (cauce) for (let k = 0; k < cauce.length; k++) if (cauce[k]) prof[k] = PROFUNDIDAD_CAUCE_M;
  const niveles: Record<string, number | null> = {};
  for (const o of ordenes) {
    const n = celdasAnegadas(o, altura);
    if (n === 0) {
      niveles[o.id] = null;
      continue;
    }
    const nivel = m.z[o.celdas[n - 1]] + PROFUNDIDAD_MIN_M;
    niveles[o.id] = nivel;
    for (let q = 0; q < n; q++) {
      const k = o.celdas[q];
      prof[k] = Math.max(0, nivel - m.z[k]);
    }
  }
  return { prof, niveles };
}

// ------------------------------------------------------------------------------ terrazas

/** Rampa hipsométrica (verdes a arena), la misma gama que el relieve local de la landing. */
export const RAMPA_TERRAZAS = ["#2f6f62", "#37796a", "#4a8b6e", "#639c76", "#8caf7c", "#b4ba86", "#cfbb8b", "#dcb68f"];

/** Número de terraza (banda) de una elevación. */
export const terraza = (z: number, intervalo = INTERVALO_TERRAZA_M) => Math.floor(z / intervalo);

const aRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const aHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function rampa(t: number): string {
  const x = Math.min(Math.max(t, 0), 1) * (RAMPA_TERRAZAS.length - 1);
  const i = Math.min(Math.floor(x), RAMPA_TERRAZAS.length - 2);
  const a = aRgb(RAMPA_TERRAZAS[i]);
  const b = aRgb(RAMPA_TERRAZAS[i + 1]);
  return aHex(a.map((v, k) => v + (b[k] - v) * (x - i)));
}

/** Un color por terraza, desde la que contiene `zmin` hasta la que contiene `zmax`. */
export function coloresTerrazas(zmin: number, zmax: number, intervalo = INTERVALO_TERRAZA_M): { base: number; colores: string[] } {
  const b0 = terraza(zmin, intervalo);
  const b1 = terraza(zmax, intervalo);
  const n = b1 - b0 + 1;
  return { base: b0, colores: Array.from({ length: n }, (_, k) => rampa(n === 1 ? 0 : k / (n - 1))) };
}

// ------------------------------------------------------------------------------ extracción de cauces

type FeatureLinea = { geometry: { type: string; coordinates: unknown } };
/** Líneas de una colección GeoJSON de cursos de agua que tocan la caja dada, recortadas a un margen de 1 vértice. */
export function lineasEnCaja(features: FeatureLinea[], bbox: [number, number, number, number]): LonLat[][] {
  const [o, s, e, n] = bbox;
  const dentro = ([x, y]: LonLat) => x >= o - 0.003 && x <= e + 0.003 && y >= s - 0.003 && y <= n + 0.003;
  const salida: LonLat[][] = [];
  for (const f of features) {
    const { type, coordinates } = f.geometry;
    const lineas = type === "LineString" ? [coordinates as LonLat[]] : type === "MultiLineString" ? (coordinates as LonLat[][]) : [];
    for (const ln of lineas) {
      let actual: LonLat[] = [];
      ln.forEach((p, i) => {
        if (dentro(p) || (i > 0 && dentro(ln[i - 1]))) actual.push(p);
        else if (actual.length) {
          if (actual.length > 1) salida.push(actual);
          actual = [];
        }
      });
      if (actual.length > 1) salida.push(actual);
    }
  }
  return salida;
}
