import { Box, Button, Heading, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { puedeUsar3D, useMenosMovimiento } from "../lib/entorno";
import { LeyendaRelieve } from "../relieve/LeyendaRelieve";
import { useRelieve } from "../relieve/useRelieve";
import { CuencaSVG } from "./CuencaSVG";
import { EscalaHidrometrica } from "./EscalaHidrometrica";

// El módulo 3D (three, R3F, drei) se descarga solo cuando hay WebGL y se admite movimiento.
const Cuenca3D = lazy(() => import("./Cuenca3D"));

const Aparece = motion(Box);

/**
 * Los rótulos del esquema (3D o 2D) nunca deben quedar bajo el texto, los botones o el panel, ni chocar entre sí.
 * Oculta cada rótulo `[data-etiqueta-escena]` cuyo recuadro cruce una zona `[data-evitar-etiquetas]`, y los rótulos
 * de departamento que tocan un rótulo de hito (los hitos tienen prioridad).
 * Es independiente del renderizador: sirve igual para WebGL y para el respaldo SVG, en cualquier ancho.
 */
function useEvitarZonas(hero: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const raiz = hero.current;
    if (!raiz) return;
    const MARGEN = 12;
    let id = 0;
    const cruza = (r: DOMRect, z: DOMRect, m: number) => r.right > z.left - m && r.left < z.right + m && r.bottom > z.top - m && r.top < z.bottom + m;
    const revisar = () => {
      const zonas = [...raiz.querySelectorAll<HTMLElement>("[data-evitar-etiquetas]")].map((z) => z.getBoundingClientRect());
      const marco = raiz.getBoundingClientRect();
      const hitos = [...raiz.querySelectorAll<HTMLElement>("[data-etiqueta-hito]")]
        .filter((h) => Number(getComputedStyle(h).opacity) > 0.2)
        .map((h) => h.getBoundingClientRect());
      raiz.querySelectorAll<HTMLElement | SVGElement>("[data-etiqueta-escena]").forEach((e) => {
        const r = e.getBoundingClientRect();
        const esDepartamento = e.hasAttribute("data-etiqueta-departamento");
        const fuera = r.left < marco.left + 6 || r.right > marco.right - 6 || r.top < marco.top + 6 || r.bottom > marco.bottom - 6;
        const choca = r.width > 0 && (fuera || zonas.some((z) => cruza(r, z, MARGEN)) || (esDepartamento && hitos.some((h) => cruza(r, h, 6))));
        e.style.visibility = choca ? "hidden" : "visible";
      });
    };
    const ciclo = () => {
      revisar();
      id = window.setTimeout(ciclo, 150);
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

export function Hero() {
  const menosMovimiento = useMenosMovimiento();
  // El 3D exige WebGL 2 y un equipo con recursos: en equipos limitados se usa el respaldo 2D.
  const [webgl] = useState(puedeUsar3D);
  const { datos, fallo } = useRelieve();
  const quiere3D = webgl && !menosMovimiento && !fallo;
  const usar3D = quiere3D && !!datos;
  const heroRef = useRef<HTMLElement>(null);
  useEvitarZonas(heroRef);

  return (
    <Box as="section" ref={heroRef} aria-labelledby="titulo-hero" position="relative" bg="oscuro.bg" color="oscuro.fg" overflow="hidden" className="sobre-oscuro">
      <Box
        data-testid="escena-cuenca"
        data-modo={quiere3D ? "3d" : "2d"}
        position={{ base: "relative", lg: "absolute" }}
        top={{ lg: 0 }}
        right={{ lg: 0 }}
        bottom={{ lg: 0 }}
        left={{ lg: 0 }}
        h={{ base: datos ? "320px" : "240px", lg: "auto" }}
      >
        {usar3D ? (
          <Suspense fallback={null}>
            <Cuenca3D datos={datos} />
          </Suspense>
        ) : quiere3D ? null : (
          // Respaldo 2D: en pantallas anchas el mapa ocupa la franja libre entre el texto y el panel.
          <Box position={{ base: "relative", lg: "absolute" }} h="100%" top={{ lg: 0 }} bottom={{ lg: 0 }} left={{ lg: "40%" }} right={{ lg: "26%" }}>
            <CuencaSVG datos={datos} />
          </Box>
        )}
        {/* Velos: a la izquierda dan contraste al titular y abajo funden la escena con el resto de la página. */}
        <Box
          aria-hidden="true"
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          pointerEvents="none"
          bgImage={{
            base: "linear-gradient(180deg, transparent 55%, var(--chakra-colors-oscuro-bg) 100%)",
            lg: "linear-gradient(90deg, var(--chakra-colors-oscuro-bg) 0%, rgba(14,27,44,0.92) 26%, rgba(14,27,44,0) 60%), linear-gradient(180deg, transparent 80%, var(--chakra-colors-oscuro-bg) 100%)",
          }}
        />
        {!datos && (
          <Text position="absolute" left={4} bottom={3} fontSize="xs" bg="oscuro.bg" px={2.5} py="2px" borderRadius="full" color="oscuro.suave">
            Esquema ilustrativo, no a escala cartográfica
          </Text>
        )}
      </Box>
      {datos && (
        <Box position={{ base: "relative", lg: "absolute" }} left={{ lg: 8 }} bottom={{ lg: 6 }} zIndex={2} px={{ base: 4, lg: 0 }} pt={{ base: 3, lg: 0 }} data-evitar-etiquetas="">
          <LeyendaRelieve meta={datos.meta} vista={usar3D ? "3d" : "2d"} />
        </Box>
      )}

      <Box
        position="relative"
        zIndex={1}
        maxW="90rem"
        mx="auto"
        px={{ base: 4, md: 8 }}
        pt={{ base: 8, lg: 16 }}
        pb={{ base: 10, lg: "11rem" }}
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 22rem" }}
        gap={{ base: 8, lg: 12 }}
        minH={{ lg: "48rem" }}
        pointerEvents="none"
        sx={{ "& a, & button, & summary": { pointerEvents: "auto" } }}
      >
        <Aparece
          initial={menosMovimiento ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          maxW="36rem"
          alignSelf="start"
          data-evitar-etiquetas=""
        >
          <Heading as="h1" id="titulo-hero" size="3xl">
            Del Pantanal a Puerto Formosa: el recorrido del agua del río Paraguay
          </Heading>
          <Text mt={5} fontSize={{ base: "md", md: "lg" }} maxW="30rem" color="oscuro.suave">
            Información para ciudadanía, productores y equipos operativos que planifican evacuaciones con anticipación. Los datos llegan hasta el 31/10/2026 y cada cifra indica su
            categoría y su fuente.
          </Text>
          <Box mt={7} display="flex" flexWrap="wrap" gap={3}>
            <Button as="a" href="#ingreso" size="lg" variant="acento">
              Elegir mi perfil
            </Button>
            <Button as={RouterLink} to="/informacion#como-llega" size="lg" variant="sobreOscuro">
              Cómo llega el agua a Formosa
            </Button>
          </Box>
        </Aparece>

        <Aparece
          initial={menosMovimiento ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: EASE_OUT }}
          bg="rgba(14,27,44,0.74)"
          border="1px solid"
          borderColor="oscuro.linea"
          borderRadius="2xl"
          p={5}
          alignSelf="start"
          pointerEvents="auto"
          style={{ backdropFilter: "blur(10px)" }}
          data-evitar-etiquetas=""
        >
          <EscalaHidrometrica />
        </Aparece>
      </Box>
    </Box>
  );
}
