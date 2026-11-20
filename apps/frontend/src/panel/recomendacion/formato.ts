import type { Veredicto } from "../tipos";
import { fmtNum } from "../ui";

/** Muestra valores heterogéneos de la comparación (números, listas y diccionarios). */
export function fmtValor(v: unknown): string {
  if (v === null || v === undefined) return "sin dato";
  if (typeof v === "number") return fmtNum(v, Number.isInteger(v) ? 0 : 1);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.length === 0 ? "ninguno" : v.map(fmtValor).join(", ");
  if (typeof v === "object") {
    const partes = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => !(Array.isArray(x) && x.length === 0) && x !== 0)
      .map(([k, x]) => `${k.replace(/_/g, " ")}: ${fmtValor(x)}`);
    return partes.length ? partes.join("; ") : "ninguno";
  }
  return String(v);
}

/** Un diccionario (viajes por vehículo, faltantes) como una línea por clave. */
export function lineasDeValor(v: unknown): string[] {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    const lineas = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => !(Array.isArray(x) && x.length === 0) && x !== 0)
      .map(([k, x]) => `${k.replace(/_/g, " ")}: ${fmtValor(x)}`);
    return lineas.length ? lineas : ["ninguno"];
  }
  return [fmtValor(v)];
}

export const NOMBRE_VEREDICTO: Record<Veredicto, string> = {
  alcanza: "alcanza a tiempo",
  justo: "llega justo",
  no_alcanza: "no alcanza",
  ya_comprometido: "ya comprometido: emergencia",
  sin_estimacion: "sin estimación",
};

export const NOMBRE_METODO: Record<string, string> = {
  red_vial: "por la red vial (OSM)",
  aproximado: "aproximado (línea recta × desvío)",
  lancha_linea_recta: "en lancha (línea recta)",
  arreo_aproximado: "arreo a pie (aproximado)",
};

export function fmtH(h: number | null | undefined): string {
  if (h === null || h === undefined) return "sin dato";
  return h < 48 ? `${fmtNum(h, 1)} h` : `${fmtNum(h / 24, 1)} días`;
}

/** Métricas de la comparación en las que un valor mayor es mejor; en el resto de las numéricas, menor es mejor. */
const MAYOR_ES_MEJOR = new Set(["personas_evacuadas", "animales_con_cupo", "familias_juntas"]);
const MENOR_ES_MEJOR = new Set([
  "personas_sin_lugar",
  "animales_sin_cupo",
  "camiones_jaula_necesarios",
  "tiempo_primer_sector_min",
  "tiempo_total_min",
  "accesos_vulnerables_usados",
  "sectores_no_alcanzan",
  "sectores_justos",
  "familias_sin_lugar_entero",
  "personas_minuto",
]);

/**
 * Posiciones de la fila con el mejor valor. Devuelve un conjunto vacío si la métrica no se ordena
 * (diccionarios, listas) o si todas las alternativas valen lo mismo (no hay nada que destacar).
 */
export function mejoresDeFila(metrica: string, valores: unknown[]): Set<number> {
  const mayor = MAYOR_ES_MEJOR.has(metrica);
  if (!mayor && !MENOR_ES_MEJOR.has(metrica)) return new Set();
  const nums = valores.map((v) => (typeof v === "number" ? v : null));
  const validos = nums.filter((n): n is number => n !== null);
  if (validos.length < 2 || validos.every((n) => n === validos[0])) return new Set();
  const mejor = mayor ? Math.max(...validos) : Math.min(...validos);
  return new Set(nums.flatMap((n, i) => (n === mejor ? [i] : [])));
}
