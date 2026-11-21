import { ASCENSO_LENTO_M_DIA, ASCENSO_RAPIDO_M_DIA, LLUVIA_CORTA_RIPIO_MM, LLUVIA_CORTA_TIERRA_MM } from "../datos/kit";

/**
 * Reloj dual río/barro (lógica pura, sin React). Estima en cuántas horas cada sector K10 queda comprometido (río) o aislado
 * (río + barro), con las mismas reglas que `app/domain/escenario.py`:
 * - comprometido: altura >= compromiso del sector (K10, disparador oficial);
 * - acceso de tierra cortado con 30 mm o más, o anegado si el sector está comprometido; ripio cortado con 80 mm o más;
 *   pavimento no se corta por lluvia; un acceso cerrado por el operador está cortado desde ya;
 * - sector aislado: tiene accesos y ninguno queda transitable.
 *
 * Es una proyección SIMULADA: ascenso lineal del río entre la tasa rápida (0,36 m/día, 2019) y la lenta (0,1077 m/día,
 * octubre 2026) y lluvia a ritmo constante (SUPUESTO). No reemplaza el escenario calculado por el backend.
 */

/** Ritmo de lluvia supuesto, en mm por hora (SUPUESTO `ritmo_lluvia_mm_h`, configurable desde el reloj). */
export const RITMO_LLUVIA_MM_H_DEFECTO = 5;
export const RITMOS_LLUVIA_MM_H = [2, 5, 10] as const;

/** Horizonte máximo que se muestra (SUPUESTO `dias_proyeccion_horizonte`: 60 días). */
export const HORIZONTE_H = 60 * 24;

/** Rango de horas: `minimo` con la condición más rápida y `maximo` con la más lenta. 0 = ya ocurrió; Infinity = no ocurre por esta vía. */
export type RangoHoras = { minimo: number; maximo: number };

export type SectorProy = { id: string; nombre: string; compromiso_m: number };
export type AccesoProy = { id: number; sector_id: string | null; superficie: string; cerrado: boolean };

export type EventoSector = "comprometido" | "aislado";

export type ProyeccionSector = {
  id: string;
  nombre: string;
  /** Horas hasta que el río llega al compromiso del sector. */
  compromiso: RangoHoras;
  /** Horas hasta que el sector queda sin accesos transitables (null si no tiene accesos cargados). */
  aislamiento: RangoHoras | null;
  /** Lo primero que le pasa al sector (mínimo de ambos relojes); ante empate, aislado. */
  evento: EventoSector;
  rango: RangoHoras;
};

const YA: RangoHoras = { minimo: 0, maximo: 0 };
const NUNCA: RangoHoras = { minimo: Infinity, maximo: Infinity };
const redondear = (h: number) => (Number.isFinite(h) ? Math.round(h * 10) / 10 : h);

/** Horas hasta que el río sube de `alturaM` a `objetivoM` con ascenso lineal (SUPUESTO). Redondea la distancia a centímetros, como el backend. */
export function horasHastaAltura(alturaM: number, objetivoM: number, rapidaMDia = ASCENSO_RAPIDO_M_DIA, lentaMDia = ASCENSO_LENTO_M_DIA): RangoHoras {
  const falta = Math.round((objetivoM - alturaM) * 100) / 100;
  if (falta <= 0) return YA;
  const h = (tasa: number) => (tasa > 0 ? redondear((falta / tasa) * 24) : Infinity);
  const a = h(rapidaMDia);
  const b = h(lentaMDia);
  return { minimo: Math.min(a, b), maximo: Math.max(a, b) };
}

/** Horas hasta que la lluvia acumulada alcanza `umbralMm` a `ritmoMmH` (SUPUESTO). 0 si ya llegó; Infinity si no llueve. */
export function horasHastaLluvia(lluviaMm: number, umbralMm: number, ritmoMmH = RITMO_LLUVIA_MM_H_DEFECTO): number {
  const llovido = Number.isFinite(lluviaMm) && lluviaMm > 0 ? lluviaMm : 0;
  const falta = umbralMm - llovido;
  if (falta <= 0) return 0;
  return ritmoMmH > 0 ? redondear(falta / ritmoMmH) : Infinity;
}

/** Horas hasta que un acceso deja de ser transitable. */
export function horasCorteAcceso(acceso: AccesoProy, compromisoM: number, alturaM: number, lluviaMm: number, ritmoMmH = RITMO_LLUVIA_MM_H_DEFECTO): RangoHoras {
  if (acceso.cerrado) return YA;
  if (acceso.superficie === "ripio") {
    const h = horasHastaLluvia(lluviaMm, LLUVIA_CORTA_RIPIO_MM, ritmoMmH);
    return { minimo: h, maximo: h };
  }
  if (acceso.superficie === "tierra") {
    const barro = horasHastaLluvia(lluviaMm, LLUVIA_CORTA_TIERRA_MM, ritmoMmH);
    const rio = horasHastaAltura(alturaM, compromisoM); // anegado cuando el sector se compromete
    return { minimo: Math.min(barro, rio.minimo), maximo: Math.min(barro, rio.maximo) };
  }
  return NUNCA;
}

/** Horas hasta que el sector queda aislado: el último de sus accesos en cortarse. null si no tiene accesos (el backend no lo marca aislado). */
export function horasAislamiento(accesos: AccesoProy[], compromisoM: number, alturaM: number, lluviaMm: number, ritmoMmH = RITMO_LLUVIA_MM_H_DEFECTO): RangoHoras | null {
  if (accesos.length === 0) return null;
  const cortes = accesos.map((a) => horasCorteAcceso(a, compromisoM, alturaM, lluviaMm, ritmoMmH));
  return { minimo: Math.max(...cortes.map((c) => c.minimo)), maximo: Math.max(...cortes.map((c) => c.maximo)) };
}

export function proyectarSector(sector: SectorProy, accesos: AccesoProy[], alturaM: number, lluviaMm: number, ritmoMmH = RITMO_LLUVIA_MM_H_DEFECTO): ProyeccionSector {
  const propios = accesos.filter((a) => a.sector_id === sector.id);
  const compromiso = horasHastaAltura(alturaM, sector.compromiso_m);
  const aislamiento = horasAislamiento(propios, sector.compromiso_m, alturaM, lluviaMm, ritmoMmH);
  const aisladoPrimero = aislamiento !== null && aislamiento.minimo <= compromiso.minimo;
  return {
    id: sector.id,
    nombre: sector.nombre,
    compromiso,
    aislamiento,
    evento: aisladoPrimero ? "aislado" : "comprometido",
    rango: aisladoPrimero && aislamiento ? aislamiento : compromiso,
  };
}

/** Sector más expuesto: el de menor tiempo hasta su primer evento (ante empate, el de mayor tiempo máximo más corto). null si la lista está vacía. */
export function sectorMasExpuesto(proyecciones: ProyeccionSector[]): ProyeccionSector | null {
  let mejor: ProyeccionSector | null = null;
  for (const p of proyecciones) {
    if (!mejor || p.rango.minimo < mejor.rango.minimo || (p.rango.minimo === mejor.rango.minimo && p.rango.maximo < mejor.rango.maximo)) mejor = p;
  }
  return mejor;
}

const coma = (n: number, dec = 0) => n.toFixed(dec).replace(".", ",");

/** Una cantidad de horas en texto corto: "<1 h", "14 h", "3,2 días" o "más de 60 días". */
export function textoHoras(h: number): string {
  if (h > HORIZONTE_H || !Number.isFinite(h)) return `más de ${HORIZONTE_H / 24} días`;
  if (h < 1) return "<1 h";
  if (h < 72) return `${coma(Math.round(h))} h`;
  return `${coma(h / 24, 1)} días`;
}

/** Rango en texto: "ya", "~14 h", "entre 14 h y 2,1 días" o "más de 60 días". */
export function textoRangoHoras(r: RangoHoras): string {
  if (r.maximo <= 0) return "ya";
  if (r.minimo > HORIZONTE_H || !Number.isFinite(r.minimo)) return `más de ${HORIZONTE_H / 24} días`;
  const a = textoHoras(r.minimo);
  const b = textoHoras(r.maximo);
  return a === b ? `~${a}` : `entre ${a} y ${b}`;
}

/** Mensaje destacado del sector más expuesto, p. ej. "S4 queda aislado en ~6 h" o "S4 ya está aislado". */
export function mensajeExpuesto(p: ProyeccionSector): string {
  const verbo = p.evento === "aislado" ? "aislado" : "comprometido";
  if (p.rango.maximo <= 0) return `${p.id} ya está ${verbo}`;
  const t = textoRangoHoras(p.rango);
  if (t.startsWith("más de")) return `Ningún sector se compromete ni se aísla en los próximos ${HORIZONTE_H / 24} días con estos supuestos`;
  return `${p.id} queda ${verbo} ${t.startsWith("entre") ? t : `en ${t}`}`;
}
