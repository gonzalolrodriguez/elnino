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
  /** Borde de campos de texto: `pizarra.500` de la web (4,6:1 sobre blanco; WCAG 1.4.11 pide 3:1). */
  bordeCampo: "#66768A",
  texto: "#0E1B2C",
  /** Texto secundario (pizarra). */
  suave: "#526072",
  placeholder: "#6B7788",
  /** Confirmación, "en orden" (albardón). */
  ok: "#2F7D5B",
  /** Alerta: relleno o trazo. Para texto usar `avisoTexto`. */
  aviso: "#B7791F",
  avisoTexto: "#7A4F10",
  avisoFondo: "#FDF6E8",
  /** Evacuación y errores. */
  error: "#B42318",
  errorFondo: "#FDEEEC",
  /** Tonos de las bandas de estado (fondo, línea y texto sobre fondo claro), como en la web. */
  okFondo: "#EAF5EF",
  okLinea: "#BFDECD",
  okTexto: "#1F5F44",
  avisoLinea: "#EBD3A0",
  errorLinea: "#F3C4BE",
  errorTexto: "#8E1B13",
  /** Línea de tiempo y escalas: tramo sin recorrer. */
  trazo: "#CBD5E1",
  /** Texto sobre fondos de acción (primario, error). */
  papel: "#FFFFFF",
  /** Tono informativo (chip "info", paso actual). */
  infoLinea: "#BBD3EC",
  infoTexto: "#174A86",
  /** Neutro: chip sin estado y su disco. */
  neutroFondo: "#F1F5F9",
  neutroDisco: "#64748B",
  /** Fondo de un botón secundario o redondo mientras se pulsa. */
  secundarioPresionado: "#D5E5F6",
  /** Aro del paso actual de la línea de tiempo. */
  aroActual: "#9CC0E6",
  /** Botón de error mientras se pulsa. */
  errorPresionado: "#8E1B13",
  /** Texto secundario sobre fondo oscuro (leyenda fija). */
  sobreOscuro: "#DCE8F5",
  /** Contorno tenue de la escala del río (tinta al 14 %). */
  contornoEscala: "rgba(14,27,44,0.14)",
  /** Velo claro sobre un fondo de acción (ficha del botón de ayuda). */
  velo: "rgba(255,255,255,0.18)",
} as const;

/** Escala de espacios (dp): todo margen o separación sale de acá. */
export const ESPACIO = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

export const RADIO = { boton: 12, campo: 10, tarjeta: 16, pastilla: 999 } as const;

/**
 * Escala tipográfica: fuente del sistema, pesos 400/600/700. Los títulos y las cifras llevan un leve
 * tracking negativo (como en la web); las cifras usan numerales tabulares.
 */
export const TIPO = {
  /** Cifra protagonista de una tarjeta (altura del río, minutos, distancia). */
  cifraGrande: { fontSize: 44, lineHeight: 48, fontWeight: "700" as const, letterSpacing: -1 },
  /** Cifra de segundo nivel (KPI, tiempos, cantidades). */
  cifraMedia: { fontSize: 28, lineHeight: 32, fontWeight: "700" as const, letterSpacing: -0.5 },
  /** Rótulo corto sobre o bajo una cifra. */
  rotulo: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const },
  titulo: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.5 },
  /** Título de bloque (como `tituloBloque` de la web, 18 px). */
  subtitulo: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const, letterSpacing: -0.2 },
  /** Cifra o frase destacada de segundo nivel (cantidad en un contador, pregunta de la brújula). */
  destacado: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  cuerpo: { fontSize: 16, lineHeight: 23, fontWeight: "400" as const },
  /** Cuerpo con peso: texto de botón, enlace y opción. */
  cuerpoFuerte: { fontSize: 16, lineHeight: 23, fontWeight: "600" as const },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  /** Fuente, fecha, ayuda (microdato de la web). Nunca menos de 12. */
  pequeno: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  /** Texto de la insignia de categoría y de la leyenda fija: el piso del sistema. */
  minimo: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const },
} as const;

/** Cifras alineadas en columnas (alturas, cantidades, horas). */
export const CIFRAS = { fontVariant: ["tabular-nums" as const] };
