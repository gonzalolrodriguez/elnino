import { Box, Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { IconoChevron } from "../iconos";

/**
 * Dato compacto: rótulo arriba, valor con numerales tabulares (`cifraMedia`) y una nota opcional. Con `compacto` el
 * valor es un texto corto ("ya comprometido") y usa el estilo de título de bloque en lugar de la cifra.
 */
export function Dato({ etiqueta, valor, nota, icono, testId, color, compacto }: { etiqueta: string; valor: ReactNode; nota?: ReactNode; icono?: ReactNode; testId?: string; color?: string; compacto?: boolean }) {
  return (
    <Box minW={0}>
      <Text textStyle="rotulo">{etiqueta}</Text>
      <Flex align="center" gap={1.5} color={color}>
        {icono}
        <Text as="span" data-testid={testId} textStyle={compacto ? "tituloBloque" : "cifraMedia"} overflowWrap="anywhere">
          {valor}
        </Text>
      </Flex>
      {nota && (
        <Text textStyle="microdato" mt="1px">
          {nota}
        </Text>
      )}
    </Box>
  );
}

/** Detalle plegable (`<details>`): el contenido queda en el documento y se abre con teclado o toque. */
export function Plegable({ resumen, children, testId, mt }: { resumen: ReactNode; children: ReactNode; testId?: string; mt?: number }) {
  return (
    <Box
      as="details"
      data-testid={testId}
      mt={mt}
      borderTop="1px solid"
      borderColor="borde"
      sx={{ "&[open] .plegable-chevron": { transform: "rotate(180deg)" }, "& > summary::-webkit-details-marker": { display: "none" } }}
    >
      <Flex
        as="summary"
        align="center"
        justify="space-between"
        gap={3}
        minH="2.75rem"
        py={2}
        cursor="pointer"
        listStyleType="none"
        fontSize="sm"
        fontWeight={600}
        borderRadius="md"
        _hover={{ color: "agua.800" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "agua.700", outlineOffset: "2px" }}
      >
        <Box as="span">{resumen}</Box>
        <Box as="span" className="plegable-chevron" display="inline-flex" transition="transform 160ms var(--ease-out)" sx={{ "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
          <IconoChevron />
        </Box>
      </Flex>
      <Box pb={3} fontSize="sm">
        {children}
      </Box>
    </Box>
  );
}
