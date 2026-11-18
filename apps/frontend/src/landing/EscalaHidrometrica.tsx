import { Box, Heading, Text } from "@chakra-ui/react";

import { Insignia } from "../components/Insignia";
import { CIFRAS_FORMOSA, type Cifra } from "../datos/kit";
import { fmt } from "../lib/entorno";

const MAXIMO = 10.5; // m, alto visible de la escala
const COLOR: Record<Cifra["tono"], string> = {
  actual: "#8FD0C8",
  alerta: "#D99A1E",
  evacuacion: "#C23B2A",
  pico: "#8A9A96",
};

/** Escala hidrométrica de Puerto Formosa: nivel al corte, umbrales y picos históricos. */
export function EscalaHidrometrica() {
  const corte = CIFRAS_FORMOSA.find((c) => c.id === "corte");
  return (
    <Box as="section" aria-labelledby="titulo-escala" color="pizarra.100">
      <Heading as="h2" id="titulo-escala" size="md" mb={4} fontFamily="heading">
        Escala de Puerto Formosa
      </Heading>
      <Box display="flex" gap={4} alignItems="stretch">
        <Box
          aria-hidden="true"
          position="relative"
          flex="0 0 34px"
          minH="320px"
          border="1px solid"
          borderColor="whiteAlpha.500"
          bgImage="repeating-linear-gradient(to top, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) calc(100%/10.5), transparent calc(100%/10.5), transparent calc(200%/10.5))"
        >
          {corte && (
            <Box position="absolute" left={0} right={0} bottom={0} height={`${(corte.valor / MAXIMO) * 100}%`} bg="rgba(47,143,138,0.75)" />
          )}
          {CIFRAS_FORMOSA.filter((c) => c.tono !== "actual").map((c) => (
            <Box
              key={c.id}
              position="absolute"
              left="-6px"
              right="-6px"
              height="3px"
              bottom={`${(c.valor / MAXIMO) * 100}%`}
              bg={COLOR[c.tono]}
            />
          ))}
        </Box>
        <Box as="ol" listStyleType="none" m={0} p={0} flex="1" display="flex" flexDirection="column" justifyContent="space-between" gap={3}>
          {CIFRAS_FORMOSA.map((c) => (
            <Box as="li" key={c.id} borderLeft="3px solid" borderColor={COLOR[c.tono]} pl={3}>
              <Text as="span" fontFamily="heading" fontSize={c.tono === "actual" ? "3xl" : "xl"} fontWeight={600} lineHeight={1} data-testid={`cifra-${c.id}`}>
                {fmt(c.valor)} m
              </Text>
              <Text fontSize="sm" mt={1}>
                {c.etiqueta} · {c.fecha}
              </Text>
              <Box mt={1} display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <Insignia categoria={c.categoria} onDark />
                <Text as="span" fontSize="xs" color="pizarra.200">
                  Fuente: {c.fuente}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      <Text mt={4} fontSize="sm" borderTop="1px solid" borderColor="whiteAlpha.300" pt={3}>
        Lluvia: sin dato observado en el kit.
      </Text>
    </Box>
  );
}
