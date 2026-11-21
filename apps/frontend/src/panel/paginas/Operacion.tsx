import { Button, Flex, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

import { IconoBandeja, IconoPersonas } from "../../components/iconos/Iconos";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { TACTIL } from "../cuadrillas/partes";
import { ColaAsistencia } from "../operacion/ColaAsistencia";
import { ListaTareas } from "../operacion/ListaTareas";
import type { Cuadrilla } from "../tipos";
import { Seccion } from "../ui";

/** Las cuadrillas se arman, editan y siguen en su propio módulo; acá queda un acceso de una línea. */
function BloqueCuadrillas({ cuadrillas }: { cuadrillas: Cuadrilla[] }) {
  return (
    <Seccion titulo="Cuadrillas" categoria="SIMULADO" id="sec-cuadrillas" icono={<IconoPersonas tam="1.25rem" />}>
      <Flex align="center" justify="space-between" columnGap={4} rowGap={3} wrap="wrap">
        <Text maxW="70ch" flex="1 1 20rem">
          Hay {cuadrillas.length} {cuadrillas.length === 1 ? "cuadrilla cargada" : "cuadrillas cargadas"}. Para crear una, editar su equipo, equipamiento y vehículo, seguir su recorrido o mandarle avisos, usá el módulo de cuadrillas.
        </Text>
        <Button as={RouterLink} to="/comando/cuadrillas" size="sm" {...TACTIL}>
          Ir a gestión de cuadrillas
        </Button>
      </Flex>
    </Seccion>
  );
}

export default function Operacion() {
  const cuadrillas = useCarga(() => api.cuadrillas());
  const tareas = useCarga(() => api.tareas());
  const lista = cuadrillas.datos?.cuadrillas ?? [];
  return (
    <>
      <CabeceraPagina
        titulo="Solicitudes y cuadrillas"
        icono={<IconoBandeja tam="1.5rem" />}
        categoria="SIMULADO"
        ayuda="Solicitudes, cuadrillas y tareas de demostración, con roles en lugar de nombres."
      />
      <ColaAsistencia cuadrillas={lista} tareas={tareas.datos?.tareas ?? []} />
      <ListaTareas cuadrillas={lista} carga={tareas} />
      <BloqueCuadrillas cuadrillas={lista} />
    </>
  );
}
