import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, type BoxProps, Button, Flex, Heading, Text } from "@chakra-ui/react";
import type { Categoria } from "@evacuaciones/shared";
import type { ReactNode } from "react";

import { EstadoCargando } from "../components/EstadoCargando";
import { AlertaError } from "../components/Formulario";
import { ESTADOS } from "../estilo/estados";
import { Insignia } from "../components/Insignia";
import type { Carga } from "../lib/useCarga";

/** Categoría que comparten todos los elementos de un bloque, o `undefined` si hay mezcla (o ninguno). */
export function categoriaComun(cats: readonly Categoria[]): Categoria | undefined {
  return cats.length > 0 && cats.every((c) => c === cats[0]) ? cats[0] : undefined;
}

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

/**
 * Para `Table sx={APILAR}`: por debajo de 48 em cada fila pasa a ser un bloque con sus rótulos (`data-etiqueta` de cada
 * celda), así la tabla no necesita desplazamiento horizontal en el celular. La primera celda es el título de la fila.
 */
export const APILAR = {
  "@media (max-width: 47.99em)": {
    thead: { position: "absolute", left: "-9999px" },
    "tbody tr": { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "1rem", rowGap: "0.25rem", padding: "0.75rem 0", borderBottom: "1px solid var(--chakra-colors-pizarra-100)" },
    "tbody td": { display: "block", border: "none", padding: "0.125rem 0", textAlign: "left !important", whiteSpace: "normal" },
    "tbody td::before": { content: "attr(data-etiqueta)", display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--chakra-colors-textoSuave)" },
    "tbody td:first-of-type": { gridColumn: "1 / -1", fontWeight: 700 },
    "tbody td:first-of-type::before": { display: "none" },
    "tbody td[colspan]": { gridColumn: "1 / -1" },
  },
} as const;

/** Tonos de los chips de estado: siempre llevan ícono y texto, el color solo refuerza. */
export type TonoChip = "ok" | "aviso" | "alerta" | "info" | "neutro";
const TONOS: Record<TonoChip, { bg: string; fg: string; borde: string }> = {
  ok: { bg: "verde.50", fg: "verde.800", borde: "verde.200" },
  aviso: { bg: "alerta.50", fg: "alerta.800", borde: "alerta.200" },
  alerta: { bg: "evacuacion.50", fg: "evacuacion.800", borde: "evacuacion.200" },
  info: { bg: "agua.100", fg: "agua.800", borde: "agua.200" },
  neutro: { bg: "pizarra.100", fg: "pizarra.700", borde: "pizarra.200" },
};

/** Chip de estado compacto (ícono + texto). */
export function Chip({ tono = "neutro", icono, children, ...resto }: { tono?: TonoChip; icono?: ReactNode; children: ReactNode } & Omit<BoxProps, "children">) {
  const t = TONOS[tono];
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap={1.5}
      px={2.5}
      py="2px"
      borderRadius="full"
      fontSize="0.8125rem"
      fontWeight={600}
      lineHeight={1.4}
      whiteSpace="nowrap"
      bg={t.bg}
      color={t.fg}
      border="1px solid"
      borderColor={t.borde}
      {...resto}
    >
      {icono}
      {children}
    </Box>
  );
}

/** Recuadro redondo con un ícono: da identidad a cada bloque y a cada página sin ocupar una línea propia. */
export function FichaIcono({ icono, tam = "2rem", tono = "info" }: { icono: ReactNode; tam?: string; tono?: TonoChip }) {
  const t = TONOS[tono];
  return (
    <Flex aria-hidden="true" w={tam} h={tam} flexShrink={0} align="center" justify="center" borderRadius="lg" bg={t.bg} color={t.fg}>
      {icono}
    </Flex>
  );
}

/** Bloque con título del panel: tarjeta blanca de línea fina (16 px de radio), sin sombras; el título lleva un ícono opcional. */
export function Seccion({
  titulo,
  children,
  categoria,
  derecha,
  id,
  icono,
  mb = 5,
}: {
  titulo: string;
  children: ReactNode;
  categoria?: Categoria;
  derecha?: ReactNode;
  id?: string;
  icono?: ReactNode;
  mb?: number;
}) {
  return (
    <Box as="section" aria-labelledby={id ?? undefined} layerStyle="tarjeta" p={{ base: 4, md: 5 }} mb={mb} minW={0}>
      <Flex align="center" columnGap={3} rowGap={1.5} mb={4} wrap="wrap">
        {icono && <FichaIcono icono={icono} />}
        <Heading as="h2" id={id} size="sm" textStyle="tituloBloque" fontSize="1.125rem">
          {titulo}
        </Heading>
        {categoria && <Insignia categoria={categoria} />}
        {derecha && (
          <Box ml="auto" textStyle="microdato">
            {derecha}
          </Box>
        )}
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
    <Box minW="9rem" flex="1 1 9rem">
      <Text textStyle="rotulo">{etiqueta}</Text>
      <Text textStyle="cifraMedia" data-testid={testId} my={1}>
        {valor}
      </Text>
      <Insignia categoria={categoria} />
      {(fuente || fecha) && (
        <Text textStyle="microdato" mt="2px">
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
    return <EstadoCargando />;
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
    <Alert status="warning" variant="subtle" fontSize="sm" mb={3}>
      <AlertIcon />
      <Box>
        <AlertTitle fontSize="sm">SIMULADO</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Box>
    </Alert>
  );
}

export const COLOR_ESTADO = ESTADOS;

export const NOMBRE_ACCESO: Record<string, string> = {
  transitable: "transitable",
  cerrado_operador: "cerrado por el operador",
  intransitable_lluvia: "intransitable por lluvia",
  anegado: "anegado",
};
