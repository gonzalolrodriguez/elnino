import { Box, Button, ButtonGroup, Table, Tbody, Td, Text, Th, Thead, Tr, VisuallyHidden } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Insignia } from "../components/Insignia";
import { MarcasUmbral } from "../components/MarcasUmbral";
import { MuestraEstado } from "../components/MuestraEstado";
import { TablaDesplazable } from "../components/TablaDesplazable";
import { K10_FECHA, MARGEN_RIESGO_M, SECTORES_K10 } from "../datos/kit";
import { fmt, fmtMiles, puedeUsar3D, useMenosMovimiento } from "../lib/entorno";
import { Inundacion2D } from "./Inundacion2D";
import type { ControlVista } from "./Inundacion3D";
import { EXAGERACION_INUNDACION, estadoSector, fraccionLlenado, INTERVALO_TERRAZA_M, TRAMO_VISUAL_M } from "./inundacion";
import { MapaSectores } from "./MapaSectores";
import { useInundacion } from "./useInundacion";

// El módulo 3D (three, R3F, drei) se descarga solo cuando hay WebGL y no se pidió menos movimiento.
const Inundacion3D = lazy(() => import("./Inundacion3D"));

export const ALTURA_CORTE_M = 5.6; // DATO OBSERVADO al 31/10/2026 (K1)
const ALTURA_FIN_CRECIDA_M = 8.3; // umbral de evacuación (K3)
const DURACION_CRECIDA_S = 8;
const PASO_M = 0.05;

export const LEYENDA_INUNDACION = `Relieve: SRTM (NASA/USGS) vía Mapzen Terrain Tiles · DOCUMENTO DE REFERENCIA. Agua: ilustrativa · SIMULADO; el momento de compromiso de cada sector es el de K10 v1.0. Exageración vertical ×${EXAGERACION_INUNDACION}. No es un modelo hidráulico.`;

const redondear = (v: number) => Math.round(v / PASO_M) * PASO_M;
const acotar = (v: number) => Math.min(12, Math.max(0, v));

/** Si el módulo 3D no se descarga o falla al dibujar, pasa al respaldo 2D sin romper la página. */
class Limite3D extends Component<{ alFallar: () => void; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  componentDidCatch() {
    this.props.alFallar();
  }
  render() {
    return this.state.fallo ? null : this.props.children;
  }
}

/** Valor que se estabiliza `ms` después del último cambio (para el aviso a lectores de pantalla). */
function useEstable<T>(valor: T, ms: number): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setV(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return v;
}

type Crecida = "detenida" | "en_curso" | "en_pausa";

/** «Reproducir crecida»: sube la altura de 5,60 a 8,30 m en ~8 s; se puede pausar y retomar. */
function useCrecida(altura: number, setAltura: (v: number) => void) {
  const [estado, setEstado] = useState<Crecida>("detenida");
  const h = useRef(altura);
  const marca = useRef(0);
  const cuadro = useRef(0);

  const detener = useCallback(() => {
    window.cancelAnimationFrame(cuadro.current);
    setEstado((e) => (e === "en_curso" ? "en_pausa" : e));
  }, []);

  const paso = useCallback(
    (t: number) => {
      const dt = Math.min((t - marca.current) / 1000, 0.1);
      marca.current = t;
      h.current = Math.min(ALTURA_FIN_CRECIDA_M, h.current + ((ALTURA_FIN_CRECIDA_M - ALTURA_CORTE_M) / DURACION_CRECIDA_S) * dt);
      setAltura(redondear(h.current));
      if (h.current >= ALTURA_FIN_CRECIDA_M) {
        setAltura(ALTURA_FIN_CRECIDA_M);
        setEstado("detenida");
        return;
      }
      cuadro.current = window.requestAnimationFrame(paso);
    },
    [setAltura],
  );

  const alternar = useCallback(() => {
    if (estado === "en_curso") return detener();
    // Retoma desde la altura actual si está dentro del tramo; si no, parte del valor observado al corte.
    h.current = altura >= ALTURA_CORTE_M && altura < ALTURA_FIN_CRECIDA_M ? altura : ALTURA_CORTE_M;
    setAltura(redondear(h.current));
    marca.current = performance.now();
    setEstado("en_curso");
    cuadro.current = window.requestAnimationFrame(paso);
  }, [estado, altura, detener, paso, setAltura]);

  useEffect(() => () => window.cancelAnimationFrame(cuadro.current), []);
  return { estado, alternar, detener };
}

/**
 * Bloque «Sectores de evaluación» de `/informacion`: relieve real con terrazas que se llenan de agua al subir la altura
 * simulada de Puerto Formosa. K10 (SIMULADO) decide cuándo se compromete cada sector; el relieve solo ordena dónde
 * avanza el agua dentro de él. La tabla es el equivalente en texto y se mantiene sincronizada.
 */
export function SectoresInundacion() {
  const [altura, setAltura] = useState(ALTURA_CORTE_M);
  const [texto, setTexto] = useState(fmtEntrada(ALTURA_CORTE_M));
  const { datos, fallo } = useInundacion();
  const reducido = useMenosMovimiento();
  const [webgl] = useState(puedeUsar3D);
  const [fallo3D, setFallo3D] = useState(false);
  const [prefiere2D, setPrefiere2D] = useState(false);
  const control = useRef<ControlVista | null>(null);
  const alFallar3D = useCallback(() => setFallo3D(true), []);

  const poner = useCallback((v: number) => {
    setAltura(v);
    setTexto(fmtEntrada(v));
  }, []);
  const crecida = useCrecida(altura, poner);

  const usar3D = !!datos && webgl && !reducido && !fallo3D && !prefiere2D;
  const resumen = useEstable(
    `Altura simulada ${fmt(altura)} m. ` + SECTORES_K10.map((s) => `${s.id} ${estadoSector(s, altura).replace("_", " ")}`).join(", ") + ".",
    700,
  );
  const estados = useMemo(() => SECTORES_K10.map((s) => ({ s, estado: estadoSector(s, altura), llenado: fraccionLlenado(altura, s.compromiso_m) })), [altura]);

  const manual = (v: number) => {
    crecida.detener();
    poner(acotar(v));
  };

  return (
    <Box>
      <Box display="flex" gap={2} alignItems="center" mb={3} flexWrap="wrap">
        <Insignia categoria={CATEGORIAS.SIMULADO} />
        <Insignia categoria={CATEGORIAS.REFERENCIA} />
        <Text fontSize="sm">K10 v1.0 · {K10_FECHA}. Sectores simulados: no son barrios ni parajes reales.</Text>
      </Box>

      <Box
        position="relative"
        h={{ base: "24rem", md: "34rem" }}
        borderRadius="2xl"
        overflow="hidden"
        border="1px solid"
        borderColor="borde"
        bg="pizarra.100"
        data-vista={usar3D ? "3d" : datos ? "2d" : "esquema"}
      >
        {fallo && (
          <Box p={3} h="100%" overflow="auto">
            <MapaSectores altura={altura} />
            <Text fontSize="xs" color="textoSuave" mt={2}>
              No se pudo cargar el relieve fino de los sectores: se muestra el esquema plano con el relieve regional.
            </Text>
          </Box>
        )}
        {!fallo && !datos && (
          <Text role="status" p={4} color="textoSuave">
            Cargando relieve de los sectores…
          </Text>
        )}
        {datos && !usar3D && (
          <Box h="100%" display="flex" alignItems="center" justifyContent="center" p={2}>
            <Inundacion2D datos={datos} altura={altura} />
          </Box>
        )}
        {datos && usar3D && (
          <Limite3D alFallar={alFallar3D}>
            <Suspense
              fallback={
                <Text role="status" p={4} color="textoSuave">
                  Cargando vista 3D…
                </Text>
              }
            >
              <Inundacion3D datos={datos} altura={altura} controlRef={control} onFallo={alFallar3D} />
            </Suspense>
          </Limite3D>
        )}
        {datos && (
          <Box position="absolute" left={3} top={3} px={2} py={1} bg="whiteAlpha.900" borderRadius="md" fontSize="xs" fontWeight={600} pointerEvents="none">
            {usar3D ? "Vista desde el sur · norte al fondo" : "Norte arriba"} · Altura {fmt(altura)} m
          </Box>
        )}
      </Box>

      {datos && usar3D && (
        <ButtonGroup mt={2} size="sm" variant="outline" isAttached={false} spacing={2} flexWrap="wrap" role="group" aria-label="Vista 3D">
          <Button onClick={() => control.current?.girar(-0.25)}>Girar a la izquierda</Button>
          <Button onClick={() => control.current?.girar(0.25)}>Girar a la derecha</Button>
          <Button onClick={() => control.current?.acercar()}>Acercar</Button>
          <Button onClick={() => control.current?.alejar()}>Alejar</Button>
          <Button onClick={() => control.current?.restablecer()}>Restablecer vista</Button>
        </ButtonGroup>
      )}
      {datos && webgl && !reducido && !fallo3D && (
        <Button mt={2} ml={usar3D ? 2 : 0} size="sm" variant="ghost" onClick={() => setPrefiere2D((v) => !v)}>
          {prefiere2D ? "Ver en 3D" : "Ver mapa 2D"}
        </Button>
      )}

      <Box mt={4} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 24rem) minmax(0, 1fr)" }} gap={{ base: 6, lg: 8 }} alignItems="start">
        <Box>
          <label htmlFor="altura-sim" style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
            Altura simulada de Puerto Formosa: {fmt(altura)} m
          </label>
          <input
            id="altura-sim"
            type="range"
            min={0}
            max={12}
            step={PASO_M}
            value={altura}
            onChange={(e) => manual(Number(e.target.value))}
            aria-valuetext={`${fmt(altura)} metros`}
            style={{ width: "100%", minHeight: "2rem" }}
          />
          <MarcasUmbral />
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap" mt={1}>
            <label htmlFor="altura-num" style={{ fontSize: "0.875rem" }}>
              Altura en metros
            </label>
            <input
              id="altura-num"
              type="number"
              inputMode="decimal"
              min={0}
              max={12}
              step={PASO_M}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                const v = Number(e.target.value.replace(",", "."));
                if (e.target.value !== "" && Number.isFinite(v) && v >= 0 && v <= 12) {
                  crecida.detener();
                  setAltura(v);
                }
              }}
              onBlur={() => setTexto(fmtEntrada(altura))}
              style={{ width: "5.5rem", minHeight: "2.25rem", padding: "0 0.5rem", border: "1px solid var(--chakra-colors-borde)", borderRadius: 6 }}
            />
          </Box>
          <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
            {!(reducido && !usar3D) && (
              <Button size="sm" colorScheme="blue" onClick={crecida.alternar} aria-pressed={crecida.estado === "en_curso"}>
                {crecida.estado === "en_curso" ? "Pausar crecida" : crecida.estado === "en_pausa" ? "Seguir crecida" : "Reproducir crecida"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                crecida.detener();
                poner(ALTURA_CORTE_M);
              }}
            >
              Volver a 5,60 m
            </Button>
          </Box>
          <Box display="flex" gap={2} alignItems="flex-start" mt={3}>
            <Insignia categoria={CATEGORIAS.OBSERVADO} />
            <Text fontSize="xs" color="textoSuave">
              5,60 m: altura observada en Puerto Formosa al corte (31/10/2026). Todo lo demás es un escenario SIMULADO. En riesgo: a menos de {fmt(MARGEN_RIESGO_M)} m de la altura de compromiso (SUPUESTO).
            </Text>
          </Box>
        </Box>

        <Box minW={0}>
          <TablaDesplazable etiqueta="Sectores de evaluación K10">
            <Table size="sm" variant="simple" aria-label="Sectores de evaluación K10">
              <Thead>
                <Tr>
                  <Th>Sector</Th>
                  <Th isNumeric>Compromiso</Th>
                  <Th isNumeric>Población</Th>
                  <Th>Estado</Th>
                  <Th isNumeric>Anegado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {estados.map(({ s, estado, llenado }) => (
                  <Tr key={s.id}>
                    <Td>
                      <strong>{s.id}</strong> {s.nombre}
                      <Text fontSize="xs" color="textoSuave">
                        {s.acceso}
                      </Text>
                    </Td>
                    <Td isNumeric>{fmt(s.compromiso_m)} m</Td>
                    <Td isNumeric>{fmtMiles(s.poblacion)}</Td>
                    <Td>
                      <MuestraEstado estado={estado} />
                    </Td>
                    <Td isNumeric>{estado === "normal" ? "0 %" : `${Math.round(llenado * 100)} %`}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TablaDesplazable>
          <Text fontSize="xs" color="textoSuave" mt={2}>
            «Anegado» es la fracción ilustrativa de la superficie del sector cubierta por el agua dibujada. S4 se compromete 0,30 m antes del nivel de alerta: a 1,90 m del valor observado al corte.
          </Text>
          <VisuallyHidden aria-live="polite" role="status">
            {resumen}
          </VisuallyHidden>
        </Box>
      </Box>

      <Box mt={5} p={3} borderRadius="lg" bg="pizarra.50" border="1px solid" borderColor="borde" data-leyenda-inundacion="">
        <Text fontSize="sm" fontWeight={600}>
          {LEYENDA_INUNDACION}
        </Text>
        <Text fontSize="xs" color="textoSuave" mt={2}>
          Cómo se lee: el momento en que cada sector se compromete lo fija K10 (altura de la escala de Puerto Formosa, no sobre el nivel del mar). El relieve solo decide por dónde avanza el agua dentro del sector: se llenan primero las
          celdas más bajas, entre (compromiso − {fmt(MARGEN_RIESGO_M)} m) y (compromiso + {fmt(TRAMO_VISUAL_M)} m; tramo de visualización, SUPUESTO). Terrazas de color y curvas cada {INTERVALO_TERRAZA_M} m de elevación; el DEM tiene celdas de ~55 m y error
          vertical de varios metros{datos ? ` (ruido medido ${fmt(datos.meta.ruido_dem_m, 1)} m)` : ""}. Fuera de los sectores no se dibuja inundación: solo el cauce (trazado IGN, ancho ilustrativo, fijo).
          {datos ? ` Descarga del relieve: ${datos.meta.fecha_descarga.split("-").reverse().join("/")}.` : ""}
        </Text>
      </Box>
    </Box>
  );
}

function fmtEntrada(v: number): string {
  return String(Math.round(v * 100) / 100);
}
