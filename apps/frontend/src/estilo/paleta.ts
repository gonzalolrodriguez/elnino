import type { Oklch } from "./oklch";

/**
 * Sistema de color "Río y cielo". Las rampas se escriben en hex (los anclajes salen de la paleta decidida
 * por el equipo) y los componentes usan tokens semánticos.
 *
 * Idea visual: los colores del río Paraguay y del cielo del Chaco, con la celeste institucional como guiño,
 * sin imitar marcas oficiales.
 *  - limo: tinta azul marino (texto, fondos oscuros del hero y del pie); el paso 900 es la tinta #0E1B2C
 *  - pizarra: neutros fríos; 50 = fondo, 200 = línea de 1 px, 600 = texto secundario
 *  - agua: azul río; 700 = acción primaria (#1E5AA0), 800 = hover (#174A86), 100 = cielo (#E6F0FA)
 *  - verde: albardón, confirmación (#2F7D5B en el paso 600)
 *  - alerta / evacuacion: reservados para los umbrales de la escala (7,80 m y 8,30 m)
 *  - rio: celeste verdoso, solo para "anegado" y las estaciones de la policía en el mapa
 */

export const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
type Rampa = Record<(typeof PASOS)[number], string> & { 950?: string };

const limo: Rampa = {
  50: "#EAF0F7",
  100: "#D6E0EC",
  200: "#B5C4D8",
  300: "#8A9FBB",
  400: "#62799A",
  500: "#46607F",
  600: "#324A68",
  700: "#223853",
  800: "#162A41",
  900: "#0E1B2C",
  950: "#09131F",
};
const pizarra: Rampa = {
  50: "#F6F8FB",
  100: "#EDF1F6",
  200: "#E2E8F0",
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#66768A",
  600: "#526072",
  700: "#3E4B5C",
  800: "#263446",
  900: "#0E1B2C",
};
const agua: Rampa = {
  50: "#F3F8FD",
  100: "#E6F0FA",
  200: "#CFE0F3",
  300: "#A8C8E8",
  400: "#78A6D6",
  500: "#4A86C5",
  600: "#2A6BB4",
  700: "#1E5AA0",
  800: "#174A86",
  900: "#123B6C",
};
// El paso 600 es el ámbar del umbral de alerta; 800 es el tono de texto sobre fondos claros (contraste AA).
const alerta: Rampa = {
  50: "#FDF6E8",
  100: "#FAEBCB",
  200: "#F4D79B",
  300: "#EBBE66",
  400: "#D9A23C",
  500: "#C98B2B",
  600: "#B7791F",
  700: "#9A6416",
  800: "#7A4F10",
  900: "#5C3B0B",
};
// El paso 700 es el rojo del umbral de evacuación.
const evacuacion: Rampa = {
  50: "#FDEEEC",
  100: "#FBD9D5",
  200: "#F5B3AC",
  300: "#EC857A",
  400: "#DC5A4D",
  500: "#C93C2E",
  600: "#BC2E21",
  700: "#B42318",
  800: "#8E1B13",
  900: "#6A140E",
};
const rio: Rampa = {
  50: "#EDF8FC",
  100: "#D8EFF7",
  200: "#B2DEEE",
  300: "#85C8E0",
  400: "#55B0D0",
  500: "#2F96BC",
  600: "#1D7B9F",
  700: "#176283",
  800: "#134D68",
  900: "#0F3B50",
};
const verde: Rampa = {
  50: "#EEF7F2",
  100: "#D6EBE0",
  200: "#AED7C1",
  300: "#82BEA0",
  400: "#58A180",
  500: "#3D8C6A",
  600: "#2F7D5B",
  700: "#256449",
  800: "#1C4D38",
  900: "#143828",
};

const papel = "#FFFFFF";

const escala = {
  alerta: alerta[600],
  evacuacion: evacuacion[700],
  // Sobre fondo oscuro (hero y pie) las marcas de umbral usan un tono más claro del mismo matiz.
  alertaClaro: alerta[300],
  evacuacionClaro: evacuacion[300],
  pico: "#8A9FBB",
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
  suave: "agua.100",
  borde: "pizarra.200",
  bordeControl: "pizarra.500",
  bordeFuerte: "pizarra.500",
  texto: "pizarra.900",
  textoSuave: "pizarra.600",
  primario: "agua.700",
  primarioHover: "agua.800",
  confirmacion: "verde.600",
  foco: "agua.800",
  focoClaro: "alerta.300",
  acento: "alerta.600",
  // Cinta fija con la leyenda obligatoria: tinta oscura, texto claro y sin color de alarma.
  leyenda: { bg: "limo.900", fg: "limo.100" },
  // Cabecera clara; el pie y el hero usan `oscuro`.
  nav: { bg: "papel", fg: "pizarra.900", activo: "agua.700", hover: "agua.100" },
  oscuro: { bg: "limo.900", fg: "limo.50", suave: "limo.200", linea: "limo.700", panel: "limo.800" },
  cat: {
    observado: { bg: "agua.100", fg: "agua.800", borde: "agua.700" },
    referencia: { bg: "papel", fg: "pizarra.700", borde: "pizarra.500" },
    simulado: { bg: "alerta.50", fg: "alerta.800", borde: "alerta.600" },
    observadoOscuro: { bg: "agua.700", fg: "papel", borde: "agua.300" },
    referenciaOscuro: { bg: "limo.800", fg: "limo.100", borde: "limo.200" },
  },
  estado: {
    normal: { fill: "pizarra.100", borde: "pizarra.500" },
    en_riesgo: { fill: "alerta.200", borde: "alerta.700" },
    comprometido: { fill: "evacuacion.400", borde: "evacuacion.700" },
    aislado: { borde: "limo.950" },
  },
  umbral: {
    alerta: "escala.alerta",
    evacuacion: "escala.evacuacion",
    alertaClaro: "escala.alertaClaro",
    evacuacionClaro: "escala.evacuacionClaro",
    pico: "escala.pico",
    textoAlerta: "alerta.800",
    textoEvacuacion: "evacuacion.700",
  },
  serie: { linea: "agua.700", cursor: "pizarra.900", grilla: "pizarra.100", eje: "pizarra.600" },
  acceso: { transitable: "agua.700", cerrado: "evacuacion.600", lluvia: "alerta.600", anegado: "rio.500", ruta: "limo.900" },
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
    hitoPrincipal: "alerta.300",
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
