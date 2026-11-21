/**
 * Climas conmutables del simulador (SIMULADO). Cada preset fija una altura de Puerto Formosa y una lluvia, y un ambiente
 * visual (niebla y lluvia dibujada). Son escenarios ilustrativos para explorar el simulador, no pronósticos.
 * Las cifras figuran en docs/ficha_fuentes.md.
 */

export type ClimaId = "seco" | "nino" | "tormenta";

/** Ambiente visual (parámetros de dibujo, no medidas). `null` en la niebla: la escena 3D queda como está por defecto. */
export type Ambiente = {
  /** Cuánto se agrisa la niebla de la escena 3D (0 = color de fondo original, 1 = gris). */
  mezclaNiebla: number;
  /** Distancias de la niebla en unidades de escena; null = las de la escena por defecto. */
  niebla: { cerca: number; lejos: number } | null;
  /** Intensidad de la lluvia dibujada, de 0 a 1. */
  lluvia: number;
};

export type Clima = {
  id: ClimaId;
  icono: string;
  etiqueta: string;
  altura_m: number;
  lluvia_mm: number;
  /** De dónde sale cada cifra del preset. */
  fuente: string;
  ambiente: Ambiente;
};

export const CLIMAS: readonly Clima[] = [
  {
    id: "seco",
    icono: "☀️",
    etiqueta: "Seco",
    altura_m: 4.96,
    lluvia_mm: 0,
    fuente: "4,96 m: lectura de K1 del 22/05/2026 (DATO OBSERVADO) usada como escenario; sin lluvia",
    ambiente: { mezclaNiebla: 0, niebla: null, lluvia: 0 },
  },
  {
    id: "nino",
    icono: "🌧️",
    etiqueta: "El Niño",
    altura_m: 7.6,
    lluvia_mm: 40,
    fuente: "7,60 m y 40 mm: ejemplo del escenario de la plataforma (SIMULADO)",
    ambiente: { mezclaNiebla: 0.3, niebla: { cerca: 4, lejos: 14 }, lluvia: 0.45 },
  },
  {
    id: "tormenta",
    icono: "⛈️",
    etiqueta: "Tormenta extrema",
    altura_m: 8.3,
    lluvia_mm: 90,
    fuente: "8,30 m: umbral de evacuación (K3); 90 mm: lluvia SIMULADA por encima del corte del ripio (80 mm)",
    ambiente: { mezclaNiebla: 0.5, niebla: { cerca: 2.5, lejos: 10 }, lluvia: 0.9 },
  },
];

export function climaPorId(id: ClimaId): Clima {
  return CLIMAS.find((c) => c.id === id) ?? CLIMAS[0];
}

/** Preset que coincide con la altura y la lluvia actuales (al centímetro y al milímetro), o null. */
export function climaDeEntrada(alturaM: number, lluviaMm: number): Clima | null {
  return CLIMAS.find((c) => Math.abs(c.altura_m - alturaM) < 0.005 && Math.abs(c.lluvia_mm - lluviaMm) < 0.5) ?? null;
}

/** Intensidad de la lluvia dibujada para una lluvia en mm (0 sin lluvia; satura en 100 mm). Parámetro de dibujo. */
export function intensidadLluvia(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(1, 0.15 + (mm / 100) * 0.85);
}
