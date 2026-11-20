/** Textos del seguimiento de la cuadrilla. La llegada es una estimación (SUPUESTO), nunca una promesa. */

/** "unos 12 min", "alrededor de 1 min", "unos 1 h 20 min". */
export function formatearLlegada(min: number | null | undefined): string | null {
  if (min === null || min === undefined || !Number.isFinite(min) || min < 0) return null;
  if (min === 0) return "ya está llegando";
  if (min === 1) return "alrededor de 1 min";
  if (min < 60) return `unos ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `unos ${h} h` : `unos ${h} h ${m} min`;
}

/** "250 m" (de a 10 m) o "3,4 km". */
export function formatearDistancia(m: number | null | undefined): string | null {
  if (m === null || m === undefined || !Number.isFinite(m) || m < 0) return null;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Hora local de Formosa de una marca ISO: "15:02". */
export function horaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

export const ETIQUETA_TIPO_CUADRILLA: Record<string, string> = { humana: "de asistencia a personas", ganadera: "de traslado de ganado", apicola: "de apicultura" };
