import { oklchAHex, type Oklch } from "./oklch";

/**
 * Sistema de color. Cada rampa se escribe en OKLCH (luminosidad, croma, matiz) y se compila a hex.
 *
 * Idea visual: escala limnimétrica sobre agua turbia del río Paraguay.
 *  - limo: fondo oscuro de la cabecera, el hero y el pie (matiz 205, agua profunda y barrosa)
 *  - pizarra: neutros con un toque verdoso del mismo matiz, para papel y texto
 *  - agua: verde azulado del cauce; es el color de las acciones y de los datos observados
 *  - alerta / evacuacion: repiten los colores de los umbrales de la escala (7,80 m y 8,30 m)
 *  - rio: azul, solo para "anegado" y las estaciones de la policía en el mapa
 */

export const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
type Rampa = Record<(typeof PASOS)[number], string> & { 950?: string };

const FACTOR_CROMA = [0.15, 0.3, 0.5, 0.7, 0.9, 1, 1, 0.95, 0.85, 0.7];
const L_BASE = [0.975, 0.945, 0.89, 0.83, 0.72, 0.6, 0.5, 0.42, 0.34, 0.26];

function rampa(h: number, c: number, l: readonly number[] = L_BASE): Rampa {
  const r = {} as Rampa;
  PASOS.forEach((p, i) => {
    r[p] = oklchAHex([l[i], c * FACTOR_CROMA[i], h]);
  });
  return r;
}

const limo = {
  ...rampa(205, 0.045, [0.95, 0.9, 0.82, 0.72, 0.6, 0.5, 0.42, 0.34, 0.28, 0.22]),
  950: oklchAHex([0.17, 0.03, 205]),
};
const pizarra = rampa(180, 0.02, [0.975, 0.955, 0.9, 0.82, 0.7, 0.52, 0.44, 0.36, 0.28, 0.21]);
const agua = rampa(188, 0.1);
// El paso 500 es el ámbar del umbral de alerta; 700 es el tono de texto sobre fondos claros (contraste AA).
const alerta = rampa(78, 0.15, [0.97, 0.94, 0.9, 0.86, 0.8, 0.75, 0.64, 0.52, 0.42, 0.34]);
const evacuacion = rampa(29, 0.19);
const rio = rampa(255, 0.12);
const verde = rampa(150, 0.13);

const papel = oklchAHex([0.995, 0.003, 165]);

const escala = {
  alerta: oklchAHex([0.75, 0.15, 78]),
  evacuacion: oklchAHex([0.54, 0.19, 29]),
  pico: oklchAHex([0.7, 0.02, 185]),
};

export const PAL = { limo, pizarra, agua, alerta, evacuacion, rio, verde, escala } as const;
export const PAPEL = papel;

/** Valores de origen en OKLCH de los colores de acento (documentación y pruebas). */
export const ORIGEN_OKLCH: Record<string, Oklch> = {
  "escala.alerta": [0.75, 0.15, 78],
  "escala.evacuacion": [0.54, 0.19, 29],
  "escala.pico": [0.7, 0.02, 185],
  papel: [0.995, 0.003, 165],
};

/**
 * Tokens semánticos: nombre -> referencia a una rampa. Los componentes usan estos nombres
 * (Chakra) y el código que necesita RGB (SVG, canvas, WebGL, Deck.gl) los resuelve con `hexDe`.
 */
export const SEMANTICOS = {
  fondo: "pizarra.50",
  superficie: "papel",
  borde: "pizarra.200",
  bordeFuerte: "pizarra.500",
  texto: "pizarra.900",
  textoSuave: "pizarra.500",
  primario: "agua.700",
  primarioHover: "agua.600",
  foco: "limo.900",
  focoClaro: "alerta.300",
  acento: "alerta.500",
  leyenda: { bg: "alerta.800", fg: "papel" },
  nav: { bg: "limo.900", fg: "pizarra.100", activo: "alerta.500", hover: "limo.700" },
  cat: {
    observado: { bg: "agua.700", fg: "papel", borde: "agua.700" },
    referencia: { bg: "papel", fg: "pizarra.700", borde: "pizarra.700" },
    simulado: { bg: "alerta.50", fg: "alerta.800", borde: "alerta.700" },
    observadoOscuro: { bg: "agua.700", fg: "papel", borde: "agua.300" },
    referenciaOscuro: { bg: "limo.800", fg: "pizarra.100", borde: "pizarra.100" },
  },
  estado: {
    normal: { fill: "pizarra.100", borde: "pizarra.500" },
    en_riesgo: { fill: "alerta.200", borde: "alerta.700" },
    comprometido: { fill: "evacuacion.400", borde: "evacuacion.700" },
    aislado: { borde: "limo.950" },
  },
  umbral: { alerta: "escala.alerta", evacuacion: "escala.evacuacion", pico: "escala.pico", textoAlerta: "alerta.700", textoEvacuacion: "evacuacion.700" },
  serie: { linea: "agua.700", cursor: "pizarra.900", grilla: "pizarra.100", eje: "pizarra.500" },
  acceso: { transitable: "agua.700", cerrado: "evacuacion.600", lluvia: "alerta.500", anegado: "rio.500", ruta: "limo.900" },
  mapa: {
    fondo: "pizarra.100",
    vial: "pizarra.400",
    localidades: "pizarra.900",
    educativos: "verde.600",
    salud: "evacuacion.600",
    policia: "rio.600",
    agua: "agua.500",
    marcador: "escala.evacuacion",
  },
  cuenca: {
    rioPrincipal: "agua.300",
    afluente: "agua.400",
    hito: "pizarra.100",
    hitoPrincipal: "alerta.500",
    hitoTexto: "alerta.300",
    grillaFina: "limo.800",
    grillaGruesa: "limo.700",
    plano: "agua.500",
    espuma: "agua.100",
    sobreAmbar: "limo.950",
  },
} as const;

type Arbol = { readonly [k: string]: string | Arbol };

function resolver(ref: string): string {
  if (ref === "papel") return PAPEL;
  const [nombre, paso] = ref.split(".");
  const rampaDe = (PAL as unknown as Record<string, Record<string, string>>)[nombre];
  const valor = rampaDe?.[paso];
  if (!valor) throw new Error(`Token de color desconocido: ${ref}`);
  return valor;
}

/** Hex de un token semántico, p. ej. `hexDe("estado.comprometido.fill")`. */
export function hexDe(ruta: string): string {
  // Acepta también referencias directas a una rampa ("pizarra.100", "papel").
  if (!(ruta.split(".")[0] in SEMANTICOS)) return resolver(ruta);
  let nodo: string | Arbol = SEMANTICOS as unknown as Arbol;
  for (const parte of ruta.split(".")) {
    if (typeof nodo === "string") break;
    nodo = nodo[parte];
    if (nodo === undefined) throw new Error(`Token semántico desconocido: ${ruta}`);
  }
  if (typeof nodo !== "string") throw new Error(`El token ${ruta} no es un color`);
  return resolver(nodo);
}

/** Convierte el árbol de referencias en el formato de `semanticTokens.colors` de Chakra. */
export function semanticosChakra(nodo: Arbol = SEMANTICOS as unknown as Arbol): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nodo)) salida[k] = typeof v === "string" ? v : semanticosChakra(v);
  return salida;
}

/** Hex -> [r, g, b, a] para Deck.gl (a en 0-255). */
export function rgbaDe(ruta: string, alfa = 255): [number, number, number, number] {
  const h = hexDe(ruta);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), alfa];
}
