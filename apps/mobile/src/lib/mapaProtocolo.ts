/**
 * Protocolo entre la app y el mapa abierto (Leaflet + OpenStreetMap dentro de un WebView).
 * Todo viaja como texto JSON por `postMessage` / `onMessage`; el mapa nunca recibe HTML ni código.
 * Las coordenadas son pares [lon, lat] en grados.
 */
export type Par = [number, number];

export type SectorMapa = {
  id: string;
  /** Rótulo corto dibujado sobre el polígono (p. ej. «S4»). */
  etiqueta: string;
  anillo: Par[];
  /** Color CSS hex (#rrggbb) del trazo y del relleno. */
  color: string;
};

export type PuntoCapa = {
  id: string;
  lon: number;
  lat: number;
  /** Texto accesible del marcador. */
  etiqueta: string;
  /** La forma (no solo el color) distingue cada tipo de punto. */
  forma: "circulo" | "cuadrado" | "rombo";
  color: string;
};

/** Trazo sobre el mapa (p. ej. el desvío que indica el operativo). El color acompaña al texto, no lo reemplaza. */
export type LineaCapa = {
  id: string;
  /** Texto accesible del trazo. */
  etiqueta: string;
  coordenadas: Par[];
  /** Color CSS hex (#rrggbb). */
  color: string;
};

export type RutaMapa = {
  coordenadas: Par[];
  /** 0..1 sobre la ruta, medido en el momento en que llegó el dato. */
  progreso: number;
  velocidadKmh: number;
  /** Con ruta real (no simulada) la extrapolación se corta a un horizonte corto. */
  simulada: boolean;
};

/** App → mapa. */
export type MensajeAlMapa =
  | { t: "capas"; sectores: SectorMapa[]; puntos: PuntoCapa[]; lineas?: LineaCapa[] }
  | { t: "encuadre"; puntos: Par[]; zoomMax?: number }
  | { t: "vista"; centro: Par; zoom: number }
  /** Marcador del punto elegido; con `elegir` el mapa deja marcar tocando o arrastrando. */
  | { t: "seleccion"; punto: { lon: number; lat: number } | null; elegir: boolean }
  | { t: "ruta"; ruta: RutaMapa | null; vehiculo: string | null; reducido: boolean }
  | { t: "seguir"; seguir: boolean };

/** Mapa → app. */
export type MensajeDelMapa =
  | { t: "listo" }
  | { t: "punto"; lon: number; lat: number; origen: "clic" | "arrastre" }
  | { t: "avance"; restanteM: number; largoM: number }
  | { t: "sinTeselas" }
  | { t: "error"; mensaje: string };

const esNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Valida un mensaje recibido del WebView: cualquier otra cosa se descarta (nunca se confía en el contenido). */
export function parsearMensajeDelMapa(crudo: string): MensajeDelMapa | null {
  let o: unknown;
  try {
    o = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (typeof o !== "object" || o === null) return null;
  const m = o as Record<string, unknown>;
  switch (m.t) {
    case "listo":
      return { t: "listo" };
    case "sinTeselas":
      return { t: "sinTeselas" };
    case "punto":
      if (esNum(m.lon) && esNum(m.lat) && Math.abs(m.lon) <= 180 && Math.abs(m.lat) <= 90) {
        return { t: "punto", lon: m.lon, lat: m.lat, origen: m.origen === "arrastre" ? "arrastre" : "clic" };
      }
      return null;
    case "avance":
      return esNum(m.restanteM) && esNum(m.largoM) ? { t: "avance", restanteM: m.restanteM, largoM: m.largoM } : null;
    case "error":
      return { t: "error", mensaje: typeof m.mensaje === "string" ? m.mensaje.slice(0, 200) : "error" };
    default:
      return null;
  }
}

/** Texto que se muestra en lugar del mapa cuando no se puede dibujar. */
export const TEXTO_MAPA_SIN_INTERNET = "El mapa necesita internet; tus datos y la brújula funcionan igual.";
