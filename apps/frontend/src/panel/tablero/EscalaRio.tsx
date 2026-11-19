import { Box, Flex, Text } from "@chakra-ui/react";

import { fmtM } from "../ui";

/**
 * Escala del río en versión de panel (fondo claro): la altura observada frente a los umbrales de alerta y de evacuación.
 * Las marcas de umbral llevan además su valor escrito debajo; el texto alternativo resume la lectura.
 */
export function EscalaRio({ altura, alerta, evacuacion }: { altura: number; alerta: number; evacuacion: number }) {
  const maximo = Math.max(10.5, Math.ceil(altura + 0.5), Math.ceil(evacuacion + 1));
  const pos = (v: number) => `${Math.min(100, (v / maximo) * 100)}%`;
  const texto = `Escala de 0 a ${maximo.toLocaleString("es-AR")} m: altura ${fmtM(altura)}, alerta en ${fmtM(alerta)} y evacuación en ${fmtM(evacuacion)}.`;
  return (
    <Box>
      <Box role="img" aria-label={texto} data-testid="escala-rio">
        <Box position="relative" h="12px" borderRadius="full" bg="pizarra.100" my="6px">
          <Box position="absolute" left={0} top={0} bottom={0} w={pos(altura)} bg="agua.600" borderRadius="full" />
          {[
            { v: alerta, c: "umbral.alerta" },
            { v: evacuacion, c: "umbral.evacuacion" },
          ].map((m) => (
            <Box key={m.v} position="absolute" left={pos(m.v)} top="-6px" bottom="-6px" w="3px" ml="-1.5px" borderRadius="full" bg={m.c} />
          ))}
        </Box>
      </Box>
      <Flex gap={{ base: 3, md: 5 }} wrap="wrap" fontSize="sm" mt={2}>
        <Text as="span" display="inline-flex" alignItems="center" gap={2}>
          <Box as="span" w="10px" h="10px" borderRadius="full" bg="agua.600" aria-hidden="true" />
          Altura <strong>{fmtM(altura)}</strong>
        </Text>
        <Text as="span" display="inline-flex" alignItems="center" gap={2}>
          <Box as="span" w="10px" h="10px" borderRadius="full" bg="umbral.alerta" aria-hidden="true" />
          Alerta <strong>{fmtM(alerta)}</strong>
        </Text>
        <Text as="span" display="inline-flex" alignItems="center" gap={2}>
          <Box as="span" w="10px" h="10px" borderRadius="full" bg="umbral.evacuacion" aria-hidden="true" />
          Evacuación <strong>{fmtM(evacuacion)}</strong>
        </Text>
      </Flex>
    </Box>
  );
}
