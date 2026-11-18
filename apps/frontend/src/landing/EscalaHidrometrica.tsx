import { Box, Heading, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";

import { Insignia } from "../components/Insignia";
import { CIFRAS_FORMOSA, type Cifra } from "../datos/kit";
import { fmt, useMenosMovimiento } from "../lib/entorno";

const MAXIMO = 10.5; // m, alto visible de la escala
const COLOR: Record<Cifra["tono"], string> = {
  actual: "agua.300",
  alerta: "escala.alerta",
  evacuacion: "escala.evacuacion",
  pico: "escala.pico",
};

const Nivel = motion(Box);
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Escala hidrométrica de Puerto Formosa: nivel al corte, umbrales y picos históricos.
 * Es el momento orquestado de la landing: al cargar, el agua sube hasta el nivel del corte y
 * después aparecen las marcas de los umbrales. Con menos movimiento, la escala se muestra quieta.
 */
export function EscalaHidrometrica() {
  const corte = CIFRAS_FORMOSA.find((c) => c.id === "corte");
  const quieto = useMenosMovimiento();
  return (
    <Box as="section" aria-labelledby="titulo-escala" color="pizarra.100">
      <Heading as="h2" id="titulo-escala" size="md" mb={4}>
        Escala de Puerto Formosa
      </Heading>
      <Box display="flex" gap={4} alignItems="stretch">
        <Box
          aria-hidden="true"
          position="relative"
          flex="0 0 36px"
          minH="320px"
          border="1px solid"
          borderColor="pizarra.400"
          overflow="visible"
          bgImage="repeating-linear-gradient(to top, var(--chakra-colors-limo-700) 0, var(--chakra-colors-limo-700) calc(100%/10.5), transparent calc(100%/10.5), transparent calc(200%/10.5))"
        >
          {corte && (
            <Nivel
              position="absolute"
              left={0}
              right={0}
              bottom={0}
              height={`${(corte.valor / MAXIMO) * 100}%`}
              bg="agua.500"
              opacity={0.85}
              transformOrigin="bottom"
              initial={quieto ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 1.1, delay: 0.35, ease: EASE_OUT }}
            />
          )}
          {CIFRAS_FORMOSA.filter((c) => c.tono !== "actual").map((c, i) => (
            <Nivel
              key={c.id}
              position="absolute"
              left="-6px"
              right="-6px"
              height="3px"
              bottom={`${(c.valor / MAXIMO) * 100}%`}
              bg={COLOR[c.tono]}
              initial={quieto ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.0 + i * 0.06, ease: EASE_OUT }}
            />
          ))}
        </Box>
        <Box as="ol" listStyleType="none" m={0} p={0} flex="1" display="flex" flexDirection="column" justifyContent="space-between" gap={3}>
          {CIFRAS_FORMOSA.map((c) => (
            <Box as="li" key={c.id} borderLeft="3px solid" borderColor={COLOR[c.tono]} pl={3}>
              <Text as="span" textStyle="cifra" fontSize={c.tono === "actual" ? "2.25rem" : "1.375rem"} data-testid={`cifra-${c.id}`}>
                {fmt(c.valor)} m
              </Text>
              <Text fontSize="sm" mt={1}>
                {c.etiqueta} · {c.fecha}
              </Text>
              <Box mt={1} display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <Insignia categoria={c.categoria} onDark />
                <Text as="span" fontSize="0.8125rem" color="pizarra.200">
                  Fuente: {c.fuente}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      <Text mt={4} fontSize="sm" borderTop="1px solid" borderColor="limo.600" pt={3}>
        Lluvia: sin dato observado en el kit.
      </Text>
    </Box>
  );
}
