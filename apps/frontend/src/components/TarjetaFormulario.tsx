import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** Superficie de formulario: tarjeta blanca con línea de 1 px. */
export function TarjetaFormulario({ children, maxW = "36rem" }: { children: ReactNode; maxW?: string }) {
  return (
    <Box
      maxW={maxW}
      layerStyle="tarjeta"
      p={{ base: 5, md: 8 }}
    >
      {children}
    </Box>
  );
}
