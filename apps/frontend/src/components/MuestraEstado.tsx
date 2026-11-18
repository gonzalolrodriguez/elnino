import { Box } from "@chakra-ui/react";

import { ESTADOS } from "../estilo/estados";

export type EstadoMuestra = keyof typeof ESTADOS;

/**
 * Estado de un sector con muestra de color y texto. La muestra repite el código de los mapas
 * (en riesgo: borde punteado; comprometido: rayado) para no depender solo del color.
 */
export function MuestraEstado({ estado, aislado = false }: { estado: EstadoMuestra; aislado?: boolean }) {
  return (
    <Box as="span" display="inline-flex" alignItems="center" gap={2} data-estado={estado}>
      <Box
        as="span"
        aria-hidden="true"
        display="inline-block"
        flex="none"
        w="1rem"
        h="1rem"
        bg={`estado.${estado}.fill`}
        border={aislado ? "3px solid" : "2px solid"}
        borderStyle={estado === "en_riesgo" ? "dashed" : "solid"}
        borderColor={aislado ? "estado.aislado.borde" : `estado.${estado}.borde`}
        bgImage={
          estado === "comprometido"
            ? "repeating-linear-gradient(45deg, var(--chakra-colors-evacuacion-700) 0 1.5px, transparent 1.5px 5px)"
            : undefined
        }
      />
      {ESTADOS[estado].texto}
    </Box>
  );
}
