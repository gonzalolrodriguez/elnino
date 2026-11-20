/**
 * Geometría pura para animar un vehículo sobre una ruta (sin DOM ni mapa, para poder probarla).
 * Las coordenadas son pares [lon, lat] en grados; las distancias, en metros.
 */
export type Par = [number, number];

const RADIO_TIERRA_M = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia entre dos puntos por la fórmula de haversine. */
export function haversine(a: Par, b: Par): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial de a hacia b en grados (0 = norte, 90 = este). */
export function rumbo(a: Par, b: Par): number {
  const f1 = rad(a[1]);
  const f2 = rad(b[1]);
  const dl = rad(b[0] - a[0]);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
}

/** Distancia acumulada en cada vértice: `acum[0] = 0` y `acum[n-1]` es el largo total. */
export function acumuladas(ruta: Par[]): number[] {
  const acum: number[] = [];
  let total = 0;
  for (let i = 0; i < ruta.length; i++) {
    if (i > 0) total += haversine(ruta[i - 1], ruta[i]);
    acum.push(total);
  }
  return acum;
}

export const largoTotal = (acum: number[]): number => (acum.length ? acum[acum.length - 1] : 0);

/** Índice del tramo [i, i+1] que contiene la distancia `d` (búsqueda binaria). */
function tramoDe(acum: number[], d: number): number {
  let lo = 0;
  let hi = acum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (acum[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Punto de la ruta a la distancia `d` desde el inicio (se acota a [0, largo]). */
export function puntoEn(ruta: Par[], acum: number[], d: number): Par {
  if (ruta.length === 0) return [0, 0];
  if (ruta.length === 1) return ruta[0];
  const dd = limitar(d, 0, largoTotal(acum));
  const i = tramoDe(acum, dd);
  const largo = acum[i + 1] - acum[i];
  const t = largo > 0 ? (dd - acum[i]) / largo : 0;
  return [ruta[i][0] + (ruta[i + 1][0] - ruta[i][0]) * t, ruta[i][1] + (ruta[i + 1][1] - ruta[i][1]) * t];
}

/** Rumbo del tramo en el que está la distancia `d`. Si el tramo no tiene largo, busca el siguiente con largo. */
export function rumboEn(ruta: Par[], acum: number[], d: number): number {
  if (ruta.length < 2) return 0;
  let i = tramoDe(acum, limitar(d, 0, largoTotal(acum)));
  while (i < ruta.length - 2 && acum[i + 1] - acum[i] === 0) i++;
  while (i > 0 && acum[i + 1] - acum[i] === 0) i--;
  return rumbo(ruta[i], ruta[i + 1]);
}

/** Parte la ruta en lo recorrido y lo que falta; ambos tramos comparten el punto de corte. */
export function dividir(ruta: Par[], acum: number[], d: number): { recorrida: Par[]; restante: Par[] } {
  if (ruta.length < 2) return { recorrida: [], restante: ruta.slice() };
  const dd = limitar(d, 0, largoTotal(acum));
  const i = tramoDe(acum, dd);
  const corte = puntoEn(ruta, acum, dd);
  return {
    recorrida: [...ruta.slice(0, i + 1), corte],
    restante: [corte, ...ruta.slice(i + 1)],
  };
}

/** Proyecta un punto sobre la ruta (aproximación plana local) y devuelve la distancia a lo largo de ella. */
export function proyectar(ruta: Par[], acum: number[], p: Par): { distancia: number; desvio: number } {
  if (ruta.length === 0) return { distancia: 0, desvio: 0 };
  if (ruta.length === 1) return { distancia: 0, desvio: haversine(ruta[0], p) };
  const kx = Math.cos(rad(p[1]));
  let mejor = { distancia: 0, desvio: Infinity };
  for (let i = 0; i < ruta.length - 1; i++) {
    const [ax, ay] = ruta[i];
    const dx = (ruta[i + 1][0] - ax) * kx;
    const dy = ruta[i + 1][1] - ay;
    const px = (p[0] - ax) * kx;
    const py = p[1] - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? limitar((px * dx + py * dy) / l2, 0, 1) : 0;
    const cercano: Par = [ax + (ruta[i + 1][0] - ax) * t, ay + dy * t];
    const desvio = haversine(cercano, p);
    if (desvio < mejor.desvio) mejor = { distancia: acum[i] + (acum[i + 1] - acum[i]) * t, desvio };
  }
  return mejor;
}

/**
 * Estimación por «navegación a estima»: desde la última distancia conocida, avanza `velocidad` durante el tiempo
 * transcurrido. Se acota al final de la ruta y, con `maxSegundos`, a un horizonte de extrapolación.
 */
export function estimarDistancia(p: { base: number; velocidadKmh: number; transcurridoMs: number; largo: number; maxSegundos?: number }): number {
  const segundos = Math.max(0, p.transcurridoMs / 1000);
  const util = p.maxSegundos === undefined ? segundos : Math.min(segundos, p.maxSegundos);
  const v = Number.isFinite(p.velocidadKmh) && p.velocidadKmh > 0 ? (p.velocidadKmh * 1000) / 3600 : 0;
  return limitar(p.base + v * util, 0, p.largo);
}

/**
 * Acerca la distancia mostrada a la objetivo con suavizado exponencial (`tauMs` = constante de tiempo).
 * No retrocede salvo que el objetivo quede más de `retrocesoMaxM` por detrás (ruta recalculada).
 */
export function suavizar(actual: number, objetivo: number, dtMs: number, tauMs = 700, retrocesoMaxM = 150): number {
  if (objetivo < actual && actual - objetivo <= retrocesoMaxM) return actual;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  const nuevo = actual + (objetivo - actual) * k;
  return Math.abs(objetivo - nuevo) < 0.5 ? objetivo : nuevo;
}

/** Minutos que faltan (redondeo hacia arriba) a la velocidad dada; null si no se puede calcular. */
export function minutosRestantes(restanteM: number, velocidadKmh: number): number | null {
  if (!Number.isFinite(restanteM) || !Number.isFinite(velocidadKmh) || velocidadKmh <= 0) return null;
  if (restanteM <= 0) return 0;
  return Math.ceil(restanteM / ((velocidadKmh * 1000) / 60));
}
