import { Alert, AlertIcon, Badge, Box, Button, Flex, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import { useState } from "react";

import { Insignia } from "../../components/Insignia";
import { solicitar } from "../../lib/api";
import { fechaHora } from "../../lib/etiquetas";
import { severidad } from "../../lib/pedidos";
import { TIPO_ORDEN, type MiSector, ordenesPorGravedad } from "./EstadoSector";

export type Dic = Record<string, unknown>;

const COLOR_ORDEN: Record<string, string> = { evacuacion: "red", evacuacion_preventiva: "orange", alerta: "yellow" };
const distancia = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);

/** Órdenes y alertas vigentes de tu sector, de mayor a menor gravedad: evacuación, evacuación preventiva, alerta. */
export function OrdenesVigentes({ sectores }: { sectores: MiSector["sectores"] }) {
  const lista = ordenesPorGravedad(sectores);
  if (lista.length === 0) return <Text>No hay órdenes ni alertas vigentes para tu sector.</Text>;
  return (
    <Box as="ul" listStyleType="none" m={0} p={0} data-testid="ordenes-vigentes">
      {lista.map((o) => (
        <Box as="li" key={o.orden_id} py={2} borderBottom="1px solid" borderColor="borde" data-severidad={severidad(o.tipo)}>
          <Flex gap={2} align="center" wrap="wrap">
            <Badge colorScheme={COLOR_ORDEN[o.tipo] ?? "gray"}>{TIPO_ORDEN[o.tipo] ?? o.tipo}</Badge>
            <Text fontSize="sm" color="textoSuave">
              {o.sector.id} · {fechaHora(o.creada_en)}
            </Text>
          </Flex>
          <Text overflowWrap="anywhere">{o.fundamento}</Text>
        </Box>
      ))}
      <Box as="li" listStyleType="none" pt={2}>
        <Insignia categoria={CATEGORIAS.SIMULADO} />
      </Box>
    </Box>
  );
}

/** Centro de recepción sugerido para personas y animales (SIMULADO). */
export function MiCentro({ d }: { d: MiSector }) {
  const c = d.centro_asignado;
  if (!c || (!c.personas && !c.animales)) return <Text>Todavía no tenés un centro asignado. Si hace falta evacuar, te vamos a avisar a dónde ir.</Text>;
  return (
    <Box data-testid="mi-centro">
      {c.personas && (
        <Text>
          Para personas: <strong>{c.personas.nombre}</strong> (a {distancia(c.personas.distancia_linea_recta_m)} en línea recta).
        </Text>
      )}
      {c.animales && (
        <Text>
          Para animales: <strong>{c.animales.nombre}</strong> (a {distancia(c.animales.distancia_linea_recta_m)} en línea recta).
        </Text>
      )}
      <Text fontSize="xs" color="textoSuave" mt={1}>
        <Insignia categoria={CATEGORIAS.SIMULADO} /> {c.nota}
      </Text>
    </Box>
  );
}

export function Notificaciones({ lista, alCambiar }: { lista: Dic[]; alCambiar: () => void }) {
  const [trabajando, setTrabajando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function marcar(id: number) {
    setTrabajando(id);
    setError(null);
    try {
      await solicitar(`/mi/notificaciones/${id}/leida`, { autenticado: true, metodo: "PATCH", cuerpo: {} });
      alCambiar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como leída.");
    } finally {
      setTrabajando(null);
    }
  }
  return (
    <>
      {error && (
        <Alert status="error" fontSize="sm" role="alert" mb={2}>
          <AlertIcon />
          {error}
        </Alert>
      )}
      <Box as="ul" listStyleType="none" m={0} p={0}>
        {lista.map((n, i) => {
          const id = typeof n.id === "number" ? n.id : null;
          const leida = n.leida === true;
          return (
            <Box as="li" key={String(n.id ?? i)} py={2} borderBottom="1px solid" borderColor="borde" display="flex" gap={3} alignItems="flex-start" flexWrap="wrap">
              <Box flex="1 1 14rem" minW={0}>
                <Text fontWeight={leida ? 400 : 700} overflowWrap="anywhere">
                  {!leida && (
                    <Badge colorScheme="blue" mr={2}>
                      Nueva
                    </Badge>
                  )}
                  {String(n.mensaje ?? n.titulo ?? "Notificación")}
                </Text>
                <Text fontSize="xs" color="textoSuave">
                  {fechaHora(typeof n.creada_en === "string" ? n.creada_en : null)}
                </Text>
              </Box>
              {!leida && id !== null && (
                <Button size="sm" variant="outline" minH="2.75rem" isLoading={trabajando === id} onClick={() => void marcar(id)}>
                  Marcar como leída
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
    </>
  );
}
