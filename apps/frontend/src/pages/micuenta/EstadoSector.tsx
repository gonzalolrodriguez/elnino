import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import type { ReactElement } from "react";

import { EstadoCargando } from "../../components/EstadoCargando";
import { IconoAlerta, IconoMegafono, IconoPunto, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { ApiError } from "../../lib/api";
import { fechaCorta } from "../../lib/etiquetas";
import { severidad } from "../../lib/pedidos";
import type { Carga } from "../../lib/useCarga";
import { AvisoDiscreto } from "./AvisoDiscreto";

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
const ESTADOS: Record<
  SectorMi["estado"],
  { texto: string; frase: string; bg: string; linea: string; disco: string; fg: string; icono: ReactElement }
> = {
  normal: {
    texto: "Normal",
    frase: "Tu sector está normal: por ahora no hace falta evacuar.",
    bg: "verde.50",
    linea: "verde.200",
    disco: "verde.600",
    fg: "verde.800",
    icono: <IconoTilde tam="1.75rem" strokeWidth={2.25} />,
  },
  en_riesgo: {
    texto: "En riesgo",
    frase: "Tu sector está en riesgo: el río se acerca a la altura en que se compromete. Preparate y seguí los avisos.",
    bg: "alerta.50",
    linea: "alerta.200",
    disco: "alerta.700",
    fg: "alerta.800",
    icono: <IconoTriangulo tam="1.75rem" />,
  },
  comprometido: {
    texto: "Comprometido",
    frase: "Tu sector está comprometido: el río ya superó la altura en que se compromete. Seguí las indicaciones oficiales y llamá al 103 si necesitás ayuda.",
    bg: "evacuacion.50",
    linea: "evacuacion.200",
    disco: "evacuacion.700",
    fg: "evacuacion.800",
    icono: <IconoAlerta tam="1.75rem" />,
  },
};

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
    <Box as="section" aria-label="Estado de tu sector">
      {carga.estado === "cargando" && (
        <Box bg="superficie" border="1px solid" borderColor="borde" borderRadius="2xl" p={4}>
          <EstadoCargando py={6} />
        </Box>
      )}
      {carga.estado === "error" &&
        (carga.error instanceof ApiError && carga.error.estado === 404 ? (
          <AvisoDiscreto>Esta función todavía no está disponible en el servidor.</AvisoDiscreto>
        ) : (
          <AvisoDiscreto peligro>No se pudo cargar el estado de tu sector: {carga.error instanceof Error ? carga.error.message : "error desconocido"}</AvisoDiscreto>
        ))}
      {carga.estado === "ok" && <Contenido d={carga.datos} alMarcarDomicilio={alMarcarDomicilio} />}
    </Box>
  );
}

/** La lectura del río en grande, con su fecha y su categoría. */
function CifraRio({ d }: { d: MiSector }) {
  const ref = d.altura_referencia;
  return (
    <Box minW={0}>
      <Text textStyle="rotulo" color="inherit" opacity={0.85}>
        Río en Puerto Formosa
      </Text>
      <Text textStyle="cifraGrande" color="texto" mt={1}>
        {metros(ref.altura_m)}
      </Text>
      <Flex align="center" gap={2} wrap="wrap" mt={2} fontSize="sm" color="texto">
        <span>({fechaCorta(ref.fecha)})</span>
        <Insignia categoria={CATEGORIAS.OBSERVADO} />
      </Flex>
    </Box>
  );
}

/** Escala del río frente a la altura de compromiso del sector. Decorativa: el dato completo está en el texto. */
function Escala({ rio, compromiso, color }: { rio: number; compromiso: number; color: string }) {
  const tope = Math.max(compromiso, rio) * 1.15;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / tope) * 100))}%`;
  // Cerca del borde derecho la etiqueta se alinea a la derecha de la marca para no salirse de la pantalla.
  const alDerecha = compromiso / tope > 0.72;
  return (
    <Box aria-hidden="true" position="relative" mt={6} mb={9}>
      <Box position="relative" h="0.625rem" borderRadius="full" bg="papel" border="1px solid" borderColor="rgba(14, 27, 44, 0.12)">
        <Box position="absolute" insetY={0} left={0} w={pct(rio)} borderRadius="full" bg="agua.700" />
        <Box position="absolute" top="-5px" bottom="-5px" w="3px" borderRadius="full" bg={color} left={pct(compromiso)} transform="translateX(-50%)" />
      </Box>
      <Text position="absolute" top="1.375rem" left={pct(compromiso)} transform={alDerecha ? "translateX(-100%)" : "translateX(-50%)"} fontSize="xs" fontWeight={700} whiteSpace="nowrap" color={color} sx={{ fontVariantNumeric: "tabular-nums" }}>
        Compromiso {metros(compromiso)}
      </Text>
      <Text position="absolute" top="1.375rem" left={0} fontSize="xs" color="textoSuave">
        0 m
      </Text>
    </Box>
  );
}

function Contenido({ d, alMarcarDomicilio }: { d: MiSector; alMarcarDomicilio: () => void }) {
  const ref = d.altura_referencia;
  if (d.sectores.length === 0) {
    return (
      <Box bg="agua.100" border="1px solid" borderColor="agua.200" borderRadius="2xl" p={{ base: 5, md: 7 }} data-testid="sector-desconocido">
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" }} gap={{ base: 6, md: 10 }} alignItems="center">
          <Flex gap={4} align="flex-start">
            <Flex aria-hidden="true" align="center" justify="center" flex="none" w="3.5rem" h="3.5rem" borderRadius="full" bg="agua.700" color="papel">
              <IconoPunto tam="1.75rem" />
            </Flex>
            <Box minW={0}>
              <Heading as="h2" size="lg">
                Todavía no sabemos en qué sector estás
              </Heading>
              <Text mt={1} mb={4} maxW="34rem" fontSize="lg" lineHeight={1.4}>
                Sin tu domicilio no podemos avisarte si tu zona corre riesgo. Marcalo en el mapa y listo.
              </Text>
              <Button minH="3rem" size="lg" onClick={alMarcarDomicilio} leftIcon={<IconoPunto />}>
                Marcá tu domicilio
              </Button>
            </Box>
          </Flex>
          <CifraRio d={d} />
        </Box>
        <Text fontSize="xs" color="textoSuave" mt={5}>
          {ref.fuente ? `Fuente: ${ref.fuente}.` : ""} Cuando sepamos tu sector, acá vas a ver cuánto falta para que se comprometa.
        </Text>
      </Box>
    );
  }
  const s = [...d.sectores].sort((a, b) => GRAVEDAD[b.estado] - GRAVEDAD[a.estado])[0];
  const e = ESTADOS[s.estado] ?? ESTADOS.normal;
  const orden = ordenesPorGravedad(d.sectores)[0];
  return (
    <Box bg={e.bg} border="1px solid" borderColor={e.linea} borderRadius="2xl" p={{ base: 5, md: 7 }} data-testid="banda-sector" data-estado={s.estado}>
      <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" }} gap={{ base: 6, md: 10 }} alignItems="start">
        <Flex gap={4} align="flex-start">
          <Flex aria-hidden="true" align="center" justify="center" flex="none" w={{ base: "3rem", md: "3.5rem" }} h={{ base: "3rem", md: "3.5rem" }} borderRadius="full" bg={e.disco} color="papel">
            {e.icono}
          </Flex>
          <Box minW={0}>
            <Flex align="center" gap={2} wrap="wrap" mb={1}>
              <Heading as="h2" size="sm" color={e.fg}>
                {s.id} · {s.nombre}: {e.texto}
                {s.aislado ? " · Aislado" : ""}
              </Heading>
              <Insignia categoria={CATEGORIAS.SIMULADO} />
            </Flex>
            <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight={700} lineHeight={1.3} letterSpacing="-0.015em" color="texto" maxW="40rem">
              {e.frase}
              {s.aislado ? " Los accesos están cortados: no salgas por tu cuenta, llamá al 103." : ""}
            </Text>
          </Box>
        </Flex>
        <CifraRio d={d} />
      </Box>

      <Escala rio={ref.altura_m} compromiso={s.altura_compromiso_m} color={e.disco} />
      <Text fontSize="md" color="texto">
        Tu sector se compromete a <strong>{metros(s.altura_compromiso_m)}</strong>:{" "}
        {s.margen_a_compromiso_m >= 0 ? `faltan ${metros(s.margen_a_compromiso_m)}` : `ya la superó por ${metros(-s.margen_a_compromiso_m)}`}.
      </Text>
      {orden && (
        <Flex align="flex-start" gap={2.5} mt={4} p={3.5} borderRadius="xl" bg="papel" border="1px solid" borderColor={e.linea} data-testid="orden-vigente" color={e.fg} fontWeight={700}>
          <Box aria-hidden="true" display="flex" mt="2px">
            <IconoMegafono />
          </Box>
          <Text>
            Orden vigente: {TIPO_ORDEN[orden.tipo] ?? orden.tipo}. {orden.fundamento}
          </Text>
        </Flex>
      )}
      <Text fontSize="xs" color="textoSuave" mt={4}>
        {d.nota}
      </Text>
    </Box>
  );
}
