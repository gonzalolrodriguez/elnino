import { Box, Heading, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";

import { hayWebGL, useMenosMovimiento } from "../lib/entorno";
import { CuencaSVG } from "./CuencaSVG";
import { EscalaHidrometrica } from "./EscalaHidrometrica";

// El módulo 3D (three, R3F, drei) se descarga solo cuando hay WebGL y se admite movimiento.
const Cuenca3D = lazy(() => import("./Cuenca3D"));

const Aparece = motion(Box);

export function Hero({ avisoSinServicio }: { avisoSinServicio: boolean }) {
  const menosMovimiento = useMenosMovimiento();
  const [webgl] = useState(hayWebGL);
  const usar3D = webgl && !menosMovimiento;

  return (
    <Box as="section" aria-labelledby="titulo-hero" position="relative" bg="limo.900" color="pizarra.50" overflow="hidden">
      <Box
        data-testid="escena-cuenca"
        data-modo={usar3D ? "3d" : "2d"}
        position={{ base: "relative", lg: "absolute" }}
        inset={{ lg: 0 }}
        h={{ base: "340px", lg: "auto" }}
      >
        {usar3D ? (
          <Suspense fallback={<CuencaSVG />}>
            <Cuenca3D />
          </Suspense>
        ) : (
          <CuencaSVG />
        )}
        <Text position="absolute" left={4} bottom={3} fontSize="xs" bg="blackAlpha.600" px={2} py="2px" borderRadius="2px">
          Esquema ilustrativo, no a escala cartográfica
        </Text>
      </Box>

      <Box
        position="relative"
        zIndex={1}
        maxW="7xl"
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={{ base: 8, lg: 12 }}
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 340px" }}
        gap={{ base: 8, lg: 12 }}
        minH={{ lg: "640px" }}
        pointerEvents="none"
        sx={{ "& a, & button": { pointerEvents: "auto" } }}
      >
        <Aparece initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} maxW="34rem" alignSelf="start">
          <Heading as="h1" id="titulo-hero" fontSize={{ base: "3xl", md: "5xl" }} textShadow="0 2px 12px rgba(14,33,37,0.9)">
            Del Pantanal a Puerto Formosa: seguí el agua del río Paraguay
          </Heading>
          <Text mt={5} fontSize={{ base: "md", md: "lg" }} maxW="30rem" textShadow="0 1px 8px rgba(14,33,37,0.95)">
            Información para ciudadanía, productores y equipos operativos que planifican evacuaciones con anticipación. Los datos
            llegan hasta el 31/10/2026 y cada cifra indica su categoría y su fuente.
          </Text>
          {avisoSinServicio && (
            <Text mt={4} fontSize="sm" bg="blackAlpha.600" display="inline-block" px={3} py={1} role="status">
              Se muestran los valores del kit guardados en esta página: el servicio de datos no respondió.
            </Text>
          )}
        </Aparece>

        <Aparece
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          bg="rgba(14,33,37,0.86)"
          p={5}
          borderTop="3px solid"
          borderColor="escala.alerta"
          alignSelf="end"
          pointerEvents="auto"
        >
          <EscalaHidrometrica />
        </Aparece>
      </Box>
    </Box>
  );
}
