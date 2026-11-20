import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useState } from "react";

import { Insignia } from "../components/Insignia";
import { useEscenario } from "./EscenarioContext";
import { fmtM, fmtNum } from "./ui";

const ALTURA_MIN = 0;
const ALTURA_MAX = 12;

function acotar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Barra del escenario, fija en todas las páginas del panel. Muestra la altura del río y la lluvia con las que se
 * calcula todo lo que se ve (sectores, recomendación, órdenes) y permite cambiarlas sin ir al mapa. Fijar los valores
 * no consulta al backend: el cálculo sigue siendo explícito en "Mapa y simulador". Si la altura difiere de la
 * observada, lo que se ve es una simulación y la barra lo rotula SIMULADO.
 */
export function AvisoEscenario() {
  const { escenarioSimulado, entrada, alturaObservada, volverAObservado, fijarAltura, fijarLluvia } = useEscenario();
  // En pantallas angostas los controles se pliegan; el resumen y el aviso quedan siempre a la vista.
  const [abierto, setAbierto] = useState(false);
  const lluviaSimulada = entrada.lluvia_origen === "simulado" || entrada.lluvia_origen === "manual";

  return (
    <Box
      role="region"
      aria-label="Escenario del panel"
      data-testid="barra-escenario"
      position="sticky"
      top={{ base: "2.9rem", md: "2rem" }}
      zIndex={20}
      mb={4}
      px={4}
      py={2.5}
      bg={escenarioSimulado ? "cat.simulado.bg" : "superficie"}
      color={escenarioSimulado ? "cat.simulado.fg" : "texto"}
      border="1px solid"
      borderStyle={escenarioSimulado ? "dashed" : "solid"}
      borderColor={escenarioSimulado ? "cat.simulado.borde" : "borde"}
      borderRadius="lg"
    >
      <Flex align="center" gap={3} wrap="wrap" role="status" data-testid={escenarioSimulado ? "aviso-escenario" : "resumen-escenario"}>
        <Text fontSize="sm" fontWeight={600}>
          {escenarioSimulado ? "Escenario activo" : "Escenario"}: {fmtM(entrada.altura_formosa_m)}
          {entrada.lluvia_mm > 0 ? ` con ${entrada.lluvia_mm.toLocaleString("es-AR")} mm de lluvia` : ""}
        </Text>
        <Insignia categoria={escenarioSimulado ? "SIMULADO" : "DATO OBSERVADO"} />
        {entrada.lluvia_mm > 0 && lluviaSimulada && !escenarioSimulado && <Insignia categoria="SIMULADO" />}
        <Flex ml={{ md: "auto" }} gap={2} align="center">
          {escenarioSimulado && (
            <Button size="sm" variant="outline" bg="superficie" onClick={volverAObservado}>
              Volver a observado ({fmtM(alturaObservada)})
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            bg="superficie"
            display={{ base: "inline-flex", md: "none" }}
            aria-expanded={abierto}
            aria-controls="controles-escenario"
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? "Ocultar controles" : "Cambiar escenario"}
          </Button>
        </Flex>
      </Flex>
      <Flex id="controles-escenario" display={{ base: abierto ? "flex" : "none", md: "flex" }} mt={2} gap={{ base: 3, md: 6 }} wrap="wrap" align="flex-end">
        <Box flex="1 1 16rem">
          <Text as="label" htmlFor="barra-altura-num" fontSize="xs" fontWeight={600} display="block">
            Altura del río en el escenario (m) · SIMULADO si difiere de {fmtM(alturaObservada)}
          </Text>
          <Flex gap={2} align="center">
            <input
              aria-label="Altura del escenario (control deslizante)"
              type="range"
              min={ALTURA_MIN}
              max={ALTURA_MAX}
              step={0.05}
              value={entrada.altura_formosa_m}
              onChange={(e) => fijarAltura(Number(e.target.value))}
              style={{ flex: 1, minWidth: 0 }}
            />
            <input
              id="barra-altura-num"
              type="number"
              inputMode="decimal"
              min={ALTURA_MIN}
              max={ALTURA_MAX}
              step={0.05}
              value={entrada.altura_formosa_m}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(v)) fijarAltura(acotar(v, ALTURA_MIN, ALTURA_MAX));
              }}
              style={{ width: "5rem", padding: "0.25rem 0.375rem", border: "1px solid var(--chakra-colors-borde, #ccc)", borderRadius: "0.375rem", background: "inherit", color: "inherit" }}
            />
          </Flex>
        </Box>
        <Box flex="1 1 12rem">
          <Text as="label" htmlFor="barra-lluvia" fontSize="xs" fontWeight={600} display="block">
            Lluvia del escenario: {fmtNum(entrada.lluvia_mm)} mm ({lluviaSimulada ? "SIMULADO" : "origen indicado"})
          </Text>
          <input
            id="barra-lluvia"
            type="range"
            min={0}
            max={200}
            step={5}
            value={entrada.lluvia_mm}
            onChange={(e) => fijarLluvia(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </Box>
      </Flex>
    </Box>
  );
}
