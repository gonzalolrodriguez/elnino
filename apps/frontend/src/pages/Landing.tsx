import { Box, Button, Heading, Link, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { Contenedor } from "../components/Contenedor";
import { IconoCamion, IconoCasa, IconoEscudo } from "../components/iconos/Iconos";
import { Layout } from "../components/Layout";
import { Plegable } from "../components/Plegable";
import { TresRelojes } from "../components/TresRelojes";
import { LIMITES_ESTATICOS } from "../datos/kit";
import { accionPorRol, useSesionPortada } from "../landing/accionSesion";
import { FranjaEstado } from "../landing/FranjaEstado";
import { Hero } from "../landing/Hero";
import { useMeta } from "../lib/useMeta";

/** Selector de perfil: tres tarjetas de igual peso; la tarjeta entera es el enlace (el nombre del perfil). */
const PERFILES: { id: string; nombre: string; detalle: string; a: string; accion: string; icono: ReactElement }[] = [
  { id: "ciudadania", nombre: "Ciudadanía", detalle: "Registrá tu grupo familiar y tu domicilio, recibí alertas y pedí asistencia.", a: "/registro/ciudadania", accion: "Registrarme", icono: <IconoCasa tam="1.5rem" /> },
  { id: "productores", nombre: "Productores", detalle: "Declará tu establecimiento y tu hacienda para planificar el traslado.", a: "/registro/productor", accion: "Registrar mi establecimiento", icono: <IconoCamion tam="1.5rem" /> },
  { id: "mandos", nombre: "Mandos operativos", detalle: "Cuenta institucional: la crea el administrador, no hay autorregistro.", a: "/login", accion: "Ingresar con mi cuenta", icono: <IconoEscudo tam="1.5rem" /> },
];

export default function Landing() {
  const meta = useMeta();
  const sesion = useSesionPortada();
  const { hash } = useLocation();
  const limites = meta.estado === "ok" ? meta.meta.limites : LIMITES_ESTATICOS;

  return (
    <Layout contenedor={false} titulo="Inicio">
      <Hero />

      <FranjaEstado />

      <Contenedor as="section" id="ingreso" aria-labelledby="titulo-perfiles" pt={{ base: 8, md: 12 }} pb={{ base: 2, md: 4 }}>
        {sesion ? (
          <Box layerStyle="tarjeta" p={4} display="flex" flexWrap="wrap" alignItems="center" gap={3} data-testid="portada-sesion">
            <Heading as="h2" id="titulo-perfiles" size="md" flex="1 1 12rem">
              Hola, {sesion.nombre_visible}
            </Heading>
            <Button as={RouterLink} to={accionPorRol(sesion.rol).a} size="lg">
              {accionPorRol(sesion.rol).texto}
            </Button>
            <Link as={RouterLink} to="/app" fontWeight={600}>
              Descargar la app
            </Link>
          </Box>
        ) : (
          <>
            <Heading as="h2" id="titulo-perfiles" size="lg" mb={5}>
              ¿Cómo querés ingresar?
            </Heading>
            <Box as="ul" listStyleType="none" m={0} p={0} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }} gap={{ base: 3, md: 5 }}>
              {PERFILES.map((p) => (
                <Box
                  as="li"
                  key={p.id}
                  layerStyle="tarjeta"
                  position="relative"
                  p={{ base: 5, md: 6 }}
                  display="flex"
                  flexDirection="column"
                  gap={3}
                  transition="border-color 160ms var(--ease-out), background-color 160ms var(--ease-out)"
                  sx={{
                    "&:focus-within": { outline: "3px solid", outlineColor: "var(--chakra-colors-foco)", outlineOffset: "2px" },
                    "@media (hover: hover) and (pointer: fine)": { "&:hover": { borderColor: "var(--chakra-colors-primario)" } },
                  }}
                >
                  <Box aria-hidden="true" display="inline-flex" alignItems="center" justifyContent="center" w="44px" h="44px" borderRadius="lg" bg="suave" color="primarioHover">
                    {p.icono}
                  </Box>
                  <Heading as="h3" size="md">
                    <Link
                      as={RouterLink}
                      to={p.a}
                      color="texto"
                      textDecoration="none"
                      _hover={{ textDecoration: "none", color: "primarioHover" }}
                      _focusVisible={{ outline: "none", boxShadow: "none" }}
                      sx={{ "&::after": { content: '""', position: "absolute", inset: 0, borderRadius: "var(--chakra-radii-xl)" } }}
                    >
                      {p.nombre}
                    </Link>
                  </Heading>
                  <Text color="textoSuave" flex="1">
                    {p.detalle}
                  </Text>
                  <Text aria-hidden="true" fontWeight={600} color="primarioHover">
                    {p.accion} →
                  </Text>
                </Box>
              ))}
            </Box>
            <Text mt={5} color="textoSuave">
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
      </Contenedor>

      <TresRelojes />

      <Contenedor pb={{ base: 10, md: 16 }}>
        <Box layerStyle="suave" p={{ base: 5, md: 8 }} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }} gap={{ base: 6, md: 10 }} alignItems="start">
          <Box>
            <Heading as="h2" size="lg" mb={3}>
              Por qué importa antes de que llueva
            </Heading>
            <Text maxW="34rem">
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
                <Heading as="h2" id="titulo-limites" size="bloque">
                  Límites de esta plataforma
                </Heading>
              }
            >
              <UnorderedList spacing={2} ml={4} pb={3} color="textoSuave">
                {limites.map((l) => (
                  <ListItem key={l}>{l}</ListItem>
                ))}
              </UnorderedList>
              {meta.estado === "error" && (
                <Text textStyle="microdato" pb={3} role="status">
                  Se muestran los valores guardados en esta página.
                </Text>
              )}
            </Plegable>
          </Box>
        </Box>
      </Contenedor>
    </Layout>
  );
}
