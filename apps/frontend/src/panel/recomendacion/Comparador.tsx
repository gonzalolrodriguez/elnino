import { Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, Input, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr, VisuallyHidden } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoTilde } from "../../components/iconos/Iconos";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useEscenario } from "../EscenarioContext";
import type { Alternativas, PronosticoLluvia } from "../tipos";
import { APILAR, Seccion } from "../ui";
import { lineasDeValor, mejoresDeFila } from "./formato";
import { Plegable } from "./piezas";

/** Fijar la primera columna (la métrica) solo donde la tabla se desplaza en horizontal; en el celular cada fila se apila. */
const COLUMNA_FIJA = {
  "@media (min-width: 48em)": {
    "th:first-of-type, td:first-of-type": { position: "sticky", left: 0, zIndex: 1, background: "var(--chakra-colors-superficie)", boxShadow: "1px 0 0 var(--chakra-colors-borde)" },
  },
} as const;

/** En el celular cada fila muestra una columna por alternativa, rotulada con su letra ("Alternativa A"). */
const corto = (nombre: string) => nombre.split(" · ")[0] ?? nombre;
const movil = (n: number) => ({
  "@media (max-width: 47.99em)": { ...APILAR["@media (max-width: 47.99em)"], "tbody tr": { ...APILAR["@media (max-width: 47.99em)"]["tbody tr"], gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` } },
});

function Valor({ v }: { v: unknown }) {
  const lineas = lineasDeValor(v);
  return (
    <>
      {lineas.map((l) => (
        <Text key={l} as="span" display="block">
          {l}
        </Text>
      ))}
    </>
  );
}

function TablaComparacion({ res }: { res: Alternativas }) {
  const filas = res.comparacion.map((f) => ({ f, mejores: mejoresDeFila(f.metrica, f.valores) }));
  const comparables = filas.filter((x) => x.mejores.size > 0);
  const victorias = res.alternativas.map((_, i) => comparables.filter((x) => x.mejores.has(i)).length);
  const maxVictorias = Math.max(0, ...victorias);
  return (
    <>
      <TablaDesplazable etiqueta="Comparación de alternativas lado a lado">
        <Table size="sm" aria-label="Comparación de alternativas lado a lado" sx={{ ...movil(res.alternativas.length), ...COLUMNA_FIJA, "td, th": { fontVariantNumeric: "tabular-nums" } }}>
          <Thead>
            <Tr>
              <Th scope="col" verticalAlign="bottom">
                Métrica
              </Th>
              {res.alternativas.map((a, i) => (
                <Th key={a.id} scope="col" whiteSpace="normal" verticalAlign="bottom" textTransform="none" letterSpacing="normal" fontSize="sm" color="texto">
                  {a.nombre}
                  <Text as="span" display="block" fontWeight={500} color={victorias[i] === maxVictorias && maxVictorias > 0 ? "verde.800" : "textoSuave"} fontSize="0.8125rem">
                    Mejor en {victorias[i]} de {comparables.length}
                  </Text>
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td fontWeight={600}>Orden de sectores</Td>
              {res.alternativas.map((a) => (
                <Td key={a.id} data-etiqueta={corto(a.nombre)}>
                  {a.orden_sectores.join(" → ") || "ninguno"}
                </Td>
              ))}
            </Tr>
            {filas.map(({ f, mejores }) => (
              <Tr key={f.metrica}>
                <Td fontWeight={600} whiteSpace="normal">
                  {f.etiqueta}
                </Td>
                {f.valores.map((v, i) => {
                  const mejor = mejores.has(i);
                  return (
                    <Td key={res.alternativas[i]?.id ?? i} data-etiqueta={corto(res.alternativas[i]?.nombre ?? "")} data-mejor={mejor ? "true" : undefined} whiteSpace="normal" bg={mejor ? "verde.50" : undefined} color={mejor ? "verde.800" : undefined} fontWeight={mejor ? 700 : undefined}>
                      <Flex as="span" align="flex-start" gap={1.5}>
                        {mejor && (
                          <>
                            <Box as="span" mt="3px" aria-hidden="true">
                              <IconoTilde tam="1em" strokeWidth={2.5} />
                            </Box>
                            <VisuallyHidden>Mejor valor de la fila: </VisuallyHidden>
                          </>
                        )}
                        <Box as="span">
                          <Valor v={v} />
                        </Box>
                      </Flex>
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Flex align="center" gap={1.5} mt={2} textStyle="microdato">
        <Box as="span" color="verde.800" aria-hidden="true">
          <IconoTilde tam="1em" strokeWidth={2.5} />
        </Box>
        <span>Mejor valor de cada fila (menor es mejor, salvo en personas con lugar, animales con cupo y familias juntas). Las filas iguales o sin orden no se destacan.</span>
      </Flex>
    </>
  );
}

export function Comparador({ pronostico, hogares }: { pronostico: PronosticoLluvia | null; hogares: boolean }) {
  const { entrada } = useEscenario();
  const centros = useCarga(() => api.centros());
  const [nombre, setNombre] = useState("");
  const [orden, setOrden] = useState("");
  const [excluidos, setExcluidos] = useState<number[]>([]);
  const [res, setRes] = useState<Alternativas | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);
  const lista = centros.datos?.centros ?? [];

  async function comparar() {
    setCargando(true);
    setError(null);
    try {
      const ids = orden
        .split(/[\s,]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      setRes(await api.alternativas(entrada, { nombre: nombre.trim() || undefined, orden_sectores: ids.length ? ids : undefined, centros_excluidos: excluidos }, pronostico ?? undefined, hogares));
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Seccion titulo="Comparador de alternativas" categoria={res?.categoria ?? "SIMULADO"} id="sec-comp">
      <Text textStyle="microdato" fontSize="sm" mb={4} maxW="70ch">
        Se generan dos alternativas (prioridad por riesgo y por población) y una tercera editable: indicá el orden de los sectores y los centros que no se usarían.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} maxW="48rem">
        <FormControl>
          <FormLabel htmlFor="alt-nombre" fontSize="sm" mb={1}>
            Nombre de la alternativa editable
          </FormLabel>
          <Input id="alt-nombre" size="sm" bg="superficie" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="alt-orden" fontSize="sm" mb={1}>
            Orden de sectores (ej.: S4, S1)
          </FormLabel>
          <Input id="alt-orden" size="sm" bg="superficie" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </FormControl>
      </SimpleGrid>
      {lista.length > 0 && (
        <Plegable mt={4} resumen={`Centros que no se usarían en la alternativa editable${excluidos.length ? ` (${excluidos.length} elegidos)` : ""}`}>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacingX={4} spacingY={2}>
            {lista.map((c) => (
              <Checkbox key={c.id} size="md" isChecked={excluidos.includes(c.id)} onChange={() => setExcluidos((x) => (x.includes(c.id) ? x.filter((i) => i !== c.id) : [...x, c.id]))}>
                {c.nombre}
              </Checkbox>
            ))}
          </SimpleGrid>
        </Plegable>
      )}
      <Button mt={4} onClick={() => void comparar()} isLoading={cargando} w={{ base: "100%", md: "auto" }}>
        Comparar alternativas
      </Button>
      <AlertaError error={error} />
      {res && (
        <Box data-testid="comparacion" mt={6}>
          <Heading as="h3" size="xs" mb={3}>
            {res.etiqueta}
          </Heading>
          <TablaComparacion res={res} />
          <Plegable mt={3} resumen="Supuestos y método de la comparación">
            <Text color="textoSuave">
              Tiempos por la red vial cuando está cargada (si no, aproximados); cada tipo de vehículo atiende a los sectores en el orden de la alternativa y los tipos distintos trabajan en paralelo. Velocidades por superficie: SUPUESTO. Cada alternativa quedó guardada con el snapshot del escenario.
            </Text>
          </Plegable>
        </Box>
      )}
    </Seccion>
  );
}
