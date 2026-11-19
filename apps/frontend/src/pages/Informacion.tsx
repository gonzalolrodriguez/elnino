import { Box, Heading, Link, ListItem, Table, Tbody, Td, Text, Th, Thead, Tr, UnorderedList } from "@chakra-ui/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { TablaDesplazable } from "../components/TablaDesplazable";
import { MarcasUmbral } from "../components/MarcasUmbral";
import { MuestraEstado } from "../components/MuestraEstado";
import { K10_FECHA, MARGEN_RIESGO_M, SECTORES_K10, UMBRAL_ALERTA } from "../datos/kit";
import { estadoSector, MapaSectores } from "../informacion/MapaSectores";
import { SerieK1 } from "../informacion/SerieK1";
import { fmt, fmtMiles } from "../lib/entorno";
import { useSerieFormosa } from "../lib/serie";

const TEMAS = [
  { id: "que-es", titulo: "Qué es El Niño" },
  { id: "como-llega", titulo: "Cómo llega el agua a Formosa" },
  { id: "amenazas", titulo: "Dos amenazas distintas" },
  { id: "serie", titulo: "Puerto Formosa: umbrales y picos" },
  { id: "pronostico", titulo: "Pronóstico estacional 2026/27" },
  { id: "sectores", titulo: "Sectores de evaluación" },
  { id: "que-hacer", titulo: "Qué hacer" },
  { id: "fuentes", titulo: "Fuentes" },
] as const;

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <Box as="section" aria-labelledby={id} py={{ base: 7, md: 9 }} borderTop="1px solid" borderColor="borde" id={`sec-${id}`}>
      <Heading as="h2" id={id} size="lg" mb={4}>
        {titulo}
      </Heading>
      {children}
    </Box>
  );
}

function Hecho({ valor, texto, fuente }: { valor: string; texto: string; fuente: string }) {
  return (
    <Box py={4} borderBottom="1px solid" borderColor="borde" display="grid" gridTemplateColumns={{ base: "1fr", md: "9.5rem minmax(0, 1fr)" }} gap={{ base: 1, md: 6 }} maxW="48rem">
      <Text textStyle="cifra" fontSize="2xl">
        {valor}
      </Text>
      <Box>
        <Text>{texto}</Text>
        <Box mt={2} display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <Insignia categoria="DOCUMENTO DE REFERENCIA" />
          <Text as="span" fontSize="xs" color="textoSuave">
            {fuente}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function Indice() {
  return (
    <Box
      as="nav"
      aria-label="En esta página"
      position={{ lg: "sticky" }}
      top={{ lg: "calc(var(--altura-leyenda) + 1.5rem)" }}
      alignSelf="start"
      borderLeft={{ lg: "1px solid" }}
      borderColor="borde"
      pl={{ lg: 4 }}
      mb={{ base: 6, lg: 0 }}
    >
      <Text fontWeight={700} fontSize="sm" mb={2}>
        En esta página
      </Text>
      <Box as="ul" listStyleType="none" m={0} p={0} display={{ base: "grid", sm: "grid", lg: "block" }} gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }} columnGap={6}>
        {TEMAS.map((t) => (
          <li key={t.id}>
            <Link href={`#${t.id}`} display="block" py={1.5} fontSize="sm" textDecoration="none" color="textoSuave" _hover={{ color: "primario", textDecoration: "underline" }}>
              {t.titulo}
            </Link>
          </li>
        ))}
      </Box>
    </Box>
  );
}

export default function Informacion() {
  const { hash } = useLocation();
  const [altura, setAltura] = useState(5.6);
  const { serie } = useSerieFormosa();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [hash]);

  return (
    <Layout titulo="Información">
      <Box maxW="80rem" mx="auto">
      <Heading as="h1" size="2xl" maxW="40rem">
        Información para entender la crecida
      </Heading>
      <Text mt={4} maxW="40rem" fontSize="lg" color="pizarra.700">
        El Niño, el río Paraguay y la lluvia local: qué es cada fenómeno, cómo se traduce en Formosa y qué dicen los datos hasta el corte del 31/10/2026.
      </Text>

      <Box mt={{ base: 6, lg: 8 }} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "13rem minmax(0, 1fr)" }} columnGap={{ lg: 10 }}>
        <Indice />
        <Box minW={0}>

      <Seccion id="que-es" titulo="Qué es El Niño">
        <Text maxW="40rem" mb={4}>
          El Niño es la fase cálida del ENOS (El Niño–Oscilación del Sur): el Pacífico ecuatorial se calienta, los vientos alisios se
          debilitan y cambia el reparto de lluvias en buena parte de Sudamérica. En primavera, bajo El Niño, se favorecen las
          precipitaciones en la Mesopotamia y en las franjas este y oeste de la región Pilcomayo–Bermejo.
        </Text>
        <Hecho valor="4/9/2026" texto="El SMN confirma la fase El Niño, con 100 % de probabilidad para septiembre–noviembre." fuente="SMN, Boletín N.º 1 sobre El Niño (04/09/2026), vía K9" />
        <Hecho valor="22/10/2026" texto="El Boletín N.º 8 indica 100 % de probabilidad de permanencia en fase El Niño en octubre–noviembre–diciembre de 2026." fuente="SMN y COHIFE, Boletín El Niño N.º 8 (publicado el 22/10/2026)" />
        <Hecho valor="83 %" texto="Probabilidad de un evento fuerte o muy fuerte en octubre–diciembre, con persistencia hasta el verano." fuente="NOAA CPC, Discusión ENSO (08/10/2026), vía K9" />
      </Seccion>

      <Seccion id="como-llega" titulo="Cómo llega el agua a Formosa">
        <Text maxW="40rem">
          La lluvia cae en la cuenca alta y media del río Paraguay. El Pantanal funciona como amortiguador: retiene agua y la entrega
          despacio. A esto se suma el remanso que genera el Paraná en la confluencia. Por eso la crecida en Puerto Formosa llega con un
          rezago de semanas a meses respecto de la lluvia que la origina. Es una descripción general del proceso: no sirve para fechar
          una crecida puntual.
        </Text>
      </Seccion>

      <Seccion id="amenazas" titulo="Dos amenazas distintas">
        <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={8} maxW="48rem">
          <Box layerStyle="suave" p={5}>
            <Heading as="h3" size="sm" mb={2}>
              Exógena: los ríos
            </Heading>
            <Text>El agua viene de afuera, por el cauce. Se sigue con las escalas del INA, que no publica pronósticos a más de 15 días (K9).</Text>
          </Box>
          <Box layerStyle="suave" p={5}>
            <Heading as="h3" size="sm" mb={2}>
              Endógena: la lluvia local
            </Heading>
            <Text>Cae sobre suelos arcillosos de muy baja pendiente y anega caminos y campos con muy poco margen de aviso (alrededor de 24 horas según el documento base del equipo).</Text>
          </Box>
        </Box>
      </Seccion>

      <Seccion id="serie" titulo="Puerto Formosa: umbrales y picos">
        <Text maxW="40rem" mb={4}>
          El nivel de alerta es {fmt(UMBRAL_ALERTA)} m y el de evacuación 8,30 m. La serie alcanzó 9,81 m en enero de 2016 y 9,72 m en
          junio de 2019. Al 31/10/2026 la escala marcaba 5,60 m. No hay lluvia observada en el kit.
        </Text>
        <SerieK1 serie={serie} />
      </Seccion>

      <Seccion id="pronostico" titulo="Pronóstico estacional 2026/27">
        <Text maxW="40rem" mb={4}>
          El modelo CFS v2 de NOAA (ensamble de 20 corridas) estima condiciones de El Niño muy fuerte para el período noviembre de 2026
          a julio de 2027. Es una señal de tendencia, no una predicción de días de lluvia ni de la altura del río.
        </Text>
        <Hecho valor="+2,2" texto="Pico estimado del índice ONI. La probabilidad de que el ONI llegue a +2,0 °C o más es de 93 %." fuente="Pronóstico agroclimático estacional 2026/27 Formosa, CFS v2 (emisión 29/10/2026)" />
        <Hecho valor="8 de 14" texto="Campañas de años El Niño que quedaron en el tercio húmedo en Formosa; solo una cayó en el tercio seco (45 campañas analizadas). La fase ENOS cambia las probabilidades, no decide la campaña." fuente="Mismo pronóstico agroclimático (29/10/2026)" />
        <Text mt={3} fontSize="sm" color="textoSuave" maxW="40rem">
          El INA no pronostica la altura del río más allá de 15 días: cualquier fecha de cruce de un umbral en 2027 sería un supuesto.
        </Text>
      </Seccion>

      <Seccion id="sectores" titulo="Sectores de evaluación">
        <Box display="flex" gap={2} alignItems="center" mb={3} flexWrap="wrap">
          <Insignia categoria="SIMULADO" />
          <Text fontSize="sm">K10 v1.0 · {K10_FECHA}. No son barrios ni parajes reales.</Text>
        </Box>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 22rem) minmax(0, 1fr)" }} gap={8} alignItems="start">
          <Box>
            <MapaSectores altura={altura} />
            <Box mt={3}>
              <label htmlFor="altura-sim" style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Altura simulada de Puerto Formosa: {fmt(altura)} m
              </label>
              <input id="altura-sim" type="range" min={0} max={12} step={0.1} value={altura} onChange={(e) => setAltura(Number(e.target.value))} style={{ width: "100%", minHeight: "2rem" }} />
              <MarcasUmbral />
              <Text fontSize="xs" color="textoSuave">
                Escenario SIMULADO. En riesgo: a menos de {fmt(MARGEN_RIESGO_M)} m de la altura de compromiso (SUPUESTO). El 5,60 m es el valor
                observado al corte.
              </Text>
            </Box>
          </Box>
          <Box minW={0}>
            <TablaDesplazable etiqueta="Sectores de evaluación K10">
            <Table size="sm" variant="simple" aria-label="Sectores de evaluación K10">
              <Thead>
                <Tr>
                  <Th>Sector</Th>
                  <Th isNumeric>Compromiso</Th>
                  <Th isNumeric>Población</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {SECTORES_K10.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <strong>{s.id}</strong> {s.nombre}
                      <Text fontSize="xs" color="textoSuave">
                        {s.acceso}
                      </Text>
                    </Td>
                    <Td isNumeric>{fmt(s.compromiso_m)} m</Td>
                    <Td isNumeric>{fmtMiles(s.poblacion)}</Td>
                    <Td><MuestraEstado estado={estadoSector(s, altura)} /></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            </TablaDesplazable>
            <Text fontSize="xs" color="textoSuave" mt={2}>
              S4 se compromete 0,30 m antes del nivel de alerta: a 1,90 m del valor observado al corte.
            </Text>
          </Box>
        </Box>
      </Seccion>

      <Seccion id="que-hacer" titulo="Qué hacer">
        <UnorderedList spacing={2} maxW="40rem" ml={4}>
          <ListItem>Anticiparse: la evacuación con el camino seco es más segura y más rápida que con lluvia.</ListItem>
          <ListItem>
            Registrarse como{" "}
            <Link as={RouterLink} to="/registro/ciudadania" >
              ciudadanía
            </Link>{" "}
            o como{" "}
            <Link as={RouterLink} to="/registro/productor" >
              productor
            </Link>{" "}
            para que el traslado de personas y animales se planifique con tiempo.
          </ListItem>
          <ListItem>Seguir las indicaciones de las autoridades: decidir una evacuación y definir recorridos les corresponde a ellas.</ListItem>
        </UnorderedList>
      </Seccion>

      <Seccion id="fuentes" titulo="Fuentes">
        <UnorderedList spacing={2} fontSize="sm" maxW="46rem" ml={4}>
          <ListItem>
            Altura de Puerto Formosa: INA, red de escalas de Prefectura Naval, serie K1 limpia (DATO OBSERVADO, corte 31/10/2026). API
            consultada el 29/10/2026: alerta.ina.gob.ar/pub/datos.
          </ListItem>
          <ListItem>Umbrales y ubicación de estaciones: INA, catálogo de estaciones, K3 (DATO OBSERVADO, consultado el 29/10/2026).</ListItem>
          <ListItem>Sectores: K10 v1.0 del 12/11/2026 (SIMULADO).</ListItem>
          <ListItem>SMN, Boletín N.º 1 sobre El Niño, 04/09/2026 (DOCUMENTO DE REFERENCIA).</ListItem>
          <ListItem>NOAA CPC, Discusión ENSO, 08/10/2026 (DOCUMENTO DE REFERENCIA).</ListItem>
          <ListItem>SMN y COHIFE, Boletín El Niño N.º 8, publicado el 22/10/2026 (DOCUMENTO DE REFERENCIA).</ListItem>
          <ListItem>Pronóstico agroclimático estacional 2026/27 Formosa, CFS v2 NOAA, emisión 29/10/2026 (DOCUMENTO DE REFERENCIA).</ListItem>
        </UnorderedList>
      </Seccion>
        </Box>
      </Box>
      </Box>
    </Layout>
  );
}
