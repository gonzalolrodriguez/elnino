import { Box, Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export type FilaBarra = { id: string; etiqueta: ReactNode; valor: number; texto?: ReactNode };

/**
 * Barras horizontales de un solo color. Cada fila lleva su valor escrito (la barra nunca es la única vía
 * para leerlo), por lo que la lista funciona también como alternativa en texto para lectores de pantalla.
 * Las barras parten de cero y la longitud es proporcional al valor máximo.
 */
export function Barras({ filas, etiqueta, maximo, vacio = "Sin datos." }: { filas: FilaBarra[]; etiqueta: string; maximo?: number; vacio?: string }) {
  if (filas.length === 0) return <Text fontSize="sm" color="textoSuave">{vacio}</Text>;
  const max = maximo ?? Math.max(1, ...filas.map((f) => f.valor));
  return (
    <Box as="ul" listStyleType="none" m={0} p={0} aria-label={etiqueta}>
      {filas.map((f) => (
        <Flex as="li" key={f.id} align="center" gap={3} py="3px" fontSize="sm">
          <Text as="span" w={{ base: "6.5rem", md: "8.5rem" }} flexShrink={0} noOfLines={1} title={typeof f.etiqueta === "string" ? f.etiqueta : undefined}>
            {f.etiqueta}
          </Text>
          <Box flex="1" h="8px" bg="pizarra.100" borderRadius="full" overflow="hidden" aria-hidden="true">
            <Box h="100%" w={`${Math.min(100, (f.valor / max) * 100)}%`} minW={f.valor > 0 ? "4px" : 0} bg="agua.600" borderRadius="full" />
          </Box>
          <Text as="span" minW="3.5rem" textAlign="right" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>
            {f.texto ?? f.valor.toLocaleString("es-AR")}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}
