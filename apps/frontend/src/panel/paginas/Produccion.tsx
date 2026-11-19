import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Heading, List, ListItem, NumberInput, NumberInputField, Select, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { api } from "../api";
import type { CalculoGanadero } from "../tipos";
import { AvisoSimulado, fmtNum, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";

const BOVINOS = ["vaca preñada", "vaca vacía", "vaca con cría", "ternero al pie", "vaquillona", "toro"] as const;
const MENORES = ["caprino", "ovino", "porcino"] as const;

function Numero({ id, etiqueta, valor, alCambiar, max = 100000 }: { id: string; etiqueta: string; valor: number; alCambiar: (n: number) => void; max?: number }) {
  return (
    <FormControl>
      <FormLabel htmlFor={id} fontSize="sm" mb={0}>
        {etiqueta}
      </FormLabel>
      <NumberInput size="sm" min={0} max={max} value={valor} onChange={(_, n) => alCambiar(Number.isNaN(n) ? 0 : n)}>
        <NumberInputField id={id} bg="superficie" />
      </NumberInput>
    </FormControl>
  );
}

function Resultado({ r }: { r: CalculoGanadero }) {
  return (
    <Box data-testid="resultado-ganaderia">
      <Flex gap={2} align="center" mb={3}>
        <Heading as="h3" size="xs">
          Resultado del cálculo
        </Heading>
        <Insignia categoria={r.categoria} />
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} fontSize="sm">
        <Box>
          <Text>
            <strong>Dormidero:</strong> <span data-testid="dormidero-m2">{fmtNum(r.dormidero.m2_necesarios, 0)} m²</span> necesarios
            {r.dormidero.alcanza === null ? " (sin superficie de albardón informada)" : r.dormidero.alcanza ? "; el albardón alcanza." : `; faltan ${fmtNum(r.dormidero.faltante_m2 ?? 0, 0)} m² de albardón.`}
            {r.dormidero.divisiones_internas ? " Se necesitan divisiones internas (más de una categoría)." : ""}
          </Text>
          <Text>
            <strong>Camiones jaula:</strong> <span data-testid="camiones-jaula">{fmtNum(r.transporte.camiones_jaula)}</span> ({r.transporte.bovinos_por_camion} bovinos por camión, SUPUESTO)
            {r.transporte.camion_con_divisiones ? ", con divisiones." : "."}
          </Text>
          <Text>
            <strong>Vehículos categoría B:</strong> {fmtNum(r.transporte.vehiculos_categoria_b)}. {r.transporte.nota}
          </Text>
          <Text>
            <strong>Ración diaria:</strong> maíz <span data-testid="racion-maiz">{fmtNum(r.racion_diaria.maiz_kg, 1)} kg</span>, pellet de girasol <span data-testid="racion-pellet">{fmtNum(r.racion_diaria.pellet_girasol_kg, 1)} kg</span> (INTA, a verificar).
          </Text>
          <Text>
            <strong>Lotes en destino:</strong> hasta {r.lote_maximo_cabezas} cabezas.
          </Text>
          {r.apicultura && (
            <Text>
              <strong>Apicultura:</strong> {r.apicultura.recomendacion}
            </Text>
          )}
        </Box>
        <Box>
          <Text fontWeight={600}>Checklist en destino</Text>
          <List styleType="disc" ml={5}>
            {r.checklist_destino.map((c) => (
              <ListItem key={c}>{c}</ListItem>
            ))}
          </List>
        </Box>
      </SimpleGrid>
      {r.advertencias.map((a) => (
        <Alert key={a} status="warning" mt={2} fontSize="sm">
          <AlertIcon />
          {a}
        </Alert>
      ))}
      <Text fontWeight={600} fontSize="sm" mt={3}>
        Supuestos usados
      </Text>
      <TablaDesplazable etiqueta="Supuestos del cálculo ganadero">
        <Table size="sm" aria-label="Supuestos del cálculo ganadero">
          <Thead>
            <Tr>
              <Th>Supuesto</Th>
              <Th>Valor</Th>
            </Tr>
          </Thead>
          <Tbody>
            {Object.entries(r.supuestos).map(([k, v]) => (
              <Tr key={k}>
                <Td>{k.replace(/_/g, " ")}</Td>
                <Td whiteSpace="normal">{typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Text fontSize="xs" color="textoSuave" mt={1}>
        {r.fuente}. Fecha del cálculo: {r.fecha_dato}.
      </Text>
    </Box>
  );
}

export default function Produccion() {
  const [bov, setBov] = useState<Record<string, number>>({ "vaca preñada": 8, "vaca vacía": 0, "vaca con cría": 10, "ternero al pie": 10, vaquillona: 1, toro: 1 });
  const [otros, setOtros] = useState<Record<string, number>>({ caprino: 0, ovino: 0, porcino: 0 });
  const [vivas, setVivas] = useState(0);
  const [muertas, setMuertas] = useState(0);
  const [traslado, setTraslado] = useState("vehicular");
  const [albardon, setAlbardon] = useState(200);
  const [r, setR] = useState<CalculoGanadero | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);

  async function calcular() {
    setCargando(true);
    setError(null);
    try {
      setR(
        await api.ganaderia({
          bovinos: BOVINOS.filter((c) => bov[c] > 0).map((c) => ({ categoria: c, cantidad: bov[c] })),
          otros: MENORES.filter((e) => otros[e] > 0).map((e) => ({ especie: e, cantidad: otros[e] })),
          ...(vivas + muertas > 0 ? { colmenas: { vivas, muertas, traslado } } : {}),
          superficie_albardon_m2: albardon,
        }),
      );
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <Heading as="h1" size="lg" mb={4}>
        Arca Productiva
      </Heading>
      <AvisoSimulado>El rodeo de ejemplo es el caso de control (8 preñadas, 10 con cría, 10 terneros, 1 vaquillona y 1 toro). Las capacidades y raciones son supuestos a verificar, no normativa.</AvisoSimulado>
      <Seccion titulo="Calculadora ganadera" categoria="SIMULADO" id="sec-ganaderia">
        <Text fontWeight={600} fontSize="sm" mb={1}>
          Bovinos por categoría
        </Text>
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={3}>
          {BOVINOS.map((c) => (
            <Numero key={c} id={`bov-${c}`} etiqueta={c} valor={bov[c]} alCambiar={(n) => setBov((b) => ({ ...b, [c]: n }))} />
          ))}
        </SimpleGrid>
        <Text fontWeight={600} fontSize="sm" mb={1}>
          Animales menores
        </Text>
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={3}>
          {MENORES.map((e) => (
            <Numero key={e} id={`menor-${e}`} etiqueta={e} valor={otros[e]} alCambiar={(n) => setOtros((o) => ({ ...o, [e]: n }))} />
          ))}
        </SimpleGrid>
        <Text fontWeight={600} fontSize="sm" mb={1}>
          Colmenas y albardón
        </Text>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
          <Numero id="colmenas-vivas" etiqueta="Colmenas vivas" valor={vivas} alCambiar={setVivas} />
          <Numero id="colmenas-muertas" etiqueta="Colmenas muertas" valor={muertas} alCambiar={setMuertas} />
          <FormControl>
            <FormLabel htmlFor="colmenas-traslado" fontSize="sm" mb={0}>
              Traslado de colmenas
            </FormLabel>
            <Select id="colmenas-traslado" size="sm" bg="superficie" value={traslado} onChange={(e) => setTraslado(e.target.value)}>
              <option value="vehicular">Vehicular</option>
              <option value="a_pie">A pie</option>
            </Select>
          </FormControl>
          <Numero id="albardon" etiqueta="Superficie del albardón (m²)" valor={albardon} alCambiar={setAlbardon} max={1_000_000_000} />
        </SimpleGrid>
        <Button size="sm" onClick={() => void calcular()} isLoading={cargando}>
          Calcular
        </Button>
        <Box mt={3}>
          <AlertaError error={error} />
        </Box>
        {r && (
          <Box mt={4}>
            <Resultado r={r} />
          </Box>
        )}
      </Seccion>
    </>
  );
}
