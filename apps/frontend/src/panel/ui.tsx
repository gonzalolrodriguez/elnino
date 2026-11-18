import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Button, Center, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import type { Categoria } from "@evacuaciones/shared";
import type { ReactNode } from "react";

import { AlertaError } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import type { Carga } from "../lib/useCarga";

/** Formatea metros con coma decimal: 5.6 -> "5,60 m". */
export function fmtM(v: number | null | undefined, dec = 2): string {
  return v === null || v === undefined ? "sin dato" : `${v.toFixed(dec).replace(".", ",")} m`;
}

export function fmtNum(v: number | null | undefined, dec = 0): string {
  return v === null || v === undefined ? "sin dato" : v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "sin fecha";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function fmtDias(min: number | null, max: number | null): string {
  if (min === null || max === null) return "sin estimación";
  const r = (n: number) => (n < 1 ? "menos de 1" : n.toFixed(0));
  return min === max || r(min) === r(max) ? `${r(min)} días` : `${r(min)} a ${r(max)} días`;
}

/** Bloque con título; el panel lo usa en lugar de tarjetas idénticas: borde fino a la izquierda según el contexto. */
export function Seccion({
  titulo,
  children,
  categoria,
  derecha,
  id,
}: {
  titulo: string;
  children: ReactNode;
  categoria?: Categoria;
  derecha?: ReactNode;
  id?: string;
}) {
  return (
    <Box as="section" aria-labelledby={id ?? undefined} bg="white" border="1px solid" borderColor="pizarra.200" borderRadius="3px" p={4} mb={4}>
      <Flex align="center" gap={3} mb={3} wrap="wrap">
        <Heading as="h2" id={id} size="sm" fontFamily="heading">
          {titulo}
        </Heading>
        {categoria && <Insignia categoria={categoria} />}
        <Box ml="auto">{derecha}</Box>
      </Flex>
      {children}
    </Box>
  );
}

/** Cifra con su categoría, fuente y fecha (regla 2 de la mesa). */
export function Cifra({
  etiqueta,
  valor,
  categoria,
  fuente,
  fecha,
  testId,
}: {
  etiqueta: string;
  valor: ReactNode;
  categoria: Categoria;
  fuente?: string;
  fecha?: string | null;
  testId?: string;
}) {
  return (
    <Box minW="9rem">
      <Text fontSize="xs" color="pizarra.500">
        {etiqueta}
      </Text>
      <Text fontSize="xl" fontWeight={600} fontFamily="heading" data-testid={testId} lineHeight={1.2}>
        {valor}
      </Text>
      <Insignia categoria={categoria} />
      {(fuente || fecha) && (
        <Text fontSize="11px" color="pizarra.500" mt="2px">
          {[fuente, fecha ? fmtFecha(fecha) : null].filter(Boolean).join(" · ")}
        </Text>
      )}
    </Box>
  );
}

/** Estados de carga, error y vacío de una carga asíncrona. */
export function Cargando<T>({
  carga,
  hijos,
  vacio,
  esVacio,
}: {
  carga: Carga<T> & { recargar: () => void };
  hijos: (d: T) => ReactNode;
  vacio?: string;
  esVacio?: (d: T) => boolean;
}) {
  if (carga.estado === "cargando") {
    return (
      <Center py={8} role="status" aria-label="Cargando">
        <Spinner />
      </Center>
    );
  }
  if (carga.estado === "error") {
    return (
      <Box>
        <AlertaError error={carga.error} />
        <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
          Reintentar
        </Button>
      </Box>
    );
  }
  if (esVacio?.(carga.datos)) {
    return (
      <Alert status="info" variant="subtle">
        <AlertIcon />
        <AlertDescription>{vacio ?? "No hay datos para mostrar."}</AlertDescription>
      </Alert>
    );
  }
  return <>{hijos(carga.datos)}</>;
}

export function AvisoSimulado({ children }: { children: ReactNode }) {
  return (
    <Alert status="warning" variant="left-accent" fontSize="sm" mb={3}>
      <AlertIcon />
      <Box>
        <AlertTitle fontSize="sm">SIMULADO</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Box>
    </Alert>
  );
}

export const COLOR_ESTADO = {
  normal: { fill: "#EAEFEC", stroke: "#5B6B68", texto: "normal" },
  en_riesgo: { fill: "#F6D98E", stroke: "#B07A12", texto: "en riesgo" },
  comprometido: { fill: "#E58C80", stroke: "#9B2D20", texto: "comprometido" },
} as const;

export const NOMBRE_ACCESO: Record<string, string> = {
  transitable: "transitable",
  cerrado_operador: "cerrado por el operador",
  intransitable_lluvia: "intransitable por lluvia",
  anegado: "anegado",
};
