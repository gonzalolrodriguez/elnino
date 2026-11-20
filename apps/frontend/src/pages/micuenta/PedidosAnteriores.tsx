import { Box, Flex, Text } from "@chakra-ui/react";

import { Plegable } from "../../components/Plegable";
import { esConforme, etiquetaAsistencia } from "../../lib/confirmacion";
import { etiquetaTipoSolicitud, fechaHora } from "../../lib/etiquetas";
import type { Pedido } from "../../lib/pedidos";

/** Estado final en palabras, con ícono y texto (nunca solo color). */
export function estadoFinal(p: Pedido): { texto: string; ok: boolean } {
  const r = p.confirmacion?.respondida ? p.confirmacion.respuesta : null;
  if (r) return { texto: esConforme(r) ? "Resuelto" : etiquetaAsistencia(r), ok: esConforme(r) };
  if (p.estado === "resuelta") return { texto: "Resuelto, sin tu confirmación", ok: true };
  return { texto: "En curso", ok: false };
}

const Tilde = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);
const Alerta = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3L18 17H2z" />
    <path d="M10 8v4M10 14.5v.01" />
  </svg>
);

/** Historial compacto y plegado de los pedidos que ya no están activos. Sin pedidos anteriores no muestra nada. */
export function PedidosAnteriores({ pedidos }: { pedidos: Pedido[] }) {
  if (pedidos.length === 0) return null;
  return (
    <Box as="section" aria-label="Mis pedidos anteriores" py={3} borderTop="1px solid" borderColor="borde" data-testid="pedidos-anteriores">
      <Plegable titulo={`Mis pedidos anteriores (${pedidos.length})`}>
        <Box as="ul" listStyleType="none" m={0} p={0}>
          {pedidos.map((p) => {
            const f = estadoFinal(p);
            return (
              <Flex as="li" key={p.id} py={2} gap={3} align="center" justify="space-between" wrap="wrap" borderTop="1px solid" borderColor="borde">
                <Box minW={0}>
                  <Text fontWeight={600}>
                    Pedido n.º {p.id} · {etiquetaTipoSolicitud(p.tipo)}
                  </Text>
                  <Text fontSize="sm" color="textoSuave">
                    {fechaHora(p.creada_en)}
                  </Text>
                </Box>
                <Flex as="span" align="center" gap={1} px={2.5} py="2px" borderRadius="full" fontSize="sm" fontWeight={600} bg={f.ok ? "verde.100" : "alerta.100"} color={f.ok ? "verde.800" : "alerta.800"} data-testid={`estado-final-${p.id}`}>
                  {f.ok ? <Tilde /> : <Alerta />}
                  {f.texto}
                </Flex>
              </Flex>
            );
          })}
        </Box>
      </Plegable>
    </Box>
  );
}
