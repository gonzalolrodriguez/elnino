import { Box, Flex, Heading, List, ListItem, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { IconoCamion, IconoCaja, IconoPersonas } from "../../components/iconos/Iconos";
import { ETIQUETA_PROFESION, ETIQUETA_TIPO_OPERATIVO, type CuadrillaPropia } from "../../lib/avisos";
import { etiquetaRolOperativo } from "../../lib/etiquetas";
import { etiquetaVehiculo } from "../../lib/pedidos";

function Subtitulo({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <Flex align="center" gap={2} mb={1.5} textStyle="rotulo" color="texto">
      <Box aria-hidden="true" display="flex">
        {icono}
      </Box>
      {children}
    </Flex>
  );
}

/**
 * Resumen de la cuadrilla propia (`GET /mi/cuadrilla`). A la cuadrilla se la ve por rol operativo y profesión: aunque la API
 * mande `nombre_visible`, esta pantalla no lo muestra (solo lo ven operador, decisor y admin en el panel).
 */
export function MiCuadrilla({ cuadrilla: c }: { cuadrilla: CuadrillaPropia }) {
  const encargado = (c.integrantes ?? []).find((i) => i.es_encargado);
  const equipamiento = (c.equipamiento ?? []).filter((x) => x.trim() !== "");
  const tipo = c.tipo_operativo ? ETIQUETA_TIPO_OPERATIVO[c.tipo_operativo] ?? c.tipo_operativo : null;
  return (
    <Box as="article" aria-label={`Mi cuadrilla ${c.nombre}`} data-testid="mi-cuadrilla">
      <Heading as="h3" size="bloque" textStyle="tituloBloque" mb={1}>
        {c.nombre}
      </Heading>
      <Text textStyle="microdato" mb={4}>
        {[tipo ? `Operativo: ${tipo}` : null, encargado ? `Encargado: ${etiquetaRolOperativo(encargado.rol_operativo)}` : null].filter(Boolean).join(" · ")}
      </Text>

      <Box display="grid" rowGap={4}>
        {c.vehiculo && (
          <Box>
            <Subtitulo icono={<IconoCamion tam="1.125rem" />}>Vehículo</Subtitulo>
            <Text>{etiquetaVehiculo(c.vehiculo) ?? c.vehiculo}</Text>
          </Box>
        )}

        {(c.integrantes ?? []).length > 0 && (
          <Box>
            <Subtitulo icono={<IconoPersonas tam="1.125rem" />}>Integrantes ({(c.integrantes ?? []).length})</Subtitulo>
            <List spacing={1} aria-label="Integrantes de la cuadrilla">
              {(c.integrantes ?? []).map((i) => (
                <ListItem key={i.id} data-testid={`integrante-${i.id}`}>
                  {etiquetaRolOperativo(i.rol_operativo)} · {ETIQUETA_PROFESION[i.profesion] ?? i.profesion}
                  {i.es_encargado ? " · encargado" : ""}
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {equipamiento.length > 0 && (
          <Box>
            <Subtitulo icono={<IconoCaja tam="1.125rem" />}>Equipamiento</Subtitulo>
            <List spacing={0.5} styleType="disc" pl={5} aria-label="Equipamiento de la cuadrilla">
              {equipamiento.map((x, k) => (
                <ListItem key={`${k}-${x}`}>{x}</ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
}
