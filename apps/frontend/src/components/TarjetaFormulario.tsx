import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** Superficie de formulario: papel con regla superior, el mismo lenguaje que las secciones del panel. */
export function TarjetaFormulario({ children, maxW = "36rem" }: { children: ReactNode; maxW?: string }) {
  return (
    <Box
      maxW={maxW}
      bg="superficie"
      border="1px solid"
      borderColor="borde"
      borderTop="3px solid"
      borderTopColor="pizarra.700"
      borderRadius="sm"
      p={{ base: 5, md: 8 }}
    >
      {children}
    </Box>
  );
}
