import { Box, Flex, Text } from "@chakra-ui/react";
import { lazy, Suspense } from "react";

import { EstadoCargando } from "../../components/EstadoCargando";
import { hayWebGL } from "../../lib/entorno";
import type { PropsMapaPedido } from "./MapaPedidoGL";

const MapaPedidoGL = lazy(() => import("./MapaPedidoGL"));

/** Mapa pequeño del pedido (carga diferida). Sin WebGL no se dibuja: la información útil ya está en texto. */
export function MapaPedido(props: Omit<PropsMapaPedido, "pedido"> & { pedido: { lon: number | null; lat: number | null } }) {
  const { pedido, cuadrilla, centro } = props;
  if (pedido.lon === null || pedido.lat === null || !hayWebGL()) return null;
  const punto = { lon: pedido.lon, lat: pedido.lat };
  return (
    <Box data-testid="mapa-pedido">
      <Box h={{ base: "15rem", md: "18rem" }} borderRadius="xl" overflow="hidden" border="1px solid" borderColor="borde" bg="suave" role="group" aria-label="Mapa de tu pedido">
        <Suspense fallback={<EstadoCargando py={10} />}>
          <MapaPedidoGL pedido={punto} cuadrilla={cuadrilla} centro={centro} />
        </Suspense>
      </Box>
      <Flex gap={4} wrap="wrap" mt={2} fontSize="xs" color="textoSuave" align="center">
        <Flex align="center" gap={1.5}>
          <Box aria-hidden="true" w="0.75rem" h="0.75rem" borderRadius="full" bg="agua.700" />
          <Text>Tu pedido</Text>
        </Flex>
        {cuadrilla && (
          <Flex align="center" gap={1.5}>
            <Box aria-hidden="true" w="0.625rem" h="0.625rem" bg="evacuacion.600" transform="rotate(45deg)" />
            <Text>Cuadrilla</Text>
          </Flex>
        )}
        {centro && (
          <Flex align="center" gap={1.5}>
            <Box aria-hidden="true" w="0.75rem" h="0.75rem" borderRadius="3px" bg="verde.600" />
            <Text>Centro asignado</Text>
          </Flex>
        )}
      </Flex>
    </Box>
  );
}
