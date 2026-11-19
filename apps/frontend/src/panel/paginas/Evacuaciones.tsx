import { Alert, AlertDescription, AlertIcon, Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VisuallyHidden } from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { ESTADO_EVACUACION, etiquetaRespuestaConfirmacion, fechaHora } from "../../lib/etiquetas";
import { hace, useAhora, useCargaViva } from "../../lib/vivo";
import { api } from "../api";
import { ChipEvacuacion } from "../evacuaciones/ChipEvacuacion";
import { DetalleEvacuacion } from "../evacuaciones/DetalleEvacuacion";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { Evacuacion } from "../tipos";
import { fmtNum, Seccion } from "../ui";

const SECTORES = ["S1", "S2", "S3", "S4"];

/** Evacuaciones con su constancia y la confirmación del evacuado. La ubicación solo la ven los roles operativos (lo hace cumplir la API). */
export default function Evacuaciones() {
  const senal = useSenalTiempoReal();
  const [estado, setEstado] = useState("");
  const [sector, setSector] = useState("");
  const [cuadrilla, setCuadrilla] = useState("");
  const [soloDiscrepancias, setSoloDiscrepancias] = useState(false);
  const [elegida, setElegida] = useState<number | null>(null);
  const carga = useCargaViva(() => api.evacuaciones({ estado: estado || undefined, sector_id: sector || undefined, limite: 200 }), { senal, clave: `${estado}|${sector}` });
  const centros = useCargaViva(() => api.centros(), { cadaMs: 10 * 60_000 });
  const ahora = useAhora();

  const todas = useMemo(() => carga.datos?.evacuaciones ?? [], [carga.datos]);
  const cuadrillas = useMemo(() => [...new Map(todas.filter((x) => x.cuadrilla_id !== null).map((x) => [x.cuadrilla_id as number, x.cuadrilla_nombre ?? `Cuadrilla ${x.cuadrilla_id}`])).entries()], [todas]);
  const filas = useMemo(() => todas.filter((x) => (!cuadrilla || String(x.cuadrilla_id) === cuadrilla) && (!soloDiscrepancias || x.estado === "con_discrepancia")), [todas, cuadrilla, soloDiscrepancias]);
  const seleccionada: Evacuacion | null = todas.find((x) => x.tarea_id === elegida) ?? null;
  const discrepancias = todas.filter((x) => x.estado === "con_discrepancia").length;

  return (
    <>
      <Heading as="h1" size="lg" mb={1}>
        Evacuaciones
      </Heading>
      <Flex align="center" gap={2} mb={4} wrap="wrap">
        <Insignia categoria="SIMULADO" />
        <Text fontSize="sm" color="textoSuave">
          Qué cerró cada cuadrilla y qué confirmó la persona evacuada. La ubicación es solo para roles operativos y cada consulta queda registrada.
        </Text>
      </Flex>

      <Seccion titulo="Lista de evacuaciones" categoria="SIMULADO" id="sec-evacuaciones" derecha={<Text fontSize="xs" color="textoSuave">{carga.actualizadoEn === null ? "" : `Actualizado ${hace(ahora - carga.actualizadoEn)}`}</Text>}>
        <Flex gap={3} wrap="wrap" mb={3} align="flex-end">
          <FormControl w="15rem">
            <FormLabel htmlFor="ev-estado" fontSize="sm" mb={0}>
              Estado
            </FormLabel>
            <Select id="ev-estado" size="sm" bg="superficie" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ESTADO_EVACUACION).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl w="9rem">
            <FormLabel htmlFor="ev-sector" fontSize="sm" mb={0}>
              Sector
            </FormLabel>
            <Select id="ev-sector" size="sm" bg="superficie" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">Todos</option>
              {SECTORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl w="14rem">
            <FormLabel htmlFor="ev-cuadrilla" fontSize="sm" mb={0}>
              Cuadrilla
            </FormLabel>
            <Select id="ev-cuadrilla" size="sm" bg="superficie" value={cuadrilla} onChange={(e) => setCuadrilla(e.target.value)}>
              <option value="">Todas</option>
              {cuadrillas.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </Select>
          </FormControl>
          <Checkbox size="sm" isChecked={soloDiscrepancias} onChange={(e) => setSoloDiscrepancias(e.target.checked)}>
            Solo las que hay que revisar{discrepancias > 0 ? ` (${discrepancias})` : ""}
          </Checkbox>
        </Flex>

        {carga.cargando && (
          <Flex role="status" aria-label="Cargando" py={6} justify="center">
            <Spinner />
          </Flex>
        )}
        {!carga.cargando && carga.datos === null && (
          <Box>
            <AlertaError error={carga.error} />
            <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
              Reintentar
            </Button>
          </Box>
        )}
        {carga.datos && filas.length === 0 && (
          <Alert status="info" variant="subtle">
            <AlertIcon />
            <AlertDescription>No hay evacuaciones con esos filtros.</AlertDescription>
          </Alert>
        )}
        {carga.datos && filas.length > 0 && (
          <TablaDesplazable etiqueta="Evacuaciones">
            <Table size="sm" aria-label="Evacuaciones">
              <Thead>
                <Tr>
                  <Th>Tarea</Th>
                  <Th>Sector</Th>
                  <Th>Cuadrilla</Th>
                  <Th>Estado</Th>
                  <Th isNumeric>Personas</Th>
                  <Th>Confirmó</Th>
                  <Th>Actualizada</Th>
                  <Th>
                    <VisuallyHidden>Detalle</VisuallyHidden>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {filas.map((x) => (
                  <Tr key={x.tarea_id} data-testid={`evac-${x.tarea_id}`} bg={x.estado === "con_discrepancia" ? "evacuacion.50" : undefined}>
                    <Td whiteSpace="normal">{x.titulo}</Td>
                    <Td>{x.sector_id ?? "—"}</Td>
                    <Td>{x.cuadrilla_nombre ?? "sin cuadrilla"}</Td>
                    <Td>
                      <ChipEvacuacion estado={x.estado} />
                    </Td>
                    <Td isNumeric>{x.constancia ? fmtNum(x.constancia.personas_trasladadas) : "—"}</Td>
                    <Td>{x.confirmacion?.respuesta ? etiquetaRespuestaConfirmacion(x.confirmacion.respuesta) : "—"}</Td>
                    <Td>{fechaHora(x.actualizado_en)}</Td>
                    <Td>
                      <Button size="xs" variant="outline" onClick={() => setElegida(x.tarea_id)} aria-label={`Ver detalle de la tarea ${x.tarea_id}`}>
                        Ver detalle
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TablaDesplazable>
        )}
        {carga.datos && carga.datos.total > carga.datos.evacuaciones.length && (
          <Text fontSize="xs" color="textoSuave" mt={2}>
            Se muestran las primeras {carga.datos.evacuaciones.length} de {fmtNum(carga.datos.total)}; usá los filtros para acotar.
          </Text>
        )}
        {carga.error !== null && carga.datos !== null && (
          <Text fontSize="xs" color="textoSuave" mt={2}>
            No se pudo actualizar la lista; se muestra la última lectura.
          </Text>
        )}
      </Seccion>

      <DetalleEvacuacion evacuacion={seleccionada} centros={centros.datos?.centros ?? []} alCerrar={() => setElegida(null)} alCambiar={carga.recargar} />
    </>
  );
}
