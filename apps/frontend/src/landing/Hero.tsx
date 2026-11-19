import { Box, Button, Heading, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { hayWebGL, useMenosMovimiento } from "../lib/entorno";
import { LeyendaRelieve } from "../relieve/LeyendaRelieve";
import { useRelieve } from "../relieve/useRelieve";
import { CuencaSVG } from "./CuencaSVG";
import { EscalaHidrometrica } from "./EscalaHidrometrica";

// El módulo 3D (three, R3F, drei) se descarga solo cuando hay WebGL y se admite movimiento.
const Cuenca3D = lazy(() => import("./Cuenca3D"));

const Aparece = motion.create(Box);

/**
 * Las etiquetas del esquema (3D o 2D) nunca deben quedar bajo el texto, los botones o la escala.
 * Oculta cada etiqueta `[data-etiqueta-escena]` cuyo recuadro cruce una zona `[data-evitar-etiquetas]`.
 * Es independiente del renderizador: sirve igual para WebGL y para el respaldo SVG, en cualquier ancho.
 */
function useEvitarZonas(hero: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const raiz = hero.current;
    if (!raiz) return;
    const MARGEN = 12;
    let id = 0;
    const revisar = () => {
      const zonas = [...raiz.querySelectorAll<HTMLElement>("[data-evitar-etiquetas]")].map((z) => z.getBoundingClientRect());
      raiz.querySelectorAll<HTMLElement | SVGElement>("[data-etiqueta-escena]").forEach((e) => {
        const r = e.getBoundingClientRect();
        const choca = r.width > 0 && zonas.some((z) => r.right > z.left - MARGEN && r.left < z.right + MARGEN && r.bottom > z.top - MARGEN && r.top < z.bottom + MARGEN);
        e.style.visibility = choca ? "hidden" : "visible";
      });
    };
    const ciclo = () => {
      revisar();
      id = window.setTimeout(ciclo, 80);
    };
    ciclo();
    window.addEventListener("resize", revisar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", revisar);
    };
  }, [hero]);
}
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function Hero({ avisoSinServicio }: { avisoSinServicio: boolean }) {
  const menosMovimiento = useMenosMovimiento();
  const [webgl] = useState(hayWebGL);
  const { datos, fallo } = useRelieve();
  const quiere3D = webgl && !menosMovimiento && !fallo;
  const usar3D = quiere3D && !!datos;
  const heroRef = useRef<HTMLElement>(null);
  useEvitarZonas(heroRef);

  return (
    <Box as="section" ref={heroRef} aria-labelledby="titulo-hero" position="relative" bg="limo.950" color="pizarra.50" overflow="hidden" className="sobre-oscuro">
      <Box
        data-testid="escena-cuenca"
        data-modo={quiere3D ? "3d" : "2d"}
        position={{ base: "relative", lg: "absolute" }}
        inset={{ lg: 0 }}
        h={{ base: datos ? "340px" : "240px", lg: "auto" }}
      >
        {usar3D ? (
          <Suspense fallback={null}>
            <Cuenca3D datos={datos} />
          </Suspense>
        ) : quiere3D ? null : (
          // Respaldo 2D: en pantallas anchas el mapa ocupa la franja libre entre el texto y la escala.
          <Box position={{ base: "relative", lg: "absolute" }} h="100%" top={{ lg: 0 }} bottom={{ lg: 0 }} left={{ lg: "40%" }} right={{ lg: "22%" }}>
            <CuencaSVG datos={datos} />
          </Box>
        )}
        {/* Velo a la izquierda: da contraste al titular sin sombras de texto. */}
        <Box
          aria-hidden="true"
          display={{ base: "none", lg: "block" }}
          position="absolute"
          inset={0}
          pointerEvents="none"
          bgImage="linear-gradient(90deg, var(--chakra-colors-limo-950) 0%, var(--chakra-colors-limo-950) 30%, transparent 68%)"
        />
        {!datos && (
          <Text position="absolute" left={4} bottom={3} fontSize="xs" bg="limo.950" px={2} py="2px" borderRadius="sm" color="pizarra.200">
            Esquema ilustrativo, no a escala cartográfica
          </Text>
        )}
      </Box>
      {datos && (
        <Box position={{ base: "relative", lg: "absolute" }} left={{ lg: 4 }} bottom={{ lg: 3 }} zIndex={2} px={{ base: 4, lg: 0 }} pt={{ base: 3, lg: 0 }}>
          <LeyendaRelieve meta={datos.meta} vista={usar3D ? "3d" : "2d"} />
        </Box>
      )}

      <Box
        position="relative"
        zIndex={1}
        maxW="7xl"
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={{ base: 8, lg: 14 }}
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 360px" }}
        gap={{ base: 8, lg: 12 }}
        minH={{ lg: "680px" }}
        pointerEvents="none"
        sx={{ "& a, & button": { pointerEvents: "auto" } }}
      >
        <Aparece
          initial={menosMovimiento ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          maxW="36rem"
          alignSelf="start"
          data-evitar-etiquetas=""
        >
          <Heading as="h1" id="titulo-hero" size="3xl">
            Del Pantanal a Puerto Formosa: seguí el agua del río Paraguay
          </Heading>
          <Text mt={5} fontSize={{ base: "md", md: "lg" }} maxW="30rem" color="pizarra.100">
            Información para ciudadanía, productores y equipos operativos que planifican evacuaciones con anticipación. Los datos
            llegan hasta el 31/10/2026 y cada cifra indica su categoría y su fuente.
          </Text>
          <Box mt={6} display="flex" flexWrap="wrap" gap={3}>
            <Button as="a" href="#ingreso" size="lg" variant="acento">
              Elegir mi perfil
            </Button>
            <Button as={RouterLink} to="/informacion#como-llega" size="lg" variant="sobreOscuro">
              Cómo llega el agua a Formosa
            </Button>
          </Box>
          {avisoSinServicio && (
            <Text mt={5} fontSize="sm" bg="limo.800" borderLeft="3px solid" borderColor="acento" display="inline-block" px={3} py={2} role="status">
              Se muestran los valores del kit guardados en esta página: el servicio de datos no respondió.
            </Text>
          )}
        </Aparece>

        <Aparece
          initial={menosMovimiento ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: EASE_OUT }}
          bg="limo.900"
          p={5}
          borderTop="3px solid"
          borderColor="escala.alerta"
          alignSelf="end"
          pointerEvents="auto"
          data-evitar-etiquetas=""
        >
          <EscalaHidrometrica />
        </Aparece>
      </Box>
    </Box>
  );
}
