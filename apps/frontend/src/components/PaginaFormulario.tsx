import { Box, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { K10_FECHA, SECTORES_K10 } from "../datos/kit";
import { fmt } from "../lib/entorno";
import { Insignia } from "./Insignia";
import { Plegable } from "./Plegable";

/**
 * Estructura común de las páginas de formulario (registro, ingreso, app).
 * En pantallas anchas el formulario va a la izquierda y un panel de apoyo a la derecha, todo el conjunto centrado;
 * en pantallas angostas el panel de apoyo pasa debajo del formulario.
 */
export function PaginaFormulario({
  titulo,
  intro,
  children,
  aside,
  anchoFormulario = "34rem",
  anchoAside = "24rem",
}: {
  titulo: string;
  intro?: ReactNode;
  children: ReactNode;
  aside: ReactNode;
  anchoFormulario?: string;
  anchoAside?: string;
}) {
  return (
    <Box maxW="80rem" mx="auto" w="100%" data-testid="pagina-formulario">
      <Box maxW="46rem" mb={6}>
        <Heading as="h1" size="xl" mb={2}>
          {titulo}
        </Heading>
        {intro && <Text>{intro}</Text>}
      </Box>
      <Box
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: `minmax(0, ${anchoFormulario}) minmax(0, ${anchoAside})` }}
        columnGap={{ lg: 10, xl: 14 }}
        rowGap={8}
        alignItems="start"
        justifyContent="start"
      >
        <Box minW={0}>{children}</Box>
        <Box
          as="aside"
          aria-label="Información de apoyo"
          minW={0}
          data-testid="panel-apoyo"
          position={{ lg: "sticky" }}
          top={{ lg: "calc(var(--altura-leyenda) + 1.5rem)" }}
        >
          {aside}
        </Box>
      </Box>
    </Box>
  );
}

/** Panel de apoyo: bloque sin contorno, con título; no repite el estilo de tarjeta del formulario. */
export function BloqueApoyo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box mb={7}>
      <Heading as="h2" size="sm" mb={2}>
        {titulo}
      </Heading>
      {children}
    </Box>
  );
}

/** Sectores de evaluación (K10, SIMULADO): referencia para quien registra su domicilio o su establecimiento. Plegado por defecto. */
export function ResumenSectores() {
  return (
    <Box mb={7} borderTop="1px solid" borderColor="borde" pt={1}>
      <Plegable titulo={<Heading as="h2" size="sm">Sectores de evaluación</Heading>}>
        <Box mb={2}>
          <Insignia categoria="SIMULADO" />
          <Text as="span" fontSize="xs" color="textoSuave" ml={2}>
            K10 v1.0 · {K10_FECHA}
          </Text>
        </Box>
        <Box as="ul" listStyleType="none" m={0} p={0} fontSize="sm">
          {SECTORES_K10.map((s) => (
            <Box as="li" key={s.id} py={1.5} borderBottom="1px solid" borderColor="pizarra.100">
              <strong>{s.id}</strong> {s.nombre}
              <Text color="textoSuave" fontSize="xs">
                Se compromete a {fmt(s.compromiso_m)} m en Puerto Formosa. {s.acceso}.
              </Text>
            </Box>
          ))}
        </Box>
        <Text fontSize="xs" color="textoSuave" mt={2} pb={2}>
          No son barrios ni parajes reales: así los armó la mesa para esta evaluación.
        </Text>
      </Plegable>
    </Box>
  );
}
