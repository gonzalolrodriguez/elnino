import { Alert, AlertIcon, Badge, Box, Button, Flex, FormControl, FormLabel, Heading, Input, List, ListItem, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { BloqueApoyo, PaginaFormulario } from "../components/PaginaFormulario";

/** APK publicada por EAS Build (perfil preview, build b08751c6 del 19/11/2026). VITE_APK_URL la reemplaza. */
const APK_URL_EAS = "https://expo.dev/artifacts/eas/DPhHMaMeOlWckYbImnaICQY-QZdvivoYwiOcL0v2HVg.apk";
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim() || APK_URL_EAS;

export function AppMovil() {
  const [perfil, setPerfil] = useState<"PRODUCTOR" | "CIUDADANO">("PRODUCTOR");
  const [personas, setPersonas] = useState("5");
  const [bovinos, setBovinos] = useState("30");
  const [acceso, setAcceso] = useState<"BARRO" | "INUNDADO" | "TRANSITABLE">("BARRO");
  const [detalle, setDetalle] = useState("Camino de tierra S4 saturado, solicitamos camion jaula");

  const tramaSos = `SOS-FSA|-26.180,-58.139|${perfil}|FAM:${personas || "1"}|BOV:${bovinos || "0"}|ACC:${acceso}|${detalle.slice(0, 52)}`;

  return (
    <Layout titulo="App móvil">
      <PaginaFormulario
        titulo="App móvil"
        intro="La app (Android) permite pedir asistencia aunque no haya conexión: el pedido queda guardado en el teléfono y se envía cuando vuelve la señal. También recibe las alertas y las órdenes de tu sector."
        anchoFormulario="36rem"
        aside={
          <>
            <BloqueApoyo titulo="Qué pasa si no hay señal">
              <Box as="ol" m={0} pl={5} fontSize="sm">
                <li>Armás el pedido de asistencia: ubicación, personas, animales y una foto.</li>
                <li>Queda guardado en el teléfono y la app muestra cuántos pedidos esperan.</li>
                <li>Cuando vuelve la señal, la app los envía sola, primero los datos mínimos y después la foto.</li>
                <li>Si no hay datos móviles, podés abrir un mensaje de texto ya redactado y enviarlo por SMS.</li>
              </Box>
            </BloqueApoyo>

            <Box layerStyle="tarjeta" p={{ base: 4, md: 5 }} mt={4}>
              <Flex justify="space-between" align="center" wrap="wrap" gap={2} mb={2}>
                <Heading as="h2" size="sm">
                  Simulador de trama SMS (Protocolo SOS-FSA)
                </Heading>
                <Insignia categoria="SIMULADO" />
              </Flex>
              <Text fontSize="xs" color="textoSuave" mb={3}>
                Sin datos móviles, la app genera un SMS compacto de hasta 160 caracteres que el servidor interpreta automáticamente.
              </Text>

              <SimpleGrid columns={{ base: 2, sm: 4 }} spacing={2} mb={3}>
                <FormControl>
                  <FormLabel htmlFor="sos-perfil" fontSize="xs" mb={0}>
                    Perfil
                  </FormLabel>
                  <Select id="sos-perfil" size="xs" bg="superficie" value={perfil} onChange={(e) => setPerfil(e.target.value as "PRODUCTOR" | "CIUDADANO")}>
                    <option value="PRODUCTOR">PRODUCTOR</option>
                    <option value="CIUDADANO">CIUDADANO</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="sos-fam" fontSize="xs" mb={0}>
                    Personas
                  </FormLabel>
                  <Input id="sos-fam" size="xs" bg="superficie" inputMode="numeric" value={personas} onChange={(e) => setPersonas(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="sos-bov" fontSize="xs" mb={0}>
                    Bovinos
                  </FormLabel>
                  <Input id="sos-bov" size="xs" bg="superficie" inputMode="numeric" value={bovinos} onChange={(e) => setBovinos(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="sos-acc" fontSize="xs" mb={0}>
                    Acceso
                  </FormLabel>
                  <Select id="sos-acc" size="xs" bg="superficie" value={acceso} onChange={(e) => setAcceso(e.target.value as "BARRO" | "INUNDADO" | "TRANSITABLE")}>
                    <option value="BARRO">BARRO</option>
                    <option value="INUNDADO">INUNDADO</option>
                    <option value="TRANSITABLE">TRANSITABLE</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl mb={3}>
                <FormLabel htmlFor="sos-detalle" fontSize="xs" mb={0}>
                  Observación breve de campo
                </FormLabel>
                <Input id="sos-detalle" size="xs" bg="superficie" maxLength={52} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
              </FormControl>

              <Box bg="oscuro.bg" color="oscuro.fg" p={3} borderRadius="lg">
                <Flex justify="space-between" align="center" mb={1}>
                  <Text fontSize="2xs" color="oscuro.suave" fontWeight={600}>
                    Trama SOS-FSA
                  </Text>
                  <Badge colorScheme={tramaSos.length <= 160 ? "green" : "red"} fontSize="2xs">
                    {tramaSos.length} / 160 car.
                  </Badge>
                </Flex>
                <Text fontFamily="mono" fontSize="xs" wordBreak="break-all" data-testid="trama-sos-preview">
                  {tramaSos}
                </Text>
              </Box>
            </Box>
          </>
        }
      >
        {APK_URL ? (
          <Box mb={6}>
            <Button as="a" href={APK_URL} rel="noopener" download>
              Descargar la app para Android (APK)
            </Button>
            <Text fontSize="sm" mt={2}>
              Al instalarla, Android puede pedirte que permitas instalar apps de origen desconocido. Es un prototipo: no es una
              herramienta oficial.
            </Text>
          </Box>
        ) : (
          <Alert status="info" mb={6}>
            <AlertIcon />
            La descarga de la app todavía no está disponible. Mientras tanto, podés registrarte y pedir asistencia desde la web (con conexión a internet).
          </Alert>
        )}
        <Heading as="h2" size="md" mb={2}>
          Qué vas a poder hacer
        </Heading>
        <List spacing={2} styleType="disc" ml={5}>
          <ListItem>Registrarte e ingresar con la misma cuenta que usás en la web.</ListItem>
          <ListItem>Enviar una solicitud de asistencia con tu ubicación, la cantidad de personas y animales, y una foto.</ListItem>
          <ListItem>Si no hay datos móviles, abrir un mensaje de texto ya redactado para enviarlo por SMS.</ListItem>
          <ListItem>Ver el mapa de tu sector y el centro de recepción asignado (SIMULADO).</ListItem>
        </List>
        <Button as={RouterLink} to="/registro/ciudadania" mt={6} variant="outline" size="sm">
          Registrarme desde la web
        </Button>
      </PaginaFormulario>
    </Layout>
  );
}
