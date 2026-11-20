import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Link, Select, Spinner, Text } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { useMemo, useState, type ReactElement } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { IconoBandeja, IconoPersonas, IconoReloj, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { etiquetaEstadoSolicitud, etiquetaOrigenSolicitud, etiquetaTipoSolicitud } from "../../lib/etiquetas";
import { hace, useAhora, useCargaViva } from "../../lib/vivo";
import { api } from "../api";
import { Chip, fmtNum, Seccion, type TonoChip } from "../ui";

const ABIERTAS = "abiertas";

const ESTADO_CHIP: Record<string, { tono: TonoChip; icono: ReactElement }> = {
  recibida: { tono: "aviso", icono: <IconoTriangulo tam="1em" /> },
  verificada: { tono: "info", icono: <IconoTilde tam="1em" /> },
  asignada: { tono: "info", icono: <IconoPersonas tam="1em" /> },
  en_curso: { tono: "info", icono: <IconoReloj tam="1em" /> },
  resuelta: { tono: "ok", icono: <IconoTilde tam="1em" /> },
};

/**
 * Cola de pedidos de asistencia para el operador: la más antigua primero, con filtros por estado y sector que se
 * aplican en el servidor. Por defecto muestra las abiertas (todas menos las resueltas). Cada pedido es una fila que se
 * apila en pantallas angostas, así no hay desplazamiento horizontal.
 */
export function ColaSolicitudes({ senal }: { senal: number }) {
  const [estado, setEstado] = useState<string>(ABIERTAS);
  const [sector, setSector] = useState("");
  const carga = useCargaViva(() => api.solicitudes({ estado: estado === ABIERTAS ? undefined : estado, sector_id: sector || undefined, limite: 50 }), { senal, clave: `${estado}|${sector}` });
  const ahora = useAhora();

  const filas = useMemo(() => {
    const lista = carga.datos?.solicitudes ?? [];
    return lista
      .filter((s) => estado !== ABIERTAS || s.estado !== "resuelta")
      .sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
  }, [carga.datos, estado]);

  const hayMas = (carga.datos?.total ?? 0) > (carga.datos?.solicitudes.length ?? 0);
  const enlace = `/comando/operacion${estado !== ABIERTAS || sector ? `?${new URLSearchParams({ ...(estado !== ABIERTAS ? { estado } : {}), ...(sector ? { sector } : {}) }).toString()}` : ""}`;

  return (
    <Seccion
      titulo="Cola de pedidos"
      categoria="SIMULADO"
      id="tab-cola"
      icono={<IconoBandeja />}
      derecha={
        <Link as={RouterLink} to={enlace} fontSize="sm" fontWeight={600} color="primarioHover">
          Atender en Solicitudes y cuadrillas
        </Link>
      }
    >
      <Flex gap={3} wrap="wrap" mb={4}>
        <FormControl w="13rem">
          <FormLabel htmlFor="cola-estado" fontSize="sm" mb={0.5}>
            Estado
          </FormLabel>
          <Select id="cola-estado" size="sm" bg="superficie" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value={ABIERTAS}>Abiertas (sin resolver)</option>
            {ESTADOS_SOLICITUD.map((e) => (
              <option key={e} value={e}>
                {etiquetaEstadoSolicitud(e)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="10rem">
          <FormLabel htmlFor="cola-sector" fontSize="sm" mb={0.5}>
            Sector
          </FormLabel>
          <Select id="cola-sector" size="sm" bg="superficie" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Todos</option>
            {["S1", "S2", "S3", "S4"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>
      {carga.cargando && (
        <Flex role="status" aria-label="Cargando" py={4} justify="center">
          <Spinner />
        </Flex>
      )}
      {!carga.cargando && carga.datos === null && (
        <>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </>
      )}
      {carga.datos && filas.length === 0 && (
        <Alert status="info" variant="subtle">
          <AlertIcon />
          <AlertDescription>No hay pedidos con esos filtros.</AlertDescription>
        </Alert>
      )}
      {carga.datos && filas.length > 0 && (
        <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Cola de pedidos, del más antiguo al más nuevo" borderTop="1px solid" borderColor="pizarra.100">
          {filas.map((s) => {
            const espera = hace(ahora - new Date(s.creado_en).getTime()).replace("hace ", "");
            const chip = ESTADO_CHIP[s.estado] ?? { tono: "neutro" as TonoChip, icono: <IconoBandeja tam="1em" /> };
            return (
              <Box
                as="li"
                key={s.id}
                data-testid={`cola-${s.id}`}
                display="grid"
                alignItems="center"
                columnGap={4}
                rowGap={1}
                py={3}
                borderBottom="1px solid"
                borderColor="pizarra.100"
                gridTemplateColumns={{ base: "1fr auto", md: "7.5rem minmax(0, 1fr) 3rem 12.5rem 8.5rem" }}
              >
                <Text as="span" fontWeight={700} fontSize="sm" display="inline-flex" alignItems="center" gap={1.5} sx={{ fontVariantNumeric: "tabular-nums" }} title="Tiempo de espera">
                  <Box as="span" color="textoSuave" display="inline-flex">
                    <IconoReloj tam="1rem" />
                  </Box>
                  {espera}
                </Text>
                <Box as="span" gridColumn={{ base: "1 / -1", md: "auto" }} gridRow={{ base: 2, md: "auto" }} minW={0} fontSize="sm">
                  <strong>{etiquetaTipoSolicitud(s.tipo)}</strong>
                  <Text as="span" color="textoSuave">
                    {" "}
                    · {etiquetaOrigenSolicitud(s.origen)}
                  </Text>
                </Box>
                <Box as="span" display={{ base: "none", md: "block" }}>
                  <Chip tono="neutro">{s.sector_id ?? "—"}</Chip>
                </Box>
                <Text as="span" fontSize="sm" gridColumn={{ base: "1 / -1", md: "auto" }} gridRow={{ base: 3, md: "auto" }} color="textoSuave" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.sector_id && (
                    <Box as="span" display={{ base: "inline", md: "none" }}>
                      {s.sector_id} ·{" "}
                    </Box>
                  )}
                  <strong style={{ color: "var(--chakra-colors-texto)" }}>{fmtNum(s.personas)}</strong> personas · <strong style={{ color: "var(--chakra-colors-texto)" }}>{fmtNum(s.animales)}</strong> animales
                </Text>
                <Box as="span" justifySelf="end" gridColumn={{ base: 2, md: "auto" }} gridRow={{ base: 1, md: "auto" }}>
                  <Chip tono={chip.tono} icono={chip.icono}>
                    {etiquetaEstadoSolicitud(s.estado)}
                  </Chip>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      {hayMas && (
        <Text textStyle="microdato" mt={3}>
          Se muestran los primeros {carga.datos?.solicitudes.length} de {fmtNum(carga.datos?.total)}; el resto está en Solicitudes y cuadrillas.
        </Text>
      )}
      {carga.error !== null && carga.datos !== null && (
        <Text textStyle="microdato" mt={3}>
          No se pudo actualizar la cola; se muestra la última lectura.
        </Text>
      )}
    </Seccion>
  );
}
