import { Box, Button, Flex, Heading, Link, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";

import { ANCHO_CONTENEDOR, GUTTER } from "../components/Contenedor";
import { IconoTilde } from "../components/iconos/Iconos";
import { Insignia } from "../components/Insignia";
import { CIFRAS_FORMOSA, UMBRAL_ALERTA } from "../datos/kit";

/** Teléfono de Defensa Civil: figura en docs/ficha_fuentes.md (números de emergencia). */
export const TELEFONO_EMERGENCIA = "103";

const ACCIONES = ["Informate en tu sector", "Prepará documentos y lo esencial", "Seguí las indicaciones oficiales"] as const;

const coma = (n: number) => n.toFixed(2).replace(".", ",");

/** Frase de estado en lenguaje llano, armada solo con las cifras del kit (K1 y K3) y su fecha de corte. */
export function fraseEstado(): { texto: string; fecha: string } {
  const corte = CIFRAS_FORMOSA.find((c) => c.id === "corte");
  if (!corte) throw new Error("Falta la cifra del corte en CIFRAS_FORMOSA");
  const falta = UMBRAL_ALERTA - corte.valor;
  const situacion = falta > 0 ? "sin alerta" : "en alerta";
  const resto = falta > 0 ? ` Faltan ${coma(falta)} m para la alerta (${coma(UMBRAL_ALERTA)} m).` : "";
  return { texto: `el río en Puerto Formosa está en ${coma(corte.valor)} m, ${situacion}.${resto}`, fecha: corte.fecha };
}

/** Franja bajo la portada: qué pasa hoy, qué hacer y a quién llamar. Es información, no una orden. */
export function FranjaEstado() {
  const { texto, fecha } = fraseEstado();
  return (
    <Box as="section" aria-labelledby="titulo-estado" data-testid="franja-estado" bg="superficie" borderBottom="1px solid" borderColor="borde">
      <Flex maxW={ANCHO_CONTENEDOR.lectura} mx="auto" px={GUTTER} py={{ base: 5, md: 6 }} gap={{ base: 4, lg: 10 }} direction={{ base: "column", lg: "row" }} align={{ lg: "center" }}>
        <Box flex="1.2">
          <Heading as="h2" id="titulo-estado" size="bloque" mb={1}>
            Cómo estamos hoy
          </Heading>
          <Text fontSize={{ base: "md", md: "lg" }} data-testid="frase-estado">
            Hoy, {fecha}: {texto} <Insignia categoria={CATEGORIAS.OBSERVADO} />
          </Text>
        </Box>
        <Box as="ul" listStyleType="none" m={0} p={0} flex="1" display="grid" gap={1.5} aria-label="Qué hacer ahora">
          {ACCIONES.map((a) => (
            <Text as="li" key={a} fontWeight={600} display="flex" alignItems="center" gap={2}>
              <Box as="span" aria-hidden="true" display="inline-flex" color="verde.600">
                <IconoTilde tam="1.1em" />
              </Box>
              {a}
            </Text>
          ))}
        </Box>
        <Button as={Link} href={`tel:${TELEFONO_EMERGENCIA}`} size="lg" flexShrink={0} _hover={{ textDecoration: "none" }} data-testid="enlace-103">
          Emergencia: {TELEFONO_EMERGENCIA}
        </Button>
      </Flex>
    </Box>
  );
}
