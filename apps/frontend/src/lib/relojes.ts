import { ASCENSO_LENTO_M_DIA, ASCENSO_RAPIDO_M_DIA, LLUVIA_CORTA_RIPIO_MM, LLUVIA_CORTA_TIERRA_MM } from "../datos/kit";

/** Lógica pura de "Tres relojes" (sin React): distancia a un umbral, rango de días y estado del camino según la lluvia. */

export type Distancia = { faltaM: number; alcanzado: boolean };

/** Metros que faltan para llegar al umbral; `alcanzado` si la altura ya lo igualó o superó. Redondea a centímetros. */
export function distanciaAUmbral(alturaM: number, umbralM: number): Distancia {
  const falta = Math.round((umbralM - alturaM) * 100) / 100;
  return falta <= 0 ? { faltaM: 0, alcanzado: true } : { faltaM: falta, alcanzado: false };
}

export type RangoDias = { minimo: number; maximo: number };

/**
 * Días hasta el umbral con ascenso lineal a tasa constante (SUPUESTO). El mínimo usa la tasa más rápida y el máximo la más lenta.
 * Devuelve null si ya se alcanzó o si alguna tasa no es positiva. Un decimal, igual que el backend.
 */
export function rangoDias(alturaM: number, umbralM: number, rapida = ASCENSO_RAPIDO_M_DIA, lenta = ASCENSO_LENTO_M_DIA): RangoDias | null {
  const { faltaM, alcanzado } = distanciaAUmbral(alturaM, umbralM);
  if (alcanzado || !(rapida > 0) || !(lenta > 0)) return null;
  const r = (t: number) => Math.round((faltaM / t) * 10) / 10;
  const a = r(rapida);
  const b = r(lenta);
  return { minimo: Math.min(a, b), maximo: Math.max(a, b) };
}

export type Superficie = "tierra" | "ripio";
export type EstadoCamino = "transitable" | "intransitable";

export const MM_CORTE: Record<Superficie, number> = { tierra: LLUVIA_CORTA_TIERRA_MM, ripio: LLUVIA_CORTA_RIPIO_MM };

/** Camino de tierra cortado con 30 mm o más; de ripio con 80 mm o más (SUPUESTO). Lluvia inválida o negativa cuenta como 0. */
export function estadoCamino(mm: number, superficie: Superficie): EstadoCamino {
  const llovido = Number.isFinite(mm) && mm > 0 ? mm : 0;
  return llovido >= MM_CORTE[superficie] ? "intransitable" : "transitable";
}

/** Fracción entre 0 y 1, acotada, para dibujar el arco. */
export function fraccion(valor: number, maximo: number): number {
  if (!(maximo > 0) || !Number.isFinite(valor)) return 0;
  return Math.min(1, Math.max(0, valor / maximo));
}

/**
 * Margen entre el compromiso de un sector y la alerta. Positivo: el sector se compromete antes de que el río llegue a la alerta
 * (S4: se compromete en 7,50 m, 0,30 m antes de 7,80 m).
 */
export function margenAntesDeAlerta(compromisoM: number, alertaM: number): number {
  return Math.round((alertaM - compromisoM) * 100) / 100;
}

/** Texto del rango, p. ej. "entre 6,1 y 20,4 días". */
export function textoRango(r: RangoDias): string {
  const f = (n: number) => n.toFixed(1).replace(".", ",");
  return `entre ${f(r.minimo)} y ${f(r.maximo)} días`;
}
