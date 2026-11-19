import { Badge, Box, Button, Flex, FormControl, FormLabel, Heading, Input, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import type { Cuadrilla, Solicitud, Tarea } from "../tipos";
import { Cargando, fmtNum, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";

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
                  <Td whiteSpace="normal">{c.integrantes.map((i) => i.rol_operativo).join(", ") || "sin integrantes"}</Td>
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
              </Tr>
            </Thead>
            <Tbody>
              {d.tareas.map((t) => (
                <Tr key={t.id}>
                  <Td whiteSpace="normal">{t.titulo}</Td>
                  <Td>{t.sector_id ?? "—"}</Td>
                  <Td>
                    <Badge>{t.estado.replace("_", " ")}</Badge>
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
                </Tr>
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
  const carga = useCarga(() => api.solicitudes());
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);
  const [cuadrilla, setCuadrilla] = useState("");

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
      <Cargando carga={carga} esVacio={(d) => d.solicitudes.length === 0} vacio="No hay solicitudes en la cola." hijos={(d) => (
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
                    <Td>{s.tipo}</Td>
                    <Td>{s.origen}</Td>
                    <Td>{s.sector_id ?? "—"}</Td>
                    <Td isNumeric>{fmtNum(s.personas)}</Td>
                    <Td isNumeric>{fmtNum(s.animales)}</Td>
                    <Td>
                      <Badge>{s.estado.replace("_", " ")}</Badge>
                    </Td>
                    <Td>
                      {sig ? (
                        <Button size="xs" variant="outline" onClick={() => void avanzar(s, sig)}>
                          {sig.replace("_", " ")}
                        </Button>
                      ) : (
                        "resuelta"
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
        Operación
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
