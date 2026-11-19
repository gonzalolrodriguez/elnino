/**
 * Contrato entre el hero (controles accesibles en HTML) y la escena 3D (cámara y agua).
 * La escena publica un `ControlCuenca`; el hero lo usa sin estado de React por cuadro: el avance se emite
 * a baja frecuencia y la barra se actualiza por DOM directo.
 */

export type ModoCuenca = "intro" | "recorrido" | "libre";

export type EstadoRecorrido = {
  modo: ModoCuenca;
  reproduciendo: boolean;
  /** Avance del recorrido, de 0 (nacientes, Mato Grosso) a 1 (confluencia con el Paraná). */
  p: number;
};

export type HitoRecorrido = { id: string; nombre: string; p: number };

export interface ControlCuenca {
  /** Hitos del río con su avance en el recorrido, de aguas arriba hacia aguas abajo. */
  hitos: HitoRecorrido[];
  irA: (p: number, opciones?: { instantaneo?: boolean }) => void;
  irAHito: (id: string, opciones?: { instantaneo?: boolean }) => void;
  jugar: () => void;
  pausar: () => void;
  /** Vuelve al encuadre de reposo (Formosa y el tramo hasta el Paraná) y sale del modo explorar. */
  volverInicio: () => void;
  explorar: (activo: boolean) => void;
  estado: () => EstadoRecorrido;
  suscribir: (f: (e: EstadoRecorrido) => void) => () => void;
}

/** Los cinco hitos que se ofrecen como atajos, en orden de recorrido. */
export const CHIPS_RECORRIDO = [
  { id: "pantanal", nombre: "Pantanal" },
  { id: "asuncion", nombre: "Asunción" },
  { id: "pilcomayo", nombre: "Puerto Pilcomayo" },
  { id: "formosa", nombre: "Puerto Formosa" },
  { id: "confluencia", nombre: "Confluencia con el Paraná" },
] as const;

export type IdHito = (typeof CHIPS_RECORRIDO)[number]["id"];

/** Hito cuyo avance está más cerca de `p` (null si no hay hitos). */
export function hitoMasCercano<T extends { p: number }>(p: number, hitos: T[]): T | null {
  let mejor: T | null = null;
  let d = Infinity;
  for (const h of hitos) {
    const dh = Math.abs(h.p - p);
    if (dh < d) {
      d = dh;
      mejor = h;
    }
  }
  return mejor;
}

/** Texto para lectores de pantalla: «42 %, cerca de Asunción». */
export function textoValor(p: number, hitos: HitoRecorrido[]): string {
  const pct = Math.round(Math.min(1, Math.max(0, p)) * 100);
  const h = hitoMasCercano(p, hitos);
  return h ? `${pct} %, cerca de ${h.nombre}` : `${pct} %`;
}

/** Avance de cada hito a partir de su fracción `u` del río y de la función que da la fracción del río alcanzada por el agua. */
export function avanceDeHito(u: number, frenteEn: (a: number) => number): number {
  if (u <= frenteEn(0)) return 0;
  if (u >= frenteEn(1)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (frenteEn(mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
