import { extendTheme } from "@chakra-ui/react";

/**
 * Identidad visual: escala limnimétrica sobre agua turbia del río Paraguay.
 * limo = fondo oscuro del hero; pizarra = papel claro; agua = verde azulado del cauce;
 * alerta y evacuacion repiten los colores de los umbrales de la escala.
 */
export const theme = extendTheme({
  config: { initialColorMode: "light", useSystemColorMode: false },
  fonts: {
    heading: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
    body: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
    mono: "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace",
  },
  colors: {
    limo: { 700: "#1B3A40", 800: "#142C31", 900: "#0E2125" },
    pizarra: { 50: "#F4F6F4", 100: "#EAEFEC", 200: "#D5DEDA", 500: "#5B6B68", 700: "#33433F", 900: "#13242A" },
    agua: { 300: "#8FD0C8", 500: "#2F8F8A", 600: "#247670", 700: "#1B5C58" },
    escala: { alerta: "#D99A1E", evacuacion: "#C23B2A", pico: "#8A9A96" },
  },
  styles: {
    global: {
      body: { bg: "pizarra.50", color: "pizarra.900", lineHeight: 1.6 },
      "a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, [tabindex]:focus-visible": {
        outline: "3px solid #D99A1E",
        outlineOffset: "2px",
      },
    },
  },
  components: {
    Heading: { baseStyle: { fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 } },
    Button: { defaultProps: { colorScheme: "teal" } },
  },
});
