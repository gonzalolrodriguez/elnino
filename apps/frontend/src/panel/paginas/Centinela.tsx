import { Badge, Box, Flex, Heading, List, ListItem, SimpleGrid, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";

import { Insignia } from "../../components/Insignia";
import { AUDITORIA_K1 } from "../../datos/auditoriaK1";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { Cargando, Seccion } from "../ui";

const COLOR_VEREDICTO: Record<string, string> = {
  RESPALDADA: "green",
  "RESPALDADA COMO PROMEDIO": "green",
  VERDADERA: "green",
  REFUTADA: "red",
  FALSA: "red",
  "NO VERIFICABLE": "gray",
  "NO VERIFICABLE CON LA CAPA DISPONIBLE": "gray",
};

const ORDEN_OFICIAL_CUENCA = [
  "1. Bahía Negra",
  "2. Concepción",
  "3. Asunción",
  "4. Puerto Pilcomayo · Clorinda (siteCode 55, lat -25,367°)",
  "5. Puerto Formosa (siteCode 57, lat -26,183°)",
  "6. Desembocadura Río Bermejo (lat -26,866°)",
  "7. Confluencia con el Río Paraná → Corrientes → Río de la Plata",
] as const;

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
        Centinela: auditoría de datos y de afirmaciones
      </Heading>

      <Seccion titulo="Auditoría de la limpieza de K1" categoria="DATO OBSERVADO" id="sec-k1">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
          <Box bg="pizarra.100" p={3} borderRadius="sm" borderTop="3px solid" borderTopColor="agua.700">
            <Text fontSize="xs" color="textoSuave">Registros crudos → válidos</Text>
            <Text textStyle="cifra" fontSize="xl">8.347 → 8.334</Text>
            <Text fontSize="xs" color="textoSuave">12 duplicados + 1 en cuarentena</Text>
          </Box>
          <Box bg="pizarra.100" p={3} borderRadius="sm" borderTop="3px solid" borderTopColor="verde.600">
            <Text fontSize="xs" color="textoSuave">Máximo histórico validado</Text>
            <Text textStyle="cifra" fontSize="xl">9,81 m</Text>
            <Text fontSize="xs" color="textoSuave">05 y 06/01/2016 (pico 2019: 9,72 m)</Text>
          </Box>
          <Box bg="pizarra.100" p={3} borderRadius="sm" borderTop="3px solid" borderTopColor="escala.alerta">
            <Text fontSize="xs" color="textoSuave">Normalizaciones con evidencia</Text>
            <Text textStyle="cifra" fontSize="xl">7 cm · 3 comas · 40 fechas</Text>
            <Text fontSize="xs" color="textoSuave">Sin alterar el archivo original K1</Text>
          </Box>
          <Box bg="pizarra.100" p={3} borderRadius="sm" borderTop="3px solid" borderTopColor="pizarra.700">
            <Text fontSize="xs" color="textoSuave">Integridad sin interpolar</Text>
            <Text textStyle="cifra" fontSize="xl">25 huecos (2018)</Text>
            <Text fontSize="xs" color="textoSuave">141 negativos reales (mín. −0,86 m)</Text>
          </Box>
        </SimpleGrid>

        <Text fontSize="sm" mb={2}>
          Entrada: {AUDITORIA_K1.entrada}. Salida: {AUDITORIA_K1.salida}.
        </Text>
        <TableContainer>
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
        </TableContainer>
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
                <Box key={a.id} borderLeft="4px solid" borderColor={a.veredicto.startsWith("REFUTADA") ? "red.500" : "pizarra.200"} pl={3} data-testid={`k6-${a.id}`}>
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
        <Box bg="pizarra.100" p={3} borderRadius="sm" border="1px solid" borderColor="borde" mb={3}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={2} mb={1.5}>
            <Text fontSize="xs" fontWeight={700} color="pizarra.800">
              Secuencia hidrográfica real verificada (aguas arriba → aguas abajo · K3 + Capas SIG IGN):
            </Text>
            <Insignia categoria="DOCUMENTO DE REFERENCIA" />
          </Flex>
          <Flex gap={1.5} wrap="wrap" align="center">
            {ORDEN_OFICIAL_CUENCA.map((n, i) => (
              <Badge key={n} bg="superficie" color="pizarra.900" border="1px solid" borderColor="borde" px={2} py={0.5}>
                {n}{i < ORDEN_OFICIAL_CUENCA.length - 1 ? " →" : ""}
              </Badge>
            ))}
          </Flex>
        </Box>

        <Cargando carga={k7} hijos={(d) => (
          <>
            <Text fontSize="sm" mb={3}>
              {d.esquema}. {d.nota}
            </Text>
            <TableContainer>
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
            </TableContainer>
          </>
        )} />
      </Seccion>
    </>
  );
}
