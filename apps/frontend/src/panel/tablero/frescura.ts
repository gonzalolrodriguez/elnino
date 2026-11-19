/** Frescura de las capas de datos: qué tan viejo es cada dato frente al momento en que se generó el resumen. */

export type EstadoFrescura = "al_dia" | "al_corte" | "vieja" | "sin_dato" | "fija";

export type Frescura = { estado: EstadoFrescura; dias: number | null };

const MS_DIA = 86_400_000;

function dia(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

/**
 * - sin dato: no hay lectura.
 * - al corte: la lectura llega a la fecha de corte de datos (31/10/2026), que es lo más reciente permitido: no se espera nada más nuevo.
 * - al día: la lectura tiene `limiteDias` o menos de antigüedad.
 * - vieja: más antigua que el límite (se muestra con advertencia).
 */
export function evaluarFrescura(fecha: string | null | undefined, generadoEn: string, fechaCorte: string, limiteDias: number): Frescura {
  if (!fecha) return { estado: "sin_dato", dias: null };
  const dias = Math.max(0, Math.floor((dia(generadoEn) - dia(fecha)) / MS_DIA));
  if (dia(fecha) >= dia(fechaCorte)) return { estado: "al_corte", dias };
  return { estado: dias <= limiteDias ? "al_dia" : "vieja", dias };
}
