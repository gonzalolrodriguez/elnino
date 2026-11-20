import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import { useState } from "react";

import { Insignia } from "../components/Insignia";

const CLAVE = "panel-nota-categorias-plegada";

function leerPlegada(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function guardarPlegada(v: boolean) {
  try {
    window.sessionStorage.setItem(CLAVE, v ? "1" : "0");
  } catch {
    /* sin almacenamiento: la nota vuelve a verse al recargar */
  }
}

/**
 * Nota fija y discreta al tope del panel: explica una sola vez qué significan las categorías. Se puede plegar durante la
 * sesión; nunca reemplaza la categoría que lleva cada bloque o cifra.
 */
export function NotaCategorias() {
  const [plegada, setPlegada] = useState(leerPlegada);
  const alternar = () => {
    const nueva = !plegada;
    guardarPlegada(nueva);
    setPlegada(nueva);
  };
  return (
    <Box data-testid="nota-categorias" mb={4} fontSize="sm" color="textoSuave" role="note" aria-label="Qué significan las categorías de los datos">
      {plegada ? (
        <Button type="button" variant="link" size="sm" fontWeight={500} onClick={alternar} aria-expanded={false} aria-controls="nota-categorias-texto">
          Ver cómo se marcan los datos
        </Button>
      ) : (
        <Flex id="nota-categorias-texto" align="center" columnGap={3} rowGap={1.5} wrap="wrap" py={2} px={3} border="1px solid" borderColor="borde" borderRadius="lg" bg="superficie">
          <Text flex="1 1 22rem" minW={0}>
            Lo calculado en este panel es <strong>SIMULADO</strong> salvo lo marcado como <strong>DATO OBSERVADO</strong> o <strong>DOCUMENTO DE REFERENCIA</strong>.
          </Text>
          <Flex as="span" align="center" gap={2} wrap="wrap" aria-hidden="true">
            <Insignia categoria={CATEGORIAS.OBSERVADO} />
            <Insignia categoria={CATEGORIAS.REFERENCIA} />
            <Insignia categoria={CATEGORIAS.SIMULADO} />
          </Flex>
          <Button type="button" variant="link" size="sm" fontWeight={500} onClick={alternar} aria-expanded={true} aria-controls="nota-categorias-texto">
            Ocultar
          </Button>
        </Flex>
      )}
    </Box>
  );
}
