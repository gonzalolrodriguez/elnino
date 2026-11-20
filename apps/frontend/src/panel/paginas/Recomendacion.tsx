import { Alert, AlertDescription, AlertIcon, Badge, Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, Input, Select, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useEscenario } from "../EscenarioContext";
import type { Alternativas, Plan, PlanSector, Recomendacion } from "../tipos";
import { MuestraEstado } from "../../components/MuestraEstado";
import { COLOR_ESTADO, fmtDias, fmtM, fmtNum, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";

const ESCENARIOS_EVACUACION = [
  { etiqueta: "Ventana Seca S4 (7,50 m · 0 mm)", altura: 7.5, lluvia: 0 },
  { etiqueta: "Caso §8.1 · S4 Aislado (7,60 m · 40 mm)", altura: 7.6, lluvia: 40 },
  { etiqueta: "Alerta K3 · S4 y S3 (7,80 m · 60 mm)", altura: 7.8, lluvia: 60 },
  { etiqueta: "Evacuación K3 (8,30 m · 85 mm)", altura: 8.3, lluvia: 85 },
] as const;

const OPCIONES_ALTERNATIVAS = [
  {
    etiqueta: "Opción 1 · Ventana Seca Rural (S4 → S3 → S1 → S2)",
    nombre: "Prioridad Ventana Seca Rural (S4 primero)",
    orden: "S4, S3, S1, S2",
    excluidos: [] as number[],
  },
  {
    etiqueta: "Opción 2 · Prioridad Vial Tierra/Ripio (S4 → S1 → S3 → S2)",
    nombre: "Prioridad accesos únicos tierra y ripio (S4 y S1)",
    orden: "S4, S1, S3, S2",
    excluidos: [] as number[],
  },
  {
    etiqueta: "Opción 3 · Contingencia sin Centro 1 (S4 → S3 → S1)",
    nombre: "Contingencia con Centro 1 excluido",
    orden: "S4, S3, S1, S2",
    excluidos: [1],
  },
] as const;

/** Muestra valores heterogéneos de la comparación (números, listas y diccionarios). */
export function fmtValor(v: unknown): string {
  if (v === null || v === undefined) return "sin dato";
  if (typeof v === "number") return fmtNum(v, Number.isInteger(v) ? 0 : 1);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.length === 0 ? "ninguno" : v.map(fmtValor).join(", ");
  if (typeof v === "object") {
    const partes = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => !(Array.isArray(x) && x.length === 0) && x !== 0)
      .map(([k, x]) => `${k.replace(/_/g, " ")}: ${fmtValor(x)}`);
    return partes.length ? partes.join("; ") : "ninguno";
  }
  return String(v);
}

function TarjetaSector({ s }: { s: PlanSector }) {
  const c = COLOR_ESTADO[s.estado];
  return (
    <Box layerStyle="tarjeta" borderLeft={`5px solid ${c.stroke}`} p={4} data-testid={`plan-${s.id}`}>
      <Flex align="center" gap={2} mb={2} wrap="wrap">
        <Heading as="h3" size="sm">
          {s.prioridad}.º · {s.id} {s.nombre}
        </Heading>
        <MuestraEstado estado={s.estado} aislado={s.aislado} />
        {s.aislado && (
          <Badge colorScheme="red" variant="solid">
            aislado
          </Badge>
        )}
      </Flex>
      <Text fontSize="sm">
        <strong>Personas:</strong> {fmtNum(s.poblacion.total_estimada)} (incluye {fmtNum(s.poblacion.personas_registradas)} registradas en {fmtNum(s.poblacion.familias_registradas)} grupos familiares).
      </Text>
      <Text fontSize="sm">
        <strong>Producción:</strong> {fmtNum(s.produccion.bovinos)} bovinos y {fmtNum(s.produccion.colmenas)} colmenas declarados en {s.produccion.establecimientos.length} establecimientos.
      </Text>
      <Text fontSize="sm">
        <strong>Ventana hasta el compromiso:</strong> {s.ventana.ya_comprometido ? "ya comprometido" : fmtDias(s.ventana.dias_hasta_compromiso_minimo, s.ventana.dias_hasta_compromiso_maximo)} (proyección lineal, SUPUESTO).
      </Text>
      <Text fontSize="sm">
        <strong>Traslado:</strong> {s.traslado_personas.vehiculo}, {fmtNum(s.traslado_personas.viajes)} viajes por acceso {s.traslado_personas.superficie_acceso}.
        {s.camiones_jaula > 0 ? ` ${s.camiones_jaula} camiones jaula.` : ""}
      </Text>
      <Text fontSize="sm">
        <strong>Centros:</strong> {s.asignacion_personas.map((a) => `${a.centro} (${fmtNum(a.cantidad)})`).join(", ") || "sin asignación"}.
        {s.personas_sin_lugar > 0 ? ` Sin lugar: ${fmtNum(s.personas_sin_lugar)} personas.` : ""}
        {s.animales_sin_cupo > 0 ? ` Sin cupo: ${fmtNum(s.animales_sin_cupo)} animales.` : ""}
      </Text>
      <Text fontSize="sm">
        <strong>Cuadrillas sugeridas:</strong> {s.cuadrillas_sugeridas.map((q) => q.tipo).join(", ") || "ninguna"}.
      </Text>
      {s.advertencias.map((a) => (
        <Text key={a} fontSize="xs" color="cat.simulado.fg">
          {a}
        </Text>
      ))}
    </Box>
  );
}

function ResumenPlan({ p }: { p: Plan }) {
  const m = p.metricas;
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={3} fontSize="sm">
      <Text>Personas a evacuar: <strong>{fmtNum(m.personas_a_evacuar)}</strong></Text>
      <Text>Con lugar: <strong>{fmtNum(m.personas_evacuadas)}</strong></Text>
      <Text>Sin lugar: <strong>{fmtNum(m.personas_sin_lugar)}</strong></Text>
      <Text>Camiones jaula: <strong>{fmtNum(m.camiones_jaula_necesarios)}</strong></Text>
    </SimpleGrid>
  );
}

function BloqueRecomendacion() {
  const { entrada, fijarAltura, fijarLluvia } = useEscenario();
  const [prioridad, setPrioridad] = useState<"riesgo" | "poblacion">("riesgo");
  const [r, setR] = useState<Recomendacion | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);

  async function generar(override?: { altura_formosa_m: number; lluvia_mm: number }) {
    setCargando(true);
    setError(null);
    try {
      const escenarioEntrada = override ? { ...entrada, ...override } : entrada;
      setR(await api.recomendacion(escenarioEntrada, prioridad));
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Seccion titulo="Recomendador de evacuación por sector" categoria="SIMULADO" id="sec-reco">
      <Alert status="info" mb={3} fontSize="sm">
        <AlertIcon />
        <AlertDescription data-testid="etiqueta-recomendacion">
          RECOMENDACIÓN, no una orden: la orden la emite una persona con rol autorizado (sección Órdenes) y queda registrada.
        </AlertDescription>
      </Alert>
      <Box layerStyle="suave" p={3} mb={3}>
        <Text fontSize="xs" fontWeight={700} mb={1.5}>
          Probar escenarios de evacuación en 1 clic (SIMULADO):
        </Text>
        <Flex gap={1.5} wrap="wrap">
          {ESCENARIOS_EVACUACION.map((esc) => (
            <Button
              key={esc.etiqueta}
              size="xs"
              variant={Math.abs(entrada.altura_formosa_m - esc.altura) < 0.03 && entrada.lluvia_mm === esc.lluvia ? "solid" : "outline"}
              type="button"
              onClick={() => {
                fijarAltura(esc.altura);
                fijarLluvia(esc.lluvia);
                void generar({ altura_formosa_m: esc.altura, lluvia_mm: esc.lluvia });
              }}
            >
              {esc.etiqueta}
            </Button>
          ))}
        </Flex>
      </Box>
      <Text fontSize="sm" mb={2}>
        Escenario: {fmtM(entrada.altura_formosa_m)} en Puerto Formosa, {fmtNum(entrada.lluvia_mm)} mm ({entrada.lluvia_origen}), {entrada.caminos_cerrados.length} caminos cerrados. Se cambian acá o en Mapa y simulador.
      </Text>
      <Flex gap={3} align="flex-end" mb={3} wrap="wrap">
        <FormControl w="auto">
          <FormLabel htmlFor="reco-prioridad" fontSize="sm" mb={0}>
            Prioridad
          </FormLabel>
          <Select id="reco-prioridad" size="sm" bg="superficie" value={prioridad} onChange={(e) => setPrioridad(e.target.value as "riesgo" | "poblacion")}>
            <option value="riesgo">Por riesgo (menor margen primero)</option>
            <option value="poblacion">Por población (más personas primero)</option>
          </Select>
        </FormControl>
        <Button size="sm" onClick={() => void generar()} isLoading={cargando}>
          Generar recomendación
        </Button>
      </Flex>
      <AlertaError error={error} />
      {r && (
        <Box data-testid="recomendacion">
          <Flex gap={2} align="center" justify="space-between" wrap="wrap" mb={2}>
            <Flex gap={2} align="center">
              <Heading as="h3" size="xs">
                {r.etiqueta}
              </Heading>
              <Insignia categoria={r.categoria} />
            </Flex>
            {r.recomendacion.sectores.length > 0 && (
              <Button
                as={RouterLink}
                to={`/comando/ordenes?sectores=${r.recomendacion.sectores.map((s) => s.id).join(",")}&tipo=evacuacion_preventiva`}
                size="xs"
                variant="outline"
              >
                Preparar orden de evacuación para {r.recomendacion.sectores.map((s) => s.id).join(", ")} →
              </Button>
            )}
          </Flex>
          <ResumenPlan p={r.recomendacion} />
          {r.recomendacion.sectores.length === 0 ? (
            <Alert status="success" fontSize="sm">
              <AlertIcon />
              Ningún sector está comprometido ni en riesgo con estos valores: no hay nada que recomendar evacuar.
            </Alert>
          ) : (
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
              {r.recomendacion.sectores.map((s) => (
                <TarjetaSector key={s.id} s={s} />
              ))}
            </SimpleGrid>
          )}
          <Box mt={3}>
            {r.limites.map((l) => (
              <Text key={l} fontSize="xs" color="textoSuave">
                {l}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </Seccion>
  );
}

function BloqueComparador() {
  const { entrada } = useEscenario();
  const centros = useCarga(() => api.centros());
  const [nombre, setNombre] = useState("");
  const [orden, setOrden] = useState("");
  const [excluidos, setExcluidos] = useState<number[]>([]);
  const [res, setRes] = useState<Alternativas | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);

  async function comparar(override?: { nombre: string; orden: string; excluidos: number[] }) {
    setCargando(true);
    setError(null);
    try {
      const nom = (override ? override.nombre : nombre).trim();
      const ord = override ? override.orden : orden;
      const exc = override ? override.excluidos : excluidos;
      const ids = ord
        .split(/[\s,]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      setRes(await api.alternativas(entrada, { nombre: nom || undefined, orden_sectores: ids.length ? ids : undefined, centros_excluidos: exc }));
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Seccion titulo="Comparador de alternativas" categoria="SIMULADO" id="sec-comp">
      <Text fontSize="sm" mb={3}>
        Se generan dos alternativas (prioridad por riesgo y por población) y una tercera editable: indicá el orden de los sectores y los centros que no se usarían, o elegí una estrategia preconfigurada.
      </Text>
      <Box layerStyle="suave" p={3} mb={3}>
        <Text fontSize="xs" fontWeight={700} mb={1.5}>
          Opciones estratégicas de evacuación para la 3.ª alternativa editable:
        </Text>
        <Flex gap={1.5} wrap="wrap">
          {OPCIONES_ALTERNATIVAS.map((op) => (
            <Button
              key={op.etiqueta}
              size="xs"
              variant={nombre === op.nombre && orden === op.orden ? "solid" : "outline"}
              type="button"
              onClick={() => {
                setNombre(op.nombre);
                setOrden(op.orden);
                setExcluidos([...op.excluidos]);
                void comparar({ nombre: op.nombre, orden: op.orden, excluidos: [...op.excluidos] });
              }}
            >
              {op.etiqueta}
            </Button>
          ))}
        </Flex>
      </Box>
      <Flex gap={3} wrap="wrap" mb={3} align="flex-end">
        <FormControl w="14rem">
          <FormLabel htmlFor="alt-nombre" fontSize="sm" mb={0}>
            Nombre de la alternativa editable
          </FormLabel>
          <Input id="alt-nombre" size="sm" bg="superficie" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
        </FormControl>
        <FormControl w="14rem">
          <FormLabel htmlFor="alt-orden" fontSize="sm" mb={0}>
            Orden de sectores (ej.: S4, S1)
          </FormLabel>
          <Input id="alt-orden" size="sm" bg="superficie" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </FormControl>
        <Button size="sm" onClick={() => void comparar()} isLoading={cargando}>
          Comparar alternativas
        </Button>
      </Flex>
      {(centros.datos?.centros ?? []).length > 0 && (
        <Box mb={3}>
          <Text fontSize="sm" fontWeight={600}>
            Centros que no se usarían en la alternativa editable
          </Text>
          <Flex gap={4} wrap="wrap">
            {(centros.datos?.centros ?? []).map((c) => (
              <Checkbox key={c.id} size="sm" isChecked={excluidos.includes(c.id)} onChange={() => setExcluidos((x) => (x.includes(c.id) ? x.filter((i) => i !== c.id) : [...x, c.id]))}>
                {c.nombre}
              </Checkbox>
            ))}
          </Flex>
        </Box>
      )}
      <AlertaError error={error} />
      {res && (
        <Box data-testid="comparacion">
          <Flex gap={2} align="center" mb={2}>
            <Heading as="h3" size="xs">
              {res.etiqueta}
            </Heading>
            <Insignia categoria={res.categoria} />
          </Flex>
          <TablaDesplazable etiqueta="Comparación de alternativas lado a lado">
            <Table size="sm" aria-label="Comparación de alternativas lado a lado">
              <Thead>
                <Tr>
                  <Th>Métrica</Th>
                  {res.alternativas.map((a) => (
                    <Th key={a.id} whiteSpace="normal">
                      {a.nombre}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                <Tr>
                  <Td fontWeight={600}>Orden de sectores</Td>
                  {res.alternativas.map((a) => (
                    <Td key={a.id}>{a.orden_sectores.join(" → ") || "ninguno"}</Td>
                  ))}
                </Tr>
                {res.comparacion.map((fila) => (
                  <Tr key={fila.metrica}>
                    <Td fontWeight={600} whiteSpace="normal">
                      {fila.etiqueta}
                    </Td>
                    {fila.valores.map((v, i) => (
                      <Td key={i} whiteSpace="normal">
                        {fmtValor(v)}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TablaDesplazable>
          <Text fontSize="xs" color="textoSuave" mt={2}>
            Tiempos con flota compartida y velocidades por superficie (SUPUESTO). Cada alternativa quedó guardada con el snapshot del escenario.
          </Text>
        </Box>
      )}
    </Seccion>
  );
}

export default function PaginaRecomendacion() {
  return (
    <>
      <Heading as="h1" size="lg" mb={4}>
        Recomendación y alternativas
      </Heading>
      <BloqueRecomendacion />
      <BloqueComparador />
    </>
  );
}
