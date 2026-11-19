import { Badge, Box, Flex, Heading, List, ListItem, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";

import { Insignia } from "../../components/Insignia";
import { AUDITORIA_K1 } from "../../datos/auditoriaK1";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { Cargando, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";

const COLOR_VEREDICTO: Record<string, string> = {
  RESPALDADA: "green",
  "RESPALDADA COMO PROMEDIO": "green",
  VERDADERA: "green",
  REFUTADA: "red",
  FALSA: "red",
  "NO VERIFICABLE": "gray",
  "NO VERIFICABLE CON LA CAPA DISPONIBLE": "gray",
};

function Veredicto({ v }: { v: string }) {
  return (
    <Badge colorScheme={COLOR_VEREDICTO[v] ?? "gray"} variant="subtle" whiteSpace="normal">
      {v}
    </Badge>
  );
}

export default function Centinela() {
  const k6 = useCarga(() => api.k6());
  const k7 = useCarga(() => api.k7());
  return (
    <>
      <Heading as="h1" size="lg" mb={4}>
        Auditoría de datos (Centinela)
      </Heading>

      <Seccion titulo="Auditoría de la limpieza de K1" categoria="DATO OBSERVADO" id="sec-k1">
        <Text fontSize="sm" mb={2}>
          Entrada: {AUDITORIA_K1.entrada}. Salida: {AUDITORIA_K1.salida}.
        </Text>
        <TablaDesplazable etiqueta="Hallazgos de la limpieza de K1">
          <Table size="sm" aria-label="Hallazgos de la limpieza de K1">
            <Thead>
              <Tr>
                <Th>Problema</Th>
                <Th>Registros</Th>
                <Th>Tratamiento</Th>
              </Tr>
            </Thead>
            <Tbody>
              {AUDITORIA_K1.hallazgos.map((h) => (
                <Tr key={h.problema}>
                  <Td whiteSpace="normal">{h.problema}</Td>
                  <Td whiteSpace="normal">{h.cantidad}</Td>
                  <Td whiteSpace="normal">{h.tratamiento}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TablaDesplazable>
        <List styleType="disc" ml={5} mt={2} fontSize="sm">
          {AUDITORIA_K1.controles.map((c) => (
            <ListItem key={c}>{c}</ListItem>
          ))}
        </List>
        <Text fontSize="xs" color="textoSuave" mt={1}>
          Fuente: {AUDITORIA_K1.fuente}. La serie conserva alteraciones pedagógicas deliberadas: no es oficial ni apta para decisiones operativas.
        </Text>
      </Seccion>

      <Seccion titulo="Verificador del informe de IA (K6)" id="sec-k6">
        <Cargando carga={k6} hijos={(d) => (
          <>
            <Text fontSize="sm" mb={3}>
              {d.informe}. {d.nota}
            </Text>
            <Flex direction="column" gap={3}>
              {d.afirmaciones.map((a) => (
                <Box key={a.id} borderLeft="3px solid" borderColor={a.veredicto.startsWith("REFUTADA") ? "red.500" : "pizarra.200"} pl={3} data-testid={`k6-${a.id}`}>
                  <Flex gap={2} align="center" wrap="wrap" mb={1}>
                    <strong>{a.id}</strong>
                    <Veredicto v={a.veredicto} />
                    <Insignia categoria={a.categoria} />
                  </Flex>
                  <Text fontSize="sm">{a.afirmacion}</Text>
                  <Text fontSize="sm" color="pizarra.700">
                    {a.evidencia}
                  </Text>
                  <Text fontSize="xs" color="textoSuave">
                    Fuente: {a.fuente}
                  </Text>
                </Box>
              ))}
            </Flex>
          </>
        )} />
      </Seccion>

      <Seccion titulo="Verificador de la red hidrográfica (K7)" id="sec-k7">
        <Cargando carga={k7} hijos={(d) => (
          <>
            <Text fontSize="sm" mb={3}>
              {d.esquema}. {d.nota}
            </Text>
            <TablaDesplazable etiqueta="Relaciones de K7">
              <Table size="sm" aria-label="Relaciones de K7">
                <Thead>
                  <Tr>
                    <Th>Relación</Th>
                    <Th>Veredicto</Th>
                    <Th>Corrección y evidencia</Th>
                    <Th>Verificado con</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {d.relaciones.map((r) => (
                    <Tr key={r.id} data-testid={`k7-${r.id}`}>
                      <Td whiteSpace="normal" minW="14rem">
                        <strong>{r.id}</strong> {r.relacion}
                      </Td>
                      <Td>
                        <Veredicto v={r.veredicto} />
                      </Td>
                      <Td whiteSpace="normal" minW="16rem">
                        {r.correccion}
                        {r.evidencia_cartografica ? ` ${r.evidencia_cartografica}` : ""}
                        <Text fontSize="xs" color="textoSuave">
                          Fuente: {r.fuente}
                        </Text>
                      </Td>
                      <Td whiteSpace="normal">
                        {r.verificado_con}
                        <Box mt={1}>
                          <Insignia categoria={r.categoria} />
                        </Box>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TablaDesplazable>
          </>
        )} />
      </Seccion>
    </>
  );
}
