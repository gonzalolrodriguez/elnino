import { Alert, AlertIcon, Box, Button, Flex, List, ListItem, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Campo, CampoSelect, AlertaError, GrupoCampos } from "../../components/Formulario";
import { Contador } from "../../components/Contador";
import { IconoCaja } from "../../components/iconos/Iconos";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { Plegable } from "../recomendacion/piezas";
import type { CalculoGanadero } from "../tipos";
import { APILAR, fmtFecha, fmtNum, Seccion } from "../ui";

/** `clave` es lo que entiende el backend; `etiqueta` es lo que lee la persona. */
const BOVINOS = [
  { clave: "vaca preñada", etiqueta: "Vaca preñada" },
  { clave: "vaca vacía", etiqueta: "Vaca vacía" },
  { clave: "vaca con cría", etiqueta: "Vaca con cría" },
  { clave: "ternero al pie", etiqueta: "Ternero al pie" },
  { clave: "vaquillona", etiqueta: "Vaquillona" },
  { clave: "toro", etiqueta: "Toro" },
] as const;
const MENORES = [
  { clave: "caprino", etiqueta: "Caprinos" },
  { clave: "ovino", etiqueta: "Ovinos" },
  { clave: "porcino", etiqueta: "Porcinos" },
] as const;

const MAX_CABEZAS = 100000;
const MAX_ALBARDON = 1_000_000_000;

/** Entero entre 0 y `max`, o `null` si el texto no lo es. */
function aEntero(texto: string, max: number): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
}

const humanizar = (k: string) => {
  const t = k.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const textoSupuesto = (v: unknown): string => {
  if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => `${humanizar(k)}: ${String(x)}`).join(", ");
  return String(v);
};

/** Cifra del resultado: rótulo, valor tabular y una línea de contexto. */
function Figura({ etiqueta, valor, nota, testId }: { etiqueta: string; valor: ReactNode; nota?: ReactNode; testId?: string }) {
  return (
    <Box minW={0}>
      <Text textStyle="rotulo">{etiqueta}</Text>
      <Text textStyle="cifraMedia" my={1} data-testid={testId}>
        {valor}
      </Text>
      {nota && <Text textStyle="microdato">{nota}</Text>}
    </Box>
  );
}

function Resultado({ r }: { r: CalculoGanadero }) {
  const d = r.dormidero;
  const dormidero =
    d.alcanza === null
      ? "Sin superficie de albardón informada."
      : d.alcanza
        ? "El albardón alcanza."
        : `Faltan ${fmtNum(d.faltante_m2 ?? 0, 0)} m² de albardón.`;
  return (
    <Seccion titulo="Resultado del cálculo" categoria={r.categoria} id="sec-resultado-ganaderia">
      <Box data-testid="resultado-ganaderia">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: 4, md: 6 }} p={{ base: 4, md: 5 }} bg="pizarra.50" border="1px solid" borderColor="borde" borderRadius="xl">
          <Figura
            etiqueta="Camiones jaula"
            valor={<span data-testid="camiones-jaula">{fmtNum(r.transporte.camiones_jaula)}</span>}
            nota={`${r.transporte.bovinos_por_camion} bovinos por camión (supuesto del equipo)${r.transporte.camion_con_divisiones ? ", con divisiones" : ""}`}
          />
          <Figura etiqueta="Dormidero necesario" valor={<span data-testid="dormidero-m2">{fmtNum(d.m2_necesarios, 0)} m²</span>} nota={`${dormidero}${d.divisiones_internas ? " Necesita divisiones internas." : ""}`} />
          <Figura etiqueta="Maíz por día" valor={<span data-testid="racion-maiz">{fmtNum(r.racion_diaria.maiz_kg, 1)} kg</span>} nota="Ración diaria (INTA, a verificar)" />
          <Figura etiqueta="Pellet de girasol por día" valor={<span data-testid="racion-pellet">{fmtNum(r.racion_diaria.pellet_girasol_kg, 1)} kg</span>} nota="Ración diaria (INTA, a verificar)" />
        </SimpleGrid>

        {r.advertencias.map((a) => (
          <Alert key={a} status="warning" mt={4}>
            <AlertIcon />
            {a}
          </Alert>
        ))}

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 5, lg: 8 }} mt={5}>
          <Box>
            <Text textStyle="tituloBloque" as="h3" mb={2}>
              Qué hay que preparar
            </Text>
            <List spacing={2}>
              <ListItem>
                <strong>Vehículos de categoría B:</strong> {fmtNum(r.transporte.vehiculos_categoria_b)}. {r.transporte.nota}
              </ListItem>
              <ListItem>
                <strong>Lotes en destino:</strong> hasta {fmtNum(r.lote_maximo_cabezas)} cabezas cada uno.
              </ListItem>
              {r.apicultura && (
                <ListItem>
                  <strong>Colmenas:</strong> {r.apicultura.recomendacion}
                </ListItem>
              )}
            </List>
          </Box>
          <Box>
            <Text textStyle="tituloBloque" as="h3" mb={2}>
              Checklist en destino
            </Text>
            <List spacing={1.5} styleType="disc" pl={5}>
              {r.checklist_destino.map((c) => (
                <ListItem key={c}>{c}</ListItem>
              ))}
            </List>
          </Box>
        </SimpleGrid>

        <Plegable mt={5} resumen="Supuestos usados en el cálculo">
          <TablaDesplazable etiqueta="Supuestos del cálculo ganadero">
            <Table size="sm" aria-label="Supuestos del cálculo ganadero" sx={APILAR}>
              <Thead>
                <Tr>
                  <Th>Supuesto</Th>
                  <Th>Valor</Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.entries(r.supuestos).map(([k, v]) => (
                  <Tr key={k}>
                    <Td data-etiqueta="Supuesto">{humanizar(k)}</Td>
                    <Td data-etiqueta="Valor" whiteSpace="normal">
                      {textoSupuesto(v)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TablaDesplazable>
        </Plegable>
        <Text textStyle="microdato" mt={2}>
          {r.fuente}. Fecha del cálculo: {fmtFecha(r.fecha_dato)}.
        </Text>
      </Box>
    </Seccion>
  );
}

export default function Produccion() {
  const [bov, setBov] = useState<Record<string, string>>({ "vaca preñada": "8", "vaca vacía": "0", "vaca con cría": "10", "ternero al pie": "10", vaquillona: "1", toro: "1" });
  const [otros, setOtros] = useState<Record<string, string>>({ caprino: "0", ovino: "0", porcino: "0" });
  const [vivas, setVivas] = useState("0");
  const [muertas, setMuertas] = useState("0");
  const [traslado, setTraslado] = useState("vehicular");
  const [albardon, setAlbardon] = useState("200");
  const [intento, setIntento] = useState(false);
  const [r, setR] = useState<CalculoGanadero | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);

  const errorEntero = (texto: string, max = MAX_CABEZAS) => (intento && aEntero(texto, max) === null ? `Ingresá un número entero entre 0 y ${max.toLocaleString("es-AR")}.` : undefined);
  const totalBovinos = BOVINOS.reduce((s, c) => s + (aEntero(bov[c.clave] ?? "", MAX_CABEZAS) ?? 0), 0);
  const hayErrores =
    BOVINOS.some((c) => aEntero(bov[c.clave] ?? "", MAX_CABEZAS) === null) ||
    MENORES.some((e) => aEntero(otros[e.clave] ?? "", MAX_CABEZAS) === null) ||
    aEntero(vivas, MAX_CABEZAS) === null ||
    aEntero(muertas, MAX_CABEZAS) === null ||
    aEntero(albardon, MAX_ALBARDON) === null;

  async function calcular() {
    setIntento(true);
    if (hayErrores) return;
    const n = (t: string, max = MAX_CABEZAS) => aEntero(t, max) ?? 0;
    setCargando(true);
    setError(null);
    try {
      setR(
        await api.ganaderia({
          bovinos: BOVINOS.filter((c) => n(bov[c.clave] ?? "") > 0).map((c) => ({ categoria: c.clave, cantidad: n(bov[c.clave] ?? "") })),
          otros: MENORES.filter((e) => n(otros[e.clave] ?? "") > 0).map((e) => ({ especie: e.clave, cantidad: n(otros[e.clave] ?? "") })),
          ...(n(vivas) + n(muertas) > 0 ? { colmenas: { vivas: n(vivas), muertas: n(muertas), traslado } } : {}),
          superficie_albardon_m2: n(albardon, MAX_ALBARDON),
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
      <CabeceraPagina
        titulo="Producción y ganado"
        icono={<IconoCaja tam="1.5rem" />}
        ayuda="Calculá camiones, dormidero y raciones para trasladar un rodeo y sus colmenas. Es una estimación para planificar, no una orden."
      />
      <Seccion titulo="Calculadora ganadera" categoria="SIMULADO" id="sec-ganaderia">
        <Text textStyle="microdato" mb={5} maxW="70ch">
          El rodeo de ejemplo es el caso de control (8 preñadas, 10 con cría, 10 terneros, 1 vaquillona y 1 toro). Las capacidades y raciones son supuestos a verificar, no normativa.
        </Text>
        <Box as="form" noValidate onSubmit={(e: React.FormEvent) => { e.preventDefault(); void calcular(); }}>
          <Box display="grid" rowGap={7}>
            <GrupoCampos leyenda="Bovinos por categoría" ayuda={`Cabezas del rodeo. Total cargado: ${fmtNum(totalBovinos)}.`}>
              <SimpleGrid columns={{ base: 2, lg: 3 }} spacing={4}>
                {BOVINOS.map((c) => (
                  <Contador key={c.clave} id={`bov-${c.clave}`} etiqueta={c.etiqueta} value={bov[c.clave] ?? ""} max={MAX_CABEZAS} error={errorEntero(bov[c.clave] ?? "")} onChange={(v) => setBov((b) => ({ ...b, [c.clave]: v }))} />
                ))}
              </SimpleGrid>
            </GrupoCampos>
            <GrupoCampos leyenda="Animales menores">
              <SimpleGrid columns={{ base: 2, lg: 3 }} spacing={4}>
                {MENORES.map((e) => (
                  <Contador key={e.clave} id={`menor-${e.clave}`} etiqueta={e.etiqueta} value={otros[e.clave] ?? ""} max={MAX_CABEZAS} error={errorEntero(otros[e.clave] ?? "")} onChange={(v) => setOtros((o) => ({ ...o, [e.clave]: v }))} />
                ))}
              </SimpleGrid>
            </GrupoCampos>
            <GrupoCampos leyenda="Colmenas" ayuda="Si no hay colmenas, dejá ambos valores en 0.">
              <SimpleGrid columns={{ base: 2, lg: 3 }} spacing={4}>
                <Contador id="colmenas-vivas" etiqueta="Colmenas vivas" value={vivas} max={MAX_CABEZAS} error={errorEntero(vivas)} onChange={setVivas} />
                <Contador id="colmenas-muertas" etiqueta="Colmenas muertas" value={muertas} max={MAX_CABEZAS} error={errorEntero(muertas)} onChange={setMuertas} />
                <Box gridColumn={{ base: "1 / -1", lg: "auto" }}>
                  <CampoSelect id="colmenas-traslado" etiqueta="Traslado de colmenas" ayuda="Solo se usa si hay colmenas." value={traslado} onChange={(e) => setTraslado(e.target.value)}>
                    <option value="vehicular">Vehicular</option>
                    <option value="a_pie">A pie</option>
                  </CampoSelect>
                </Box>
              </SimpleGrid>
            </GrupoCampos>
            <GrupoCampos leyenda="Albardón" angosto>
              <Campo
                id="albardon"
                etiqueta="Superficie del albardón (m²)"
                ayuda="La loma alta donde el rodeo puede esperar en seco."
                inputMode="numeric"
                value={albardon}
                error={errorEntero(albardon, MAX_ALBARDON)}
                onChange={(e) => setAlbardon(e.target.value)}
              />
            </GrupoCampos>
          </Box>
          <Flex mt={6} gap={3} align="center" wrap="wrap">
            <Button type="submit" isLoading={cargando} w={{ base: "100%", md: "auto" }}>
              Calcular
            </Button>
            {intento && hayErrores && (
              <Text textStyle="microdato" color="evacuacion.700" fontWeight={600} role="alert">
                Revisá los campos marcados antes de calcular.
              </Text>
            )}
          </Flex>
        </Box>
        <Box mt={3}>
          <AlertaError error={error} />
        </Box>
      </Seccion>
      {r && <Resultado r={r} />}
    </>
  );
}
