import { Box, Flex, Text, VisuallyHidden } from "@chakra-ui/react";

import { fechaHora } from "../../lib/etiquetas";
import { pasosDe, type Pedido } from "../../lib/pedidos";

/**
 * Línea de tiempo del pedido: Recibido, Verificado, Cuadrilla asignada, En camino y Asistido (más «Confirmado por vos»).
 * El avance se lee por forma y por texto, no solo por color: círculo lleno con tilde (hecho), anillo (paso actual), círculo vacío (falta).
 */
export function LineaTiempoPedido({ pedido }: { pedido: Pedido }) {
  const pasos = pasosDe(pedido);
  return (
    <Box as="ol" listStyleType="none" m={0} p={0} aria-label={`Avance del pedido n.º ${pedido.id}`} data-testid={`linea-tiempo-${pedido.id}`}>
      {pasos.map((p, i) => {
        const ultimo = i === pasos.length - 1;
        const marca = p.en ? fechaHora(p.en) : null;
        return (
          <Flex as="li" key={p.clave} gap={3} data-testid={`paso-${p.clave}`} data-alcanzado={p.alcanzado} data-actual={p.actual} aria-current={p.actual ? "step" : undefined}>
            <Flex direction="column" align="center" flex="none" w="1.5rem">
              <Flex
                align="center"
                justify="center"
                w="1.5rem"
                h="1.5rem"
                borderRadius="full"
                flex="none"
                bg={p.alcanzado ? "agua.700" : "superficie"}
                color="papel"
                border="2px solid"
                borderColor={p.alcanzado ? "agua.700" : "pizarra.400"}
                boxShadow={p.actual ? "0 0 0 4px var(--chakra-colors-agua-100)" : undefined}
                aria-hidden="true"
              >
                {p.alcanzado && (
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 10.5l4 4 8-9" />
                  </svg>
                )}
              </Flex>
              {!ultimo && <Box w="2px" flex="1" minH="1.25rem" bg={p.alcanzado && pasos[i + 1].alcanzado ? "agua.700" : "pizarra.300"} aria-hidden="true" />}
            </Flex>
            <Box pb={ultimo ? 0 : 3} pt="1px" minW={0}>
              <Text fontWeight={p.actual ? 700 : p.alcanzado ? 600 : 400} color={p.alcanzado ? "texto" : "textoSuave"} lineHeight={1.3}>
                {p.etiqueta}
                <VisuallyHidden>{p.actual ? " (paso actual)" : p.alcanzado ? " (hecho)" : " (pendiente)"}</VisuallyHidden>
              </Text>
              {marca && (
                <Text fontSize="sm" color="textoSuave">
                  {marca}
                </Text>
              )}
            </Box>
          </Flex>
        );
      })}
    </Box>
  );
}
