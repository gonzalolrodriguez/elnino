import { Alert, AlertIcon, Box, Button, Heading, List, ListItem, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { Layout } from "../components/Layout";

/** URL pública de la APK generada con EAS Build (perfil preview). Vacía = descarga no disponible. */
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim() || "";

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
      {APK_URL ? (
        <Box maxW="40rem" mb={6}>
          <Button as="a" href={APK_URL} rel="noopener" download>
            Descargar la app para Android (APK)
          </Button>
          <Text fontSize="sm" mt={2}>
            Al instalarla, Android puede pedirte que permitas instalar apps de origen desconocido. Es un prototipo: no es una
            herramienta oficial.
          </Text>
        </Box>
      ) : (
        <Alert status="info" maxW="40rem" mb={6}>
          <AlertIcon />
          La descarga de la app todavía no está disponible. Mientras tanto, podés registrarte y pedir asistencia desde la web.
        </Alert>
      )}
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
