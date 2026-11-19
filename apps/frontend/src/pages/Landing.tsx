import { Box, Button, Heading, Link, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { LIMITES_ESTATICOS } from "../datos/kit";
import { Hero } from "../landing/Hero";
import { useMeta } from "../lib/useMeta";

const PERFILES = [
  {
    id: "ciudadania",
    nombre: "Ciudadanía",
    texto: "Registrá tu grupo familiar y tu domicilio para saber en qué sector estás, recibir alertas y pedir asistencia si el camino se corta.",
    principal: { a: "/registro/ciudadania", t: "Registrarme" },
    secundaria: { a: "/login", t: "Ya tengo cuenta" },
  },
  {
    id: "productores",
    nombre: "Productores agropecuarios",
    texto: "Declará tu establecimiento, la ubicación de la tranquera y tu hacienda para planificar el traslado de animales antes de que los caminos se saturen.",
    principal: { a: "/registro/productor", t: "Registrar mi establecimiento" },
    secundaria: { a: "/app", t: "Descargar la app" },
  },
  {
    id: "mandos",
    nombre: "Mandos operativos y decisores",
    texto: "Monitor del río, simulador de escenarios y emisión de órdenes. Las cuentas institucionales las crea el administrador: no hay autorregistro.",
    principal: { a: "/login", t: "Ingresar con cuenta institucional" },
    secundaria: null,
  },
] as const;

export default function Landing() {
  const meta = useMeta();
  const { hash } = useLocation();
  const limites = meta.estado === "ok" ? meta.meta.limites : LIMITES_ESTATICOS;

  return (
    <Layout contenedor={false} titulo="Inicio">
      <Hero />

      <Box as="section" id="ingreso" aria-labelledby="titulo-perfiles" maxW="90rem" mx="auto" px={{ base: 4, md: 8 }} pt={{ base: 12, md: 20 }} pb={{ base: 10, md: 14 }}>
        <Heading as="h2" id="titulo-perfiles" size="xl" mb={2}>
          ¿Cómo querés ingresar?
        </Heading>
        <Text color="textoSuave" maxW="34rem" mb={{ base: 6, md: 8 }}>
          Elegí tu perfil. Cada uno ve la información que necesita.
        </Text>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }} gap={{ base: 4, md: 5 }}>
          {PERFILES.map((p) => (
            <Box key={p.id} layerStyle="tarjeta" p={{ base: 5, md: 6 }} display="flex" flexDirection="column">
              <Heading as="h3" size="md" mb={2}>
                {p.nombre}
              </Heading>
              <Text color="textoSuave" flex="1" mb={5}>
                {p.texto}
              </Text>
              <Box display="flex" alignItems="center" flexWrap="wrap" columnGap={4} rowGap={2}>
                <Button as={RouterLink} to={p.principal.a}>
                  {p.principal.t}
                </Button>
                {p.secundaria && (
                  <Link as={RouterLink} to={p.secundaria.a} fontWeight={600}>
                    {p.secundaria.t}
                  </Link>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box maxW="90rem" mx="auto" px={{ base: 4, md: 8 }} pb={{ base: 12, md: 20 }}>
        <Box layerStyle="suave" p={{ base: 6, md: 10 }} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }} gap={{ base: 6, md: 12 }} alignItems="start">
          <Box>
            <Heading as="h2" size="lg" mb={3}>
              Por qué importa antes de que llueva
            </Heading>
            <Text maxW="32rem">
              La crecida del río Paraguay llega a Formosa con un rezago de semanas a meses y, además, la lluvia local cae sobre suelos arcillosos de muy baja pendiente. Evacuar con el
              camino seco es más seguro que hacerlo con el agua encima.
            </Text>
            <Button as={RouterLink} to="/informacion" mt={5} variant="solid">
              Leer cómo llega El Niño a Formosa
            </Button>
          </Box>
          <Box as="section" aria-labelledby="titulo-limites" bg="superficie" borderRadius="xl" px={{ base: 4, md: 5 }} py={1}>
            <Plegable
              id="limites"
              abierto={hash === "#limites" ? true : undefined}
              titulo={
                <Heading as="h2" id="titulo-limites" size="sm">
                  Límites de esta plataforma
                </Heading>
              }
            >
              <UnorderedList spacing={2} fontSize="sm" ml={4} pb={3} color="textoSuave">
                {limites.map((l) => (
                  <ListItem key={l}>{l}</ListItem>
                ))}
              </UnorderedList>
              {meta.estado === "error" && (
                <Text fontSize="xs" color="textoSuave" pb={3} role="status">
                  Se muestran los valores guardados en esta página.
                </Text>
              )}
            </Plegable>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
