import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { CLIMAS, climaDeEntrada, type Clima, type ClimaId } from "./clima";
import { useEscenario } from "./EscenarioContext";

/**
 * Tres climas de un clic (SIMULADO): fijan altura y lluvia y recalculan el escenario. Es reversible: cualquier preset,
 * los deslizadores o «volver al dato observado» lo deshacen.
 */
export function SelectorClima() {
  const { entrada, fijarAltura, fijarLluvia, simular, calculando } = useEscenario();
  const [pendiente, setPendiente] = useState<ClimaId | null>(null);
  const activo = climaDeEntrada(entrada.altura_formosa_m, entrada.lluvia_mm);

  // El cálculo se pide cuando la entrada ya refleja el preset (simular usa la entrada vigente).
  useEffect(() => {
    if (pendiente && activo?.id === pendiente) {
      setPendiente(null);
      void simular();
    }
  }, [pendiente, activo, simular]);

  function aplicar(c: Clima) {
    fijarAltura(c.altura_m);
    fijarLluvia(c.lluvia_mm, "simulado");
    setPendiente(c.id);
  }

  return (
    <Box data-testid="selector-clima" mb={4}>
      <Text textStyle="rotulo" color="texto" mb={2} id="selector-clima-titulo">
        Climas de un clic (SIMULADO)
      </Text>
      <Flex gap={2} wrap="wrap" role="group" aria-labelledby="selector-clima-titulo">
        {CLIMAS.map((c) => (
          <Button
            key={c.id}
            size="sm"
            flex="1 1 6.5rem"
            variant={activo?.id === c.id ? "solid" : "outline"}
            aria-pressed={activo?.id === c.id}
            isLoading={calculando && pendiente === null && activo?.id === c.id}
            onClick={() => aplicar(c)}
            title={c.fuente}
          >
            <span aria-hidden="true">{c.icono}</span>&nbsp;{c.etiqueta}
          </Button>
        ))}
      </Flex>
      <Text textStyle="microdato" mt={1.5} data-testid="selector-clima-detalle">
        {activo ? `${activo.etiqueta}: ${activo.fuente}.` : "Seco 4,96 m sin lluvia · El Niño 7,60 m y 40 mm · Tormenta extrema 8,30 m y 90 mm."} Escenarios ilustrativos, no pronósticos.
      </Text>
    </Box>
  );
}
