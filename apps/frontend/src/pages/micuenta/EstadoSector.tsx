import { Alert, AlertIcon, Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";

import { EstadoCargando } from "../../components/EstadoCargando";
import { Insignia } from "../../components/Insignia";
import { ApiError } from "../../lib/api";
import { fechaCorta } from "../../lib/etiquetas";
import { severidad } from "../../lib/pedidos";
import type { Carga } from "../../lib/useCarga";

export type SectorMi = {
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
  sectores: SectorMi[];
  altura_referencia: { altura_m: number; fecha: string; categoria: string; fuente: string };
  centro_asignado: { personas: Centro; animales: Centro; nota: string } | null;
  nota: string;
};

export const TIPO_ORDEN: Record<string, string> = {
  alerta: "Alerta",
  evacuacion_preventiva: "Evacuación preventiva",
  evacuacion: "Evacuación",
};

/** Forma + texto + color: el estado nunca se comunica solo con el color. */
const ESTADOS = {
  normal: {
    texto: "Normal",
    frase: "Tu sector está normal: por ahora no hace falta evacuar.",
    bg: "estado.normal.fill",
    borde: "estado.normal.borde",
    fg: "pizarra.900",
    icono: <path d="M4 10.5l4 4 8-9" />,
  },
  en_riesgo: {
    texto: "En riesgo",
    frase: "Tu sector está en riesgo: el río se acerca a la altura en que se compromete. Preparate y seguí los avisos.",
    bg: "estado.en_riesgo.fill",
    borde: "estado.en_riesgo.borde",
    fg: "alerta.800",
    icono: (
      <>
        <path d="M10 3L18 17H2z" />
        <path d="M10 8v4M10 14.5v.01" />
      </>
    ),
  },
  comprometido: {
    texto: "Comprometido",
    frase: "Tu sector está comprometido: el río ya superó la altura en que se compromete. Seguí las indicaciones oficiales y llamá al 103 si necesitás ayuda.",
    bg: "estado.comprometido.fill",
    borde: "estado.comprometido.borde",
    fg: "evacuacion.800",
    icono: (
      <>
        <circle cx="10" cy="10" r="8" />
        <path d="M10 5.5v5.5M10 13.8v.01" />
      </>
    ),
  },
} as const;

const GRAVEDAD = { normal: 0, en_riesgo: 1, comprometido: 2 } as const;
const metros = (n: number) => `${n.toFixed(2).replace(".", ",")} m`;

/** Orden vigente de mayor gravedad (evacuación, evacuación preventiva, alerta) y, a igual gravedad, la más nueva. */
export function ordenesPorGravedad(sectores: SectorMi[]) {
  return sectores
    .flatMap((s) => s.alertas.map((a) => ({ ...a, sector: s })))
    .sort((a, b) => severidad(b.tipo) - severidad(a.tipo) || Date.parse(b.creada_en) - Date.parse(a.creada_en));
}

/**
 * Banda de estado del sector: una frase en lenguaje común, la distancia del río a la altura de compromiso y la orden vigente.
 * Estados y órdenes son SIMULADO; la altura del río es observada. Si no sabemos el sector, pide marcar el domicilio.
 */
export function BandaSector({ carga, alMarcarDomicilio }: { carga: Carga<MiSector>; alMarcarDomicilio: () => void }) {
  return (
    <Box as="section" aria-label="Estado de tu sector" mb={5}>
      {carga.estado === "cargando" && (
        <Box layerStyle="tarjeta" p={4}>
          <EstadoCargando py={4} />
        </Box>
      )}
      {carga.estado === "error" && (
        <Alert status={carga.error instanceof ApiError && carga.error.estado === 404 ? "info" : "error"} fontSize="sm" role="alert">
          <AlertIcon />
          {carga.error instanceof ApiError && carga.error.estado === 404
            ? "Esta función todavía no está disponible en el servidor."
            : `No se pudo cargar el estado de tu sector: ${carga.error instanceof Error ? carga.error.message : "error desconocido"}`}
        </Alert>
      )}
      {carga.estado === "ok" && <Contenido d={carga.datos} alMarcarDomicilio={alMarcarDomicilio} />}
    </Box>
  );
}

function Contenido({ d, alMarcarDomicilio }: { d: MiSector; alMarcarDomicilio: () => void }) {
  const ref = d.altura_referencia;
  if (d.sectores.length === 0) {
    return (
      <Box layerStyle="suave" p={{ base: 4, md: 5 }} data-testid="sector-desconocido">
        <Heading as="h2" size="md" mb={1}>
          Todavía no sabemos en qué sector estás
        </Heading>
        <Text mb={3}>Sin tu domicilio no podemos avisarte si tu zona corre riesgo. Marcalo en el mapa y listo.</Text>
        <Button minH="2.75rem" onClick={alMarcarDomicilio}>
          Marcá tu domicilio
        </Button>
        <Text fontSize="sm" color="textoSuave" mt={3}>
          Altura del río en Puerto Formosa: <strong>{metros(ref.altura_m)}</strong> ({fechaCorta(ref.fecha)}) <Insignia categoria={CATEGORIAS.OBSERVADO} />
        </Text>
      </Box>
    );
  }
  const s = [...d.sectores].sort((a, b) => GRAVEDAD[b.estado] - GRAVEDAD[a.estado])[0];
  const e = ESTADOS[s.estado] ?? ESTADOS.normal;
  const orden = ordenesPorGravedad(d.sectores)[0];
  return (
    <Box bg={e.bg} borderLeft="8px solid" borderColor={e.borde} borderRadius="xl" p={{ base: 4, md: 5 }} data-testid="banda-sector" data-estado={s.estado}>
      <Flex gap={4} align="flex-start">
        <Box as="svg" w="2rem" h="2rem" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" color={e.fg} flex="none" mt="2px" aria-hidden="true">
          {e.icono}
        </Box>
        <Box minW={0}>
          <Flex align="center" gap={2} wrap="wrap" mb={1}>
            <Heading as="h2" size="sm" color={e.fg}>
              {s.id} · {s.nombre}: {e.texto}
              {s.aislado ? " · Aislado" : ""}
            </Heading>
            <Insignia categoria={CATEGORIAS.SIMULADO} />
          </Flex>
          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight={600} lineHeight={1.3} color="texto">
            {e.frase}
            {s.aislado ? " Los accesos están cortados: no salgas por tu cuenta, llamá al 103." : ""}
          </Text>
          <Text fontSize="sm" mt={2} color="texto">
            El río en Puerto Formosa está en <strong>{metros(ref.altura_m)}</strong> ({fechaCorta(ref.fecha)}) <Insignia categoria={CATEGORIAS.OBSERVADO} /> y tu sector se compromete a {metros(s.altura_compromiso_m)}:{" "}
            {s.margen_a_compromiso_m >= 0 ? `faltan ${metros(s.margen_a_compromiso_m)}` : `ya la superó por ${metros(-s.margen_a_compromiso_m)}`}.
          </Text>
          {orden && (
            <Text fontSize="sm" fontWeight={700} mt={2} color={e.fg} data-testid="orden-vigente">
              Orden vigente: {TIPO_ORDEN[orden.tipo] ?? orden.tipo}. {orden.fundamento}
            </Text>
          )}
          <Text fontSize="xs" color="textoSuave" mt={2}>
            {d.nota}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}
