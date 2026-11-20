import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";

import { IconoBandeja, IconoPersonas } from "../../components/iconos/Iconos";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useSenalTiempoReal } from "../TiempoRealContext";
import { Cargando, Chip, Seccion } from "../ui";
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
    <div data-testid="novedades-cuadrillas">
      <Seccion
        titulo="Novedades de las cuadrillas"
        id="novedades-cuadrillas"
        categoria="SIMULADO"
        icono={<IconoPersonas tam="1.25rem" />}
        derecha={
          <Link as={RouterLink} to="/comando/cuadrillas" fontWeight={600} color="primarioHover" display="inline-flex" alignItems="center" minH="2.75rem">
            Ver cuadrillas
          </Link>
        }
      >
        <Cargando
          carga={carga}
          esVacio={(d) => d.items.length === 0}
          vacio="Todavía no hay partes de las cuadrillas."
          hijos={(d) => (
            <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={2}>
              {ordenarNovedades(d.items)
                .slice(0, limite)
                .map((p) => {
                  const urgente = prioridadParte(p) < 2;
                  return (
                    <Box as="li" key={p.id} p={3} borderRadius="lg" border="1px solid" borderColor={urgente ? "alerta.300" : "borde"} bg={urgente ? "alerta.50" : "superficie"} data-testid="novedad-cuadrilla">
                      <Flex align="center" columnGap={2} rowGap={1} wrap="wrap">
                        <ChipParte parte={p} />
                        {p.tipo === "dificultad" && <Chip tono={p.resuelta ? "ok" : "alerta"}>{p.resuelta ? "Resuelta" : "Sin resolver"}</Chip>}
                        <Text as="time" dateTime={p.creado_en} textStyle="microdato" ml={{ md: "auto" }}>
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
                        <Text fontSize="sm" color="textoSuave" mt={0.5} overflowWrap="anywhere">
                          {truncar(p.observacion)}
                        </Text>
                      )}
                    </Box>
                  );
                })}
            </Box>
          )}
        />
        <Flex align="center" gap={1.5} mt={3} textStyle="microdato">
          <IconoBandeja tam="0.9rem" />
          Los partes se identifican por rol, no por nombre.
        </Flex>
      </Seccion>
    </div>
  );
}
