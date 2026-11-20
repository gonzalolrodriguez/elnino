/**
 * Lógica pura de la «Brújula sin conexión» (sin React ni sensores): rumbo y distancia en línea recta
 * entre dos puntos, rumbo cardinal en español, elección del destino más cercano y formatos de texto.
 * La flecha NO es un camino: solo indica la dirección general hacia el destino.
 */

export type Punto = { lat: number; lon: number };

export type Destino = {
  id: number;
  nombre: string;
  lat: number;
  lon: number;
  /** Categoría que informa el backend (la capacidad de los centros es SIMULADO). */
  categoria: "DATO OBSERVADO" | "DOCUMENTO DE REFERENCIA" | "SIMULADO";
};

const RADIO_TIERRA_M = 6_371_000;
const aRad = (g: number) => (g * Math.PI) / 180;
const aGrados = (r: number) => (r * 180) / Math.PI;

/** Lleva cualquier ángulo al rango [0, 360). */
export function normalizar360(grados: number): number {
  const r = grados % 360;
  return r < 0 ? r + 360 : r === 0 ? 0 : r;
}

/** Diferencia angular más corta, en (-180, 180]: positivo = girar a la derecha (horario). */
export function diferenciaAngular(deDeg: number, aDeg: number): number {
  const d = normalizar360(aDeg - deDeg);
  return d > 180 ? d - 360 : d;
}

/** Rumbo inicial (0° = norte, 90° = este) del círculo máximo de `a` hacia `b`. */
export function rumboInicial(a: Punto, b: Punto): number {
  const f1 = aRad(a.lat);
  const f2 = aRad(b.lat);
  const dl = aRad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return normalizar360(aGrados(Math.atan2(y, x)));
}

/** Distancia en línea recta (haversine) en metros. */
export function distanciaM(a: Punto, b: Punto): number {
  const f1 = aRad(a.lat);
  const f2 = aRad(b.lat);
  const df = f2 - f1;
  const dl = aRad(b.lon - a.lon);
  const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const CARDINALES = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"] as const;

/** Rumbo cardinal de 8 puntos en español («noreste»). */
export function rumboCardinal(grados: number): string {
  return CARDINALES[Math.round(normalizar360(grados) / 45) % 8];
}

/** Destino más cercano en línea recta, o `null` si la lista está vacía. */
export function elegirMasCercano(desde: Punto, destinos: Destino[]): Destino | null {
  let mejor: Destino | null = null;
  let mejorD = Infinity;
  for (const d of destinos) {
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon)) continue;
    const dist = distanciaM(desde, d);
    if (dist < mejorD) {
      mejor = d;
      mejorD = dist;
    }
  }
  return mejor;
}

/** «250 m» (de a 10) o «2,3 km» (un decimal, con coma). */
export function formatearDistanciaBrujula(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Igual que la anterior pero para lectores de pantalla («2,3 kilómetros», «250 metros»). */
export function formatearDistanciaHablada(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "una distancia desconocida";
  if (m < 1000) return `${Math.round(m / 10) * 10} metros`;
  const km = (m / 1000).toFixed(1).replace(".", ",");
  return km === "1,0" ? "1 kilómetro" : `${km} kilómetros`;
}

/** Hora de la marca de tiempo en el teléfono, «dd/mm hh:mm». */
export function formatearGuardado(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export type LecturaRumbo = { trueHeading?: number; magHeading?: number; accuracy?: number };

/**
 * Rumbo del teléfono: usa `trueHeading` si es válido (≥ 0), si no `magHeading`. Es confiable cuando
 * el sensor informa calibración media o alta (accuracy ≥ 2); sin `accuracy` se acepta la lectura.
 */
export function rumboDelTelefono(l: LecturaRumbo | null): { grados: number; confiable: boolean } | null {
  if (!l) return null;
  const verdadero = typeof l.trueHeading === "number" && l.trueHeading >= 0 ? l.trueHeading : null;
  const magnetico = typeof l.magHeading === "number" && l.magHeading >= 0 ? l.magHeading : null;
  const grados = verdadero ?? magnetico;
  if (grados === null || !Number.isFinite(grados)) return null;
  const confiable = typeof l.accuracy === "number" ? l.accuracy >= 2 : true;
  return { grados: normalizar360(grados), confiable };
}

/** Descripción para el lector de pantalla y texto de rumbo: «Dirigite hacia el noreste, a 2,3 kilómetros de Centro X». */
export function descripcionDireccion(rumbo: number, distancia: number, nombre: string): string {
  return `Dirigite hacia el ${rumboCardinal(rumbo)}, a ${formatearDistanciaHablada(distancia)} de ${nombre}`;
}

/** Texto corto sin sensor: «al noreste, a 2,3 km». */
export function rumboEnTexto(rumbo: number, distancia: number): string {
  return `al ${rumboCardinal(rumbo)}, a ${formatearDistanciaBrujula(distancia)}`;
}
