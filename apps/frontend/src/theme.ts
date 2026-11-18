import { extendTheme } from "@chakra-ui/react";

import { PAL, PAPEL, semanticosChakra } from "./estilo/paleta";

/**
 * Sistema visual de la plataforma (Chakra v2).
 *
 * Dirección: escala limnimétrica sobre agua turbia del río Paraguay. Herramienta cívica de emergencia:
 * papel verdoso y tinta oscura para leer bajo estrés, un solo color de acción (agua) y los ámbar y rojo
 * reservados para los umbrales de la escala (alerta 7,80 m, evacuación 8,30 m).
 * Colores en OKLCH (src/estilo/paleta.ts) compilados a hex; los componentes usan tokens semánticos.
 *
 * Tipografía: Source Serif 4 (títulos y cifras) y Public Sans (texto), ambas variables y autoalojadas
 * con @fontsource-variable; la pila de respaldo mantiene la app legible sin conexión.
 */
const FUENTE_TITULOS = "'Source Serif 4 Variable', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const FUENTE_TEXTO = "'Public Sans Variable', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

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
  fonts: { heading: FUENTE_TITULOS, body: FUENTE_TEXTO, mono: "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace" },
  radii: { none: "0", sm: "2px", base: "2px", md: "3px", lg: "4px", xl: "6px", "2xl": "8px", full: "9999px" },
  colors: {
    ...PAL,
    papel: PAPEL,
    // Nombres de Chakra mapeados a las rampas propias: las alertas, insignias y estados heredan el sistema.
    teal: PAL.agua,
    green: PAL.verde,
    red: PAL.evacuacion,
    orange: PAL.alerta,
    yellow: PAL.alerta,
    blue: PAL.rio,
    gray: PAL.pizarra,
  },
  semanticTokens: { colors: semanticosChakra() },
  textStyles: {
    cifra: { fontFamily: "heading", fontWeight: 600, fontVariantNumeric: "tabular-nums lining-nums", lineHeight: 1.1 },
    nota: { fontSize: "sm", color: "textoSuave" },
  },
  styles: {
    global: {
      ":root": {
        "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        "--ease-in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      html: { scrollPaddingTop: "4rem", overflowX: "clip", colorScheme: "light" },
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
      // Foco visible de dos tonos según el fondo: tinta sobre claro, ámbar claro sobre oscuro.
      "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible":
        { outline: "3px solid", outlineColor: "foco", outlineOffset: "2px" },
      ".sobre-oscuro a:focus-visible, .sobre-oscuro button:focus-visible, .sobre-oscuro [tabindex]:focus-visible, a.sobre-oscuro:focus-visible":
        { outlineColor: "focoClaro" },
      "input[type='range']": { accentColor: "var(--chakra-colors-primario)", width: "100%" },
      table: { fontVariantNumeric: "tabular-nums" },
      // Regla de graduación de escala limnimétrica: marca fina cada 8 px y marca gruesa cada 40 px.
      ".regla-escala": {
        height: "10px",
        backgroundRepeat: "repeat-x",
        backgroundImage:
          "linear-gradient(90deg, var(--chakra-colors-nav-activo) 0 1px, transparent 1px), linear-gradient(90deg, var(--chakra-colors-nav-activo) 0 1px, transparent 1px)",
        backgroundSize: "8px 4px, 40px 10px",
        backgroundPosition: "0 0, 0 0",
        opacity: 0.7,
      },
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
      baseStyle: { fontWeight: 600, letterSpacing: "-0.015em", fontOpticalSizing: "auto" },
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
        borderRadius: "sm",
        letterSpacing: "0.005em",
        transition: TRANSICION_CONTROL,
        _active: { transform: "scale(0.97)" },
        _focusVisible: { boxShadow: "none" },
        _disabled: { opacity: 0.5, cursor: "not-allowed" },
      },
      sizes: {
        xs: { h: "1.875rem", minW: "1.875rem", fontSize: "sm", px: 3 },
        sm: { h: "2.5rem", minW: "2.5rem", fontSize: "sm", px: 4 },
        md: { h: "2.75rem", minW: "2.75rem", fontSize: "md", px: 5 },
        lg: { h: "3rem", minW: "3rem", fontSize: "md", px: 6 },
      },
      variants: {
        solid: {
          bg: "primario",
          color: "papel",
          _hover: { bg: "primarioHover", _disabled: { bg: "primario" } },
        },
        outline: {
          bg: "transparent",
          color: "texto",
          border: "1.5px solid",
          borderColor: "pizarra.700",
          _hover: { bg: "pizarra.100", _disabled: { bg: "transparent" } },
        },
        ghost: { bg: "transparent", color: "texto", _hover: { bg: "pizarra.100" } },
        sobreOscuro: {
          bg: "limo.950",
          color: "nav.fg",
          border: "1.5px solid",
          borderColor: "pizarra.300",
          _hover: { bg: "nav.hover" },
        },
        acento: { bg: "acento", color: "limo.950", _hover: { bg: "alerta.400" } },
        peligro: { bg: "escala.evacuacion", color: "papel", _hover: { bg: "evacuacion.700" } },
      },
      defaultProps: { variant: "solid", size: "md" },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: "superficie",
            border: "1.5px solid",
            borderColor: "bordeFuerte",
            borderRadius: "sm",
            transition: TRANSICION_CONTROL,
            _hover: { borderColor: "pizarra.700" },
            _focusVisible: { borderColor: "texto", boxShadow: "none", zIndex: 1 },
            _invalid: { borderColor: "escala.evacuacion", boxShadow: "inset 0 0 0 1px var(--chakra-colors-escala-evacuacion)" },
            _placeholder: { color: "pizarra.500" },
          },
        },
      },
      sizes: {
        md: { field: { h: "2.75rem", fontSize: "md", px: 3 } },
        sm: { field: { h: "2.5rem", fontSize: "sm", px: 3 } },
        xs: { field: { h: "2rem", fontSize: "sm", px: 2 } },
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            bg: "superficie",
            border: "1.5px solid",
            borderColor: "bordeFuerte",
            borderRadius: "sm",
            _hover: { borderColor: "pizarra.700" },
            _focusVisible: { borderColor: "texto", boxShadow: "none" },
            _invalid: { borderColor: "escala.evacuacion" },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: "superficie",
          border: "1.5px solid",
          borderColor: "bordeFuerte",
          borderRadius: "sm",
          _hover: { borderColor: "pizarra.700" },
          _focusVisible: { borderColor: "texto", boxShadow: "none" },
          _invalid: { borderColor: "escala.evacuacion", boxShadow: "inset 0 0 0 1px var(--chakra-colors-escala-evacuacion)" },
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
      baseStyle: { text: { color: "evacuacion.700", fontSize: "sm", fontWeight: 500 } },
    },
    Checkbox: {
      baseStyle: {
        control: {
          borderColor: "bordeFuerte",
          borderWidth: "1.5px",
          borderRadius: "sm",
          bg: "superficie",
          _checked: { bg: "primario", borderColor: "primario", color: "papel", _hover: { bg: "primarioHover", borderColor: "primarioHover" } },
          _focusVisible: { boxShadow: "none", outline: "3px solid", outlineColor: "foco", outlineOffset: "2px" },
        },
      },
    },
    Badge: {
      baseStyle: { textTransform: "none", fontWeight: 600, fontSize: "xs", letterSpacing: "0.01em", borderRadius: "sm", px: 2, py: "1px" },
    },
    Alert: {
      baseStyle: { container: { borderRadius: "sm" } },
    },
    Table: {
      baseStyle: {
        th: { textTransform: "none", letterSpacing: "normal", fontFamily: "body", fontWeight: 600, color: "pizarra.700" },
      },
      variants: {
        simple: {
          th: { borderBottom: "2px solid", borderColor: "pizarra.700", fontSize: "sm" },
          td: { borderBottom: "1px solid", borderColor: "borde" },
        },
      },
    },
    Spinner: { baseStyle: { color: "primario" } },
  },
});
