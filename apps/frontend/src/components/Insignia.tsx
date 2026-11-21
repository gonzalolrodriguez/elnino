import { Box, VisuallyHidden } from "@chakra-ui/react";
import { CATEGORIAS, type Categoria } from "@evacuaciones/shared";

/**
 * Jerarquía visual de las categorías (la regla de la mesa pide mostrarlas, no gritarlas):
 *  - DATO OBSERVADO: relleno azul sólido con texto claro; es la excepción valiosa y tiene que destacar.
 *  - DOCUMENTO DE REFERENCIA: sin relleno, borde continuo gris.
 *  - SIMULADO: texto gris tenue con subrayado punteado, sin caja; es lo corriente en el panel.
 * Siempre lleva el texto completo (nunca abreviado) y contraste de 4,5:1 o más.
 */
const ESTILOS: Record<Categoria, Record<string, unknown>> = {
  [CATEGORIAS.OBSERVADO]: { bg: "cat.observadoOscuro.bg", color: "cat.observadoOscuro.fg", border: "1px solid", borderColor: "cat.observadoOscuro.bg", borderRadius: "full", px: 2.5, fontWeight: 700 },
  [CATEGORIAS.REFERENCIA]: { bg: "transparent", color: "cat.referencia.fg", border: "1px solid", borderColor: "cat.referencia.borde", borderRadius: "full", px: 2.5, fontWeight: 600 },
  [CATEGORIAS.SIMULADO]: {
    bg: "transparent",
    color: "pizarra.600",
    textDecoration: "underline dotted",
    textUnderlineOffset: "3px",
    textDecorationThickness: "1px",
    px: 0.5,
    fontWeight: 500,
  },
};

const ESTILOS_SOBRE_OSCURO: Partial<Record<Categoria, Record<string, unknown>>> = {
  [CATEGORIAS.OBSERVADO]: { bg: "cat.observadoOscuro.bg", color: "cat.observadoOscuro.fg", border: "1px solid", borderColor: "cat.observadoOscuro.borde", borderRadius: "full", px: 2.5, fontWeight: 700 },
  [CATEGORIAS.REFERENCIA]: { bg: "cat.referenciaOscuro.bg", color: "cat.referenciaOscuro.fg", border: "1px solid", borderColor: "cat.referenciaOscuro.borde", borderRadius: "full", px: 2.5, fontWeight: 600 },
  [CATEGORIAS.SIMULADO]: { bg: "transparent", color: "limo.100", textDecoration: "underline dotted", textUnderlineOffset: "3px", px: 0.5, fontWeight: 500 },
};

/**
 * Categoría visible de cada cifra, serie o capa (regla 2 de la mesa). Lleva el prefijo "Categoría:" para lectores de pantalla.
 * `variante="compacta"` quita el relleno vertical para usarla dentro de celdas y filas.
 */
export function Insignia({ categoria, onDark = false, variante = "normal" }: { categoria: Categoria; onDark?: boolean; variante?: "normal" | "compacta" }) {
  const estilo = (onDark ? ESTILOS_SOBRE_OSCURO[categoria] : undefined) ?? ESTILOS[categoria];
  return (
    <Box
      as="span"
      data-categoria={categoria}
      display="inline-block"
      py={variante === "compacta" ? 0 : "1px"}
      fontSize="0.75rem"
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
