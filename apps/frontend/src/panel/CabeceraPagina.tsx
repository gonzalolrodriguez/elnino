import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import type { Categoria } from "@evacuaciones/shared";
import type { ReactNode } from "react";

import { Insignia } from "../components/Insignia";
import { useRegistrarSlotEscenario } from "./SlotEscenario";
import { FichaIcono } from "./ui";

/**
 * Cabecera común de las páginas del panel: ícono, título (h1), categoría de la página, explicación breve, frescura
 * y acciones a la derecha. En pantallas angostas las acciones bajan debajo del título. Es el primer elemento de la
 * página: la nota de categorías y la barra del escenario del panel se dibujan justo debajo (ver `SlotEscenario`).
 */
export function CabeceraPagina({
  titulo,
  icono,
  categoria,
  ayuda,
  actualizado,
  actualizadoId,
  acciones,
}: {
  titulo: string;
  icono?: ReactNode;
  categoria?: Categoria;
  ayuda?: ReactNode;
  actualizado?: ReactNode;
  actualizadoId?: string;
  acciones?: ReactNode;
}) {
  const registrarSlot = useRegistrarSlotEscenario();
  return (
    <>
    <Flex as="header" align="flex-start" justify="space-between" columnGap={4} rowGap={3} wrap="wrap" mb={5}>
      <Flex gap={3.5} align="flex-start" minW={0} flex="1 1 24rem">
        {icono && <FichaIcono icono={icono} tam="2.75rem" />}
        <Box minW={0}>
          <Flex align="center" columnGap={3} rowGap={1} wrap="wrap">
            <Heading as="h1" size="pagina" textStyle="titularPagina">
              {titulo}
            </Heading>
            {categoria && <Insignia categoria={categoria} />}
          </Flex>
          {ayuda && (
            <Text textStyle="microdato" mt={1} maxW="70ch">
              {ayuda}
            </Text>
          )}
          {actualizado && (
            <Text textStyle="microdato" mt={ayuda ? 0.5 : 1} data-testid={actualizadoId}>
              {actualizado}
            </Text>
          )}
        </Box>
      </Flex>
      {acciones && (
        <Flex gap={2} wrap="wrap" align="center">
          {acciones}
        </Flex>
      )}
    </Flex>
    {registrarSlot && <Box ref={registrarSlot} display="contents" data-testid="slot-escenario" />}
    </>
  );
}
