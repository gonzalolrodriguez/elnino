import { Box, Button, Flex, FormControl, FormLabel, Input, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoBandeja, IconoPersonas } from "../../components/iconos/Iconos";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaRolOperativo } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { ColaAsistencia } from "../operacion/ColaAsistencia";
import { ListaTareas } from "../operacion/ListaTareas";
import type { Cuadrilla } from "../tipos";
import { APILAR, Cargando, Seccion } from "../ui";

const TIPO_INCIDENTE = { humana: "Humana y servicios", ganadera: "Ganadera", apicola: "Apícola" } as const;
/** Estas tablas tienen muchas columnas: se apilan por debajo de 80 em (1280 px), porque el menú lateral le quita ancho a la página. */
const BASE_APILAR = APILAR["@media (max-width: 47.99em)"];
const APILAR_PANEL = {
  "@media (max-width: 79.99em)": { ...BASE_APILAR, "tbody tr": { ...BASE_APILAR["tbody tr"], gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, 1fr))" } },
} as const;

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
    <Seccion titulo="Cuadrillas" categoria="SIMULADO" id="sec-cuadrillas" icono={<IconoPersonas tam="1.25rem" />}>
      <Cargando carga={carga} esVacio={(d) => d.cuadrillas.length === 0} vacio="Todavía no hay cuadrillas. Creá una abajo." hijos={(d) => (
        <TablaDesplazable etiqueta="Cuadrillas" mb={4}>
          <Table size="sm" aria-label="Cuadrillas" sx={APILAR_PANEL}>
            <Thead>
              <Tr>
                <Th>Cuadrilla</Th>
                <Th>Tipo</Th>
                <Th>Integrantes (rol)</Th>
                <Th>Roles que faltan en la plantilla</Th>
              </Tr>
            </Thead>
            <Tbody>
              {d.cuadrillas.map((c) => (
                <Tr key={c.id}>
                  <Td>{c.nombre}</Td>
                  <Td data-etiqueta="Tipo">{TIPO_INCIDENTE[c.tipo_incidente as keyof typeof TIPO_INCIDENTE] ?? c.tipo_incidente}</Td>
                  <Td whiteSpace="normal" data-etiqueta="Integrantes (rol)">{c.integrantes.map((i) => etiquetaRolOperativo(i.rol_operativo)).join(", ") || "sin integrantes"}</Td>
                  <Td whiteSpace="normal" data-etiqueta="Roles que faltan en la plantilla">{c.roles_faltantes.map((r) => etiquetaRolOperativo(r)).join(", ") || "plantilla completa"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
      )} />
      <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (nombre.trim().length >= 2) void crear(); }} borderTop="1px solid" borderColor="borde" pt={4}>
        <Text fontWeight={700} mb={2}>
          Crear una cuadrilla
        </Text>
        <Text textStyle="microdato" mb={3}>
          El nombre lleva al menos 2 letras y no incluye nombres de personas.
        </Text>
        <Flex gap={3} align="flex-end" wrap="wrap">
          <FormControl w={{ base: "full", sm: "16rem" }}>
            <FormLabel htmlFor="cuadrilla-nombre" fontSize="sm" mb={1}>
              Nombre de la cuadrilla
            </FormLabel>
            <Input id="cuadrilla-nombre" bg="superficie" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </FormControl>
          <FormControl w={{ base: "full", sm: "14rem" }}>
            <FormLabel htmlFor="cuadrilla-tipo" fontSize="sm" mb={1}>
              Tipo de incidente
            </FormLabel>
            <Select id="cuadrilla-tipo" bg="superficie" value={tipo} onChange={(e) => setTipo(e.target.value as keyof typeof TIPO_INCIDENTE)}>
              {Object.entries(TIPO_INCIDENTE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FormControl>
          <Button type="submit" w={{ base: "full", sm: "auto" }} isDisabled={nombre.trim().length < 2}>
            Crear cuadrilla
          </Button>
        </Flex>
      </Box>
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Seccion>
  );
}


export default function Operacion() {
  const cuadrillas = useCarga(() => api.cuadrillas());
  const tareas = useCarga(() => api.tareas());
  const lista = cuadrillas.datos?.cuadrillas ?? [];
  return (
    <>
      <CabeceraPagina
        titulo="Solicitudes y cuadrillas"
        icono={<IconoBandeja tam="1.5rem" />}
        categoria="SIMULADO"
        ayuda="Solicitudes, cuadrillas y tareas de demostración, con roles en lugar de nombres."
      />
      <ColaAsistencia cuadrillas={lista} tareas={tareas.datos?.tareas ?? []} />
      <ListaTareas cuadrillas={lista} carga={tareas} />
      <BloqueCuadrillas carga={cuadrillas} />
    </>
  );
}
