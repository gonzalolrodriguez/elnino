import { Box, Flex, Heading, Link, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";

import { IconoBandeja } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useSenalTiempoReal } from "../TiempoRealContext";
import { Cargando } from "../ui";
import { ChipParte, ordenarNovedades, prioridadParte, truncar } from "./partes";

const REFRESCO_MS = 60_000;

/**
 * Novedades de las cuadrillas para el Tablero: primero las dificultades sin resolver y los resultados no completos,
 * después lo más reciente. Se actualiza con cualquier evento de tiempo real y, por las dudas, cada 60 s.
 */
export function NovedadesCuadrillas({ limite = 8 }: { limite?: number }) {
  const senal = useSenalTiempoReal();
  const carga = useCarga(() => api.partesRecientes(Math.max(limite, 20)), [senal]);
  const { recargar } = carga;
  useEffect(() => {
    const t = setInterval(recargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [recargar]);

  return (
    <Box as="section" aria-labelledby="novedades-cuadrillas" layerStyle="tarjeta" p={{ base: 4, md: 5 }} data-testid="novedades-cuadrillas">
      <Flex align="center" gap={3} mb={3} wrap="wrap">
        <Heading as="h2" id="novedades-cuadrillas" size="sm">
          Novedades de las cuadrillas
        </Heading>
        <Insignia categoria="SIMULADO" />
        <Link as={RouterLink} to="/comando/cuadrillas" ml="auto" fontSize="sm" fontWeight={600} color="primarioHover">
          Ver cuadrillas
        </Link>
      </Flex>
      <Cargando
        carga={carga}
        esVacio={(d) => d.items.length === 0}
        vacio="Todavía no hay partes de las cuadrillas."
        hijos={(d) => (
          <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={2}>
            {ordenarNovedades(d.items)
              .slice(0, limite)
              .map((p) => (
                <Box
                  as="li"
                  key={p.id}
                  p={3}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={prioridadParte(p) === 2 ? "borde" : "alerta.300"}
                  bg={prioridadParte(p) === 2 ? "superficie" : "alerta.50"}
                  data-testid="novedad-cuadrilla"
                >
                  <Flex align="center" gap={2} wrap="wrap">
                    <ChipParte parte={p} />
                    {p.tipo === "dificultad" && (
                      <Text as="span" fontSize="sm" fontWeight={600}>
                        {p.resuelta ? "Resuelta" : "Sin resolver"}
                      </Text>
                    )}
                    <Text as="time" dateTime={p.creado_en} fontSize="sm" color="textoSuave" ml="auto">
                      {fechaHora(p.creado_en)}
                    </Text>
                  </Flex>
                  <Text fontSize="sm" mt={1.5}>
                    <Link as={RouterLink} to={`/comando/cuadrillas#cuadrilla-${p.cuadrilla_id}`} fontWeight={700}>
                      {p.cuadrilla_nombre}
                    </Link>
                    {p.sector_id ? ` · Sector ${p.sector_id}` : ""}
                    {p.autor_rol ? ` · ${etiquetaRolOperativo(p.autor_rol)}` : ""}
                  </Text>
                  {p.observacion && (
                    <Text fontSize="sm" color="textoSuave" mt={0.5}>
                      {truncar(p.observacion)}
                    </Text>
                  )}
                </Box>
              ))}
          </Box>
        )}
      />
      <Flex align="center" gap={1.5} mt={2} color="textoSuave" fontSize="xs">
        <IconoBandeja tam="0.9rem" />
        Los partes se identifican por rol, no por nombre.
      </Flex>
    </Box>
  );
}
