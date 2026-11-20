import { Box, Flex, Text } from "@chakra-ui/react";

import { Insignia } from "../components/Insignia";
import { hexDe } from "../estilo/paleta";
import { colorProfundidad, EXAGERACION_VERTICAL, PROFUNDIDAD_SATURADA_M } from "./lamina";

const css = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Leyenda de la lámina de agua ilustrativa. Rotula siempre que no es un modelo hidráulico. */
export function LeyendaLamina() {
  const rampa = `linear-gradient(90deg, ${css(colorProfundidad(0.08))}, ${css(colorProfundidad(1))})`;
  return (
    <Box data-testid="leyenda-lamina" mt={3} fontSize="sm">
      <Flex align="center" gap={2} wrap="wrap" mb={1}>
        <Text fontWeight={600}>Lámina de agua ilustrativa</Text>
        <Insignia categoria="SIMULADO" />
      </Flex>
      <Text fontSize="xs" color="textoSuave">
        Lámina ilustrativa: no es un modelo hidráulico. Muestra cuánto supera la altura del río la altura de compromiso de cada sector (K10, SIMULADO).
      </Text>
      <Flex align="center" gap={2} mt={1} fontSize="xs" color="textoSuave" wrap="wrap">
        <span>0 m de excedente</span>
        <Box as="span" display="inline-block" w="7rem" h="8px" aria-hidden="true" style={{ background: rampa }} />
        <span>{PROFUNDIDAD_SATURADA_M} m o más</span>
      </Flex>
      <Flex align="center" gap={2} mt={1} fontSize="xs" color="textoSuave">
        <Box as="span" display="inline-block" w="1.25rem" h="0" borderTop="3px solid" style={{ borderColor: hexDe("alerta.600") }} aria-hidden="true" />
        <span>Borde ámbar: sector en riesgo (a 0,50 m o menos de su compromiso).</span>
      </Flex>
      <Text fontSize="xs" color="textoSuave" mt={1}>
        Altura exagerada ×{EXAGERACION_VERTICAL} (visualización, no una medida); se nota al inclinar el mapa. Trazo rojo discontinuo: acceso cortado.
      </Text>
    </Box>
  );
}
