import { rgbaDe } from "../estilo/paleta";

/**
 * Lámina de agua ilustrativa de los sectores (lógica pura, sin React ni deck.gl).
 *
 * No es un modelo hidráulico: solo muestra cuánto supera la altura de Puerto Formosa la altura de compromiso
 * de cada sector (K10, SIMULADO). El estado oficial del simulador sigue viniendo del backend.
 */

export type RGBA = [number, number, number, number];

/** Margen de riesgo: un sector está en riesgo a 0,50 m o menos de su compromiso (SUPUESTO `margen_riesgo_m`, ya en la ficha de fuentes). */
export const MARGEN_RIESGO_M = 0.5;

/** Altura de la lámina sobre el mapa: metros dibujados por cada metro de excedente (parámetro de visualización, no una medida). */
export const EXAGERACION_VERTICAL = 150;

/** Excedente a partir del cual el color ya no se oscurece más (parámetro de visualización). */
export const PROFUNDIDAD_SATURADA_M = 3;

/** Hitos que recorre "Reproducir subida": compromiso de S4 (K10), alerta y evacuación (K3). */
export const HITOS_M = [
  { valor: 7.5, texto: "compromiso de S4 (K10)" },
  { valor: 7.8, texto: "alerta (K3)" },
  { valor: 8.3, texto: "evacuación (K3)" },
] as const;

/** Duración de "Reproducir subida" (parámetro de visualización). */
export const DURACION_REPRODUCCION_MS = 7000;

export type EstadoLamina = "seco" | "en_riesgo" | "inundado";

/** Metros por encima de la altura de compromiso (0 si no la supera). */
export function excedenteM(altura: number, compromiso: number): number {
  return Math.max(0, altura - compromiso);
}

export function estadoLamina(altura: number, compromiso: number): EstadoLamina {
  if (altura >= compromiso) return "inundado";
  return altura >= compromiso - MARGEN_RIESGO_M ? "en_riesgo" : "seco";
}

/** Nivel visual 0 a 1: excedente sobre la profundidad que satura el color. */
export function nivelVisual(excedente: number): number {
  return Math.min(1, Math.max(0, excedente / PROFUNDIDAD_SATURADA_M));
}

/** Altura dibujada de la lámina, en metros del mapa (exagerada). */
export function elevacionVisualM(excedente: number): number {
  return Math.max(0, excedente) * EXAGERACION_VERTICAL;
}

const CIELO = rgbaDe("agua.100");
const RIO = rgbaDe("agua.700");
const ALERTA = rgbaDe("alerta.600");
const EVACUACION = rgbaDe("evacuacion.700");

const mezcla = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** Color por profundidad: del celeste del cielo al azul del río; más opaco cuanto más profundo. */
export function colorProfundidad(nivel: number): RGBA {
  const t = Math.min(1, Math.max(0, nivel));
  return [mezcla(CIELO[0], RIO[0], t), mezcla(CIELO[1], RIO[1], t), mezcla(CIELO[2], RIO[2], t), mezcla(110, 225, t)];
}

/** Color de relleno de la lámina de un sector: transparente si está seco o solo en riesgo. */
export function colorLamina(altura: number, compromiso: number): RGBA {
  const exc = excedenteM(altura, compromiso);
  if (estadoLamina(altura, compromiso) !== "inundado") return [CIELO[0], CIELO[1], CIELO[2], 0];
  // Un mínimo de nivel para que el primer centímetro ya se vea.
  return colorProfundidad(Math.max(0.08, nivelVisual(exc)));
}

/** Borde de advertencia: solo para los sectores en riesgo. */
export function colorBordeRiesgo(altura: number, compromiso: number): RGBA {
  return estadoLamina(altura, compromiso) === "en_riesgo" ? ALERTA : [ALERTA[0], ALERTA[1], ALERTA[2], 0];
}

/** Color del hito de la altura (alerta y evacuación del río), para el rótulo de la reproducción. */
export function colorUmbralRio(altura: number): RGBA {
  if (altura >= 8.3) return EVACUACION;
  if (altura >= 7.8) return ALERTA;
  return RIO;
}

/** Altura en un instante de la reproducción (interpolación lineal, t de 0 a 1). */
export function alturaEnProgreso(desde: number, hasta: number, t: number): number {
  const f = Math.min(1, Math.max(0, t));
  return desde + (hasta - desde) * f;
}

/** Hitos que se cruzan al subir de `desde` a `hasta`. */
export function hitosEnRecorrido(desde: number, hasta: number): typeof HITOS_M[number][] {
  return HITOS_M.filter((h) => h.valor > desde && h.valor <= hasta);
}

/** Último hito alcanzado a esa altura (para el rótulo mientras se reproduce), o null. */
export function ultimoHito(altura: number): typeof HITOS_M[number] | null {
  const alcanzados = HITOS_M.filter((h) => altura >= h.valor);
  return alcanzados.length > 0 ? alcanzados[alcanzados.length - 1] : null;
}

type Punto = [number, number];

/**
 * Parte una línea en trazos (largo `trazo`, en las unidades de las coordenadas) separados por huecos del mismo largo.
 * Sirve para dibujar discontinuo sin extensiones de deck.gl.
 */
export function discontinuar(linea: Punto[], trazo: number): Punto[][] {
  if (linea.length < 2 || trazo <= 0) return [];
  const salida: Punto[][] = [];
  let actual: Punto[] = [];
  let dibujando = true;
  let restante = trazo;
  actual.push(linea[0]);
  for (let i = 1; i < linea.length; i++) {
    let [x0, y0] = linea[i - 1];
    const [x1, y1] = linea[i];
    let largo = Math.hypot(x1 - x0, y1 - y0);
    while (largo > restante) {
      const f = restante / largo;
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f;
      if (dibujando) {
        actual.push([x, y]);
        salida.push(actual);
        actual = [];
      } else {
        actual = [[x, y]];
      }
      dibujando = !dibujando;
      largo -= restante;
      x0 = x;
      y0 = y;
      restante = trazo;
    }
    restante -= largo;
    if (dibujando) actual.push([x1, y1]);
  }
  if (dibujando && actual.length >= 2) salida.push(actual);
  return salida;
}
