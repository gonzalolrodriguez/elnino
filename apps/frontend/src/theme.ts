import { extendTheme } from "@chakra-ui/react";

import { PAL, PAPEL, semanticosChakra } from "./estilo/paleta";

/**
 * Sistema visual de la plataforma (Chakra v2): "Río y cielo".
 *
 * Dirección: pública, sobria y amable. Tinta azul marino para el texto, azul río para la acción principal,
 * cielo claro para superficies suaves y botones secundarios, línea de 1 px en lugar de contornos gruesos.
 * El ámbar y el rojo quedan reservados para los umbrales de la escala (alerta 7,80 m, evacuación 8,30 m).
 * Las rampas viven en src/estilo/paleta.ts; los componentes usan tokens semánticos.
 *
 * Tipografía: una sola familia, Atkinson Hyperlegible Next (diseñada para baja visión), variable y
 * autoalojada con @fontsource-variable. La jerarquía sale del peso (400/600/700) y del tamaño; las cifras
 * usan numerales tabulares. La pila de respaldo mantiene la app legible sin conexión.
 * Forma: botones 12 px, campos 10 px, tarjetas 16 px, sombras mínimas.
 */
const FUENTE = "'Atkinson Hyperlegible Next Variable', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

const TAMANOS_TITULO = {
  sm: { fontSize: "1.0625rem", lineHeight: 1.3 },
  md: { fontSize: "1.25rem", lineHeight: 1.25 },
  lg: { fontSize: "clamp(1.375rem, 1.15rem + 0.9vw, 1.75rem)", lineHeight: 1.2 },
  xl: { fontSize: "clamp(1.625rem, 1.25rem + 1.5vw, 2.25rem)", lineHeight: 1.15 },
  "2xl": { fontSize: "clamp(1.875rem, 1.3rem + 2.3vw, 3rem)", lineHeight: 1.1 },
  "3xl": { fontSize: "clamp(2.125rem, 1.4rem + 3vw, 3.5rem)", lineHeight: 1.08 },
  "4xl": { fontSize: "clamp(2.375rem, 1.4rem + 4vw, 4rem)", lineHeight: 1.05 },
  "5xl": { fontSize: "clamp(2.5rem, 1.3rem + 5vw, 4.5rem)", lineHeight: 1.03 },
};

const TRANSICION_CONTROL =
  "background-color 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms var(--ease-out), transform 120ms var(--ease-out)";

export const theme = extendTheme({
  config: { initialColorMode: "light", useSystemColorMode: false },
  fonts: { heading: FUENTE, body: FUENTE, mono: "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace" },
  radii: { none: "0", sm: "6px", base: "8px", md: "10px", lg: "12px", xl: "16px", "2xl": "20px", full: "9999px" },
  colors: {
    ...PAL,
    papel: PAPEL,
    // Nombres de Chakra mapeados a las rampas propias: las alertas, insignias y estados heredan el sistema.
    teal: PAL.agua,
    green: PAL.verde,
    red: PAL.evacuacion,
    orange: PAL.alerta,
    yellow: PAL.alerta,
    blue: PAL.agua,
    gray: PAL.pizarra,
  },
  semanticTokens: { colors: semanticosChakra() },
  layerStyles: {
    // Tarjeta: superficie blanca, línea de 1 px y radio de 16 px; sin sombra.
    tarjeta: { bg: "superficie", border: "1px solid", borderColor: "borde", borderRadius: "xl" },
    // Superficie suave sin borde para agrupar contenido sin marcar contornos.
    suave: { bg: "suave", borderRadius: "xl" },
  },
  textStyles: {
    cifra: { fontFamily: "heading", fontWeight: 700, fontVariantNumeric: "tabular-nums lining-nums", lineHeight: 1.1, letterSpacing: "-0.02em" },
    nota: { fontSize: "sm", color: "textoSuave" },
    // Panel personal: saludo, cifras grandes (tabulares) y rótulos chicos de datos.
    pantalla: { fontFamily: "heading", fontWeight: 700, fontSize: "clamp(2rem, 1.3rem + 2.6vw, 3.25rem)", lineHeight: 1.05, letterSpacing: "-0.03em" },
    cifraGrande: {
      fontFamily: "heading",
      fontWeight: 700,
      fontSize: "clamp(2.5rem, 1.6rem + 3vw, 3.75rem)",
      lineHeight: 1,
      letterSpacing: "-0.035em",
      fontVariantNumeric: "tabular-nums lining-nums",
    },
    cifraMedia: { fontFamily: "heading", fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.1, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums lining-nums" },
    rotulo: { fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.3, color: "textoSuave" },
  },
  styles: {
    global: {
      ":root": {
        "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        "--ease-in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
        // Alto de la leyenda fija (hasta 3 líneas en pantallas angostas): el foco y los anclajes no deben quedar debajo.
        "--altura-leyenda": "3.25rem",
        "@media (min-width: 48em)": { "--altura-leyenda": "2.25rem" },
      },
      "input, select, textarea, button, [tabindex], [id]": { scrollMarginTop: "calc(var(--altura-leyenda) + 1rem)" },
      html: { scrollPaddingTop: "calc(var(--altura-leyenda) + 1rem)", overflowX: "clip", colorScheme: "light" },
      "a, button, input, select, textarea, label, summary, [role='button']": { touchAction: "manipulation" },
      "a, button": { WebkitTapHighlightColor: "transparent" },
      body: {
        bg: "fondo",
        color: "texto",
        lineHeight: 1.6,
        overflowX: "clip",
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      },
      "::selection": { bg: "agua.200", color: "texto" },
      "h1, h2, h3": { textWrap: "balance" },
      "p, li": { textWrap: "pretty" },
      // Foco visible de dos tonos según el fondo: azul oscuro sobre claro, ámbar claro sobre oscuro.
      "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible":
        { outline: "3px solid", outlineColor: "foco", outlineOffset: "2px" },
      ".sobre-oscuro a:focus-visible, .sobre-oscuro button:focus-visible, .sobre-oscuro [tabindex]:focus-visible, a.sobre-oscuro:focus-visible":
        { outlineColor: "focoClaro" },
      "input[type='range']": { accentColor: "var(--chakra-colors-primario)", width: "100%" },
      table: { fontVariantNumeric: "tabular-nums" },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.01ms !important",
          animationIterationCount: "1 !important",
          transitionDuration: "0.01ms !important",
          scrollBehavior: "auto !important",
        },
      },
    },
  },
  components: {
    Heading: {
      baseStyle: { fontWeight: 700, letterSpacing: "-0.02em" },
      sizes: TAMANOS_TITULO,
    },
    Link: {
      baseStyle: {
        color: "primario",
        textDecoration: "underline",
        textUnderlineOffset: "0.2em",
        textDecorationThickness: "1px",
        transition: "color 160ms var(--ease-out)",
        _hover: { color: "primarioHover", textDecorationThickness: "2px" },
      },
    },
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: "lg",
        transition: TRANSICION_CONTROL,
        _active: { transform: "scale(0.97)" },
        _focusVisible: { boxShadow: "none" },
        _disabled: { opacity: 0.5, cursor: "not-allowed" },
      },
      sizes: {
        xs: { h: "1.875rem", minW: "1.875rem", fontSize: "sm", px: 3 },
        sm: { h: "2.5rem", minW: "2.5rem", fontSize: "sm", px: 4 },
        md: { h: "2.75rem", minW: "2.75rem", fontSize: "md", px: 5 },
        lg: { h: "3.25rem", minW: "3.25rem", fontSize: "md", px: 7 },
      },
      variants: {
        // Principal: azul río relleno.
        solid: {
          bg: "primario",
          color: "papel",
          _hover: { bg: "primarioHover", _disabled: { bg: "primario" } },
        },
        // Secundario: relleno cielo, sin contorno.
        outline: {
          bg: "suave",
          color: "primarioHover",
          border: "none",
          _hover: { bg: "agua.200", _disabled: { bg: "suave" } },
        },
        ghost: { bg: "transparent", color: "texto", _hover: { bg: "pizarra.100" } },
        // Sobre fondo oscuro: secundario translúcido y principal blanco (variante acento).
        sobreOscuro: {
          bg: "rgba(255,255,255,0.12)",
          color: "oscuro.fg",
          _hover: { bg: "rgba(255,255,255,0.2)" },
        },
        acento: { bg: "papel", color: "limo.900", _hover: { bg: "agua.100" } },
        peligro: { bg: "escala.evacuacion", color: "papel", _hover: { bg: "evacuacion.800" } },
      },
      defaultProps: { variant: "solid", size: "md" },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: "superficie",
            border: "1px solid",
            borderColor: "bordeControl",
            borderRadius: "md",
            transition: TRANSICION_CONTROL,
            _hover: { borderColor: "pizarra.700" },
            _focusVisible: { borderColor: "primario", boxShadow: "0 0 0 1px var(--chakra-colors-primario)", zIndex: 1 },
            _invalid: { borderColor: "escala.evacuacion", boxShadow: "0 0 0 1px var(--chakra-colors-escala-evacuacion)" },
            _placeholder: { color: "pizarra.500" },
          },
        },
      },
      sizes: {
        md: { field: { h: "2.75rem", fontSize: "md", px: 3.5 } },
        sm: { field: { h: "2.5rem", fontSize: "sm", px: 3 } },
        xs: { field: { h: "2rem", fontSize: "sm", px: 2 } },
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            bg: "superficie",
            border: "1px solid",
            borderColor: "bordeControl",
            borderRadius: "md",
            _hover: { borderColor: "pizarra.700" },
            _focusVisible: { borderColor: "primario", boxShadow: "0 0 0 1px var(--chakra-colors-primario)" },
            _invalid: { borderColor: "escala.evacuacion" },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: "superficie",
          border: "1px solid",
          borderColor: "bordeControl",
          borderRadius: "md",
          _hover: { borderColor: "pizarra.700" },
          _focusVisible: { borderColor: "primario", boxShadow: "0 0 0 1px var(--chakra-colors-primario)" },
          _invalid: { borderColor: "escala.evacuacion", boxShadow: "0 0 0 1px var(--chakra-colors-escala-evacuacion)" },
        },
      },
    },
    Form: {
      baseStyle: {
        helperText: { color: "textoSuave", fontSize: "sm", mt: 1 },
      },
    },
    FormLabel: { baseStyle: { fontWeight: 600, fontSize: "sm", mb: 1, color: "texto" } },
    FormError: {
      baseStyle: { text: { color: "evacuacion.700", fontSize: "sm", fontWeight: 600 } },
    },
    Checkbox: {
      baseStyle: {
        control: {
          borderColor: "bordeControl",
          borderWidth: "1px",
          borderRadius: "sm",
          bg: "superficie",
          _checked: { bg: "primario", borderColor: "primario", color: "papel", _hover: { bg: "primarioHover", borderColor: "primarioHover" } },
          _focusVisible: { boxShadow: "none", outline: "3px solid", outlineColor: "foco", outlineOffset: "2px" },
        },
      },
    },
    Badge: {
      baseStyle: { textTransform: "none", fontWeight: 600, fontSize: "xs", letterSpacing: "0.01em", borderRadius: "full", px: 2.5, py: "2px" },
    },
    Alert: {
      baseStyle: { container: { borderRadius: "lg" } },
    },
    Table: {
      baseStyle: {
        th: { textTransform: "none", letterSpacing: "normal", fontFamily: "body", fontWeight: 600, color: "textoSuave" },
      },
      variants: {
        simple: {
          th: { borderBottom: "1px solid", borderColor: "borde", fontSize: "sm" },
          td: { borderBottom: "1px solid", borderColor: "pizarra.100" },
        },
      },
    },
    Spinner: { baseStyle: { color: "primario" } },
  },
});
