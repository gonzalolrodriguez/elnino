import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Select,
  Text,
  useToast,
} from "@chakra-ui/react";
import { PERFILES_RUTEO } from "@evacuaciones/shared";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { MuestraEstado } from "../../components/MuestraEstado";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useEscenario } from "../EscenarioContext";
import { Simulador } from "../Simulador";
import type { AccesoProps, CapaOficial, Ruta } from "../tipos";
import { Cargando, fmtFecha, fmtNum, NOMBRE_ACCESO, Seccion } from "../ui";

const MapaGL = lazy(() => import("../MapaGL"));

async function cargarCapas(): Promise<{ capas: CapaOficial[] }> {
  const r = await fetch(`${import.meta.env.BASE_URL}capas/capas.json`);
  if (!r.ok) throw new Error("No se pudo cargar el manifiesto de capas oficiales.");
  return (await r.json()) as { capas: CapaOficial[] };
}

const PERFIL_TEXTO: Record<string, string> = { vehicular: "Vehicular", camion_jaula: "Camión jaula", arreo: "Arreo a pie" };

function centroide(anillo: number[][]): { lon: number; lat: number } {
  return { lon: anillo.reduce((s, p) => s + p[0], 0) / anillo.length, lat: anillo.reduce((s, p) => s + p[1], 0) / anillo.length };
}

function PanelAcceso({ acceso, alCambiar }: { acceso: AccesoProps; alCambiar: () => void }) {
  const { alternarCamino, entrada } = useEscenario();
  const toast = useToast();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const motivoInvalido = intento && motivo.trim().length < 3;

  async function marcar(transitable: boolean) {
    setIntento(true);
    if (!transitable && motivo.trim().length < 3) return;
    setGuardando(true);
    setError(null);
    try {
      await api.marcarAcceso(acceso.id, transitable, motivo.trim());
      toast({ title: transitable ? "Acceso marcado como transitable" : "Acceso marcado como no transitable", description: acceso.nombre, status: "success", duration: 4000 });
      setMotivo("");
      setIntento(false);
      alCambiar();
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Box data-testid="panel-acceso">
      <Text fontSize="sm">
        <strong>{acceso.nombre}</strong> · superficie {acceso.superficie}
        {acceso.sector_id ? ` · sector ${acceso.sector_id}` : ""}
      </Text>
      <Text fontSize="sm" mb={2}>
        Estado: <strong>{acceso.transitable ? "transitable" : "no transitable"}</strong>
        {!acceso.transitable && acceso.motivo ? ` (${acceso.motivo})` : ""}
        {acceso.actualizado_por_rol ? ` · actualizado por ${acceso.actualizado_por_rol} el ${fmtFecha(acceso.actualizado_en)}` : ""}.
      </Text>
      <FormControl isInvalid={motivoInvalido} mb={2}>
        <FormLabel htmlFor="motivo-acceso" fontSize="sm" mb={0}>
          Motivo (obligatorio para marcarlo no transitable)
        </FormLabel>
        <Input id="motivo-acceso" size="sm" bg="superficie" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
        <FormErrorMessage>Indicá el motivo (al menos 3 caracteres).</FormErrorMessage>
      </FormControl>
      <Flex gap={2} wrap="wrap">
        <Button size="sm" colorScheme="red" isLoading={guardando} onClick={() => void marcar(false)} isDisabled={!acceso.transitable}>
          Marcar no transitable
        </Button>
        <Button size="sm" variant="outline" isLoading={guardando} onClick={() => void marcar(true)} isDisabled={acceso.transitable}>
          Marcar transitable
        </Button>
        <Checkbox size="sm" isChecked={entrada.caminos_cerrados.includes(acceso.id)} onChange={() => alternarCamino(acceso.id)}>
          Cerrar solo en la simulación
        </Checkbox>
      </Flex>
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}

function PanelRuteo({ ruta, setRuta, origenManual, setModoOrigen, modoOrigen, setOrigenManual }: {
  ruta: Ruta | null;
  setRuta: (r: Ruta | null) => void;
  origenManual: { lon: number; lat: number } | null;
  setOrigenManual: (p: { lon: number; lat: number } | null) => void;
  modoOrigen: boolean;
  setModoOrigen: (v: boolean) => void;
}) {
  const { entrada } = useEscenario();
  const sectores = useCarga(() => api.sectores());
  const centros = useCarga(() => api.centros());
  const [perfil, setPerfil] = useState<string>("vehicular");
  const [origenSector, setOrigenSector] = useState("S4");
  const [centroId, setCentroId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [calculando, setCalculando] = useState(false);

  async function trazar() {
    setError(null);
    setCalculando(true);
    try {
      const f = sectores.datos?.features.find((x) => String(x.properties.id) === origenSector);
      const origen = origenManual ?? (f ? centroide((f.geometry.coordinates as number[][][])[0]) : null);
      if (!origen || !centroId) throw new Error("Elegí un origen y un centro de recepción de destino.");
      const r = await api.ruteo({
        perfil,
        origen,
        centro_id: Number(centroId),
        altura_formosa_m: entrada.altura_formosa_m,
        lluvia_mm: entrada.lluvia_mm,
        caminos_cerrados: entrada.caminos_cerrados,
      });
      setRuta(r);
    } catch (e) {
      setError(e);
      setRuta(null);
    } finally {
      setCalculando(false);
    }
  }

  return (
    <Box>
      <Flex gap={2} wrap="wrap" mb={2}>
        <FormControl w="auto">
          <FormLabel htmlFor="ruta-perfil" fontSize="xs" mb={0}>
            Perfil
          </FormLabel>
          <Select id="ruta-perfil" size="sm" bg="superficie" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            {PERFILES_RUTEO.map((p) => (
              <option key={p} value={p}>
                {PERFIL_TEXTO[p]}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="auto">
          <FormLabel htmlFor="ruta-origen" fontSize="xs" mb={0}>
            Origen
          </FormLabel>
          <Select id="ruta-origen" size="sm" bg="superficie" value={origenSector} onChange={(e) => { setOrigenSector(e.target.value); setOrigenManual(null); }}>
            {(sectores.datos?.features ?? []).map((f) => (
              <option key={String(f.properties.id)} value={String(f.properties.id)}>
                Sector {String(f.properties.id)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="auto">
          <FormLabel htmlFor="ruta-destino" fontSize="xs" mb={0}>
            Destino
          </FormLabel>
          <Select id="ruta-destino" size="sm" bg="superficie" placeholder="Centro de recepción" value={centroId} onChange={(e) => setCentroId(e.target.value)}>
            {(centros.datos?.centros ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </FormControl>
      </Flex>
      <Flex gap={2} wrap="wrap" align="center">
        <Button size="sm" onClick={() => void trazar()} isLoading={calculando}>
          Trazar ruta
        </Button>
        <Button size="sm" variant={modoOrigen ? "solid" : "outline"} onClick={() => setModoOrigen(!modoOrigen)} aria-pressed={modoOrigen}>
          {modoOrigen ? "Hacé clic en el mapa" : "Elegir origen en el mapa"}
        </Button>
        {origenManual && (
          <Button size="sm" variant="ghost" onClick={() => setOrigenManual(null)}>
            Quitar origen del mapa
          </Button>
        )}
      </Flex>
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
      {ruta && (
        <Box mt={3} data-testid="resultado-ruta" fontSize="sm">
          <Flex gap={2} align="center" mb={1}>
            <strong>{ruta.encontrada ? "Ruta encontrada" : "Sin ruta"}</strong>
            <Insignia categoria="SIMULADO" />
            <Text as="span" color="textoSuave">
              método: {ruta.metodo === "pgrouting" ? "red vial (pgRouting)" : "aproximado"}
            </Text>
          </Flex>
          {ruta.encontrada && ruta.distancia_m !== undefined && (
            <Text>
              {fmtNum(ruta.distancia_m / 1000, 1)} km · {fmtNum(ruta.tiempo_min ?? 0, 0)} min estimados (velocidades SUPUESTO)
            </Text>
          )}
          {!ruta.encontrada && ruta.motivo && <Text>{ruta.motivo}</Text>}
          {ruta.limitacion && (
            <Alert status="warning" mt={2} fontSize="sm" data-testid="ruta-limitacion">
              <AlertIcon />
              <AlertDescription>{ruta.limitacion}</AlertDescription>
            </Alert>
          )}
          {ruta.advertencias.map((a) => (
            <Text key={a} fontSize="xs" color="textoSuave">
              {a}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** Barras de color del tinte: la local (rampa propia del corredor) y la de la cuenca, con sus extremos en metros. */
function RampaRelieve({ local, cuenca }: { local: [number, string][]; cuenca: [number, string][] }) {
  const barra = (r: [number, string][]) => `linear-gradient(90deg, ${r.map((p) => p[1]).join(", ")})`;
  const redondo = (n: number) => Math.round(n);
  return (
    <Box ml={6} my={1} aria-label="Escala de color del relieve" role="group">
      <Text fontSize="11px" color="textoSuave">
        Corredor de los sectores: {redondo(local[0][0])} m
        <Box as="span" display="inline-block" w="7rem" h="8px" mx={2} style={{ background: barra(local) }} />
        {redondo(local[local.length - 1][0])} m
      </Text>
      <Text fontSize="11px" color="textoSuave">
        Cuenca (vista general): {redondo(cuenca[1][0])} m
        <Box as="span" display="inline-block" w="7rem" h="8px" mx={2} style={{ background: barra(cuenca.slice(1)) }} />
        {redondo(cuenca[cuenca.length - 2][0])}+ m
      </Text>
    </Box>
  );
}

function SelectorCapas({ capas, activas, alternar, osm, setOsm }: { capas: CapaOficial[]; activas: string[]; alternar: (id: string) => void; osm: boolean; setOsm: (v: boolean) => void }) {
  return (
    <Box>
      {capas.map((c) => (
        <Box key={c.id} mb={2}>
          <Checkbox size="sm" isChecked={activas.includes(c.id)} onChange={() => alternar(c.id)}>
            {c.etiqueta}{c.n > 0 && (
              <Text as="span" color="textoSuave">
                {" "}({fmtNum(c.n)})
              </Text>
            )}
          </Checkbox>
          <Flex ml={6} gap={2} align="center" wrap="wrap">
            <Insignia categoria={c.categoria} />
            <Text fontSize="11px" color="textoSuave">
              Fuente: {c.nombre_fuente}. Fecha de actualización: {fmtFecha(c.fecha_actualizacion)}. {c.licencia.split(".")[0]}.
            </Text>
          </Flex>
          {c.id === "relieve" && c.rampa_local && c.rampa_cuenca && <RampaRelieve local={c.rampa_local} cuenca={c.rampa_cuenca} />}
          {c.nota && (
            <Text ml={6} fontSize="11px" color="pizarra.700">
              {c.nota}
            </Text>
          )}
        </Box>
      ))}
      <Checkbox size="sm" isChecked={osm} onChange={(e) => setOsm(e.target.checked)}>
        Fondo OpenStreetMap (requiere internet)
      </Checkbox>
      <Text ml={6} fontSize="11px" color="textoSuave">
        Sin conexión el mapa usa fondo liso y las capas incluidas en el repositorio. © colaboradores de OpenStreetMap (ODbL).
      </Text>
    </Box>
  );
}

function Leyenda() {
  const linea = (color: string, texto: string) => (
    <Flex align="center" gap={2} fontSize="sm">
      <Box w="1.25rem" h="4px" bg={color} aria-hidden="true" />
      {texto}
    </Flex>
  );
  return (
    <Flex wrap="wrap" aria-label="Leyenda del mapa" role="group" mt={3} align="center" columnGap={5} rowGap={2}>
      <Flex align="center" gap={2} fontSize="sm">
        sector: <MuestraEstado estado="comprometido" /> <MuestraEstado estado="en_riesgo" /> <MuestraEstado estado="normal" />
      </Flex>
      {linea("acceso.transitable", "acceso transitable")}
      {linea("acceso.cerrado", "acceso cerrado")}
      {linea("acceso.lluvia", "intransitable por lluvia")}
      {linea("acceso.anegado", "anegado")}
      {linea("acceso.ruta", "ruta calculada")}
      <Text fontSize="sm" flexBasis="100%">
        Círculos verdes: centros de recepción (SIMULADO). Círculos oscuros con borde ámbar: estaciones K3 (DATO OBSERVADO). Borde grueso: sector aislado.
      </Text>
    </Flex>
  );
}

export default function MapaOperativo() {
  const { escenario, entrada } = useEscenario();
  const sectores = useCarga(() => api.sectores());
  const accesos = useCarga(() => api.accesos());
  const centros = useCarga(() => api.centros());
  const estaciones = useCarga(() => api.estaciones());
  const capas = useCarga(cargarCapas);
  const [capasActivas, setCapasActivas] = useState<string[]>(["localidades_parajes", "departamentos", "curvas_nivel", "relieve"]);
  const [osm, setOsm] = useState(false);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [modoOrigen, setModoOrigen] = useState(false);
  const [origenManual, setOrigenManual] = useState<{ lon: number; lat: number } | null>(null);

  const listaAccesos = useMemo(() => (accesos.datos?.features ?? []).map((f) => f.properties as unknown as AccesoProps), [accesos.datos]);
  const accesoSel = listaAccesos.find((a) => a.id === seleccion) ?? null;
  const estadoSectores = useMemo(() => Object.fromEntries((escenario?.sectores ?? []).map((s) => [s.id, s])), [escenario]);
  const estadoAccesos = useMemo(() => {
    const r: Record<number, string> = {};
    for (const s of escenario?.sectores ?? []) for (const a of s.accesos) r[a.id] = a.estado;
    return r;
  }, [escenario]);

  const { simular } = useEscenario();
  const recargarAccesos = accesos.recargar;
  const alCambiar = useCallback(() => {
    recargarAccesos();
    if (escenario) void simular();
  }, [recargarAccesos, escenario, simular]);

  useEffect(() => {
    if (!modoOrigen) return;
    const salir = (e: KeyboardEvent) => e.key === "Escape" && setModoOrigen(false);
    window.addEventListener("keydown", salir);
    return () => window.removeEventListener("keydown", salir);
  }, [modoOrigen]);

  return (
    <>
      <Heading as="h1" size="lg" mb={4}>
        Mapa operativo y simulador
      </Heading>
      <Flex direction={{ base: "column", xl: "row-reverse" }} align={{ base: "stretch", xl: "flex-start" }} sx={{ "& > * + *": { marginTop: "1rem" }, "@media (min-width: 80em)": { "& > * + *": { marginTop: 0, marginRight: "1rem" } } }}>
        <Box flex="1" w="100%" minW={0} position={{ xl: "sticky" }} top={{ xl: "calc(var(--altura-leyenda) + 1rem)" }}>
          <Box
            h={{ base: "60vh", xl: "75vh" }}
            minH="18rem"
            border="1px solid"
            borderColor="borde"
            bg="superficie"
            sx={{ "@supports (height: 1dvh)": { height: "60dvh", "@media (min-width: 80em)": { height: "75dvh" } } }}
          >
            <Suspense fallback={<Text p={4} role="status">Cargando mapa…</Text>}>
              <MapaGL
                sectores={sectores.datos}
                accesos={accesos.datos}
                centros={centros.datos?.centros ?? []}
                estaciones={estaciones.datos?.estaciones ?? []}
                estadoSectores={estadoSectores}
                estadoAccesos={estadoAccesos}
                cerradosSimulacion={entrada.caminos_cerrados}
                capas={capas.datos?.capas ?? []}
                capasActivas={capasActivas}
                fondoOsm={osm}
                ruta={ruta}
                modoOrigen={modoOrigen}
                origenRuta={origenManual}
                onAcceso={(a) => setSeleccion(a.id)}
                onPunto={(lon, lat) => { setOrigenManual({ lon, lat }); setModoOrigen(false); }}
              />
            </Suspense>
          </Box>
          <Leyenda />
          <Text fontSize="xs" color="textoSuave" mt={1}>
            Sectores K10 y accesos: SIMULADO. Capas territoriales: DOCUMENTO DE REFERENCIA (fuente y fecha en la lista de capas). Escala y fondo sin conexión; no hay claves de servicios externos.
          </Text>
        </Box>
        <Box w={{ base: "100%", xl: "26rem" }} flexShrink={0}>
          <Seccion titulo="Simulador de escenario" categoria="SIMULADO" id="sec-sim">
            <Simulador accesos={listaAccesos} />
          </Seccion>
          <Seccion titulo="Accesos y caminos" categoria="SIMULADO" id="sec-accesos">
            <Cargando carga={accesos} esVacio={() => listaAccesos.length === 0} vacio="No hay accesos cargados." hijos={() => (
              <>
                <Box as="ul" listStyleType="none" m={0} p={0} mb={3}>
                  {listaAccesos.map((a) => (
                    <li key={a.id}>
                      <Button
                        variant="unstyled"
                        display="flex"
                        w="100%"
                        h="auto"
                        py={1}
                        px={2}
                        textAlign="left"
                        fontSize="sm"
                        fontWeight={a.id === seleccion ? 700 : 400}
                        bg={a.id === seleccion ? "pizarra.100" : "transparent"}
                        onClick={() => setSeleccion(a.id)}
                        aria-pressed={a.id === seleccion}
                      >
                        {a.nombre} · {a.superficie} · {a.transitable ? "transitable" : "no transitable"}
                        {estadoAccesos[a.id] && estadoAccesos[a.id] !== "transitable" ? ` (escenario: ${NOMBRE_ACCESO[estadoAccesos[a.id]] ?? estadoAccesos[a.id]})` : ""}
                      </Button>
                    </li>
                  ))}
                </Box>
                {accesoSel ? <PanelAcceso key={accesoSel.id} acceso={accesoSel} alCambiar={alCambiar} /> : <Text fontSize="sm" color="textoSuave">Elegí un acceso de la lista o hacé clic sobre él en el mapa para marcarlo no transitable.</Text>}
              </>
            )} />
          </Seccion>
          <Seccion titulo="Ruteo" categoria="SIMULADO" id="sec-ruteo">
            <PanelRuteo ruta={ruta} setRuta={setRuta} origenManual={origenManual} setOrigenManual={setOrigenManual} modoOrigen={modoOrigen} setModoOrigen={setModoOrigen} />
          </Seccion>
          <Seccion titulo="Capas oficiales" categoria="DOCUMENTO DE REFERENCIA" id="sec-capas">
            <Cargando carga={capas} hijos={(c) => (
              <SelectorCapas
                capas={c.capas}
                activas={capasActivas}
                alternar={(id) => setCapasActivas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))}
                osm={osm}
                setOsm={setOsm}
              />
            )} />
          </Seccion>
        </Box>
      </Flex>
    </>
  );
}
