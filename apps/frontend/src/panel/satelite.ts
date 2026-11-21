import type { Categoria } from "@evacuaciones/shared";

import { fmtFecha, fmtNum } from "./ui";

/**
 * Agua observada por satélite (Sentinel-1 radar y Sentinel-2 óptico): ocho escenas de `data/geo/satelite/` copiadas a
 * `public/capas/satelite/` por `scripts/preparar-datos.mjs`. La imagen es DOCUMENTO DE REFERENCIA; la máscara de agua
 * es un producto derivado del equipo, sin validación a campo.
 */
export type EscenaSatelite = {
  id: string;
  fecha: string;
  sensor: "Sentinel-1" | "Sentinel-2";
  tipo: "radar" | "óptico";
  area_agua_km2: number | null;
  /** Máximo diario de Puerto Formosa (K1, DATO OBSERVADO) del día más cercano a la imagen. */
  altura_k1_m: number | null;
  fecha_k1: string;
  /** Solo Sentinel-2: el radar atraviesa las nubes. */
  nube_pct: number | null;
  /** Porcentaje de la zona de trabajo que cubre la escena: debajo de 100 el área de agua es parcial. */
  cobertura_aoi_pct: number | null;
  evento: string;
  archivo: string;
};

export type CatalogoSatelite = {
  categoria: Categoria;
  fuente: string;
  licencia: string;
  fecha_descarga: string;
  fecha_corte: string;
  /** Zona de trabajo: [oeste, sur, este, norte]. */
  zona: [number, number, number, number] | null;
  escenas: EscenaSatelite[];
};

/** Lo que recibe el mapa: el GeoJSON de la escena elegida (o `null` con la capa apagada) y la zona para encuadrar. */
export type CapaSatelite = { archivo: string | null; zona: [number, number, number, number] | null };

export const LEYENDA_SATELITE =
  "Imagen: Copernicus Sentinel-1/2 (Planetary Computer) · DOCUMENTO DE REFERENCIA. Máscara de agua: producto derivado (Otsu sobre VV dB / MNDWI con máscara de nubes SCL); puede confundir suelo húmedo, bañados o vegetación inundada; áreas S1 y S2 no comparables entre sí.";

export async function cargarEscenasSatelite(): Promise<CatalogoSatelite> {
  const r = await fetch(`${import.meta.env.BASE_URL}capas/satelite/escenas.json`);
  if (!r.ok) throw new Error("No se pudo cargar la lista de imágenes de satélite.");
  const c = (await r.json()) as CatalogoSatelite;
  return { ...c, escenas: [...c.escenas].sort((a, b) => a.fecha.localeCompare(b.fecha)) };
}

/** "09/01/2016 · Sentinel-1 radar": lo que ve la persona en el selector de fecha. */
export function etiquetaEscena(e: EscenaSatelite): string {
  return `${fmtFecha(e.fecha)} · ${e.sensor} ${e.tipo}`;
}

/** Nubes en texto: el radar no las ve ("no aplica"); el óptico informa el porcentaje enmascarado. */
export function textoNubes(e: EscenaSatelite): string {
  return e.nube_pct === null ? "no aplica (radar)" : `${fmtNum(e.nube_pct, 1)} %`;
}

export function textoCobertura(e: EscenaSatelite): string {
  if (e.cobertura_aoi_pct === null) return "sin dato";
  return `${fmtNum(e.cobertura_aoi_pct, 1)} %${e.cobertura_aoi_pct < 100 ? " (área de agua parcial)" : ""}`;
}
