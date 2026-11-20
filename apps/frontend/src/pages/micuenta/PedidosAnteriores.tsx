import { Box, Flex, Text } from "@chakra-ui/react";
import type { ReactElement } from "react";

import { IconoAlerta, IconoHistorial, IconoMascota, IconoPersonas, IconoPuntos, IconoRumbo, IconoTilde } from "../../components/iconos/Iconos";
import { Plegable } from "../../components/Plegable";
import { esConforme, etiquetaAsistencia } from "../../lib/confirmacion";
import { etiquetaTipoSolicitud, fechaHora } from "../../lib/etiquetas";
import type { Pedido } from "../../lib/pedidos";
import { FichaIcono } from "./Panel";

/** Estado final en palabras, con ícono y texto (nunca solo color). */
export function estadoFinal(p: Pedido): { texto: string; ok: boolean } {
  const r = p.confirmacion?.respondida ? p.confirmacion.respuesta : null;
  if (r) return { texto: esConforme(r) ? "Resuelto" : etiquetaAsistencia(r), ok: esConforme(r) };
  if (p.estado === "resuelta") return { texto: "Resuelto, sin tu confirmación", ok: true };
  return { texto: "En curso", ok: false };
}

const ICONO_TIPO: Record<string, ReactElement> = {
  asistencia: <IconoPersonas />,
  evacuacion: <IconoRumbo />,
  ganado: <IconoMascota />,
};

/** Historial compacto y plegado de los pedidos que ya no están activos. Sin pedidos anteriores no muestra nada. */
export function PedidosAnteriores({ pedidos }: { pedidos: Pedido[] }) {
  if (pedidos.length === 0) return null;
  return (
    <Box as="section" aria-label="Mis pedidos anteriores" bg="superficie" border="1px solid" borderColor="borde" borderRadius="2xl" px={{ base: 4, md: 6 }} py={{ base: 2, md: 3 }} data-testid="pedidos-anteriores">
      <Plegable
        titulo={
          <Flex as="span" align="center" gap={3}>
            <FichaIcono>
              <IconoHistorial />
            </FichaIcono>
            <Text as="span" fontWeight={700} fontSize="md">{`Mis pedidos anteriores (${pedidos.length})`}</Text>
          </Flex>
        }
      >
        <Box as="ul" listStyleType="none" m={0} p={0} pb={2}>
          {pedidos.map((p) => {
            const f = estadoFinal(p);
            return (
              <Flex as="li" key={p.id} py={3} gap={3} align="center" justify="space-between" wrap="wrap" borderTop="1px solid" borderColor="borde">
                <Flex gap={3} align="center" minW={0}>
                  <FichaIcono tono="tinta" tam="2.25rem">
                    {ICONO_TIPO[p.tipo] ?? <IconoPuntos />}
                  </FichaIcono>
                  <Box minW={0}>
                    <Text fontWeight={600} lineHeight={1.3}>
                      Pedido n.º {p.id} · {etiquetaTipoSolicitud(p.tipo)}
                    </Text>
                    <Text fontSize="sm" color="textoSuave" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {fechaHora(p.creada_en)}
                    </Text>
                  </Box>
                </Flex>
                <Flex as="span" align="center" gap={1.5} px={2.5} py="2px" borderRadius="full" fontSize="sm" fontWeight={600} bg={f.ok ? "verde.100" : "alerta.100"} color={f.ok ? "verde.800" : "alerta.800"} data-testid={`estado-final-${p.id}`}>
                  {f.ok ? <IconoTilde tam="0.9rem" strokeWidth={2.5} /> : <IconoAlerta tam="0.9rem" strokeWidth={2.25} />}
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
