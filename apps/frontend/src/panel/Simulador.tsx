import { Badge, Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, Select, SimpleGrid, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";

import { AlertaError } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { MarcasUmbral } from "../components/MarcasUmbral";
import { MuestraEstado } from "../components/MuestraEstado";
import { useEscenario } from "./EscenarioContext";
import type { AccesoProps, OrigenLluvia } from "./tipos";
import { fmtM, fmtNum, NOMBRE_ACCESO } from "./ui";

const ORIGENES: { valor: OrigenLluvia; texto: string }[] = [
  { valor: "simulado", texto: "Simulado (deslizador)" },
  { valor: "manual", texto: "Carga manual" },
  { valor: "parte_policial", texto: "Parte policial" },
  { valor: "planilla_upca", texto: "Planilla UPCA" },
];

const PRESETS_ESCENARIO = [
  { etiqueta: "Corte 31/10 (5,60 m · 0 mm)", altura: 5.6, lluvia: 0 },
  { etiqueta: "Caso §8.1 · S4 Aislado (7,60 m · 40 mm)", altura: 7.6, lluvia: 40 },
  { etiqueta: "Alerta K3 (7,80 m · 60 mm)", altura: 7.8, lluvia: 60 },
  { etiqueta: "Evacuación + Ripio (8,30 m · 85 mm)", altura: 8.3, lluvia: 85 },
] as const;

/** Controles del escenario (CLAUDE.md §8.1) y resultado por sector. Todo el resultado es SIMULADO. */
export function Simulador({ accesos }: { accesos: AccesoProps[] }) {
  const { entrada, fijarAltura, fijarLluvia, alternarCamino, escenario, calculando, error, simular } = useEscenario();
  const lluviaSimulada = entrada.lluvia_origen === "simulado" || entrada.lluvia_origen === "manual";

  return (
    <Box>
      <Flex direction="column" gap={3}>
        <Box bg="pizarra.100" p={2.5} borderRadius="sm" border="1px solid" borderColor="borde">
          <Text fontSize="xs" fontWeight={700} color="pizarra.700" mb={1.5}>
            Escenarios rápidos de evaluación (SIMULADO):
          </Text>
          <Flex gap={1.5} wrap="wrap">
            {PRESETS_ESCENARIO.map((p) => (
              <Button
                key={p.etiqueta}
                size="xs"
                variant={Math.abs(entrada.altura_formosa_m - p.altura) < 0.03 && entrada.lluvia_mm === p.lluvia ? "solid" : "outline"}
                type="button"
                onClick={() => {
                  fijarAltura(p.altura);
                  fijarLluvia(p.lluvia);
                }}
              >
                {p.etiqueta}
              </Button>
            ))}
          </Flex>
        </Box>

        <FormControl>
          <FormLabel htmlFor="sim-altura" mb={0} fontSize="sm">
            Altura de Puerto Formosa (0 a 12 m): <strong data-testid="sim-altura-valor">{fmtM(entrada.altura_formosa_m)}</strong>
          </FormLabel>
          <input
            id="sim-altura"
            type="range"
            min={0}
            max={12}
            step={0.05}
            value={entrada.altura_formosa_m}
            onChange={(e) => fijarAltura(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <MarcasUmbral />
          <Text fontSize="xs" color="textoSuave">
            Valor SIMULADO. Alerta 7,80 m y evacuación 8,30 m (K3). Dato del corte: 5,60 m. Compromiso S4: 7,50 m.
          </Text>
        </FormControl>

        <FormControl>
          <FormLabel htmlFor="sim-lluvia" mb={0} fontSize="sm">
            Lluvia: <strong data-testid="sim-lluvia-valor">{fmtNum(entrada.lluvia_mm)} mm</strong> ({lluviaSimulada ? "SIMULADO" : "origen indicado"})
          </FormLabel>
          <input
            id="sim-lluvia"
            type="range"
            min={0}
            max={200}
            step={5}
            value={entrada.lluvia_mm}
            onChange={(e) => fijarLluvia(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <Select aria-label="Origen de la lluvia" size="sm" bg="superficie" mt={1} value={entrada.lluvia_origen} onChange={(e) => fijarLluvia(entrada.lluvia_mm, e.target.value as OrigenLluvia)}>
            {ORIGENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </Select>
          <Text fontSize="xs" color="textoSuave" mt={1}>
            Umbrales de saturación (SUPUESTO): camino de tierra ≥ 30 mm · camino de ripio ≥ 80 mm.
          </Text>
        </FormControl>

        <Box>
          <Text fontSize="sm" fontWeight={600} mb={1}>
            Caminos cerrados en la simulación
          </Text>
          {accesos.length === 0 ? (
            <Text fontSize="sm" color="textoSuave">
              No hay accesos cargados.
            </Text>
          ) : (
            accesos.map((a) => (
              <Checkbox key={a.id} size="sm" display="flex" isChecked={entrada.caminos_cerrados.includes(a.id)} onChange={() => alternarCamino(a.id)}>
                {a.nombre} <Text as="span" color="textoSuave">({a.superficie}{a.sector_id ? `, ${a.sector_id}` : ""})</Text>
              </Checkbox>
            ))
          )}
        </Box>

        <Button onClick={() => void simular()} isLoading={calculando} loadingText="Calculando" size="sm">
          Calcular escenario
        </Button>
      </Flex>

      {error !== null && (
        <Box mt={3}>
          <AlertaError error={error} />
        </Box>
      )}

      {escenario && (
        <Box mt={4} data-testid="resultado-escenario">
          <Flex align="center" gap={2} mb={2} wrap="wrap">
            <Heading as="h3" size="xs">
              Resultado
            </Heading>
            <Insignia categoria="SIMULADO" />
          </Flex>
          <Text fontSize="sm" mb={2} data-testid="resultado-rio">
            Río: <strong>{escenario.rio.estado}</strong> a {fmtM(escenario.rio.altura_m)}; a {fmtM(Math.abs(escenario.rio.distancia_a_alerta_m))}{" "}
            {escenario.rio.distancia_a_alerta_m >= 0 ? "de la alerta" : "por encima de la alerta"} y a {fmtM(Math.abs(escenario.rio.distancia_a_evacuacion_m))}{" "}
            {escenario.rio.distancia_a_evacuacion_m >= 0 ? "de la evacuación" : "por encima de la evacuación"}.
          </Text>
          {escenario.resumen && (
            <SimpleGrid columns={2} spacing={2} mb={3} fontSize="xs">
              <Box bg="pizarra.100" p={2} borderRadius="sm">
                Comprometidos: <strong>{escenario.resumen.comprometidos.join(", ") || "ninguno"}</strong>
              </Box>
              <Box bg="pizarra.100" p={2} borderRadius="sm">
                Aislados (sin acceso): <strong>{escenario.resumen.aislados.join(", ") || "ninguno"}</strong>
              </Box>
            </SimpleGrid>
          )}
          <TableContainer>
            <Table size="sm" aria-label="Estado de los sectores en el escenario">
              <Thead>
                <Tr>
                  <Th>Sector</Th>
                  <Th>Estado</Th>
                  <Th isNumeric>Margen</Th>
                  <Th>ISAD</Th>
                  <Th>Accesos</Th>
                </Tr>
              </Thead>
              <Tbody>
                {escenario.sectores.map((s) => (
                  <Tr key={s.id} data-testid={`sector-${s.id}`}>
                    <Td fontWeight={700}>{s.id}</Td>
                    <Td whiteSpace="normal">
                      <MuestraEstado estado={s.estado} />
                      {s.aislado && (
                        <Badge ml={1} colorScheme="red" variant="solid">
                          aislado
                        </Badge>
                      )}
                    </Td>
                    <Td isNumeric>{fmtM(s.margen_a_compromiso_m)}</Td>
                    <Td whiteSpace="normal">{s.isad ? `${fmtNum(s.isad.valor, 2)} (SIMULADO)` : "sin dato"}</Td>
                    <Td whiteSpace="normal" fontSize="xs">
                      {s.accesos.map((a) => `${a.nombre}: ${NOMBRE_ACCESO[a.estado] ?? a.estado}`).join("; ") || "sin accesos"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
          <Text fontSize="xs" color="textoSuave" mt={1}>
            El ISAD es un índice relativo SIMULADO y no reemplaza el criterio de compromiso de K10. Margen: distancia en la escala hasta el compromiso del sector (negativa si ya lo superó).
          </Text>
        </Box>
      )}
    </Box>
  );
}
