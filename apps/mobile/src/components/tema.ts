/**
 * Tokens de diseño de la app ("Río y cielo"). Única fuente de colores, radios y escala tipográfica;
 * las pantallas y los componentes no deben escribir hex ni radios a mano.
 */
export const COLOR = {
  /** Texto y fondos oscuros (leyenda fija). */
  tinta: "#0E1B2C",
  /** Acción primaria. */
  primario: "#1E5AA0",
  primarioPresionado: "#174A86",
  /** Superficies suaves y botón secundario relleno. */
  cielo: "#E6F0FA",
  fondo: "#F6F8FB",
  superficie: "#FFFFFF",
  /** Líneas de 1 px (tarjetas, separadores). */
  borde: "#E2E8F0",
  /** Borde de campos de texto: apenas más firme para que el campo se reconozca. */
  bordeCampo: "#C3CCD8",
  texto: "#0E1B2C",
  /** Texto secundario (pizarra). */
  suave: "#526072",
  placeholder: "#6B7788",
  /** Confirmación, "en orden" (albardón). */
  ok: "#2F7D5B",
  /** Alerta: relleno o trazo. Para texto usar `avisoTexto`. */
  aviso: "#B7791F",
  avisoTexto: "#8A5A0B",
  avisoFondo: "#FBF3E2",
  /** Evacuación y errores. */
  error: "#B42318",
  errorFondo: "#FDEFED",
} as const;

export const RADIO = { boton: 12, campo: 10, tarjeta: 16, pastilla: 999 } as const;

/** Escala tipográfica: fuente del sistema, pesos 400/600/700. */
export const TIPO = {
  titulo: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const },
  subtitulo: { fontSize: 17, lineHeight: 24, fontWeight: "600" as const },
  cuerpo: { fontSize: 16, lineHeight: 23, fontWeight: "400" as const },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  pequeno: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
} as const;

/** Cifras alineadas en columnas (alturas, cantidades, horas). */
export const CIFRAS = { fontVariant: ["tabular-nums" as const] };
