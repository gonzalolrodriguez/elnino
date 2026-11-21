import { Box, Flex, Heading, List, ListItem, Text } from "@chakra-ui/react";

import { IconoCamion, IconoCaja, IconoPersonas } from "../../components/iconos/Iconos";
import { ETIQUETA_PROFESION, ETIQUETA_TIPO_OPERATIVO, type CuadrillaPropia } from "../../lib/avisos";
import { etiquetaRolOperativo } from "../../lib/etiquetas";
import { etiquetaVehiculo } from "../../lib/pedidos";

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
      <Heading as="h3" size="sm" textStyle="tituloBloque" mb={1}>
        {c.nombre}
      </Heading>
      <Text textStyle="microdato" mb={3}>
        {[tipo ? `Operativo: ${tipo}` : null, encargado ? `Encargado: ${etiquetaRolOperativo(encargado.rol_operativo)}` : null].filter(Boolean).join(" · ")}
      </Text>

      {c.vehiculo && (
        <Flex align="center" gap={2} mb={3} fontSize="sm">
          <Box aria-hidden="true" display="flex">
            <IconoCamion tam="1.125rem" />
          </Box>
          <Text>
            <strong>Vehículo:</strong> {etiquetaVehiculo(c.vehiculo) ?? c.vehiculo}
          </Text>
        </Flex>
      )}

      {(c.integrantes ?? []).length > 0 && (
        <Box mb={3}>
          <Flex align="center" gap={2} mb={1} fontSize="sm" fontWeight={700}>
            <Box aria-hidden="true" display="flex">
              <IconoPersonas tam="1.125rem" />
            </Box>
            Integrantes ({(c.integrantes ?? []).length})
          </Flex>
          <List spacing={1} aria-label="Integrantes de la cuadrilla">
            {(c.integrantes ?? []).map((i) => (
              <ListItem key={i.id} fontSize="sm" data-testid={`integrante-${i.id}`}>
                {etiquetaRolOperativo(i.rol_operativo)} · {ETIQUETA_PROFESION[i.profesion] ?? i.profesion}
                {i.es_encargado ? " · encargado" : ""}
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {equipamiento.length > 0 && (
        <Box>
          <Flex align="center" gap={2} mb={1} fontSize="sm" fontWeight={700}>
            <Box aria-hidden="true" display="flex">
              <IconoCaja tam="1.125rem" />
            </Box>
            Equipamiento
          </Flex>
          <List spacing={0.5} styleType="disc" pl={5} aria-label="Equipamiento de la cuadrilla">
            {equipamiento.map((x, k) => (
              <ListItem key={`${k}-${x}`} fontSize="sm">
                {x}
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
