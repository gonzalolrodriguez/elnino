import { Box, Flex, Text, VisuallyHidden } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import type { ReactElement } from "react";

import { IconoBandeja, IconoCamion, IconoEscudo, IconoPersonas, IconoTilde } from "../../components/iconos/Iconos";
import { fechaHora } from "../../lib/etiquetas";
import { pasosDe, type Pedido } from "../../lib/pedidos";

const ICONOS: Record<string, ReactElement> = {
  recibida: <IconoBandeja tam="1rem" />,
  verificada: <IconoEscudo tam="1rem" />,
  asignada: <IconoPersonas tam="1rem" />,
  en_curso: <IconoCamion tam="1rem" />,
  resuelta: <IconoTilde tam="1rem" strokeWidth={2.5} />,
  confirmada: <IconoTilde tam="1rem" strokeWidth={2.5} />,
};

// Único movimiento de la vista: un latido suave en el paso en curso, para que se lea «esto está pasando ahora».
const latido = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(30, 90, 160, 0.38); }
  70%, 100% { box-shadow: 0 0 0 0.6rem rgba(30, 90, 160, 0); }
`;

/** «14:05» si es de hoy y «19/11 14:05» si es de otro día (horario de Argentina). */
function cuando(iso: string | null): string | null {
  if (!iso) return null;
  const completa = fechaHora(iso);
  if (completa === "sin fecha") return null;
  const [dia, hora] = completa.split(/,?\s+/);
  const hoy = fechaHora(new Date().toISOString()).split(/,?\s+/)[0];
  return dia === hoy ? hora : `${dia.slice(0, 5)} ${hora}`;
}

/**
 * Seguimiento del pedido, como el de un envío: Recibido, Verificado, Cuadrilla asignada, En camino y Asistido
 * (más «Confirmado por vos»). El avance se lee por ícono, por forma y por texto, no solo por color:
 * disco lleno (hecho), disco con latido (paso actual) y disco vacío (falta).
 */
export function LineaTiempoPedido({ pedido }: { pedido: Pedido }) {
  const pasos = pasosDe(pedido);
  return (
    <Box as="ol" listStyleType="none" m={0} p={0} aria-label={`Avance del pedido n.º ${pedido.id}`} data-testid={`linea-tiempo-${pedido.id}`}>
      {pasos.map((p, i) => {
        const ultimo = i === pasos.length - 1;
        const marca = cuando(p.en);
        const siguienteHecho = !ultimo && pasos[i + 1].alcanzado;
        return (
          <Flex as="li" key={p.clave} gap={3.5} data-testid={`paso-${p.clave}`} data-alcanzado={p.alcanzado} data-actual={p.actual} aria-current={p.actual ? "step" : undefined}>
            <Flex direction="column" align="center" flex="none" w="2rem">
              <Flex
                align="center"
                justify="center"
                w="2rem"
                h="2rem"
                borderRadius="full"
                flex="none"
                bg={p.alcanzado ? "agua.700" : "superficie"}
                color={p.alcanzado ? "papel" : "pizarra.500"}
                border="2px solid"
                borderColor={p.alcanzado ? "agua.700" : "pizarra.300"}
                animation={p.actual ? `${latido} 2.4s var(--ease-out) infinite` : undefined}
                aria-hidden="true"
              >
                {ICONOS[p.clave] ?? <IconoTilde tam="1rem" />}
              </Flex>
              {!ultimo && <Box w="2px" flex="1" minH="1.5rem" my="3px" borderRadius="full" bg={p.alcanzado && siguienteHecho ? "agua.700" : "pizarra.200"} aria-hidden="true" />}
            </Flex>
            <Box pb={ultimo ? 0 : 4} pt="0.3rem" minW={0} flex="1">
              <Flex justify="space-between" align="baseline" gap={3}>
                <Text fontWeight={p.actual ? 700 : p.alcanzado ? 600 : 400} fontSize={p.actual ? "lg" : "md"} color={p.alcanzado ? "texto" : "textoSuave"} lineHeight={1.25}>
                  {p.etiqueta}
                  <VisuallyHidden>{p.actual ? " (paso actual)" : p.alcanzado ? " (hecho)" : " (pendiente)"}</VisuallyHidden>
                </Text>
                {marca && (
                  <Text as="time" fontSize="sm" color="textoSuave" flex="none" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {marca}
                  </Text>
                )}
              </Flex>
            </Box>
          </Flex>
        );
      })}
    </Box>
  );
}
