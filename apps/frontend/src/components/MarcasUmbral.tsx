import { Box } from "@chakra-ui/react";

import { UMBRAL_ALERTA, UMBRAL_EVACUACION } from "../datos/kit";
import { fmt } from "../lib/entorno";

/**
 * Marcas de los umbrales K3 bajo un deslizador de altura (0 a `max` m).
 * La marca es una línea con texto: alerta punteada, evacuación continua, como en el gráfico de la serie.
 */
export function MarcasUmbral({ max = 12 }: { max?: number }) {
  const pos = (v: number) => `calc(8px + (100% - 16px) * ${v / max})`;
  return (
    <Box position="relative" h="2.25rem" mt={-1} aria-hidden="true" fontSize="0.75rem" fontWeight={700} lineHeight={1.2}>
      <Box position="absolute" left={pos(UMBRAL_ALERTA)} top={0} h="0.6rem" borderLeft="2px dotted" borderColor="escala.alerta" />
      <Box position="absolute" left={pos(UMBRAL_ALERTA)} top="0.65rem" transform="translateX(-100%)" pr={1} color="alerta.700" whiteSpace="nowrap">
        Alerta {fmt(UMBRAL_ALERTA)} m
      </Box>
      <Box position="absolute" left={pos(UMBRAL_EVACUACION)} top={0} h="0.6rem" borderLeft="2px solid" borderColor="escala.evacuacion" />
      <Box position="absolute" left={pos(UMBRAL_EVACUACION)} top="0.65rem" pl={1} color="evacuacion.700" whiteSpace="nowrap">
        Evacuación {fmt(UMBRAL_EVACUACION)} m
      </Box>
    </Box>
  );
}
