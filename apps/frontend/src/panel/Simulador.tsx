import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Heading, Select, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";

import { AlertaError } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { Opcion } from "../components/Opcion";
import { useEscenario } from "./EscenarioContext";
import type { AccesoProps, OrigenLluvia } from "./tipos";
import { MarcasUmbral } from "../components/MarcasUmbral";
import { MuestraEstado } from "../components/MuestraEstado";
import { APILAR, Chip, fmtM, fmtNum, NOMBRE_ACCESO } from "./ui";
import { TablaDesplazable } from "../components/TablaDesplazable";
import { ultimoHito } from "./lamina";
import { useReproducirSubida } from "./useReproducirSubida";

const ORIGENES: { valor: OrigenLluvia; texto: string }[] = [
  { valor: "simulado", texto: "Simulado (deslizador)" },
  { valor: "manual", texto: "Carga manual" },
  { valor: "parte_policial", texto: "Parte policial" },
  { valor: "planilla_upca", texto: "Planilla UPCA" },
];

/** Controles del escenario (CLAUDE.md §8.1) y resultado por sector. Todo el resultado es SIMULADO. */
export function Simulador({ accesos }: { accesos: AccesoProps[] }) {
  const { laminaVisible, fijarLaminaVisible, alturaVisual, entrada, fijarAltura, fijarLluvia, alternarCamino, escenario, entradaCalculada, desactualizado, calculando, error, simular } = useEscenario();
  const { reproduciendo, reproducir, detener, puedeReproducir } = useReproducirSubida();
  const hito = alturaVisual === null ? null : ultimoHito(alturaVisual);
  const lluviaSimulada = entrada.lluvia_origen === "simulado" || entrada.lluvia_origen === "manual";

  return (
    <Box>
      <Flex direction="column" gap={3}>
        <FormControl>
          <FormLabel htmlFor="sim-altura">
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
          <Text textStyle="microdato">
            Valor SIMULADO. Alerta 7,80 m y evacuación 8,30 m (K3). Dato del corte: 5,60 m.
          </Text>
          <Flex gap={3} align="center" wrap="wrap" mt={3}>
            <Box flex="1 1 12rem">
              <Opcion etiqueta="Lámina de agua ilustrativa" isChecked={laminaVisible} onChange={fijarLaminaVisible} />
            </Box>
            <Button variant="outline" onClick={reproduciendo ? detener : reproducir} isDisabled={!reproduciendo && !puedeReproducir} aria-pressed={reproduciendo}>
              {reproduciendo ? "Detener" : "Reproducir subida"}
            </Button>
          </Flex>
          {reproduciendo && alturaVisual !== null && (
            <Text textStyle="microdato" mt={1} role="status" data-testid="sim-reproduccion">
              Reproduciendo: {fmtM(alturaVisual)} (SIMULADO){hito ? `, superó el ${hito.texto}` : ""}.
            </Text>
          )}
          {!reproduciendo && !puedeReproducir && (
            <Text textStyle="microdato" mt={1}>
              Para reproducir la subida, elegí una altura mayor que el dato del corte.
            </Text>
          )}
        </FormControl>

        <FormControl>
          <FormLabel htmlFor="sim-lluvia">
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
          <Select aria-label="Origen de la lluvia" bg="superficie" mt={2} value={entrada.lluvia_origen} onChange={(e) => fijarLluvia(entrada.lluvia_mm, e.target.value as OrigenLluvia)}>
            {ORIGENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Text textStyle="rotulo" color="texto" mb={2}>
            Caminos cerrados en la simulación
          </Text>
          {accesos.length === 0 ? (
            <Text textStyle="microdato">No hay accesos cargados.</Text>
          ) : (
            <Flex direction="column" gap={2}>
              {accesos.map((a) => (
                <Opcion key={a.id} etiqueta={`${a.nombre} (${a.superficie}${a.sector_id ? `, ${a.sector_id}` : ""})`} isChecked={entrada.caminos_cerrados.includes(a.id)} onChange={() => alternarCamino(a.id)} />
              ))}
            </Flex>
          )}
        </Box>

        <Button onClick={() => void simular()} isLoading={calculando} loadingText="Calculando">
          Calcular escenario
        </Button>
      </Flex>

      {error !== null && (
        <Box mt={3}>
          <AlertaError error={error} />
        </Box>
      )}

      {escenario && desactualizado && (
        <Alert status="warning" mt={4} alignItems="center" role="status" data-testid="resultado-desactualizado">
          <AlertIcon />
          <Box flex="1">
            <strong>Resultado desactualizado.</strong> Cambiaste los controles después de calcular (resultado de {fmtM(entradaCalculada?.altura_formosa_m)} y{" "}
            {fmtNum(entradaCalculada?.lluvia_mm)} mm).
          </Box>
          <Button onClick={() => void simular()} isLoading={calculando} loadingText="Calculando">
            Recalcular
          </Button>
        </Alert>
      )}

      {escenario && (
        <Box mt={4} data-testid="resultado-escenario" opacity={desactualizado ? 0.55 : 1}>
          <Flex align="center" gap={2} mb={2} wrap="wrap">
            <Heading as="h3" size="bloque" textStyle="rotulo" color="texto">
              Resultado
            </Heading>
            <Insignia categoria="SIMULADO" />
          </Flex>
          <Text mb={3} data-testid="resultado-rio">
            Río: <strong>{escenario.rio.estado}</strong> a {fmtM(escenario.rio.altura_m)}; a {fmtM(Math.abs(escenario.rio.distancia_a_alerta_m))}{" "}
            {escenario.rio.distancia_a_alerta_m >= 0 ? "de la alerta" : "por encima de la alerta"} y a {fmtM(Math.abs(escenario.rio.distancia_a_evacuacion_m))}{" "}
            {escenario.rio.distancia_a_evacuacion_m >= 0 ? "de la evacuación" : "por encima de la evacuación"}.
          </Text>
          <TablaDesplazable etiqueta="Estado de los sectores en el escenario">
            <Table size="sm" aria-label="Estado de los sectores en el escenario" sx={APILAR}>
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
                    <Td whiteSpace="normal" data-etiqueta="Estado">
                      <Flex gap={1.5} wrap="wrap" align="center">
                        <MuestraEstado estado={s.estado} />
                        {s.aislado && <Chip tono="alerta">aislado</Chip>}
                      </Flex>
                    </Td>
                    <Td isNumeric data-etiqueta="Margen">{fmtM(s.margen_a_compromiso_m)}</Td>
                    <Td whiteSpace="normal" data-etiqueta="ISAD">{s.isad ? `${fmtNum(s.isad.valor, 2)} (SIMULADO)` : "sin dato"}</Td>
                    <Td whiteSpace="normal" textStyle="microdato" data-etiqueta="Accesos">
                      {s.accesos.map((a) => `${a.nombre}: ${NOMBRE_ACCESO[a.estado] ?? a.estado}`).join("; ") || "sin accesos"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TablaDesplazable>
          <Text textStyle="microdato" mt={2}>
            El ISAD es un índice relativo SIMULADO y no reemplaza el criterio de compromiso de K10. Margen: distancia en la escala hasta el compromiso del sector (negativa si ya lo superó).
          </Text>
        </Box>
      )}
    </Box>
  );
}
