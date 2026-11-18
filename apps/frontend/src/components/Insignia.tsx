import { Box } from "@chakra-ui/react";
import { CATEGORIAS, type Categoria } from "@evacuaciones/shared";

const ESTILOS: Record<Categoria, Record<string, string>> = {
  [CATEGORIAS.OBSERVADO]: { bg: "#1B5C58", color: "white", border: "1px solid #1B5C58" },
  [CATEGORIAS.REFERENCIA]: { bg: "white", color: "#33433F", border: "1.5px solid #33433F" },
  [CATEGORIAS.SIMULADO]: { bg: "#FFF4DC", color: "#6B4300", border: "1.5px dashed #B07A12" },
};

/** Categoría visible de cada cifra, serie o capa (regla 2 de la mesa). */
export function Insignia({ categoria, onDark = false }: { categoria: Categoria; onDark?: boolean }) {
  const base = ESTILOS[categoria];
  const estilo = onDark && categoria === CATEGORIAS.REFERENCIA ? { ...base, bg: "transparent", color: "#EAEFEC", border: "1.5px solid #EAEFEC" } : base;
  return (
    <Box
      as="span"
      display="inline-block"
      px={2}
      py="1px"
      borderRadius="2px"
      fontSize="11px"
      fontWeight={700}
      letterSpacing="0.02em"
      whiteSpace="nowrap"
      {...estilo}
    >
      {categoria}
    </Box>
  );
}
