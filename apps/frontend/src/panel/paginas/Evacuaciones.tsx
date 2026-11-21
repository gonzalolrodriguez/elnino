import { Box, Button, Flex, Table, Tbody, Td, Text, Th, Thead, Tr, VisuallyHidden } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError, CampoSelect } from "../../components/Formulario";
import { EstadoCargando } from "../../components/EstadoCargando";
import { IconoCamion } from "../../components/iconos/Iconos";
import { Opcion } from "../../components/Opcion";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { ESTADO_EVACUACION, fechaHora } from "../../lib/etiquetas";
import { hace, useAhora, useCargaViva } from "../../lib/vivo";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { TACTIL } from "../cuadrillas/partes";
import { ChipEvacuacion } from "../evacuaciones/ChipEvacuacion";
import { DetalleEvacuacion } from "../evacuaciones/DetalleEvacuacion";
import { RespuestaConfirmacionTexto } from "../evacuaciones/RespuestaConfirmacion";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { EstadoEvacuacion, Evacuacion } from "../tipos";
import { APILAR, fmtNum, Seccion } from "../ui";

const SECTORES = ["S1", "S2", "S3", "S4"];

/** Qué quiere decir cada estado, en el orden en que una evacuación los recorre. */
const SIGNIFICADO: { estado: EstadoEvacuacion; texto: string }[] = [
  { estado: "pendiente", texto: "La tarea de traslado existe pero la cuadrilla todavía no salió." },
  { estado: "en_curso", texto: "La cuadrilla está trasladando a las personas o a los animales." },
  { estado: "cerrada_cuadrilla", texto: "La cuadrilla cerró la tarea con su constancia; falta que la persona evacuada confirme." },
  { estado: "verificada", texto: "La persona evacuada confirmó que llegó y la constancia coincide." },
  { estado: "con_discrepancia", texto: "La constancia y la confirmación no coinciden: conviene revisarla." },
];

/** Estado vacío: dice por qué no hay nada y cuál es el próximo paso, con la leyenda de estados para entender lo que va a aparecer. */
function SinEvacuaciones({ hayFiltros, alQuitarFiltros }: { hayFiltros: boolean; alQuitarFiltros: () => void }) {
  if (hayFiltros) {
    return (
      <Flex direction="column" align="flex-start" gap={2} p={4} bg="fondo" borderRadius="xl" border="1px dashed" borderColor="bordeControl" data-testid="evacuaciones-vacia">
        <Text fontWeight={700}>No hay evacuaciones con esos filtros.</Text>
        <Text textStyle="microdato">Probá con otro estado, sector o cuadrilla.</Text>
        <Button size="sm" variant="outline" {...TACTIL} onClick={alQuitarFiltros}>
          Quitar los filtros
        </Button>
      </Flex>
    );
  }
  return (
    <Box data-testid="evacuaciones-vacia">
      <Flex direction="column" align="flex-start" gap={2} p={4} bg="fondo" borderRadius="xl" border="1px dashed" borderColor="bordeControl">
        <Text fontWeight={700}>Todavía no hay evacuaciones registradas.</Text>
        <Text maxW="70ch">
          Una evacuación aparece acá cuando una cuadrilla cierra una tarea de traslado con su constancia (destino, personas y fotos). Después, la persona evacuada confirma si llegó.
        </Text>
        <Button as={RouterLink} to="/comando/operacion#sec-tareas" size="sm" {...TACTIL}>
          Ver las tareas de las cuadrillas
        </Button>
      </Flex>
      <Text as="h3" textStyle="tituloBloque" mt={5} mb={3}>
        Qué va a mostrar cada estado
      </Text>
      <Box as="ul" listStyleType="none" m={0} p={0} display="grid" gap={2}>
        {SIGNIFICADO.map((s) => (
          <Flex as="li" key={s.estado} align="center" columnGap={3} rowGap={1} wrap="wrap">
            <Box flex="0 0 17rem" maxW="100%">
              <ChipEvacuacion estado={s.estado} />
            </Box>
            <Text textStyle="microdato" flex="1 1 16rem">
              {s.texto}
            </Text>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}

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
  const hayFiltros = Boolean(estado || sector || cuadrilla || soloDiscrepancias);
  const quitarFiltros = () => {
    setEstado("");
    setSector("");
    setCuadrilla("");
    setSoloDiscrepancias(false);
  };

  return (
    <>
      <CabeceraPagina
        titulo="Evacuaciones"
        icono={<IconoCamion tam="1.5rem" />}
        categoria="SIMULADO"
        ayuda="Qué cerró cada cuadrilla y qué confirmó la persona evacuada. La ubicación es solo para roles operativos y cada consulta queda registrada."
        actualizado={carga.actualizadoEn === null ? undefined : `Actualizado ${hace(ahora - carga.actualizadoEn)}`}
      />

      <Seccion
        titulo="Lista de evacuaciones"
        id="sec-evacuaciones"
        icono={<IconoCamion tam="1.25rem" />}
        derecha={carga.datos ? `${fmtNum(carga.datos.total)} en total${discrepancias > 0 ? `, ${fmtNum(discrepancias)} para revisar` : ""}` : undefined}
      >
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr)) minmax(0, 1.2fr)" }} columnGap={4} rowGap={3} alignItems="end" mb={4}>
          <CampoSelect id="ev-estado" etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ESTADO_EVACUACION).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect id="ev-sector" etiqueta="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Todos</option>
            {SECTORES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect id="ev-cuadrilla" etiqueta="Cuadrilla" value={cuadrilla} onChange={(e) => setCuadrilla(e.target.value)}>
            <option value="">Todas</option>
            {cuadrillas.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </CampoSelect>
          <Opcion etiqueta={`Solo las que hay que revisar${discrepancias > 0 ? ` (${discrepancias})` : ""}`} isChecked={soloDiscrepancias} onChange={setSoloDiscrepancias} />
        </Box>

        {carga.cargando && <EstadoCargando />}
        {!carga.cargando && carga.datos === null && (
          <Box>
            <AlertaError error={carga.error} />
            <Button mt={2} size="sm" variant="outline" {...TACTIL} onClick={carga.recargar}>
              Reintentar
            </Button>
          </Box>
        )}
        {carga.datos && filas.length === 0 && <SinEvacuaciones hayFiltros={hayFiltros} alQuitarFiltros={quitarFiltros} />}
        {carga.datos && filas.length > 0 && (
          <TablaDesplazable etiqueta="Evacuaciones">
            <Table size="sm" aria-label="Evacuaciones" sx={APILAR}>
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
                    <Td whiteSpace="normal" minW="9rem" fontWeight={600}>
                      {x.titulo}
                    </Td>
                    <Td data-etiqueta="Sector">{x.sector_id ?? "—"}</Td>
                    <Td data-etiqueta="Cuadrilla">{x.cuadrilla_nombre ?? "sin cuadrilla"}</Td>
                    <Td data-etiqueta="Estado" maxW="14rem">
                      <ChipEvacuacion estado={x.estado} />
                    </Td>
                    <Td isNumeric data-etiqueta="Personas">
                      {x.constancia ? fmtNum(x.constancia.personas_trasladadas) : "—"}
                    </Td>
                    <Td data-etiqueta="Confirmó">{x.confirmacion?.respuesta ? <RespuestaConfirmacionTexto respuesta={x.confirmacion.respuesta} /> : "—"}</Td>
                    <Td data-etiqueta="Actualizada">{fechaHora(x.actualizado_en)}</Td>
                    <Td>
                      <Button size="sm" variant="outline" {...TACTIL} onClick={() => setElegida(x.tarea_id)} aria-label={`Ver detalle de la tarea ${x.tarea_id}`}>
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
          <Text textStyle="microdato" mt={2}>
            Se muestran las primeras {carga.datos.evacuaciones.length} de {fmtNum(carga.datos.total)}; usá los filtros para acotar.
          </Text>
        )}
        {carga.error !== null && carga.datos !== null && (
          <Text textStyle="microdato" mt={2}>
            No se pudo actualizar la lista; se muestra la última lectura.
          </Text>
        )}
      </Seccion>

      <DetalleEvacuacion evacuacion={seleccionada} centros={centros.datos?.centros ?? []} alCerrar={() => setElegida(null)} alCambiar={carga.recargar} />
    </>
  );
}
