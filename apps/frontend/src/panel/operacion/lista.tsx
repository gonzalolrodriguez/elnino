import { Box, Button, Flex, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Piezas comunes de las listas de «Solicitudes y cuadrillas» (cola de solicitudes y tareas).
 *
 * El ancho disponible depende del menú lateral, no de la pantalla, así que las filas se adaptan con
 * consultas de contenedor (`@container`) y no con puntos de corte de la ventana: angosto = tarjeta, medio = dos
 * líneas, ancho = columnas alineadas. Un navegador sin soporte cae en la tarjeta, que nunca desborda.
 */
export const CONTENEDOR = { containerType: "inline-size" } as const;

/** Oculto a la vista pero leído por los lectores de pantalla. */
export const SOLO_LECTOR = { position: "absolute", width: "1px", height: "1px", margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

export const ANCHO_MEDIO = "34rem";
export const ANCHO_AMPLIO = "60rem";

/** Chip de filtro: botón con `aria-pressed`, texto y cantidad. Alto táctil de 44 px en el celular. */
export function ChipFiltro({ activo, onClick, children, cantidad }: { activo: boolean; onClick: () => void; children: ReactNode; cantidad?: number }) {
  return (
    <Button
      size="sm"
      borderRadius="full"
      variant={activo ? "solid" : "outline"}
      aria-pressed={activo}
      onClick={onClick}
      minH={{ base: "2.75rem", md: "2.25rem" }}
      px={3.5}
      fontWeight={600}
    >
      {children}
      {cantidad !== undefined && (
        <Box as="span" ml={1.5} sx={{ fontVariantNumeric: "tabular-nums" }} opacity={activo ? 0.9 : 0.75} fontWeight={700}>
          {cantidad}
        </Box>
      )}
    </Button>
  );
}

/** Grupo de chips con un rótulo visible a la izquierda (arriba en el celular). */
export function GrupoFiltros({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Flex role="group" aria-label={rotulo} align={{ base: "flex-start", md: "center" }} direction={{ base: "column", md: "row" }} gap={{ base: 1.5, md: 3 }}>
      <Box textStyle="rotulo" aria-hidden="true" flexShrink={0} minW={{ md: "4.5rem" }}>
        {rotulo}
      </Box>
      <Flex gap={2} wrap="wrap">
        {children}
      </Flex>
    </Flex>
  );
}

/** Contenedor de una fila de lista: tarjeta fina que se vuelve fila de tabla en ancho amplio. */
export function FilaLista({ sx, children, atenuada, acento, ...resto }: { sx: Record<string, unknown>; children: ReactNode; atenuada?: boolean; acento?: boolean } & Omit<BoxProps, "sx" | "children">) {
  return (
    <Box
      as="li"
      listStyleType="none"
      display="grid"
      columnGap={3}
      rowGap={0}
      alignItems="center"
      position="relative"
      bg="superficie"
      border="1px solid"
      borderColor="borde"
      borderLeftWidth={acento ? "4px" : "1px"}
      borderLeftColor={acento ? "alerta.400" : "borde"}
      borderRadius="xl"
      px={{ base: 3.5, md: 4 }}
      py={3}
      opacity={atenuada ? 0.78 : 1}
      transition="border-color 160ms var(--ease-out), background-color 160ms var(--ease-out)"
      _hover={{ borderColor: "bordeControl" }}
      sx={sx}
      {...resto}
    >
      {children}
    </Box>
  );
}
