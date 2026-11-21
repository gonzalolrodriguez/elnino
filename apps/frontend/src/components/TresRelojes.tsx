import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { CATEGORIAS, type Categoria } from "@evacuaciones/shared";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  CFS_ACUMULADO_MM,
  CFS_MENSUAL,
  CFS_NORMAL_MM,
  CIFRAS_FORMOSA,
  LLUVIA_CORTA_RIPIO_MM,
  LLUVIA_CORTA_TIERRA_MM,
  SECTORES_K10,
  UMBRAL_ALERTA,
  UMBRAL_EVACUACION,
  ASCENSO_LENTO_M_DIA,
  ASCENSO_RAPIDO_M_DIA,
} from "../datos/kit";
import { PAL } from "../estilo/paleta";
import { fmt, fmtMiles, useMenosMovimiento } from "../lib/entorno";
import { distanciaAUmbral, estadoCamino, fraccion, margenAntesDeAlerta, rangoDias, textoRango } from "../lib/relojes";
import { Insignia } from "./Insignia";
import { Plegable } from "./Plegable";

/**
 * Tres relojes: la evacuación corre contra el río (DATO OBSERVADO), el barro (SUPUESTO) y El Niño (DOCUMENTO DE REFERENCIA).
 * Variante "amplia" para la landing; "compacta" para el tablero del panel, que puede pasar la altura y la lluvia del escenario.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BARRIDO = 270; // grados del arco
const INICIO = 135; // grados, medidos en sentido horario desde las 3 en punto: abajo a la izquierda
const R = 78;
const C = 100;

function punto(grados: number, radio = R) {
  const a = (grados * Math.PI) / 180;
  return { x: C + radio * Math.cos(a), y: C + radio * Math.sin(a) };
}
const ARCO = (() => {
  const a = punto(INICIO);
  const b = punto(INICIO + BARRIDO);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 1 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
})();

type Marca = { f: number; color: string };

/** Arco de 270 grados: pista, relleno animado una sola vez al entrar en pantalla y marcas de umbral. El texto central va encima. */
function Dial({ f, color, marcas = [], orden, tamano, centro, etiqueta }: { f: number; color: string; marcas?: Marca[]; orden: number; tamano: string; centro: ReactNode; etiqueta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const quieto = useMenosMovimiento();
  const sinObservador = typeof IntersectionObserver === "undefined";
  const [enVista, setEnVista] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || sinObservador) return;
    const o = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setEnVista(true);
          o.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    o.observe(el);
    return () => o.disconnect();
  }, [sinObservador]);
  const visible = quieto || sinObservador || enVista;
  return (
    <Box ref={ref} position="relative" w={tamano} h={tamano} flexShrink={0} role="img" aria-label={etiqueta}>
      <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">
        <path d={ARCO} fill="none" stroke={PAL.pizarra[100]} strokeWidth={14} strokeLinecap="round" />
        {f > 0 && (
          <motion.path
            d={ARCO}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            initial={quieto ? { pathLength: f } : { pathLength: 0 }}
            animate={{ pathLength: visible ? f : 0 }}
            transition={quieto ? { duration: 0 } : { duration: 1.1, delay: 0.15 + orden * 0.14, ease: EASE_OUT }}
          />
        )}
        {marcas.map((m) => {
          const g = INICIO + BARRIDO * m.f;
          const a = punto(g, R - 14);
          const b = punto(g, R + 14);
          return <line key={m.f} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={m.color} strokeWidth={4} strokeLinecap="round" />;
        })}
      </svg>
      <Flex position="absolute" inset={0} direction="column" align="center" justify="center" textAlign="center" px="14%" pt="4%">
        {centro}
      </Flex>
    </Box>
  );
}

function Pie({ categorias, fuente }: { categorias: Categoria[]; fuente: string }) {
  return (
    <Flex gap={2} align="center" wrap="wrap" mt={3}>
      {categorias.map((c) => (
        <Insignia key={c} categoria={c} />
      ))}
      <Text as="span" fontSize="xs" color="textoSuave">
        {fuente}
      </Text>
    </Flex>
  );
}

type Props = {
  variante?: "amplia" | "compacta";
  /** Texto corto sobre el título (solo en la variante amplia), p. ej. el nombre de la sección en la portada. */
  sobretitulo?: string;
  /** Altura del río en metros. Por defecto, el dato del corte (31/10/2026). */
  alturaM?: number;
  /** Categoría de la altura: DATO OBSERVADO para el corte; SIMULADO si es un valor del simulador. */
  alturaCategoria?: Categoria;
  /** Lluvia del escenario en mm. Sin valor: el kit no tiene lluvia observada y el reloj muestra el umbral. */
  lluviaMm?: number;
  lluviaCategoria?: Categoria;
};

export function TresRelojes({ variante = "amplia", sobretitulo, alturaM, alturaCategoria = CATEGORIAS.OBSERVADO, lluviaMm, lluviaCategoria = CATEGORIAS.SIMULADO }: Props) {
  const amplia = variante === "amplia";
  const corte = CIFRAS_FORMOSA.find((c) => c.id === "corte");
  const altura = alturaM ?? corte?.valor ?? 5.6;
  const fechaAltura = alturaM === undefined ? corte?.fecha : undefined;
  const s4 = SECTORES_K10.find((s) => s.id === "S4");
  const margenS4 = s4 ? margenAntesDeAlerta(s4.compromiso_m, UMBRAL_ALERTA) : null;
  const tamano = amplia ? { base: "10rem", md: "11.5rem" } : "6.25rem";

  const dist = distanciaAUmbral(altura, UMBRAL_ALERTA);
  const rango = rangoDias(altura, UMBRAL_ALERTA);
  const hayLluvia = lluviaMm !== undefined;
  const mm = hayLluvia ? Math.max(0, lluviaMm) : 0;
  const tierra = estadoCamino(mm, "tierra");
  const ripio = estadoCamino(mm, "ripio");

  const relojes = [
    {
      id: "rio",
      nombre: "Reloj del río",
      dial: (
        <Dial
          orden={0}
          tamano={tamano as string}
          f={fraccion(altura, UMBRAL_EVACUACION)}
          color={PAL.agua[700]}
          marcas={[{ f: fraccion(UMBRAL_ALERTA, UMBRAL_EVACUACION), color: PAL.alerta[600] }]}
          etiqueta={`Reloj del río: ${fmt(altura)} m de ${fmt(UMBRAL_EVACUACION)} m de evacuación; la alerta está en ${fmt(UMBRAL_ALERTA)} m`}
          centro={
            <>
              <Text textStyle="cifra" fontSize={amplia ? { base: "1.75rem", md: "2.1rem" } : "1.25rem"} data-testid="reloj-rio-falta">
                {dist.alcanzado ? "Superada" : `${fmt(dist.faltaM)} m`}
              </Text>
              <Text fontSize={amplia ? "xs" : "10px"} color="textoSuave" lineHeight={1.25}>
                {dist.alcanzado ? "la alerta de 7,80 m" : "a la alerta"}
              </Text>
            </>
          }
        />
      ),
      titular: dist.alcanzado ? "El río ya superó la alerta." : `El río está a ${fmt(dist.faltaM)} m de la alerta.`,
      detalle: (
        <>
          <Text fontSize="sm" data-testid="reloj-rio-detalle">
            Puerto Formosa marca <strong>{fmt(altura)} m</strong>
            {fechaAltura ? ` al corte (${fechaAltura})` : ""}; la alerta está en {fmt(UMBRAL_ALERTA)} m y la evacuación en {fmt(UMBRAL_EVACUACION)} m.
          </Text>
          {rango && (
            <Text fontSize="sm" mt={2} data-testid="reloj-rio-rango">
              Al ritmo de las crecidas registradas, llegaría a la alerta <strong>{textoRango(rango)}</strong>.
            </Text>
          )}
        </>
      ),
      extra: rango && amplia && (
        <Text fontSize="xs" color="textoSuave" mt={2}>
          Supuesto: ascenso lineal a ritmo constante, entre {fmt(ASCENSO_RAPIDO_M_DIA)} m por día (mayor suba diaria de 2019) y {fmt(ASCENSO_LENTO_M_DIA, 4)} m por día (promedio de octubre
          de 2026). No es un pronóstico: el INA no pronostica a más de 15 días.
        </Text>
      ),
      categorias: (rango ? [alturaCategoria, CATEGORIAS.SIMULADO] : [alturaCategoria]) as Categoria[],
      fuente: "K1 y K3 · proyección: supuesto",
    },
    {
      id: "barro",
      nombre: "Reloj del barro",
      dial: (
        <Dial
          orden={1}
          tamano={tamano as string}
          f={fraccion(mm, LLUVIA_CORTA_RIPIO_MM)}
          color={PAL.alerta[600]}
          marcas={[
            { f: fraccion(LLUVIA_CORTA_TIERRA_MM, LLUVIA_CORTA_RIPIO_MM), color: PAL.alerta[800] },
            { f: 1, color: PAL.evacuacion[700] },
          ]}
          etiqueta={
            hayLluvia
              ? `Reloj del barro: ${fmt(mm, 0)} mm de lluvia simulada; la tierra se corta con ${LLUVIA_CORTA_TIERRA_MM} mm y el ripio con ${LLUVIA_CORTA_RIPIO_MM} mm`
              : `Reloj del barro: la tierra se corta con ${LLUVIA_CORTA_TIERRA_MM} mm y el ripio con ${LLUVIA_CORTA_RIPIO_MM} mm; el kit no tiene lluvia observada`
          }
          centro={
            <>
              <Text textStyle="cifra" fontSize={amplia ? { base: "1.75rem", md: "2.1rem" } : "1.25rem"} data-testid="reloj-barro-cifra">
                {fmt(hayLluvia ? mm : LLUVIA_CORTA_TIERRA_MM, 0)} mm
              </Text>
              <Text fontSize={amplia ? "xs" : "10px"} color="textoSuave" lineHeight={1.25}>
                {hayLluvia ? "lluvia del escenario" : "cortan la tierra"}
              </Text>
            </>
          }
        />
      ),
      titular: hayLluvia
        ? tierra === "intransitable"
          ? "Con esa lluvia el camino de tierra queda cortado."
          : "Con esa lluvia el camino de tierra sigue transitable."
        : "El barro puede cortar el camino antes de que el río llegue a la alerta.",
      detalle: (
        <>
          <Text fontSize="sm" data-testid="reloj-barro-detalle">
            {hayLluvia ? (
              <>
                Camino de tierra: <strong>{tierra}</strong>. Camino de ripio: <strong>{ripio}</strong> (se corta con {LLUVIA_CORTA_RIPIO_MM} mm).
              </>
            ) : (
              <>
                Un camino de tierra se corta con {LLUVIA_CORTA_TIERRA_MM} mm de lluvia y uno de ripio con {LLUVIA_CORTA_RIPIO_MM} mm.
              </>
            )}
          </Text>
          {margenS4 !== null && s4 && (
            <Text fontSize="sm" mt={2} data-testid="reloj-barro-s4">
              S4 {s4.nombre.replace(/^Sector /, "")} se compromete en {fmt(s4.compromiso_m)} m, {fmt(margenS4)} m antes de la alerta, y su acceso es de tierra.
            </Text>
          )}
        </>
      ),
      extra: amplia && (
        <Text fontSize="xs" color="textoSuave" mt={2}>
          {hayLluvia ? "La lluvia es un valor del simulador. " : ""}El kit no tiene lluvia observada: estos umbrales son un supuesto, no una medición.
        </Text>
      ),
      categorias: [lluviaCategoria] as Categoria[],
      fuente: "umbrales: supuesto · sector S4: K10",
    },
    {
      id: "nino",
      nombre: "Reloj del Niño",
      dial: (
        <Dial
          orden={2}
          tamano={tamano as string}
          f={0.83}
          color={PAL.pizarra[700]}
          etiqueta="Reloj del Niño: 83 % de probabilidad de un evento fuerte o muy fuerte"
          centro={
            <>
              <Text textStyle="cifra" fontSize={amplia ? { base: "1.75rem", md: "2.1rem" } : "1.25rem"} data-testid="reloj-nino-cifra">
                83 %
              </Text>
              <Text fontSize={amplia ? "xs" : "10px"} color="textoSuave" lineHeight={1.25}>
                fuerte o muy fuerte
              </Text>
            </>
          }
        />
      ),
      titular: "El Niño está confirmado y se espera fuerte.",
      detalle: (
        <>
          <Text fontSize="sm">
            El SMN confirmó la fase El Niño el 4/9/2026. La NOAA da 83 % de probabilidad de un evento fuerte o muy fuerte en octubre-diciembre.
          </Text>
          <Text fontSize="sm" mt={2} data-testid="reloj-nino-cfs">
            Pronóstico estacional CFS v2 (noviembre de 2026 a julio de 2027): <strong>{fmtMiles(CFS_ACUMULADO_MM)} mm</strong> frente a {fmtMiles(CFS_NORMAL_MM)} mm normales, con un pico de 308 mm
            en marzo de 2027.
          </Text>
        </>
      ),
      extra: amplia && <MensualCFS />,
      categorias: [CATEGORIAS.REFERENCIA] as Categoria[],
      fuente: "SMN, NOAA y CFS v2 (emisión 29/10/2026)",
    },
  ];

  return (
    <Box
      as="section"
      aria-labelledby={`titulo-relojes-${variante}`}
      data-testid={`tres-relojes-${variante}`}
      {...(amplia
        ? { bg: "superficie", borderY: "1px solid", borderColor: "borde" }
        : { layerStyle: "tarjeta", mb: 5 })}
    >
      <Box maxW={amplia ? "90rem" : undefined} mx="auto" px={amplia ? { base: 4, md: 8 } : { base: 4, md: 5 }} py={amplia ? { base: 10, md: 16 } : 4}>
        {amplia ? (
          <Box mb={{ base: 6, md: 10 }} maxW="40rem">
            {sobretitulo && (
              <Text fontSize="sm" fontWeight={700} letterSpacing="0.06em" textTransform="uppercase" color="textoSuave" mb={1}>
                {sobretitulo}
              </Text>
            )}
            <Heading as="h2" id={`titulo-relojes-${variante}`} size="xl" mb={2}>
              Tres relojes corren a la vez
            </Heading>
            <Text color="textoSuave">A veces hay que evacuar con el río todavía bajo: el barro corta el camino primero. Cada reloj mide una cuenta regresiva distinta.</Text>
          </Box>
        ) : (
          <Heading as="h2" id={`titulo-relojes-${variante}`} size="bloque" textStyle="tituloBloque" mb={3}>
            Tres relojes
          </Heading>
        )}

        <Box display="grid" gridTemplateColumns={amplia ? { base: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" } : { base: "minmax(0, 1fr)", lg: "repeat(3, minmax(0, 1fr))" }} columnGap={amplia ? 0 : 4}>
          {relojes.map((r, i) => (
            <Box
              key={r.id}
              data-testid={`reloj-${r.id}`}
              py={amplia ? { base: 6, md: 0 } : { base: 3, lg: 0 }}
              pl={amplia ? { base: 0, md: i === 0 ? 0 : 8 } : { base: 0, lg: i === 0 ? 0 : 4 }}
              pr={amplia ? { base: 0, md: i === 2 ? 0 : 8 } : 0}
              borderTop={i === 0 ? "none" : { base: "1px solid", [amplia ? "md" : "lg"]: "none" }}
              borderLeft={i === 0 ? "none" : { base: "none", [amplia ? "md" : "lg"]: "1px solid" }}
              borderColor="borde"
              pt={i === 0 ? 0 : undefined}
            >
              <Flex gap={amplia ? 5 : 3} align="center" direction={amplia ? { base: "row", md: "column" } : "row"} alignItems={amplia ? { base: "center", md: "flex-start" } : "center"}>
                {r.dial}
                <Box minW={0}>
                  <Heading as="h3" size={amplia ? "md" : "xs"} mb={1}>
                    {r.nombre}
                  </Heading>
                  <Text fontSize={amplia ? "md" : "sm"} fontWeight={600} lineHeight={1.35}>
                    {r.titular}
                  </Text>
                </Box>
              </Flex>
              {amplia && (
                <Box mt={4}>
                  {r.detalle}
                  {r.extra}
                  <Pie categorias={r.categorias} fuente={r.fuente} />
                </Box>
              )}
              {!amplia && (
                <Box mt={1.5}>
                  <Pie categorias={r.categorias} fuente={r.fuente} />
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {amplia && (
          <Box mt={{ base: 4, md: 8 }} maxW="46rem">
            <Plegable id="relojes-fuentes" titulo={<Text as="span" fontWeight={600}>De dónde sale cada cifra</Text>}>
              <Box as="ul" fontSize="sm" color="textoSuave" pl={4} pb={3}>
                <li>Río: altura al corte (K1, 31/10/2026) y umbrales de alerta y evacuación (K3).</li>
                <li>Barro: umbrales de lluvia (supuestos del sistema) y sector S4 de K10 (simulado).</li>
                <li>El Niño: SMN (4/9/2026), NOAA (8/10/2026) y pronóstico CFS v2 (29/10/2026). Informe de un tercero, orientativo y probabilístico.</li>
              </Box>
            </Plegable>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Pares de columnas por mes: proyectado y normal (CFS v2). Un solo gráfico, sin animación propia. */
function MensualCFS() {
  const max = Math.max(...CFS_MENSUAL.flatMap((m) => [m.proyectado, m.normal]));
  const W = 270;
  const H = 70;
  const paso = W / CFS_MENSUAL.length;
  return (
    <Box mt={3}>
      <Box
        as="svg"
        viewBox={`0 0 ${W} ${H + 14}`}
        w="100%"
        maxW="18rem"
        role="img"
        aria-label="Precipitación mensual proyectada frente a la normal, de noviembre a julio. Pico de 308 mm proyectados en marzo de 2027, contra 175 mm normales."
      >
        {CFS_MENSUAL.map((m, i) => {
          const x = i * paso + 4;
          const hp = (m.proyectado / max) * H;
          const hn = (m.normal / max) * H;
          const pico = m.proyectado === max;
          return (
            <g key={m.mes}>
              <rect x={x} y={H - hn} width={paso / 2 - 4} height={hn} fill={PAL.pizarra[200]} />
              <rect x={x + paso / 2 - 3} y={H - hp} width={paso / 2 - 4} height={hp} fill={pico ? PAL.agua[800] : PAL.agua[500]} />
              <text x={x + paso / 2 - 3} y={H + 11} textAnchor="middle" fontSize={8} fill={PAL.pizarra[600]}>
                {m.mes}
              </text>
            </g>
          );
        })}
      </Box>
      <Text fontSize="xs" color="textoSuave" mt={1}>
        Barras claras: normal histórica 1991-2020. Barras azules: proyectado, con el pico en marzo.
      </Text>
    </Box>
  );
}
