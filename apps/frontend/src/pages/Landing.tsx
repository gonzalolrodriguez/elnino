import { Badge, Box, Button, Flex, Heading, Link, ListItem, SimpleGrid, Text, UnorderedList } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { EstadoBackend } from "../components/EstadoBackend";
import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { LIMITES_ESTATICOS } from "../datos/kit";
import { Hero } from "../landing/Hero";
import { useMeta } from "../lib/useMeta";

const SINTESIS_CORTE = [
  {
    id: "kpi-corte",
    valor: "5,60 m",
    etiqueta: "Puerto Formosa al corte (31/10/2026)",
    detalle: "Ascenso en octubre desde 2,37 m (01/10). A 2,20 m del nivel oficial de alerta (7,80 m).",
    categoria: "DATO OBSERVADO" as const,
    fuente: "K1 limpio · INA siteCode 57",
    borde: "agua.700",
  },
  {
    id: "kpi-s4",
    valor: "7,50 m",
    etiqueta: "Compromiso temprano · Sector S4 Rural Este",
    detalle: "Se compromete 0,30 m antes del alerta oficial (7,80 m) y su camino de tierra se satura con lluvia.",
    categoria: "SIMULADO" as const,
    fuente: "K10 v1.0 · 12/11/2026",
    borde: "escala.alerta",
  },
  {
    id: "kpi-poblacion",
    valor: "5.650",
    etiqueta: "Personas en los 4 sectores de evaluación",
    detalle: "S1 Norte (1.200) · S2 Centro (3.500) · S3 Sur (800) · S4 Rural Este (150 + producción ganadera).",
    categoria: "SIMULADO" as const,
    fuente: "K10 v1.0 · suma de sectores",
    borde: "pizarra.700",
  },
  {
    id: "kpi-cfs",
    valor: "1.623 mm",
    etiqueta: "Lluvia proyectada Nov 2026 – Jul 2027",
    detalle: "+394 mm sobre la normal (1.229 mm), con pico proyectado de 308 mm en marzo de 2027.",
    categoria: "DOCUMENTO DE REFERENCIA" as const,
    fuente: "NOAA CFS v2 · 29/10/2026",
    borde: "agua.600",
  },
] as const;

const PERFILES = [
  {
    id: "ciudadania",
    nombre: "Ciudadanía",
    acento: "agua.700",
    pilares: ["Grupo familiar y vulnerables", "Alertas por sector K10", "Solicitud de asistencia web y SMS"],
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
    acento: "verde.600",
    pilares: ["Tranquera Digital en S4/S1", "Hacienda hasta 200 cab./lote", "Albardón, camiones y ración INTA"],
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
    acento: "escala.alerta",
    pilares: ["Simulador Ventana Seca y ruteo", "Arca Productiva y cuadrillas", "Centinela K1/K6/K7 y Bitácora K8"],
    texto:
      "Monitor del río, simulador de escenarios y emisión de órdenes. Las cuentas institucionales las crea el administrador: no hay autorregistro.",
    acciones: [
      { a: "/login", t: "Ingresar con cuenta institucional", principal: true },
    ],
  },
] as const;

export default function Landing() {
  const meta = useMeta();
  const limites = meta.estado === "ok" ? meta.meta.limites : LIMITES_ESTATICOS;

  return (
    <Layout contenedor={false} titulo="Inicio">
      <Hero avisoSinServicio={meta.estado === "error"} />

      {/* Franja de síntesis territorial e hidrológica al día de corte */}
      <Box as="section" aria-label="Síntesis territorial al día de corte" bg="pizarra.100" borderBottom="1px solid" borderColor="borde" py={{ base: 6, md: 8 }}>
        <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }}>
          <Flex justify="space-between" align="baseline" wrap="wrap" gap={2} mb={4}>
            <Heading as="h2" size="sm" color="pizarra.800" textTransform="uppercase" letterSpacing="0.04em">
              Panorama operativo al corte oficial (31/10/2026)
            </Heading>
            <Text fontSize="xs" color="textoSuave">
              Cada tarjeta distingue entre dato observado del kit, documento de referencia y escenario simulado
            </Text>
          </Flex>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
            {SINTESIS_CORTE.map((k) => (
              <Box
                key={k.id}
                bg="superficie"
                border="1px solid"
                borderColor="borde"
                borderTop="4px solid"
                borderTopColor={k.borde}
                borderRadius="sm"
                p={4}
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                gap={2}
              >
                <Box>
                  <Flex justify="space-between" align="center" gap={2} wrap="wrap" mb={1}>
                    <Insignia categoria={k.categoria} />
                    <Text fontSize="xs" color="textoSuave">
                      {k.fuente}
                    </Text>
                  </Flex>
                  <Text textStyle="cifra" fontSize="2xl" mt={1}>
                    {k.valor}
                  </Text>
                  <Text fontWeight={700} fontSize="sm" mt={0.5}>
                    {k.etiqueta}
                  </Text>
                </Box>
                <Text fontSize="xs" color="textoSuave">
                  {k.detalle}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Box>

      {/* Selector de ingreso por perfil en tarjetas visuales */}
      <Box as="section" id="ingreso" aria-labelledby="titulo-perfiles" maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 10, md: 16 }}>
        <Flex justify="space-between" align="flex-end" wrap="wrap" gap={4} mb={{ base: 6, md: 8 }}>
          <Box>
            <Heading as="h2" id="titulo-perfiles" size="xl">
              ¿Cómo querés ingresar?
            </Heading>
            <Text mt={2} color="textoSuave" maxW="42rem">
              Seleccioná tu perfil para registrar una tranquera productiva, empadronar un grupo familiar o acceder al centro de comando operativo.
            </Text>
          </Box>
        </Flex>

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
          {PERFILES.map((p) => (
            <Box
              key={p.id}
              bg="superficie"
              border="1px solid"
              borderColor="borde"
              borderTop="4px solid"
              borderTopColor={p.acento}
              borderRadius="sm"
              p={{ base: 5, md: 6 }}
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
              gap={5}
            >
              <Box>
                <Heading as="h3" size="md" mb={3}>
                  {p.nombre}
                </Heading>
                <Text fontSize="md" mb={4}>
                  {p.texto}
                </Text>
                <Flex gap={1.5} wrap="wrap">
                  {p.pilares.map((pilar) => (
                    <Badge key={pilar} bg="pizarra.100" color="pizarra.800" fontWeight={600} px={2} py={0.5}>
                      {pilar}
                    </Badge>
                  ))}
                </Flex>
              </Box>
              <Box display="flex" gap={3} flexWrap="wrap" pt={3} borderTop="1px solid" borderColor="borde">
                {p.acciones.map((x) => (
                  <Button key={x.t} as={RouterLink} to={x.a} variant={"principal" in x && x.principal ? "solid" : "outline"}>
                    {x.t}
                  </Button>
                ))}
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Box bg="pizarra.100" py={{ base: 10, md: 16 }} borderTop="1px solid" borderColor="borde">
        <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={10}>
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Por qué importa antes de que llueva ("Ventana Seca")
            </Heading>
            <Text maxW="34rem">
              La crecida del río Paraguay llega a Formosa con un rezago de semanas a meses y, además, la lluvia local cae sobre suelos
              arcillosos de muy baja pendiente. Evacuar personas y hacienda con el camino seco es más seguro que hacerlo con el agua encima.
            </Text>
            <Flex gap={3} wrap="wrap" mt={5}>
              <Button as={RouterLink} to="/informacion" variant="outline">
                Leer cómo llega El Niño a Formosa
              </Button>
              <Button as={RouterLink} to="/informacion#sectores" variant="ghost">
                Explorar sectores K10 →
              </Button>
            </Flex>
          </Box>
          <Box as="section" aria-labelledby="titulo-limites" bg="superficie" p={6} border="1px solid" borderColor="borde" borderTop="3px solid" borderTopColor="pizarra.700" borderRadius="sm">
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
