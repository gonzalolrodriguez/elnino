import { Alert, AlertIcon, Badge, Box, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";

import { Insignia } from "../../components/Insignia";
import { ApiError, solicitar } from "../../lib/api";
import { fechaCorta, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";

type Sector = {
  id: string;
  nombre: string;
  estado: "normal" | "en_riesgo" | "comprometido";
  aislado: boolean;
  altura_compromiso_m: number;
  margen_a_compromiso_m: number;
  accesos: { nombre: string; superficie: string; estado: string }[];
  alertas: { orden_id: number; tipo: string; fundamento: string; creada_en: string }[];
};
type Centro = { id: number; nombre: string; tipo: string; distancia_linea_recta_m: number } | null;
export type MiSector = {
  sectores: Sector[];
  altura_referencia: { altura_m: number; fecha: string; categoria: string; fuente: string };
  centro_asignado: { personas: Centro; animales: Centro; nota: string } | null;
  nota: string;
};

const ESTADO_SECTOR = {
  normal: { texto: "Normal", color: "green" },
  en_riesgo: { texto: "En riesgo", color: "orange" },
  comprometido: { texto: "Comprometido", color: "red" },
} as const;

const TIPO_ORDEN: Record<string, string> = {
  alerta: "Alerta",
  evacuacion_preventiva: "Evacuación preventiva",
  evacuacion: "Evacuación",
};
const SUPERFICIE: Record<string, string> = { asfalto: "pavimentado", pavimento: "pavimentado", ripio: "ripio", tierra: "tierra" };
const ESTADO_ACCESO: Record<string, string> = {
  transitable: "transitable",
  cerrado_operador: "cerrado por el operador",
  intransitable_lluvia: "intransitable por lluvia",
  anegado: "anegado",
};

const metros = (n: number) => `${n.toFixed(2).replace(".", ",")} m`;
const distancia = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);

/** «Estado de tu sector»: lo primero que ve la ciudadanía. Estados y centro asignado son SIMULADO; la altura es observada. */
export function EstadoSector() {
  const carga = useCarga(() => solicitar<MiSector>("/mi/sector", { autenticado: true }));
  return (
    <Box as="section" aria-labelledby="estado-sector" layerStyle="tarjeta" p={{ base: 4, md: 6 }} mb={6}>
      <Flex align="center" gap={3} wrap="wrap" mb={3}>
        <Heading as="h2" id="estado-sector" size="md">
          Estado de tu sector
        </Heading>
        <Insignia categoria={CATEGORIAS.SIMULADO} />
      </Flex>
      {carga.estado === "cargando" && (
        <Text display="flex" alignItems="center" gap={2}>
          <Spinner size="sm" /> Cargando…
        </Text>
      )}
      {carga.estado === "error" && (
        <Alert status={carga.error instanceof ApiError && carga.error.estado === 404 ? "info" : "error"} fontSize="sm" role="alert">
          <AlertIcon />
          {carga.error instanceof ApiError && carga.error.estado === 404
            ? "Esta función todavía no está disponible en el servidor."
            : `No se pudo cargar el estado de tu sector: ${carga.error instanceof Error ? carga.error.message : "error desconocido"}`}
        </Alert>
      )}
      {carga.estado === "ok" && <Contenido d={carga.datos} />}
    </Box>
  );
}

function Contenido({ d }: { d: MiSector }) {
  return (
    <>
      {d.sectores.length === 0 ? (
        <Text>
          Todavía no sabemos en qué sector estás. Cargá tu domicilio en tu grupo familiar (más abajo) o pedí ayuda indicando tu ubicación.
        </Text>
      ) : (
        <Box as="ul" listStyleType="none" m={0} p={0}>
          {d.sectores.map((s) => {
            const e = ESTADO_SECTOR[s.estado] ?? ESTADO_SECTOR.normal;
            return (
              <Box as="li" key={s.id} mb={4}>
                <Flex align="center" gap={2} wrap="wrap">
                  <Text fontWeight={700}>
                    {s.id} · {s.nombre}
                  </Text>
                  <Badge colorScheme={e.color}>{e.texto}</Badge>
                  {s.aislado && <Badge colorScheme="red">Aislado</Badge>}
                </Flex>
                <Text fontSize="sm" color="textoSuave">
                  Se compromete a {metros(s.altura_compromiso_m)} en Puerto Formosa;{" "}
                  {s.margen_a_compromiso_m >= 0 ? `faltan ${metros(s.margen_a_compromiso_m)}` : `ya la superó por ${metros(-s.margen_a_compromiso_m)}`}.
                </Text>
                {s.accesos.length > 0 && (
                  <Text fontSize="sm">
                    Accesos:{" "}
                    {s.accesos.map((a) => `${a.nombre} (${SUPERFICIE[a.superficie] ?? a.superficie}, ${ESTADO_ACCESO[a.estado] ?? a.estado})`).join("; ")}.
                  </Text>
                )}
                {s.alertas.length > 0 && (
                  <Box mt={1}>
                    <Text fontSize="sm" fontWeight={600}>
                      Avisos y órdenes recientes
                    </Text>
                    <Box as="ul" fontSize="sm" m={0} pl={5}>
                      {s.alertas.map((a) => (
                        <li key={a.orden_id}>
                          {TIPO_ORDEN[a.tipo] ?? a.tipo} · {fechaHora(a.creada_en)}: {a.fundamento}
                        </li>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
      <Text fontSize="sm">
        Altura de referencia: <strong>{metros(d.altura_referencia.altura_m)}</strong> en Puerto Formosa ({fechaCorta(d.altura_referencia.fecha)}){" "}
        <Insignia categoria={CATEGORIAS.OBSERVADO} /> <Text as="span" color="textoSuave">{d.altura_referencia.fuente}</Text>
      </Text>
      {d.centro_asignado && (d.centro_asignado.personas || d.centro_asignado.animales) && (
        <Box mt={3}>
          <Text fontWeight={600}>
            Centro sugerido <Insignia categoria={CATEGORIAS.SIMULADO} />
          </Text>
          {d.centro_asignado.personas && (
            <Text fontSize="sm">
              Para personas: {d.centro_asignado.personas.nombre} (a {distancia(d.centro_asignado.personas.distancia_linea_recta_m)} en línea recta).
            </Text>
          )}
          {d.centro_asignado.animales && (
            <Text fontSize="sm">
              Para animales: {d.centro_asignado.animales.nombre} (a {distancia(d.centro_asignado.animales.distancia_linea_recta_m)} en línea recta).
            </Text>
          )}
          <Text fontSize="xs" color="textoSuave">
            {d.centro_asignado.nota}
          </Text>
        </Box>
      )}
      <Text fontSize="xs" color="textoSuave" mt={3}>
        {d.nota}
      </Text>
    </>
  );
}
