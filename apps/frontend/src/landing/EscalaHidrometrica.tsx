import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";

import { Insignia } from "../components/Insignia";
import { Plegable } from "../components/Plegable";
import { CIFRAS_FORMOSA, UMBRAL_ALERTA, UMBRAL_EVACUACION } from "../datos/kit";
import { fmt, useMenosMovimiento } from "../lib/entorno";

const MAXIMO = 10.5; // m, largo visible de la escala
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const Nivel = motion.create(Box);

const cifra = (id: string) => CIFRAS_FORMOSA.find((c) => c.id === id);

/**
 * Escala hidrométrica de Puerto Formosa. Un solo valor protagonista (la altura al corte) y una barra con los dos umbrales;
 * los picos históricos quedan plegados. Cada cifra conserva su categoría y su fuente.
 * Al cargar, el agua de la barra sube hasta el nivel del corte; con menos movimiento la barra se muestra quieta.
 */
export function EscalaHidrometrica() {
  const corte = cifra("corte");
  const alerta = cifra("alerta");
  const evacuacion = cifra("evacuacion");
  const picos = CIFRAS_FORMOSA.filter((c) => c.tono === "pico");
  const quieto = useMenosMovimiento();
  if (!corte || !alerta || !evacuacion) return null;
  const pos = (v: number) => `${(v / MAXIMO) * 100}%`;
  return (
    <Box as="section" aria-labelledby="titulo-escala" color="oscuro.suave">
      <Heading as="h2" id="titulo-escala" fontSize="sm" fontWeight={600} color="oscuro.suave" letterSpacing="0">
        Puerto Formosa · altura del río al corte
      </Heading>

      <Box as="ol" listStyleType="none" m={0} p={0}>
        <Box as="li" mt={2}>
          <Text textStyle="cifra" fontSize={{ base: "3rem", md: "3.5rem" }} color="oscuro.fg" data-testid="cifra-corte">
            {fmt(corte.valor)} m
          </Text>
          <Flex mt={2} gap={2} align="center" wrap="wrap">
            <Insignia categoria={corte.categoria} onDark />
            <Text as="span" fontSize="xs">
              {corte.etiqueta} · {corte.fecha} · Fuente: {corte.fuente}
            </Text>
          </Flex>
        </Box>
      </Box>

      <Box mt={5} role="img" aria-label={`Escala de 0 a ${fmt(MAXIMO, 1)} m: ${fmt(corte.valor)} m al corte, alerta en ${fmt(UMBRAL_ALERTA)} m y evacuación en ${fmt(UMBRAL_EVACUACION)} m`}>
        <Box position="relative" h="10px" borderRadius="full" bg="rgba(255,255,255,0.12)" overflow="visible">
          <Nivel
            position="absolute"
            left={0}
            top={0}
            bottom={0}
            width={pos(corte.valor)}
            borderRadius="full"
            bg="agua.300"
            transformOrigin="left"
            initial={quieto ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.1, delay: 0.4, ease: EASE_OUT }}
          />
          {[
            { v: UMBRAL_ALERTA, c: "umbral.alertaClaro" },
            { v: UMBRAL_EVACUACION, c: "umbral.evacuacionClaro" },
          ].map((m) => (
            <Box key={m.v} position="absolute" left={pos(m.v)} top="-5px" bottom="-5px" w="3px" ml="-1.5px" borderRadius="full" bg={m.c} />
          ))}
        </Box>
        <Flex mt={3.5} gap={4} wrap="wrap" fontSize="sm" color="oscuro.fg">
          <Text as="span" display="inline-flex" alignItems="center" gap={2}>
            <Box as="span" w="8px" h="8px" borderRadius="full" bg="umbral.alertaClaro" aria-hidden="true" />
            Alerta{" "}
            <Text as="span" fontWeight={700} data-testid="cifra-alerta">
              {fmt(alerta.valor)} m
            </Text>
          </Text>
          <Text as="span" display="inline-flex" alignItems="center" gap={2}>
            <Box as="span" w="8px" h="8px" borderRadius="full" bg="umbral.evacuacionClaro" aria-hidden="true" />
            Evacuación{" "}
            <Text as="span" fontWeight={700} data-testid="cifra-evacuacion">
              {fmt(evacuacion.valor)} m
            </Text>
          </Text>
        </Flex>
        <Flex mt={2} gap={2} align="center" wrap="wrap">
          <Insignia categoria={alerta.categoria} onDark />
          <Text as="span" fontSize="xs">
            Umbrales · {alerta.fecha} · Fuente: {alerta.fuente}
          </Text>
        </Flex>
      </Box>

      <Box mt={3} pt={1} borderTop="1px solid" borderColor="oscuro.linea">
        <Plegable titulo={<span style={{ fontSize: "0.875rem" }}>Picos históricos de la serie</span>} tono="oscuro">
          <Box as="ul" listStyleType="none" m={0} p={0} pb={1}>
            {picos.map((c) => (
              <Box as="li" key={c.id} py={2}>
                <Text as="span" textStyle="cifra" fontSize="xl" color="oscuro.fg" data-testid={`cifra-${c.id}`}>
                  {fmt(c.valor)} m
                </Text>
                <Text fontSize="xs">
                  {c.etiqueta} · {c.fecha}
                </Text>
                <Flex mt={1} gap={2} align="center" wrap="wrap">
                  <Insignia categoria={c.categoria} onDark />
                  <Text as="span" fontSize="xs">
                    Fuente: {c.fuente}
                  </Text>
                </Flex>
              </Box>
            ))}
          </Box>
        </Plegable>
        <Text fontSize="xs" pt={1}>
          Lluvia: sin dato observado en el kit.
        </Text>
      </Box>
    </Box>
  );
}
