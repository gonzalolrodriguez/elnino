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
      <Box h={{ base: "13rem", md: "16rem" }} borderRadius="lg" overflow="hidden" border="1px solid" borderColor="borde" bg="suave" role="group" aria-label="Mapa de tu pedido">
        <Suspense fallback={<EstadoCargando py={10} />}>
          <MapaPedidoGL pedido={punto} cuadrilla={cuadrilla} centro={centro} />
        </Suspense>
      </Box>
      <Flex gap={4} wrap="wrap" mt={1} fontSize="xs" color="textoSuave">
        <Text>● Tu pedido</Text>
        {cuadrilla && <Text>◆ Cuadrilla</Text>}
        {centro && <Text>■ Centro asignado</Text>}
      </Flex>
    </Box>
  );
}
