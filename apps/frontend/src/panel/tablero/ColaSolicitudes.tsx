import { Alert, AlertDescription, AlertIcon, Badge, Button, Flex, FormControl, FormLabel, Link, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaEstadoSolicitud, etiquetaOrigenSolicitud, etiquetaTipoSolicitud } from "../../lib/etiquetas";
import { hace, useAhora, useCargaViva } from "../../lib/vivo";
import { api } from "../api";
import { fmtNum, Seccion } from "../ui";

const ABIERTAS = "abiertas";

/**
 * Cola de pedidos de asistencia para el operador: la más antigua primero, con filtros por estado y sector que se
 * aplican en el servidor. Por defecto muestra las abiertas (todas menos las resueltas).
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
    <Seccion titulo="Cola de pedidos" categoria="SIMULADO" id="tab-cola" derecha={<Link as={RouterLink} to={enlace} fontSize="sm" fontWeight={600} color="primarioHover">Atender en Solicitudes y cuadrillas</Link>}>
      <Flex gap={3} wrap="wrap" mb={3}>
        <FormControl w="12rem">
          <FormLabel htmlFor="cola-estado" fontSize="sm" mb={0}>
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
          <FormLabel htmlFor="cola-sector" fontSize="sm" mb={0}>
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
        <TablaDesplazable etiqueta="Cola de pedidos, del más antiguo al más nuevo">
          <Table size="sm" aria-label="Cola de pedidos">
            <Thead>
              <Tr>
                <Th>Espera</Th>
                <Th>Tipo</Th>
                <Th>Canal</Th>
                <Th>Sector</Th>
                <Th isNumeric>Personas</Th>
                <Th isNumeric>Animales</Th>
                <Th>Estado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filas.map((s) => (
                <Tr key={s.id} data-testid={`cola-${s.id}`}>
                  <Td>{hace(ahora - new Date(s.creado_en).getTime()).replace("hace ", "")}</Td>
                  <Td>{etiquetaTipoSolicitud(s.tipo)}</Td>
                  <Td>{etiquetaOrigenSolicitud(s.origen)}</Td>
                  <Td>{s.sector_id ?? "—"}</Td>
                  <Td isNumeric>{fmtNum(s.personas)}</Td>
                  <Td isNumeric>{fmtNum(s.animales)}</Td>
                  <Td>
                    <Badge>{etiquetaEstadoSolicitud(s.estado)}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )}
      {hayMas && (
        <Text fontSize="xs" color="textoSuave" mt={2}>
          Se muestran los primeros {carga.datos?.solicitudes.length} de {fmtNum(carga.datos?.total)}; el resto está en Solicitudes y cuadrillas.
        </Text>
      )}
      {carga.error !== null && carga.datos !== null && (
        <Text fontSize="xs" color="textoSuave" mt={2}>
          No se pudo actualizar la cola; se muestra la última lectura.
        </Text>
      )}
    </Seccion>
  );
}
