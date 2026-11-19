import { Alert, AlertIcon, Box, Button, Heading, List, ListItem, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { Layout } from "../components/Layout";
import { BloqueApoyo, PaginaFormulario } from "../components/PaginaFormulario";

/** URL pública de la APK generada con EAS Build (perfil preview). Vacía = descarga no disponible. */
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim() || "";

export function AppMovil() {
  return (
    <Layout titulo="App móvil">
      <PaginaFormulario
        titulo="App móvil"
        intro="La app (Android) permite pedir asistencia aunque no haya conexión: el pedido queda guardado en el teléfono y se envía cuando vuelve la señal. También recibe las alertas y las órdenes de tu sector."
        anchoFormulario="36rem"
        aside={
          <BloqueApoyo titulo="Qué pasa si no hay señal">
            <Box as="ol" m={0} pl={5} fontSize="sm">
              <li>Armás el pedido de asistencia: ubicación, personas, animales y una foto.</li>
              <li>Queda guardado en el teléfono y la app muestra cuántos pedidos esperan.</li>
              <li>Cuando vuelve la señal, la app los envía sola, primero los datos mínimos y después la foto.</li>
              <li>Si no hay datos móviles, podés abrir un mensaje de texto ya redactado y enviarlo por SMS.</li>
            </Box>
          </BloqueApoyo>
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
            La descarga de la app todavía no está disponible. Mientras tanto, podés registrarte y pedir asistencia desde la web.
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
