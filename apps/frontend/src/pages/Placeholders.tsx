import { Alert, AlertIcon, Box, Button, Heading, List, ListItem, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { Layout } from "../components/Layout";

export function AppMovil() {
  return (
    <Layout titulo="App móvil">
      <Heading as="h1" size="xl" mb={3}>
        App móvil
      </Heading>
      <Text maxW="40rem" mb={4}>
        La app (Android) permite pedir asistencia aunque no haya conexión: el pedido queda guardado en el teléfono y se envía cuando
        vuelve la señal. También recibe las alertas y las órdenes de tu sector.
      </Text>
      <Alert status="warning" maxW="40rem" mb={6}>
        <AlertIcon />
        El archivo de instalación (APK) todavía no está publicado. Se genera en la Fase 5 con EAS Build.
      </Alert>
      <Box maxW="40rem">
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
      </Box>
    </Layout>
  );
}
