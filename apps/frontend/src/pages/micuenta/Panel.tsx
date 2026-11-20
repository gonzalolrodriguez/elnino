import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** Ficha de ícono: cuadrado suave con el ícono adentro. Decorativa. */
export function FichaIcono({ children, tono = "agua", tam = "2.5rem" }: { children: ReactNode; tono?: "agua" | "verde" | "alerta" | "rojo" | "tinta"; tam?: string }) {
  const tonos = {
    agua: { bg: "agua.100", color: "agua.800" },
    verde: { bg: "verde.100", color: "verde.800" },
    alerta: { bg: "alerta.100", color: "alerta.800" },
    rojo: { bg: "evacuacion.100", color: "evacuacion.800" },
    tinta: { bg: "limo.100", color: "limo.800" },
  }[tono];
  return (
    <Flex aria-hidden="true" align="center" justify="center" flex="none" w={tam} h={tam} borderRadius="lg" {...tonos}>
      {children}
    </Flex>
  );
}

/** Sección del panel personal: ícono, título (h2) y, si hace falta, una acción a la derecha. Es una región con nombre. */
export function Panel({
  titulo,
  icono,
  accion,
  children,
  etiqueta,
  tono,
  ...resto
}: {
  titulo: ReactNode;
  icono: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  /** Nombre accesible de la región (por defecto, el título). */
  etiqueta: string;
  tono?: "agua" | "verde" | "alerta" | "rojo" | "tinta";
  id?: string;
  "data-testid"?: string;
  order?: Record<string, number> | number;
  w?: string;
}) {
  return (
    <Box as="section" aria-label={etiqueta} bg="superficie" border="1px solid" borderColor="borde" borderRadius="2xl" p={{ base: 4, md: 6 }} minW={0} {...resto}>
      <Flex align="center" justify="space-between" gap={3} mb={4}>
        <Flex align="center" gap={3} minW={0}>
          <FichaIcono tono={tono}>{icono}</FichaIcono>
          <Heading as="h2" size="md" minW={0}>
            {titulo}
          </Heading>
        </Flex>
        {accion}
      </Flex>
      {children}
    </Box>
  );
}

/** Estado vacío: ícono tenue y una frase que dice qué pasa y qué sigue. */
export function Vacio({ icono, children, ...resto }: { icono: ReactNode; children: ReactNode; "data-testid"?: string }) {
  return (
    <Flex align="center" gap={3} p={3.5} borderRadius="xl" bg="fondo" color="textoSuave" {...resto}>
      <Box aria-hidden="true" display="flex" color="pizarra.500">
        {icono}
      </Box>
      <Box fontSize="sm" lineHeight={1.45}>
        {children}
      </Box>
    </Flex>
  );
}

/** Una cifra de un resumen (grupo familiar, establecimientos): ícono, número grande y rótulo. */
export function Dato({ icono, valor, rotulo }: { icono: ReactNode; valor: unknown; rotulo: string }) {
  return (
    <Flex direction="column" gap={1.5} minW={0}>
      <Box aria-hidden="true" display="flex" color="agua.700">
        {icono}
      </Box>
      <Text textStyle="cifraMedia" fontSize="2rem">
        {valor === undefined || valor === null ? "—" : String(valor)}
      </Text>
      <Text textStyle="rotulo">{rotulo}</Text>
    </Flex>
  );
}

/** Rejilla de cifras de un resumen: 2 columnas en móvil, 4 desde `sm`, con filete entre columnas. */
export function RejillaDatos({ children }: { children: ReactNode }) {
  return (
    <Box display="grid" gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }} gap={{ base: 5, sm: 4 }} sx={{ "& > *": { paddingLeft: { sm: 4 } }, "& > *:first-of-type": { paddingLeft: 0 } }}>
      {children}
    </Box>
  );
}
