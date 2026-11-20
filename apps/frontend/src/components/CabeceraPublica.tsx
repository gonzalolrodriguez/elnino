import { Box, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Cabecera de toda página pública que no es la portada (información, ingreso, registros, app): un solo h1 y una
 * línea de entrada de hasta 60 caracteres. Misma escala en todas, para que al navegar el título no cambie de tamaño.
 */
export function CabeceraPublica({ titulo, intro, id }: { titulo: string; intro?: ReactNode; id?: string }) {
  return (
    <Box maxW="46rem" mb={{ base: 6, md: 8 }}>
      <Heading as="h1" id={id} size="2xl">
        {titulo}
      </Heading>
      {intro && (
        <Text mt={3} fontSize={{ base: "md", md: "lg" }} color="textoSuave" maxW="60ch">
          {intro}
        </Text>
      )}
    </Box>
  );
}
