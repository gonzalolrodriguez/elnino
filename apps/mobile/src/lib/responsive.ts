import { useContext, type Context } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

/**
 * Kit de diseño adaptable. Todo se deriva de las dimensiones de la ventana (dp), la escala de fuente
 * del sistema y los insets de las zonas seguras, de modo que la app se vea bien desde un teléfono
 * viejo de 320x568 dp hasta una tablet de 1024 dp, en vertical y apaisado.
 *
 * Clases de dispositivo (por el lado corto, así un teléfono apaisado NO es una tablet):
 *  - compacto: ancho < 360 dp (teléfonos chicos o viejos).
 *  - normal:   360 dp <= ancho y lado corto < 600 dp (teléfonos comunes y grandes).
 *  - tablet:   lado corto >= 600 dp. Con ancho >= 840 dp usa dos columnas.
 */
export const PUNTOS = { compacto: 360, tablet: 600, dosColumnas: 840 } as const;

/** Ancho máximo del contenido (sin márgenes): una columna legible o dos columnas en tablet. */
export const ANCHO_MAX = { una: 640, dos: 960 } as const;

/** Tamaño mínimo de un elemento táctil (dp), Material Design / WCAG 2.5.8. */
export const TOQUE_MIN = 48;

export type ClaseDispositivo = "compacto" | "normal" | "tablet";

export type Insets = { top: number; bottom: number; left: number; right: number };
const SIN_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export type Diseno = {
  ancho: number;
  alto: number;
  fontScale: number;
  clase: ClaseDispositivo;
  esTablet: boolean;
  apaisado: boolean;
  /** 1 o 2 columnas para listas de tarjetas. */
  columnas: 1 | 2;
  /** Margen horizontal de las pantallas (dp). */
  margen: number;
  /** Separación vertical entre bloques; crece con la fuente grande para que respire. */
  paso: number;
  /** Ancho útil del contenido, ya sin márgenes ni insets y limitado al máximo de la clase. */
  anchoContenido: number;
  /** Alto sugerido para un mapa embebido dentro de una pantalla con scroll. */
  altoMapa: number;
  insets: Insets;
};

const acotar = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Función pura (testeable) que calcula todo el diseño a partir de las medidas. */
export function calcularDiseno(
  ancho: number,
  alto: number,
  fontScale: number,
  insets: Insets = SIN_INSETS,
): Diseno {
  const corto = Math.min(ancho, alto);
  const esTablet = corto >= PUNTOS.tablet;
  const clase: ClaseDispositivo = esTablet ? "tablet" : ancho < PUNTOS.compacto ? "compacto" : "normal";
  const apaisado = ancho > alto;
  const columnas = esTablet && ancho >= PUNTOS.dosColumnas ? 2 : 1;
  const margen = clase === "tablet" ? 24 : clase === "compacto" ? 12 : 16;
  const paso = Math.round(14 * acotar(fontScale, 1, 1.5));
  const maximo = columnas === 2 ? ANCHO_MAX.dos : ANCHO_MAX.una;
  const disponible = ancho - insets.left - insets.right - margen * 2;
  const altoMapa = apaisado && !esTablet
    ? Math.round(acotar(alto * 0.7, 200, 360))
    : Math.round(acotar(alto * 0.38, 220, 440));
  return {
    ancho,
    alto,
    fontScale,
    clase,
    esTablet,
    apaisado,
    columnas,
    margen,
    paso,
    anchoContenido: Math.max(Math.min(disponible, maximo), 0),
    altoMapa,
    insets,
  };
}

/** Diseño vigente. Funciona también sin SafeAreaProvider (insets en cero). */
export function useDiseno(): Diseno {
  const { width, height, fontScale } = useWindowDimensions();
  // El contexto es nulo fuera de un SafeAreaProvider (pruebas, pantallas aisladas).
  const insets = useContext(SafeAreaInsetsContext as unknown as Context<Insets | null>) ?? SIN_INSETS;
  return calcularDiseno(width, height, fontScale, insets);
}

/**
 * Tamaño de fuente para un elemento de alto fijo (p. ej. la barra de pestañas): sigue la escala del
 * sistema hasta `tope`; más allá de eso se queda en `tope`. Se usa con `allowFontScaling={false}`
 * solo en esos elementos puntuales.
 */
export function fuenteAcotada(base: number, fontScale: number, tope: number): number {
  return Math.round(base * Math.min(Math.max(fontScale, 1), tope) * 10) / 10;
}
