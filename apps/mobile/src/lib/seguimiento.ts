import type { Coordenadas } from "@/lib/dispositivo";

/**
 * Lógica pura del seguimiento de la cuadrilla («Cuadrilla en camino»). La llegada es una estimación
 * (SUPUESTO), nunca una promesa. Contrato: docs/contrato_api.md · «Seguimiento de la cuadrilla».
 */

/** Cada cuánto envía su posición la cuadrilla (el servidor admite una cada 10 s) y cada cuánto se refresca la tarjeta. */
export const INTERVALO_ENVIO_MS = 30_000;
export const INTERVALO_REFRESCO_MS = 20_000;

/** "unos 12 min", "alrededor de 1 min", "unos 1 h 20 min". `null` si no hay estimación. */
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

/** Hora local de Formosa de una marca ISO ("15:02"); evita depender de `Intl` en el teléfono. */
export function horaLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t - 3 * 3600_000); // Formosa es UTC-3 todo el año
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}

/** Verdadero si pasaron más de `limiteMin` minutos desde `iso` (o si la marca es ilegible). */
export function esPosicionVieja(iso: string | null | undefined, ahoraMs: number, limiteMin: number): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return ahoraMs - t > limiteMin * 60_000;
}

/**
 * Progreso (0 a 1) del recorrido para la barra: 1 - distancia actual / mayor distancia vista en este
 * seguimiento. Sin referencia o sin distancia no hay progreso que mostrar (`null`).
 */
export function progresoRecorrido(actualM: number | null | undefined, maximaM: number | null | undefined): number | null {
  if (actualM === null || actualM === undefined || !maximaM || maximaM <= 0) return null;
  return Math.min(1, Math.max(0, 1 - actualM / maximaM));
}

/**
 * Buffer de una sola posición: si no hay red se conserva solo la última y se reenvía; nunca se acumulan.
 * Pisar una posición pendiente con otra más nueva es el comportamiento buscado.
 */
export class UltimaPosicion {
  private actual: { coordenadas: Coordenadas; precisionM: number | null; tomadaEn: number } | null = null;

  guardar(coordenadas: Coordenadas, precisionM: number | null, tomadaEn = Date.now()): void {
    this.actual = { coordenadas, precisionM, tomadaEn };
  }

  pendiente() {
    return this.actual;
  }

  /** Marca como enviada la posición indicada; si mientras tanto llegó una más nueva, esa se conserva. */
  enviada(tomadaEn: number): void {
    if (this.actual && this.actual.tomadaEn === tomadaEn) this.actual = null;
  }

  limpiar(): void {
    this.actual = null;
  }
}
