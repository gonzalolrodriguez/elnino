import { Box, Button, Flex, FormControl, FormLabel, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { Fragment, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { IconoBandeja, IconoCamion, IconoPersonas, IconoTilde, IconoReloj } from "../../components/iconos/Iconos";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaEstadoSolicitud, etiquetaOrigenSolicitud, etiquetaTipoSolicitud } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { AvisoAtencion, ChipEstadoTarea, ChipParte, TACTIL } from "../cuadrillas/partes";
import { HistorialPartes } from "../cuadrillas/HistorialPartes";
import type { Cuadrilla, Solicitud, Tarea } from "../tipos";
import { APILAR, Cargando, Chip, fmtNum, Seccion, type TonoChip } from "../ui";

const SIGUIENTE_TAREA: Record<string, { estado: string; texto: string }[]> = {
  pendiente: [
    { estado: "en_curso", texto: "Iniciar" },
    { estado: "cancelada", texto: "Cancelar" },
  ],
  en_curso: [
    { estado: "completada", texto: "Completar" },
    { estado: "cancelada", texto: "Cancelar" },
  ],
};
/** Estas tablas tienen muchas columnas: se apilan por debajo de 80 em (1280 px), porque el menú lateral le quita ancho a la página. */
const BASE_APILAR = APILAR["@media (max-width: 47.99em)"];
const APILAR_PANEL = {
  "@media (max-width: 79.99em)": { ...BASE_APILAR, "tbody tr": { ...BASE_APILAR["tbody tr"], gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, 1fr))" } },
} as const;
const TONO_SOLICITUD: Record<string, TonoChip> = { recibida: "aviso", verificada: "info", asignada: "info", en_curso: "info", resuelta: "ok" };

/** Las cuadrillas se arman, editan y siguen en su propio módulo; acá quedan las tareas y las solicitudes. */
function BloqueCuadrillas({ cuadrillas }: { cuadrillas: Cuadrilla[] }) {
  return (
    <Seccion titulo="Cuadrillas" categoria="SIMULADO" id="sec-cuadrillas" icono={<IconoPersonas tam="1.25rem" />}>
      <Text fontSize="sm" mb={3}>
        Hay {cuadrillas.length} {cuadrillas.length === 1 ? "cuadrilla" : "cuadrillas"} cargadas. Para crear una, editar su equipo, equipamiento y vehículo, seguir su recorrido o mandarle avisos, usá el módulo de cuadrillas.
      </Text>
      <Button as={RouterLink} to="/comando/cuadrillas" size="sm" {...TACTIL}>
        Ir a gestión de cuadrillas
      </Button>
    </Seccion>
  );
}

function BloqueTareas({ cuadrillas }: { cuadrillas: Cuadrilla[] }) {
  const carga = useCarga(() => api.tareas());
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);
  // `?tarea=N` (enlace desde «Cuadrillas») deja abierto el historial de partes de esa tarea.
  const [params] = useSearchParams();
  const [abiertas, setAbiertas] = useState<number[]>(() => (params.get("tarea") ? [Number(params.get("tarea"))] : []));
  const alternar = (id: number) => setAbiertas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  async function cambiar(t: Tarea, c: { estado?: string; cuadrilla_id?: number }) {
    setError(null);
    try {
      await api.actualizarTarea(t.id, c);
      toast({ title: "Tarea actualizada", status: "success", duration: 2500 });
      carga.recargar();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Seccion titulo="Tareas de cuadrillas" categoria="SIMULADO" id="sec-tareas" icono={<IconoCamion tam="1.25rem" />}>
      <Cargando carga={carga} esVacio={(d) => d.tareas.length === 0} vacio="No hay tareas. Se crean al emitir una orden o asignar una solicitud." hijos={(d) => (
        <TablaDesplazable etiqueta="Tareas">
          <Table size="sm" aria-label="Tareas" sx={APILAR_PANEL}>
            <Thead>
              <Tr>
                <Th>Tarea</Th>
                <Th>Sector</Th>
                <Th>Estado</Th>
                <Th>Cuadrilla</Th>
                <Th>Acciones</Th>
                <Th>Partes</Th>
              </Tr>
            </Thead>
            <Tbody>
              {d.tareas.map((t) => (
                <Fragment key={t.id}>
                  <Tr>
                    <Td whiteSpace="normal" maxW="22rem">{t.titulo}</Td>
                    <Td data-etiqueta="Sector">{t.sector_id ?? "—"}</Td>
                    <Td whiteSpace="normal" data-etiqueta="Estado">
                      <Flex direction="column" align="flex-start" gap={1}>
                        <ChipEstadoTarea estado={t.estado} />
                        {t.requiere_atencion && <AvisoAtencion />}
                        {t.ultimo_parte && <ChipParte parte={t.ultimo_parte} />}
                      </Flex>
                    </Td>
                    <Td data-etiqueta="Cuadrilla" sx={{ "@media (max-width: 79.99em)": { gridColumn: "1 / -1 !important" } }}>
                      <Select aria-label={`Cuadrilla de la tarea ${t.id}`} size="sm" minW="12rem" {...TACTIL} bg="superficie" value={t.cuadrilla_id ?? ""} placeholder="Sin asignar" onChange={(e) => e.target.value && void cambiar(t, { cuadrilla_id: Number(e.target.value) })}>
                        {cuadrillas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td data-etiqueta="Acciones">
                      <Flex gap={1.5} wrap="wrap">
                        {(SIGUIENTE_TAREA[t.estado] ?? []).map((a) => (
                          <Button key={a.estado} size="sm" {...TACTIL} variant="outline" aria-label={`${a.texto} la tarea ${t.id}`} onClick={() => void cambiar(t, { estado: a.estado })}>
                            {a.texto}
                          </Button>
                        ))}
                        {(SIGUIENTE_TAREA[t.estado] ?? []).length === 0 && <Text color="textoSuave">Sin acciones</Text>}
                      </Flex>
                    </Td>
                    <Td data-etiqueta="Partes">
                      <Button size="sm" {...TACTIL} variant="outline" aria-expanded={abiertas.includes(t.id)} aria-controls={`partes-tarea-${t.id}`} onClick={() => alternar(t.id)} aria-label={`${abiertas.includes(t.id) ? "Ocultar" : "Ver"} partes de la tarea ${t.id}`}>
                        {abiertas.includes(t.id) ? "Ocultar partes" : "Ver partes"}
                      </Button>
                    </Td>
                  </Tr>
                  {abiertas.includes(t.id) && (
                    <Tr>
                      <Td colSpan={6} whiteSpace="normal" id={`partes-tarea-${t.id}`}>
                        <HistorialPartes tareaId={t.id} requiereAtencion={t.requiere_atencion === true} alCambiar={carga.recargar} />
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )} />
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Seccion>
  );
}

function BloqueSolicitudes({ cuadrillas }: { cuadrillas: Cuadrilla[] }) {
  // Los filtros viven en la URL: el tablero enlaza acá con `?estado=recibida` o `?sector=S4`.
  const [params, setParams] = useSearchParams();
  const estadoFiltro = params.get("estado") ?? "";
  const sectorFiltro = params.get("sector") ?? "";
  const carga = useCarga(() => api.solicitudes({ estado: estadoFiltro || undefined, sector_id: sectorFiltro || undefined, limite: 200 }), [estadoFiltro, sectorFiltro]);
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);
  const [cuadrilla, setCuadrilla] = useState("");
  const cambiarFiltro = (clave: "estado" | "sector", valor: string) => {
    const nuevo = new URLSearchParams(params);
    if (valor) nuevo.set(clave, valor);
    else nuevo.delete(clave);
    setParams(nuevo, { replace: true });
  };

  async function avanzar(s: Solicitud, estado: string) {
    setError(null);
    try {
      await api.avanzarSolicitud(s.id, estado, estado === "asignada" && cuadrilla ? Number(cuadrilla) : undefined);
      toast({ title: `Solicitud ${s.id}: ${estado.replace("_", " ")}`, status: "success", duration: 2500 });
      carga.recargar();
    } catch (e) {
      setError(e);
    }
  }
  const siguiente = (e: string) => ESTADOS_SOLICITUD[ESTADOS_SOLICITUD.indexOf(e as (typeof ESTADOS_SOLICITUD)[number]) + 1];

  return (
    <Seccion titulo="Cola de solicitudes de asistencia" categoria="SIMULADO" id="sec-solicitudes" icono={<IconoBandeja tam="1.25rem" />}>
      <Flex gap={3} wrap="wrap" mb={4}>
        <FormControl w={{ base: "calc(50% - 0.375rem)", sm: "11rem" }}>
          <FormLabel htmlFor="op-filtro-estado" fontSize="sm" mb={1}>
            Estado
          </FormLabel>
          <Select id="op-filtro-estado" bg="superficie" value={estadoFiltro} onChange={(e) => cambiarFiltro("estado", e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_SOLICITUD.map((e) => (
              <option key={e} value={e}>
                {etiquetaEstadoSolicitud(e)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w={{ base: "calc(50% - 0.375rem)", sm: "9rem" }}>
          <FormLabel htmlFor="op-filtro-sector" fontSize="sm" mb={1}>
            Sector
          </FormLabel>
          <Select id="op-filtro-sector" bg="superficie" value={sectorFiltro} onChange={(e) => cambiarFiltro("sector", e.target.value)}>
            <option value="">Todos</option>
            {["S1", "S2", "S3", "S4"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w={{ base: "full", sm: "16rem" }} ml={{ sm: "auto" }}>
          <FormLabel htmlFor="op-cuadrilla-asignar" fontSize="sm" mb={1}>
            Cuadrilla para asignar
          </FormLabel>
          <Select id="op-cuadrilla-asignar" bg="superficie" placeholder="Elegir al pasar a «Asignada»" value={cuadrilla} onChange={(e) => setCuadrilla(e.target.value)}>
            {cuadrillas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>
      <Cargando carga={carga} esVacio={(d) => d.solicitudes.length === 0} vacio={estadoFiltro || sectorFiltro ? "No hay solicitudes con esos filtros." : "No hay solicitudes en la cola."} hijos={(d) => (
        <TablaDesplazable etiqueta="Solicitudes">
          <Table size="sm" aria-label="Solicitudes" sx={APILAR_PANEL}>
            <Thead>
              <Tr>
                <Th>N.º</Th>
                <Th>Tipo</Th>
                <Th>Origen</Th>
                <Th>Sector</Th>
                <Th isNumeric>Personas</Th>
                <Th isNumeric>Animales</Th>
                <Th>Estado</Th>
                <Th>Pasar a</Th>
              </Tr>
            </Thead>
            <Tbody>
              {d.solicitudes.map((s) => {
                const sig = siguiente(s.estado);
                return (
                  <Tr key={s.id}>
                    <Td>
                      <Text as="span" display={{ base: "inline", xl: "none" }}>
                        Solicitud n.º{" "}
                      </Text>
                      {s.id}
                    </Td>
                    <Td data-etiqueta="Tipo">{etiquetaTipoSolicitud(s.tipo)}</Td>
                    <Td data-etiqueta="Origen">{etiquetaOrigenSolicitud(s.origen)}</Td>
                    <Td data-etiqueta="Sector">{s.sector_id ?? "—"}</Td>
                    <Td isNumeric data-etiqueta="Personas">{fmtNum(s.personas)}</Td>
                    <Td isNumeric data-etiqueta="Animales">{fmtNum(s.animales)}</Td>
                    <Td data-etiqueta="Estado">
                      <Chip tono={TONO_SOLICITUD[s.estado] ?? "neutro"} icono={s.estado === "resuelta" ? <IconoTilde tam="0.9rem" /> : <IconoReloj tam="0.9rem" />}>
                        {etiquetaEstadoSolicitud(s.estado)}
                      </Chip>
                    </Td>
                    <Td data-etiqueta="Pasar a">
                      {sig ? (
                        <Button size="sm" {...TACTIL} variant="outline" aria-label={`Pasar la solicitud ${s.id} a ${etiquetaEstadoSolicitud(sig).toLowerCase()}`} onClick={() => void avanzar(s, sig)}>
                          {etiquetaEstadoSolicitud(sig)}
                        </Button>
                      ) : (
                        <Text color="textoSuave">Ya resuelta</Text>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )} />
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Seccion>
  );
}

export default function Operacion() {
  const cuadrillas = useCarga(() => api.cuadrillas());
  const lista = cuadrillas.datos?.cuadrillas ?? [];
  return (
    <>
      <CabeceraPagina
        titulo="Solicitudes y cuadrillas"
        icono={<IconoBandeja tam="1.5rem" />}
        categoria="SIMULADO"
        ayuda="Solicitudes, cuadrillas y tareas de demostración, con roles en lugar de nombres."
      />
      <BloqueSolicitudes cuadrillas={lista} />
      <BloqueTareas cuadrillas={lista} />
      <BloqueCuadrillas cuadrillas={lista} />
    </>
  );
}
