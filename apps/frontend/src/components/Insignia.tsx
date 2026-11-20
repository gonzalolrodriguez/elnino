import { Box, VisuallyHidden } from "@chakra-ui/react";
import { CATEGORIAS, type Categoria } from "@evacuaciones/shared";

/**
 * Cada categoría se distingue por forma y por texto, no solo por color:
 *  - DATO OBSERVADO: relleno cielo y borde continuo azul
 *  - DOCUMENTO DE REFERENCIA: fondo blanco y borde continuo gris
 *  - SIMULADO: borde punteado ámbar y fondo rayado en diagonal
 */
const ESTILOS: Record<Categoria, Record<string, string>> = {
  [CATEGORIAS.OBSERVADO]: { bg: "cat.observado.bg", color: "cat.observado.fg", border: "1px solid", borderColor: "cat.observado.borde" },
  [CATEGORIAS.REFERENCIA]: { bg: "cat.referencia.bg", color: "cat.referencia.fg", border: "1px solid", borderColor: "cat.referencia.borde" },
  [CATEGORIAS.SIMULADO]: {
    bg: "cat.simulado.bg",
    color: "cat.simulado.fg",
    border: "1px dashed",
    borderColor: "cat.simulado.borde",
    bgImage: "repeating-linear-gradient(135deg, transparent 0 5px, var(--chakra-colors-alerta-100) 5px 6px)",
  },
};

const ESTILOS_SOBRE_OSCURO: Partial<Record<Categoria, Record<string, string>>> = {
  [CATEGORIAS.OBSERVADO]: { bg: "cat.observadoOscuro.bg", color: "cat.observadoOscuro.fg", border: "1px solid", borderColor: "cat.observadoOscuro.borde" },
  [CATEGORIAS.REFERENCIA]: { bg: "cat.referenciaOscuro.bg", color: "cat.referenciaOscuro.fg", border: "1px solid", borderColor: "cat.referenciaOscuro.borde" },
};

/** Categoría visible de cada cifra, serie o capa (regla 2 de la mesa). Lleva el prefijo "Categoría:" para lectores de pantalla. */
export function Insignia({ categoria, onDark = false }: { categoria: Categoria; onDark?: boolean }) {
  const estilo = (onDark ? ESTILOS_SOBRE_OSCURO[categoria] : undefined) ?? ESTILOS[categoria];
  return (
    <Box
      as="span"
      data-categoria={categoria}
      display="inline-block"
      px={2.5}
      py="1px"
      borderRadius="full"
      fontSize="0.75rem"
      fontWeight={600}
      lineHeight={1.5}
      letterSpacing="0.02em"
      whiteSpace="nowrap"
      {...estilo}
    >
      <VisuallyHidden>Categoría: </VisuallyHidden>
      {categoria}
    </Box>
  );
}
