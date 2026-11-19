import { Alert, AlertIcon, Badge, Box, Button, Flex, FormControl, FormLabel, Heading, Input, List, ListItem, Select, SimpleGrid, Text } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";

export function AppMovil() {
  const [perfil, setPerfil] = useState<"PRODUCTOR" | "CIUDADANO">("PRODUCTOR");
  const [personas, setPersonas] = useState("5");
  const [bovinos, setBovinos] = useState("30");
  const [acceso, setAcceso] = useState<"BARRO" | "INUNDADO" | "TRANSITABLE">("BARRO");
  const [detalle, setDetalle] = useState("Camino de tierra S4 saturado, solicitamos camion jaula");

  const tramaSos = `SOS-FSA|-26.180,-58.139|${perfil}|FAM:${personas || "1"}|BOV:${bovinos || "0"}|ACC:${acceso}|${detalle.slice(0, 52)}`;

  return (
    <Layout titulo="App móvil">
      <Heading as="h1" size="xl" mb={3}>
        App móvil
      </Heading>
      <Text maxW="44rem" mb={4}>
        La app (Android · Expo React Native) permite pedir asistencia aunque no haya conexión: el pedido queda guardado en la cola local
        (<code>expo-sqlite</code>) con clave de idempotencia y se sincroniza en dos tiempos (JSON primero, foto comprimida después) cuando
        vuelve la señal. También recibe las alertas y las órdenes de tu sector.
      </Text>
      <Alert status="warning" maxW="44rem" mb={6}>
        <AlertIcon />
        El archivo de instalación (APK) todavía no está publicado. Se genera en la Fase 5 con EAS Build.
      </Alert>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8} alignItems="start">
        <Box>
          <Heading as="h2" size="md" mb={2}>
            Qué vas a poder hacer
          </Heading>
          <List spacing={2} styleType="disc" ml={5}>
            <ListItem>Registrarte e ingresar con la misma cuenta que usás en la web (tokens resguardados en <code>expo-secure-store</code>).</ListItem>
            <ListItem>Enviar una solicitud de asistencia con tu ubicación GPS, la cantidad de personas y animales, y una foto comprimida.</ListItem>
            <ListItem>Si no hay datos móviles, abrir un mensaje de texto ya redactado (protocolo <code>SOS-FSA</code>) para enviarlo por SMS.</ListItem>
            <ListItem>Ver el mapa de tu sector y el centro de recepción asignado (SIMULADO), o cambiar al modo Cuadrilla para completar checklists en terreno.</ListItem>
          </List>
          <Flex gap={3} wrap="wrap" mt={6}>
            <Button as={RouterLink} to="/registro/ciudadania" variant="outline" size="sm">
              Registrarme desde la web
            </Button>
            <Button as={RouterLink} to="/registro/productor" variant="solid" size="sm">
              Registrar establecimiento (Tranquera Digital)
            </Button>
          </Flex>
        </Box>

        {/* Simulador interactivo de la trama compacta SMS SOS-FSA (<= 160 caracteres) */}
        <Box bg="superficie" border="1px solid" borderColor="borde" borderTop="3px solid" borderTopColor="pizarra.700" borderRadius="sm" p={{ base: 4, md: 6 }}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={2} mb={2}>
            <Heading as="h2" size="sm">
              Simulador de trama SMS sin cobertura (Protocolo SOS-FSA)
            </Heading>
            <Insignia categoria="SIMULADO" />
          </Flex>
          <Text fontSize="xs" color="textoSuave" mb={4}>
            Cuando un productor rural en el Sector S4 o Banco Payaguá pierde datos móviles por tormenta, la app codifica los datos críticos en un único SMS estándar de hasta 160 caracteres que el parser del backend (<code>parser_mensajes.py</code>) interpreta automáticamente.
          </Text>

          <SimpleGrid columns={{ base: 2, sm: 4 }} spacing={3} mb={3}>
            <FormControl>
              <FormLabel htmlFor="sos-perfil" fontSize="xs" mb={0}>
                Perfil
              </FormLabel>
              <Select id="sos-perfil" size="sm" bg="superficie" value={perfil} onChange={(e) => setPerfil(e.target.value as "PRODUCTOR" | "CIUDADANO")}>
                <option value="PRODUCTOR">PRODUCTOR</option>
                <option value="CIUDADANO">CIUDADANO</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="sos-fam" fontSize="xs" mb={0}>
                Personas
              </FormLabel>
              <Input id="sos-fam" size="sm" bg="superficie" inputMode="numeric" value={personas} onChange={(e) => setPersonas(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="sos-bov" fontSize="xs" mb={0}>
                Bovinos
              </FormLabel>
              <Input id="sos-bov" size="sm" bg="superficie" inputMode="numeric" value={bovinos} onChange={(e) => setBovinos(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="sos-acc" fontSize="xs" mb={0}>
                Acceso
              </FormLabel>
              <Select id="sos-acc" size="sm" bg="superficie" value={acceso} onChange={(e) => setAcceso(e.target.value as "BARRO" | "INUNDADO" | "TRANSITABLE")}>
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
            <Input id="sos-detalle" size="sm" bg="superficie" maxLength={52} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </FormControl>

          <Box bg="limo.950" color="pizarra.50" p={3} borderRadius="sm">
            <Flex justify="space-between" align="center" mb={1}>
              <Text fontSize="xs" color="pizarra.300" fontWeight={600}>
                Trama generada para SMS / Webhook simulado
              </Text>
              <Badge colorScheme={tramaSos.length <= 160 ? "green" : "red"}>
                {tramaSos.length} / 160 caracteres
              </Badge>
            </Flex>
            <Text fontFamily="mono" fontSize="xs" wordBreak="break-all" data-testid="trama-sos-preview">
              {tramaSos}
            </Text>
          </Box>
        </Box>
      </SimpleGrid>
    </Layout>
  );
}
