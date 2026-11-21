import { Alert, AlertIcon, Box, Button, Heading, List, ListItem, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { IconoTilde } from "../components/iconos/Iconos";
import { Layout } from "../components/Layout";
import { BloqueApoyo, PaginaFormulario } from "../components/PaginaFormulario";

/** APK publicada por EAS Build (perfil preview, build 34864646 del 21/11/2026, desde main). VITE_APK_URL la reemplaza. */
const APK_URL_EAS = "https://expo.dev/artifacts/eas/Km7I8Iw-a792K0_oQTfwb1hkOG4kafonYpjx-O10u44.apk";
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim() || APK_URL_EAS;

export function AppMovil() {
  return (
    <Layout titulo="App móvil">
      <PaginaFormulario
        titulo="App móvil"
        intro="La app (Android) permite pedir asistencia aunque no haya conexión: el pedido queda guardado en el teléfono y se envía cuando vuelve la señal. También recibe las alertas y las órdenes de tu sector."
        anchoFormulario="36rem"
        aside={
          <BloqueApoyo titulo="Qué pasa si no hay señal">
            <Box as="ol" m={0} pl={5} color="textoSuave">
              <li>Armás el pedido de asistencia: ubicación, personas, animales y una foto.</li>
              <li>Queda guardado en el teléfono y la app muestra cuántos pedidos esperan.</li>
              <li>Cuando vuelve la señal, la app los envía sola, primero los datos mínimos y después la foto.</li>
              <li>Si no hay datos móviles, podés abrir un mensaje de texto ya redactado y enviarlo por SMS.</li>
            </Box>
          </BloqueApoyo>
        }
      >
        {APK_URL ? (
          <Box layerStyle="tarjeta" p={{ base: 5, md: 6 }} mb={8}>
            <Heading as="h2" size="bloque" mb={1}>
              Descargá la app para Android
            </Heading>
            <Text color="textoSuave" mb={4}>
              Al instalarla, Android puede pedirte que permitas instalar apps de origen desconocido. Es un prototipo: no es una herramienta oficial.
            </Text>
            <Button as="a" href={APK_URL} rel="noopener" download w={{ base: "100%", sm: "auto" }}>
              Descargar la app (APK)
            </Button>
          </Box>
        ) : (
          <Alert status="info" mb={8}>
            <AlertIcon />
            La descarga de la app todavía no está disponible. Mientras tanto, podés registrarte y pedir asistencia desde la web (con conexión a internet).
          </Alert>
        )}
        <Heading as="h2" size="bloque" mb={3}>
          Qué vas a poder hacer
        </Heading>
        <List spacing={2.5}>
          {[
            "Registrarte e ingresar con la misma cuenta que usás en la web.",
            "Enviar una solicitud de asistencia con tu ubicación, la cantidad de personas y animales, y una foto.",
            "Si no hay datos móviles, abrir un mensaje de texto ya redactado para enviarlo por SMS.",
            "Ver el mapa de tu sector y el centro de recepción asignado (SIMULADO).",
          ].map((t) => (
            <ListItem key={t} display="flex" gap={2.5} alignItems="flex-start">
              <Box as="span" aria-hidden="true" display="inline-flex" mt="0.2em" color="verde.600">
                <IconoTilde />
              </Box>
              {t}
            </ListItem>
          ))}
        </List>
        <Button as={RouterLink} to="/registro/ciudadania" mt={6} variant="outline">
          Registrarme desde la web
        </Button>
      </PaginaFormulario>
    </Layout>
  );
}
