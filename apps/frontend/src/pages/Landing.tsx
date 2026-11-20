import { Box, Button, Heading, Link, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { TresRelojes } from "../components/TresRelojes";
import { LIMITES_ESTATICOS } from "../datos/kit";
import { accionPorRol, useSesionPortada } from "../landing/accionSesion";
import { FranjaEstado } from "../landing/FranjaEstado";
import { Hero } from "../landing/Hero";
import { useMeta } from "../lib/useMeta";

/** Selector compacto de perfil: los mismos destinos de siempre, en tres botones. */
const PERFILES = [
  { id: "ciudadania", nombre: "Ciudadanía", detalle: "Registrá tu grupo familiar y tu domicilio, recibí alertas y pedí asistencia.", a: "/registro/ciudadania" },
  { id: "productores", nombre: "Productores", detalle: "Declará tu establecimiento y tu hacienda para planificar el traslado.", a: "/registro/productor" },
  { id: "mandos", nombre: "Mandos operativos", detalle: "Cuenta institucional: la crea el administrador, no hay autorregistro.", a: "/login" },
] as const;

export default function Landing() {
  const meta = useMeta();
  const sesion = useSesionPortada();
  const { hash } = useLocation();
  const limites = meta.estado === "ok" ? meta.meta.limites : LIMITES_ESTATICOS;

  return (
    <Layout contenedor={false} titulo="Inicio">
      <Hero />

      <FranjaEstado />

      <Box as="section" id="ingreso" aria-labelledby="titulo-perfiles" maxW="90rem" mx="auto" px={{ base: 4, md: 8 }} pt={{ base: 8, md: 10 }} pb={{ base: 8, md: 10 }}>
        {sesion ? (
          <Box layerStyle="tarjeta" p={4} display="flex" flexWrap="wrap" alignItems="center" gap={3} data-testid="portada-sesion">
            <Heading as="h2" id="titulo-perfiles" size="md" flex="1 1 12rem">
              Hola, {sesion.nombre_visible}
            </Heading>
            <Button as={RouterLink} to={accionPorRol(sesion.rol).a} size="lg">
              {accionPorRol(sesion.rol).texto}
            </Button>
            <Link as={RouterLink} to="/app" fontWeight={600} fontSize="sm">
              Descargar la app
            </Link>
          </Box>
        ) : (
          <>
        <Heading as="h2" id="titulo-perfiles" size="lg" mb={4}>
          ¿Cómo querés ingresar?
        </Heading>
        <Box as="ul" listStyleType="none" m={0} p={0} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }} gap={{ base: 3, md: 4 }}>
          {PERFILES.map((p) => (
            <Box as="li" key={p.id} layerStyle="tarjeta" p={4} display="flex" flexDirection="column" gap={3}>
              <Text color="textoSuave" fontSize="sm" flex="1">
                {p.detalle}
              </Text>
              <Button as={RouterLink} to={p.a} size="lg" w="100%">
                {p.nombre}
              </Button>
            </Box>
          ))}
        </Box>
        <Text mt={4} fontSize="sm" color="textoSuave">
          ¿Ya tenés cuenta?{" "}
          <Link as={RouterLink} to="/login" fontWeight={600}>
            Ingresar
          </Link>
          {" · "}
          <Link as={RouterLink} to="/app" fontWeight={600}>
            Descargar la app
          </Link>
        </Text>
          </>
        )}
      </Box>

      <TresRelojes sobretitulo="Entender la situación" />

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
