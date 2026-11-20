import { Box, List, ListItem, SimpleGrid, Text } from "@chakra-ui/react";

import { IconoAlerta, IconoReloj, IconoTilde } from "../../components/iconos/Iconos";
import type { Plan } from "../tipos";
import { fmtNum } from "../ui";
import { Dato, Plegable } from "./piezas";

/** Cifras del plan completo: lo que entra, lo que queda afuera y cuántos sectores no llegan a tiempo. */
export function ResumenPlan({ p }: { p: Plan }) {
  const m = p.metricas;
  const descartados = p.centros_descartados ?? [];
  return (
    <Box>
      <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} spacing={{ base: 4, md: 5 }} p={{ base: 4, md: 5 }} bg="pizarra.50" border="1px solid" borderColor="borde" borderRadius="xl">
        <Dato etiqueta="Personas a evacuar" valor={fmtNum(m.personas_a_evacuar)} />
        <Dato etiqueta="Con lugar" valor={fmtNum(m.personas_evacuadas)} color="verde.800" icono={<IconoTilde tam="1.1rem" strokeWidth={2.25} />} />
        <Dato
          etiqueta="Sin lugar"
          valor={fmtNum(m.personas_sin_lugar)}
          color={m.personas_sin_lugar > 0 ? "evacuacion.800" : undefined}
          icono={m.personas_sin_lugar > 0 ? <IconoAlerta tam="1.1rem" /> : undefined}
        />
        <Dato etiqueta="Camiones jaula" valor={fmtNum(m.camiones_jaula_necesarios)} />
        <Dato etiqueta="Tiempo total" valor={m.tiempo_total_min === null ? "sin dato" : `${fmtNum(m.tiempo_total_min)} min`} />
        {m.sectores_no_alcanzan !== undefined && (
          <Dato
            etiqueta="Sectores que no alcanzan"
            valor={fmtNum(m.sectores_no_alcanzan)}
            color={m.sectores_no_alcanzan > 0 ? "evacuacion.800" : undefined}
            icono={m.sectores_no_alcanzan > 0 ? <IconoAlerta tam="1.1rem" /> : undefined}
          />
        )}
        {m.sectores_justos !== undefined && (
          <Dato etiqueta="Sectores que llegan justo" valor={fmtNum(m.sectores_justos)} color={m.sectores_justos > 0 ? "alerta.800" : undefined} icono={m.sectores_justos > 0 ? <IconoReloj tam="1.1rem" /> : undefined} />
        )}
        {m.familias_juntas !== undefined && (
          <Dato etiqueta="Familias juntas" valor={fmtNum(m.familias_juntas)} nota={m.familias_sin_lugar_entero ? `sin lugar entero: ${fmtNum(m.familias_sin_lugar_entero)}` : undefined} />
        )}
      </SimpleGrid>
      {descartados.length > 0 && (
        <Plegable testId="centros-descartados" resumen={`Centros descartados en este escenario (${descartados.length})`}>
          <List spacing={1.5} color="textoSuave">
            {descartados.map((c) => (
              <ListItem key={c.id}>
                <Text as="span" fontWeight={600} color="texto">
                  {c.nombre ?? `Centro ${c.id}`}
                </Text>
                : {c.motivo}
              </ListItem>
            ))}
          </List>
        </Plegable>
      )}
    </Box>
  );
}
