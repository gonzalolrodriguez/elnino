import { Badge, Box, Button, Flex, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import { useState, type ReactElement } from "react";

import { IconoAlerta, IconoCampana, IconoCasa, IconoEdificio, IconoEscudo, IconoMascota, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { solicitar } from "../../lib/api";
import { fechaHora } from "../../lib/etiquetas";
import { severidad } from "../../lib/pedidos";
import { AvisoDiscreto } from "./AvisoDiscreto";
import { TIPO_ORDEN, type MiSector, ordenesPorGravedad } from "./EstadoSector";
import { Vacio } from "./Panel";

export type Dic = Record<string, unknown>;

const COLOR_ORDEN: Record<string, string> = { evacuacion: "red", evacuacion_preventiva: "orange", alerta: "yellow" };
const DISCO_ORDEN: Record<string, { bg: string; fg: string; icono: ReactElement }> = {
  evacuacion: { bg: "evacuacion.700", fg: "papel", icono: <IconoAlerta tam="1.125rem" /> },
  evacuacion_preventiva: { bg: "alerta.700", fg: "papel", icono: <IconoTriangulo tam="1.125rem" /> },
  alerta: { bg: "alerta.100", fg: "alerta.800", icono: <IconoCampana tam="1.125rem" /> },
};
const distancia = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);

/** Órdenes y alertas vigentes de tu sector, de mayor a menor gravedad: evacuación, evacuación preventiva, alerta. */
export function OrdenesVigentes({ sectores }: { sectores: MiSector["sectores"] }) {
  const lista = ordenesPorGravedad(sectores);
  if (lista.length === 0) return <Vacio icono={<IconoEscudo />}>No hay órdenes ni alertas vigentes para tu sector.</Vacio>;
  return (
    <Box as="ul" listStyleType="none" m={0} p={0} data-testid="ordenes-vigentes">
      {lista.map((o) => {
        const disco = DISCO_ORDEN[o.tipo] ?? DISCO_ORDEN.alerta;
        return (
          <Flex as="li" key={o.orden_id} gap={3} py={3} borderBottom="1px solid" borderColor="borde" data-severidad={severidad(o.tipo)}>
            <Flex aria-hidden="true" align="center" justify="center" flex="none" w="2.25rem" h="2.25rem" borderRadius="full" bg={disco.bg} color={disco.fg}>
              {disco.icono}
            </Flex>
            <Box minW={0}>
              <Flex gap={2} align="center" wrap="wrap">
                <Badge colorScheme={COLOR_ORDEN[o.tipo] ?? "gray"}>{TIPO_ORDEN[o.tipo] ?? o.tipo}</Badge>
                <Text fontSize="sm" color="textoSuave">
                  {o.sector.id} · {fechaHora(o.creada_en)}
                </Text>
              </Flex>
              <Text overflowWrap="anywhere" mt={0.5}>
                {o.fundamento}
              </Text>
            </Box>
          </Flex>
        );
      })}
      <Box as="li" listStyleType="none" pt={3}>
        <Insignia categoria={CATEGORIAS.SIMULADO} />
      </Box>
    </Box>
  );
}

function FilaCentro({ icono, rotulo, c }: { icono: ReactElement; rotulo: string; c: { nombre: string; distancia_linea_recta_m: number } }) {
  return (
    <Flex gap={3.5} align="center" py={2}>
      <Flex aria-hidden="true" align="center" justify="center" flex="none" w="2.75rem" h="2.75rem" borderRadius="lg" bg="verde.100" color="verde.800">
        {icono}
      </Flex>
      <Text minW={0} lineHeight={1.35}>
        {rotulo}: <strong>{c.nombre}</strong>{" "}
        <Text as="span" color="textoSuave" fontSize="sm" whiteSpace="nowrap">
          (a {distancia(c.distancia_linea_recta_m)} en línea recta)
        </Text>
      </Text>
    </Flex>
  );
}

/** Centro de recepción sugerido para personas y animales (SIMULADO). */
export function MiCentro({ d }: { d: MiSector }) {
  const c = d.centro_asignado;
  if (!c || (!c.personas && !c.animales)) return <Vacio icono={<IconoCasa />}>Todavía no tenés un centro asignado. Si hace falta evacuar, te vamos a avisar a dónde ir.</Vacio>;
  return (
    <Box data-testid="mi-centro">
      {c.personas && <FilaCentro icono={<IconoEdificio />} rotulo="Para personas" c={c.personas} />}
      {c.animales && <FilaCentro icono={<IconoMascota />} rotulo="Para animales" c={c.animales} />}
      <Text fontSize="xs" color="textoSuave" mt={2}>
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
        <Box mb={2}>
          <AvisoDiscreto peligro>{error}</AvisoDiscreto>
        </Box>
      )}
      <Box as="ul" listStyleType="none" m={0} p={0}>
        {lista.map((n, i) => {
          const id = typeof n.id === "number" ? n.id : null;
          const leida = n.leida === true;
          return (
            <Flex as="li" key={String(n.id ?? i)} py={3} borderBottom="1px solid" borderColor="borde" gap={3} align="flex-start" wrap="wrap">
              <Flex aria-hidden="true" align="center" justify="center" flex="none" w="2.25rem" h="2.25rem" borderRadius="full" bg={leida ? "pizarra.100" : "agua.100"} color={leida ? "pizarra.600" : "agua.800"}>
                {leida ? <IconoTilde tam="1.125rem" /> : <IconoCampana tam="1.125rem" />}
              </Flex>
              <Box flex="1 1 12rem" minW={0}>
                <Text fontWeight={leida ? 400 : 700} overflowWrap="anywhere" lineHeight={1.4}>
                  {!leida && (
                    <Badge colorScheme="blue" mr={2} verticalAlign="1px">
                      Nueva
                    </Badge>
                  )}
                  {String(n.mensaje ?? n.titulo ?? "Notificación")}
                </Text>
                <Text fontSize="xs" color="textoSuave" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {fechaHora(typeof n.creada_en === "string" ? n.creada_en : null)}
                </Text>
              </Box>
              {!leida && id !== null && (
                <Button size="sm" variant="outline" minH="2.75rem" isLoading={trabajando === id} onClick={() => void marcar(id)}>
                  Marcar como leída
                </Button>
              )}
            </Flex>
          );
        })}
      </Box>
    </>
  );
}
