import { sectorDe } from "../datos/kit";

/** Texto en vivo bajo el mapa: en qué sector K10 (SIMULADO) cae el punto marcado. */
export function textoPuntoEnSector(lon: number | null, lat: number | null): string {
  if (lon === null || lat === null || Number.isNaN(lon) || Number.isNaN(lat)) return "Todavía no marcaste ningún punto.";
  const s = sectorDe(lon, lat);
  return s
    ? `Marcaste un punto dentro del Sector ${s.id} · ${s.nombre.replace(/^Sector /, "")} (SIMULADO).`
    : "Marcaste un punto fuera de los sectores simulados.";
}
