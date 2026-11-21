import { Box, Button, Flex, Input, InputGroup, InputRightElement, Text } from "@chakra-ui/react";
import { useState } from "react";

import { IconoOlas } from "../components/iconos/Iconos";
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
  // Campo numérico con coma decimal ("5,60"): mientras se escribe se respeta lo tipeado y al salir se normaliza.
  const [borrador, setBorrador] = useState<string | null>(null);
  const lluviaSimulada = entrada.lluvia_origen === "simulado" || entrada.lluvia_origen === "manual";

  return (
    <Box
      role="region"
      aria-label="Escenario del panel"
      data-testid="barra-escenario"
      position="sticky"
      top="calc(var(--altura-leyenda) + 0.25rem)"
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
        <Box aria-hidden="true" display="inline-flex" color={escenarioSimulado ? "cat.simulado.fg" : "primario"}>
          <IconoOlas tam="1.25rem" />
        </Box>
        <Text fontSize="sm" fontWeight={700}>
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
          <Text as="label" htmlFor="barra-altura-num" textStyle="rotulo" color="inherit" display="block">
            Altura del río en el escenario · SIMULADO si difiere de {fmtM(alturaObservada)}
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
            <InputGroup w="7rem" flexShrink={0}>
              <Input
                id="barra-altura-num"
                inputMode="decimal"
                autoComplete="off"
                bg="superficie"
                pr="2.25rem"
                value={borrador ?? fmtNum(entrada.altura_formosa_m, 2)}
                onChange={(e) => {
                  setBorrador(e.target.value);
                  const v = Number(e.target.value.replace(",", "."));
                  if (e.target.value.trim() !== "" && Number.isFinite(v)) fijarAltura(acotar(v, ALTURA_MIN, ALTURA_MAX));
                }}
                onBlur={() => setBorrador(null)}
              />
              <InputRightElement pointerEvents="none" color="textoSuave" fontSize="sm" aria-hidden="true">
                m
              </InputRightElement>
            </InputGroup>
          </Flex>
        </Box>
        <Box flex="1 1 12rem">
          <Text as="label" htmlFor="barra-lluvia" textStyle="rotulo" color="inherit" display="block">
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
