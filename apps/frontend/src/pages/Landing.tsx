import { Box, Button, Heading, Link, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { EstadoBackend } from "../components/EstadoBackend";
import { Layout } from "../components/Layout";
import { LIMITES_ESTATICOS } from "../datos/kit";
import { Hero } from "../landing/Hero";
import { useMeta } from "../lib/useMeta";

const PERFILES = [
  {
    id: "ciudadania",
    nombre: "Ciudadanía",
    texto:
      "Registrá tu grupo familiar y tu domicilio para saber en qué sector estás, recibir alertas y pedir asistencia si el camino se corta.",
    acciones: [
      { a: "/registro/ciudadania", t: "Registrarme", principal: true },
      { a: "/login", t: "Ya tengo cuenta" },
    ],
  },
  {
    id: "productores",
    nombre: "Productores agropecuarios",
    texto:
      "Declará tu establecimiento, la ubicación de la tranquera y tu hacienda. Con esos datos se planifica el traslado de animales antes de que los caminos se saturen.",
    acciones: [
      { a: "/registro/productor", t: "Registrar mi establecimiento", principal: true },
      { a: "/app", t: "Descargar la app" },
    ],
  },
  {
    id: "mandos",
    nombre: "Mandos operativos y decisores",
    texto:
      "Monitor del río, simulador de escenarios y emisión de órdenes. Las cuentas institucionales las crea el administrador: no hay autorregistro.",
    acciones: [{ a: "/login", t: "Ingresar con cuenta institucional", principal: true }],
  },
] as const;

export default function Landing() {
  const meta = useMeta();
  const limites = meta.estado === "ok" ? meta.meta.limites : LIMITES_ESTATICOS;

  return (
    <Layout contenedor={false} titulo="Inicio">
      <Hero avisoSinServicio={meta.estado === "error"} />

      <Box as="section" id="ingreso" aria-labelledby="titulo-perfiles" maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 10, md: 16 }}>
        <Heading as="h2" id="titulo-perfiles" size="xl" mb={{ base: 4, md: 8 }}>
          ¿Cómo querés ingresar?
        </Heading>
        <Box>
          {PERFILES.map((p, i) => (
            <Box
              key={p.id}
              display="grid"
              gridTemplateColumns={{ base: "1fr", md: "minmax(0, 15rem) minmax(0, 1fr) auto" }}
              gap={{ base: 3, md: 8 }}
              alignItems="start"
              py={6}
              borderTop={i === 0 ? "2px solid" : "1px solid"}
              borderColor="pizarra.700"
            >
              <Heading as="h3" size="md" pt={0.5}>
                {p.nombre}
              </Heading>
              <Text maxW="38rem">{p.texto}</Text>
              <Box display="flex" gap={3} flexWrap="wrap">
                {p.acciones.map((x) => (
                  <Button key={x.t} as={RouterLink} to={x.a} variant={"principal" in x && x.principal ? "solid" : "outline"}>
                    {x.t}
                  </Button>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box bg="pizarra.100" py={{ base: 10, md: 16 }}>
        <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={10}>
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Por qué importa antes de que llueva
            </Heading>
            <Text maxW="32rem">
              La crecida del río Paraguay llega a Formosa con un rezago de semanas a meses y, además, la lluvia local cae sobre suelos
              arcillosos de muy baja pendiente. Evacuar con el camino seco es más seguro que hacerlo con el agua encima.
            </Text>
            <Button as={RouterLink} to="/informacion" mt={5} variant="outline">
              Leer cómo llega El Niño a Formosa
            </Button>
          </Box>
          <Box as="section" aria-labelledby="titulo-limites">
            <Heading as="h2" id="titulo-limites" size="md" mb={3}>
              Límites de esta plataforma
            </Heading>
            <UnorderedList spacing={2} fontSize="sm" ml={4}>
              {limites.map((l) => (
                <ListItem key={l}>{l}</ListItem>
              ))}
            </UnorderedList>
          </Box>
        </Box>
      </Box>

      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={10}>
        <EstadoBackend />
        <Text mt={4} fontSize="sm">
          Fuentes y supuestos de cada cifra:{" "}
          <Link as={RouterLink} to="/informacion#fuentes">
            sección de fuentes
          </Link>
          .
        </Text>
      </Box>
    </Layout>
  );
}
