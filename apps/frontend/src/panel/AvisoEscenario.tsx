import { Box, Button, Flex, Text } from "@chakra-ui/react";

import { Insignia } from "../components/Insignia";
import { useEscenario } from "./EscenarioContext";
import { fmtM } from "./ui";

/**
 * Aviso persistente en todo el panel: si la altura elegida en el simulador no es la observada, lo que se ve
 * (sectores, recomendación, órdenes) corresponde a una simulación y no al río real.
 */
export function AvisoEscenario() {
  const { escenarioSimulado, entrada, alturaObservada, volverAObservado } = useEscenario();
  if (!escenarioSimulado) return null;
  return (
    <Flex role="status" data-testid="aviso-escenario" align="center" gap={3} wrap="wrap" mb={4} px={4} py={3} bg="cat.simulado.bg" color="cat.simulado.fg" border="1px dashed" borderColor="cat.simulado.borde" borderRadius="lg">
      <Text fontSize="sm" fontWeight={600}>
        Escenario activo: {fmtM(entrada.altura_formosa_m)}
        {entrada.lluvia_mm > 0 ? ` con ${entrada.lluvia_mm.toLocaleString("es-AR")} mm de lluvia` : ""}
      </Text>
      <Insignia categoria="SIMULADO" />
      <Box ml={{ md: "auto" }}>
        <Button size="sm" variant="outline" bg="superficie" onClick={volverAObservado}>
          Volver a observado ({fmtM(alturaObservada)})
        </Button>
      </Box>
    </Flex>
  );
}
