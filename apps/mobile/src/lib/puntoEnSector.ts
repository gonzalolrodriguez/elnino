import k10 from "@/datos/k10Sectores.json";

/**
 * Sectores K10 (SIMULADO, v1.0, 12/11/2026) copiados del kit para que el mapa de elegir ubicación
 * funcione sin conexión. Geometría y atributos sin cambios (decisión D8).
 */
export type SectorK10 = {
  id: string;
  nombre: string;
  compromiso_m: number;
  poblacion: number;
  acceso: string;
  /** Anillo cerrado de pares [lon, lat]. */
  anillo: number[][];
};

export const SECTORES_K10: SectorK10[] = (k10 as { sectores: SectorK10[] }).sectores;
export const K10_FECHA = "12/11/2026";

/** Sector K10 que contiene el punto (trazado por rayos); `null` si cae fuera de todos. */
export function sectorDe(lon: number, lat: number, sectores: SectorK10[] = SECTORES_K10): SectorK10 | null {
  for (const s of sectores) {
    let dentro = false;
    const a = s.anillo;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i];
      const [xj, yj] = a[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    if (dentro) return s;
  }
  return null;
}

/** Texto en vivo bajo el mapa: en qué sector K10 (SIMULADO) cae el punto marcado. */
export function textoPuntoEnSector(lon: number | null | undefined, lat: number | null | undefined): string {
  if (lon == null || lat == null || Number.isNaN(lon) || Number.isNaN(lat)) return "Todavía no marcaste ningún punto.";
  const s = sectorDe(lon, lat);
  return s
    ? `Marcaste un punto dentro del Sector ${s.id} · ${s.nombre.replace(/^Sector /, "")} (SIMULADO).`
    : "Marcaste un punto fuera de los sectores simulados.";
}
