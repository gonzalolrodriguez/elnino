import { Box, type BoxProps } from "@chakra-ui/react";

/**
 * Anchos de contenedor del sistema (DESIGN.md, Layout): un solo ancho por familia de pantallas.
 *  - `lectura`: páginas de lectura, formularios y área ciudadana (texto corrido a 70 caracteres dentro).
 *  - `datos`: paneles de datos y barra de navegación.
 */
export const ANCHO_CONTENEDOR = { lectura: "72rem", datos: "90rem" } as const;
export type AnchoContenedor = keyof typeof ANCHO_CONTENEDOR;

/** Márgenes laterales únicos: 16 px en móvil, 24 px desde 768 px. No alternar 32 / 80 / 94 px entre páginas hermanas. */
export const GUTTER = { base: 4, md: 6 } as const;

/** Contenedor centrado con el ancho y los márgenes del sistema. Úsese en lugar de `maxW`/`px` sueltos. */
export function Contenedor({ ancho = "lectura", children, ...resto }: { ancho?: AnchoContenedor } & BoxProps) {
  return (
    <Box maxW={ANCHO_CONTENEDOR[ancho]} w="100%" mx="auto" px={GUTTER} {...resto}>
      {children}
    </Box>
  );
}
