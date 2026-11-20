import { Badge, Box, Button, Flex, FormControl, FormLabel, Heading, Input, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import type { Cuadrilla, Solicitud, Tarea } from "../tipos";
import { AvisoAtencion } from "../cuadrillas/TarjetaCuadrilla";
import { HistorialPartes } from "../cuadrillas/HistorialPartes";
import { ChipParte } from "../cuadrillas/partes";
import { Cargando, fmtNum, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaEstadoSolicitud, etiquetaEstadoTarea, etiquetaOrigenSolicitud, etiquetaRolOperativo, etiquetaTipoSolicitud } from "../../lib/etiquetas";

const TIPO_INCIDENTE = { humana: "Humana y servicios", ganadera: "Ganadera", apicola: "Apícola" } as const;
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

function BloqueCuadrillas({ carga }: { carga: ReturnType<typeof useCarga<{ cuadrillas: Cuadrilla[] }>> }) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<keyof typeof TIPO_INCIDENTE>("humana");
  const [error, setError] = useState<unknown>(null);

  async function crear() {
    setError(null);
    try {
      await api.crearCuadrilla({ nombre: nombre.trim(), tipo_incidente: tipo });
      toast({ title: "Cuadrilla creada", description: nombre, status: "success", duration: 3000 });
      setNombre("");
      carga.recargar();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Seccion titulo="Cuadrillas" categoria="SIMULADO" id="sec-cuadrillas">
      <Cargando carga={carga} esVacio={(d) => d.cuadrillas.length === 0} vacio="Todavía no hay cuadrillas. Creá una abajo." hijos={(d) => (
        <TablaDesplazable etiqueta="Cuadrillas" mb={3}>
          <Table size="sm" aria-label="Cuadrillas">
            <Thead>
              <Tr>
                <Th>Cuadrilla</Th>
                <Th>Tipo</Th>
                <Th>Integrantes (rol)</Th>
                <Th>Roles faltantes de la plantilla</Th>
              </Tr>
            </Thead>
            <Tbody>
              {d.cuadrillas.map((c) => (
                <Tr key={c.id}>
                  <Td>{c.nombre}</Td>
                  <Td>{TIPO_INCIDENTE[c.tipo_incidente as keyof typeof TIPO_INCIDENTE] ?? c.tipo_incidente}</Td>
                  <Td whiteSpace="normal">{c.integrantes.map((i) => etiquetaRolOperativo(i.rol_operativo)).join(", ") || "sin integrantes"}</Td>
                  <Td whiteSpace="normal">{c.roles_faltantes.join(", ") || "plantilla completa"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )} />
      <Flex gap={2} align="flex-end" wrap="wrap">
        <FormControl w="14rem">
          <FormLabel htmlFor="cuadrilla-nombre" fontSize="sm" mb={0}>
            Nombre de la cuadrilla
          </FormLabel>
          <Input id="cuadrilla-nombre" size="sm" bg="superficie" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </FormControl>
        <FormControl w="12rem">
          <FormLabel htmlFor="cuadrilla-tipo" fontSize="sm" mb={0}>
            Tipo de incidente
          </FormLabel>
          <Select id="cuadrilla-tipo" size="sm" bg="superficie" value={tipo} onChange={(e) => setTipo(e.target.value as keyof typeof TIPO_INCIDENTE)}>
            {Object.entries(TIPO_INCIDENTE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FormControl>
        <Button size="sm" onClick={() => void crear()} isDisabled={nombre.trim().length < 2}>
          Crear cuadrilla
        </Button>
      </Flex>
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
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
    <Seccion titulo="Tareas de cuadrillas" categoria="SIMULADO" id="sec-tareas">
      <Cargando carga={carga} esVacio={(d) => d.tareas.length === 0} vacio="No hay tareas. Se crean al emitir una orden o asignar una solicitud." hijos={(d) => (
        <TablaDesplazable etiqueta="Tareas">
          <Table size="sm" aria-label="Tareas">
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
                  <Td whiteSpace="normal">{t.titulo}</Td>
                  <Td>{t.sector_id ?? "—"}</Td>
                  <Td whiteSpace="normal">
                    <Flex direction="column" align="flex-start" gap={1}>
                      <Badge>{etiquetaEstadoTarea(t.estado)}</Badge>
                      {t.requiere_atencion && <AvisoAtencion />}
                      {t.ultimo_parte && <ChipParte parte={t.ultimo_parte} />}
                    </Flex>
                  </Td>
                  <Td>
                    <Select aria-label={`Cuadrilla de la tarea ${t.id}`} size="xs" bg="superficie" value={t.cuadrilla_id ?? ""} placeholder="Sin asignar" onChange={(e) => e.target.value && void cambiar(t, { cuadrilla_id: Number(e.target.value) })}>
                      {cuadrillas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Flex gap={1}>
                      {(SIGUIENTE_TAREA[t.estado] ?? []).map((a) => (
                        <Button key={a.estado} size="xs" variant="outline" onClick={() => void cambiar(t, { estado: a.estado })}>
                          {a.texto}
                        </Button>
                      ))}
                    </Flex>
                  </Td>
                  <Td>
                    <Button size="xs" variant="outline" aria-expanded={abiertas.includes(t.id)} aria-controls={`partes-tarea-${t.id}`} onClick={() => alternar(t.id)} aria-label={`${abiertas.includes(t.id) ? "Ocultar" : "Ver"} partes de la tarea ${t.id}`}>
                      {abiertas.includes(t.id) ? "Ocultar partes" : "Ver partes"}
                    </Button>
                  </Td>
                </Tr>
                {abiertas.includes(t.id) && (
                  <Tr>
                    <Td colSpan={6} whiteSpace="normal">
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
    <Seccion titulo="Cola de solicitudes de asistencia" categoria="SIMULADO" id="sec-solicitudes" derecha={
      <Select aria-label="Cuadrilla para asignar" size="xs" bg="superficie" placeholder="Cuadrilla al asignar" value={cuadrilla} onChange={(e) => setCuadrilla(e.target.value)}>
        {cuadrillas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Select>
    }>
      <Flex gap={3} wrap="wrap" mb={3}>
        <FormControl w="12rem">
          <FormLabel htmlFor="op-filtro-estado" fontSize="sm" mb={0}>
            Estado
          </FormLabel>
          <Select id="op-filtro-estado" size="sm" bg="superficie" value={estadoFiltro} onChange={(e) => cambiarFiltro("estado", e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_SOLICITUD.map((e) => (
              <option key={e} value={e}>
                {etiquetaEstadoSolicitud(e)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="10rem">
          <FormLabel htmlFor="op-filtro-sector" fontSize="sm" mb={0}>
            Sector
          </FormLabel>
          <Select id="op-filtro-sector" size="sm" bg="superficie" value={sectorFiltro} onChange={(e) => cambiarFiltro("sector", e.target.value)}>
            <option value="">Todos</option>
            {["S1", "S2", "S3", "S4"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>
      <Cargando carga={carga} esVacio={(d) => d.solicitudes.length === 0} vacio={estadoFiltro || sectorFiltro ? "No hay solicitudes con esos filtros." : "No hay solicitudes en la cola."} hijos={(d) => (
        <TablaDesplazable etiqueta="Solicitudes">
          <Table size="sm" aria-label="Solicitudes">
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
                    <Td>{s.id}</Td>
                    <Td>{etiquetaTipoSolicitud(s.tipo)}</Td>
                    <Td>{etiquetaOrigenSolicitud(s.origen)}</Td>
                    <Td>{s.sector_id ?? "—"}</Td>
                    <Td isNumeric>{fmtNum(s.personas)}</Td>
                    <Td isNumeric>{fmtNum(s.animales)}</Td>
                    <Td>
                      <Badge>{etiquetaEstadoSolicitud(s.estado)}</Badge>
                    </Td>
                    <Td>
                      {sig ? (
                        <Button size="xs" variant="outline" onClick={() => void avanzar(s, sig)}>
                          {etiquetaEstadoSolicitud(sig)}
                        </Button>
                      ) : (
                        "Resuelta"
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
      <Heading as="h1" size="lg" mb={1}>
        Solicitudes y cuadrillas
      </Heading>
      <Flex align="center" gap={2} mb={4}>
        <Insignia categoria="SIMULADO" />
        <Text fontSize="sm" color="textoSuave">
          Solicitudes, cuadrillas y tareas de demostración, con roles en lugar de nombres.
        </Text>
      </Flex>
      <BloqueSolicitudes cuadrillas={lista} />
      <BloqueTareas cuadrillas={lista} />
      <BloqueCuadrillas carga={cuadrillas} />
    </>
  );
}
