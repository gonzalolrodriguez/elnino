import { Alert, AlertIcon, Box, Button, ButtonGroup, Flex, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EstadoCargando } from "../components/EstadoCargando";
import { Insignia } from "../components/Insignia";
import { Opcion } from "../components/Opcion";
import { TablaDesplazable } from "../components/TablaDesplazable";
import { fechaDeIndice, fechaLarga, indiceDeFecha, SERIE_K1, type SerieDiaria } from "../datos/kit";
import { hexDe } from "../estilo/paleta";
import { fmt } from "../lib/entorno";
import { useCarga } from "../lib/useCarga";
import { construirTrazo } from "../informacion/SerieK1";
import { fmtCaudal, maximosAnuales, NOTA_CAUDAL, pedirCaudal, type RespuestaCaudal } from "./caudal";

const C = {
  fondo: hexDe("superficie"),
  borde: hexDe("borde"),
  grilla: hexDe("serie.grilla"),
  eje: hexDe("serie.eje"),
  caudal: hexDe("serie.linea"),
  cursor: hexDe("serie.cursor"),
  altura: hexDe("umbral.textoAlerta"),
  pico: hexDe("umbral.pico"),
  bandaAncha: hexDe("agua.200"),
  bandaMedia: hexDe("agua.400"),
};

const W0 = 900;
const M = { l: 58, r: 52, t: 14, b: 28 };
const Y_MIN_K1 = -1;
const Y_MAX_K1 = 10.5;

const PRESETS = [
  { id: "todo", etiqueta: "Toda la serie", desde: "2006-01-01", hasta: "2026-10-31" },
  { id: "2015", etiqueta: "2015-16", desde: "2015-06-01", hasta: "2016-06-30" },
  { id: "2019", etiqueta: "2019", desde: "2019-01-01", hasta: "2019-09-30" },
  { id: "2026", etiqueta: "Desde el 01/09/2026", desde: "2026-09-01", hasta: "2026-10-31" },
] as const;

function techo(max: number): number {
  const paso = max > 8000 ? 4000 : max > 3000 ? 2000 : 1000;
  return Math.ceil(max / paso) * paso;
}

function Grafico({ c, k1 }: { c: RespuestaCaudal; k1: SerieDiaria }) {
  const post = c.posterior_al_corte;
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("todo");
  const [verAltura, setVerAltura] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(W0);
  useEffect(() => {
    const medir = () => {
      const w = contenedor.current?.clientWidth;
      if (w) setAncho(Math.max(300, Math.min(1200, Math.round(w))));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  const W = ancho;
  const H = ancho < 520 ? 270 : 330;

  const origen = c.fechas[0];
  const ultimaFecha = post ? post.fechas[post.fechas.length - 1] : c.fechas[c.fechas.length - 1];
  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0];
  const hasta = preset === "todo" || preset === "2026" ? ultimaFecha : p.hasta;
  const i0 = indiceDeFecha(origen, p.desde);
  const i1 = indiceDeFecha(origen, hasta);
  const iCorte = indiceDeFecha(origen, c.fecha_dato);

  const maxVisible = useMemo(() => {
    let m = 0;
    for (let i = Math.max(0, i0); i <= Math.min(c.caudal_m3s.length - 1, i1); i++) m = Math.max(m, c.caudal_m3s[i] ?? 0);
    if (post) for (const v of post.maximo) m = Math.max(m, v ?? 0);
    return techo(m * 1.05 || 1000);
  }, [c, post, i0, i1]);

  const x = (i: number) => M.l + ((i - i0) / Math.max(1, i1 - i0)) * (W - M.l - M.r);
  const y = (v: number) => M.t + ((maxVisible - v) / maxVisible) * (H - M.t - M.b);
  const yK = (v: number) => M.t + ((Y_MAX_K1 - v) / (Y_MAX_K1 - Y_MIN_K1)) * (H - M.t - M.b);

  const trazoCaudal = useMemo(() => {
    const serie: SerieDiaria = { desde: origen, hasta: c.fechas[c.fechas.length - 1], valores: c.caudal_m3s };
    return construirTrazo(serie, Math.max(0, i0), Math.min(iCorte, i1), x, y, W - M.l - M.r);
  }, [c, i0, i1, W, maxVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const desfase = indiceDeFecha(origen, k1.desde);
  const trazoAltura = useMemo(() => {
    if (!verAltura) return "";
    const j0 = Math.max(0, i0 - desfase);
    const j1 = Math.min(k1.valores.length - 1, Math.min(iCorte, i1) - desfase);
    return construirTrazo(k1, j0, j1, (j) => x(j + desfase), yK, W - M.l - M.r);
  }, [verAltura, k1, i0, i1, W, maxVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  function poligono(sup: (number | null)[], inf: (number | null)[]): string {
    if (!post) return "";
    const base = indiceDeFecha(origen, post.fechas[0]);
    const arriba: string[] = [];
    const abajo: string[] = [];
    post.fechas.forEach((_, k) => {
      const a = sup[k];
      const b = inf[k];
      if (a === null || a === undefined || b === null || b === undefined) return;
      arriba.push(`${x(base + k).toFixed(1)} ${y(a).toFixed(1)}`);
      abajo.unshift(`${x(base + k).toFixed(1)} ${y(b).toFixed(1)}`);
    });
    return arriba.length ? `M${arriba.join("L")}L${abajo.join("L")}Z` : "";
  }
  const trazoPost = useMemo(() => {
    if (!post) return "";
    const base = indiceDeFecha(origen, post.fechas[0]);
    const pts = post.mediana.map((v, k) => (v === null ? null : `${x(base + k).toFixed(1)} ${y(v).toFixed(1)}`)).filter(Boolean);
    return pts.length ? `M${pts.join("L")}` : "";
  }, [post, i0, i1, W, maxVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dias = i1 - i0;
  const base = dias > 3000 ? 24 : dias > 1000 ? 12 : dias > 400 ? 6 : dias > 150 ? 2 : 1;
  const paso = ancho < 520 ? base * 2 : base;
  const ticksX: { i: number; texto: string }[] = [];
  for (let i = Math.max(0, i0); i <= i1; i++) {
    const f = fechaDeIndice(origen, i);
    if (f.endsWith("-01")) {
      const abs = Number(f.slice(0, 4)) * 12 + Number(f.slice(5, 7)) - 1;
      if (abs % paso === 0) ticksX.push({ i, texto: paso >= 12 ? f.slice(0, 4) : `${f.slice(5, 7)}/${f.slice(2, 4)}` });
    }
  }
  const pasoY = maxVisible / 4;
  const ticksY = [0, 1, 2, 3, 4].map((k) => k * pasoY);

  const actual = cursor !== null && cursor >= i0 && cursor <= i1 ? cursor : null;
  const fechaActual = actual !== null ? fechaDeIndice(origen, actual) : null;
  const caudalActual = actual !== null && actual <= iCorte ? c.caudal_m3s[actual] : null;
  const alturaActual = actual !== null ? (k1.valores[actual - desfase] ?? null) : null;
  const kPost = post && actual !== null ? actual - indiceDeFecha(origen, post.fechas[0]) : -1;

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = (px - M.l) / (W - M.l - M.r);
    setCursor(Math.min(i1, Math.max(i0, Math.round(i0 + t * (i1 - i0)))));
  }

  let lectura = "Mové el cursor sobre el gráfico o usá el deslizador para leer un día.";
  if (actual !== null && fechaActual) {
    const partes: string[] = [];
    if (caudalActual !== null) partes.push(`caudal modelado ${fmtCaudal(caudalActual)} m³/s (GloFAS)`);
    if (post && kPost >= 0 && post.mediana[kPost] !== null && post.mediana[kPost] !== undefined) {
      partes.push(
        `ensamble posterior al corte: mediana ${fmtCaudal(post.mediana[kPost] as number)} m³/s, p25–p75 ${fmtCaudal(post.p25[kPost] ?? 0)}–${fmtCaudal(post.p75[kPost] ?? 0)}, mín.–máx. ${fmtCaudal(post.minimo[kPost] ?? 0)}–${fmtCaudal(post.maximo[kPost] ?? 0)} m³/s`,
      );
    }
    if (verAltura) partes.push(alturaActual === null || fechaActual > c.fecha_dato ? "altura observada: sin dato" : `altura observada ${fmt(alturaActual)} m (K1)`);
    lectura = `${fechaLarga(fechaActual)}: ${partes.join(" · ") || "sin dato"}`;
  }

  return (
    <Box as="figure" m={0} ref={contenedor}>
      <Flex gap={3} align="center" wrap="wrap" mb={3}>
        <ButtonGroup size="sm" variant="outline" display="flex" flexWrap="wrap" gap={2} role="group" aria-label="Período del gráfico de caudal">
          {PRESETS.map((q) => (
            <Button key={q.id} onClick={() => { setPreset(q.id); setCursor(null); }} aria-pressed={preset === q.id} variant={preset === q.id ? "solid" : "outline"}>
              {q.etiqueta}
            </Button>
          ))}
        </ButtonGroup>
        <Insignia categoria="DOCUMENTO DE REFERENCIA" />
        {verAltura && <Insignia categoria="DATO OBSERVADO" />}
      </Flex>
      <Box maxW="30rem" mb={3}>
        <Opcion etiqueta="Superponer la altura observada de la escala (serie K1, eje derecho en m)" isChecked={verAltura} onChange={setVerAltura} id="caudal-ver-altura" />
      </Box>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", background: C.fondo, border: `1px solid ${C.borde}`, touchAction: "pan-y" }}
        role="img"
        aria-label={`Caudal diario modelado del río Paraguay en ${c.estacion.nombre} entre ${fechaLarga(p.desde)} y ${fechaLarga(hasta)}, en metros cúbicos por segundo, fuente GloFAS`}
        data-testid="caudal-grafico"
        onPointerMove={alMover}
        onPointerDown={alMover}
        onPointerLeave={(e) => e.pointerType !== "touch" && setCursor(null)}
      >
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={C.grilla} />
            <text x={M.l - 6} y={y(v) + 4} fontSize="12" textAnchor="end" fill={C.caudal}>
              {fmtCaudal(v)}
            </text>
          </g>
        ))}
        <text x={4} y={12} fontSize="12" fill={C.caudal}>
          m³/s
        </text>
        {verAltura &&
          [0, 2, 4, 6, 8, 10].map((v) => (
            <text key={v} x={W - M.r + 6} y={yK(v) + 4} fontSize="12" fill={C.altura}>
              {v}
            </text>
          ))}
        {verAltura && (
          <text x={W - 22} y={12} fontSize="12" fill={C.altura}>
            m
          </text>
        )}
        {ticksX.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={H - M.b} y2={H - M.b + 4} stroke={C.eje} />
            <text x={x(t.i)} y={H - 10} fontSize="12" textAnchor="middle" fill={C.eje}>
              {t.texto}
            </text>
          </g>
        ))}
        {post && iCorte >= i0 && iCorte <= i1 && (
          <g>
            <line x1={x(iCorte)} x2={x(iCorte)} y1={M.t} y2={H - M.b} stroke={C.eje} strokeDasharray="4 4" />
            <text x={x(iCorte) + 4} y={M.t + 12} fontSize="12" fill={C.eje}>
              corte 31/10/2026
            </text>
          </g>
        )}
        {post && <path d={poligono(post.maximo, post.minimo)} fill={C.bandaAncha} opacity="0.7" data-testid="caudal-banda-minmax" />}
        {post && <path d={poligono(post.p75, post.p25)} fill={C.bandaMedia} opacity="0.6" data-testid="caudal-banda-p25p75" />}
        {post && <path d={trazoPost} fill="none" stroke={C.caudal} strokeWidth="1.6" strokeDasharray="5 3" />}
        <path d={trazoCaudal} fill="none" stroke={C.caudal} strokeWidth="1.6" strokeLinejoin="round" />
        {verAltura && <path d={trazoAltura} fill="none" stroke={C.altura} strokeWidth="1.4" strokeDasharray="6 3" strokeLinejoin="round" data-testid="caudal-trazo-altura" />}
        {c.picos.map((pk) => {
          const i = indiceDeFecha(origen, pk.fecha);
          if (i < i0 || i > i1) return null;
          return (
            <g key={pk.anio}>
              <circle cx={x(i)} cy={y(pk.caudal_m3s)} r="3.5" fill={C.pico} />
              <text x={x(i) + 6} y={y(pk.caudal_m3s) - 6} fontSize="12" fontWeight="700" fill={C.cursor}>
                {pk.anio}: {fmtCaudal(pk.caudal_m3s)} m³/s
              </text>
            </g>
          );
        })}
        {actual !== null && <line x1={x(actual)} x2={x(actual)} y1={M.t} y2={H - M.b} stroke={C.cursor} strokeWidth="1" />}
      </svg>

      <Flex gap={{ base: 3, md: 6 }} rowGap={1.5} wrap="wrap" mt={2} textStyle="microdato" aria-label="Series del gráfico" role="group" data-testid="caudal-leyenda">
        <Flex align="center" gap={2}>
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" x2="28" y1="4" y2="4" stroke={C.caudal} strokeWidth="2" />
          </svg>
          Caudal modelado (GloFAS, eje izquierdo, m³/s)
        </Flex>
        {verAltura && (
          <Flex align="center" gap={2}>
            <svg width="28" height="8" aria-hidden="true">
              <line x1="0" x2="28" y1="4" y2="4" stroke={C.altura} strokeWidth="2" strokeDasharray="6 3" />
            </svg>
            Altura observada (K1, eje derecho, m)
          </Flex>
        )}
        {post && (
          <Flex align="center" gap={2}>
            <svg width="28" height="10" aria-hidden="true">
              <rect x="0" y="0" width="28" height="10" fill={C.bandaAncha} />
              <rect x="0" y="3" width="28" height="4" fill={C.bandaMedia} />
            </svg>
            Ensamble posterior al corte (mínimo–máximo y p25–p75)
          </Flex>
        )}
      </Flex>

      <Box mt={3}>
        <label htmlFor="cursor-caudal" style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block" }}>
          Explorar día por día
        </label>
        <input id="cursor-caudal" type="range" min={i0} max={i1} value={actual ?? Math.min(i1, iCorte)} onChange={(e) => setCursor(Number(e.target.value))} style={{ width: "100%", minHeight: "2rem" }} />
        <Text role="status" fontWeight={600} minH="1.5rem">
          {lectura}
        </Text>
      </Box>

      <Text as="figcaption" textStyle="microdato" mt={2} maxW="70ch">
        Caudal diario modelado por GloFAS (Copernicus Emergency Management Service) vía Open-Meteo, en la celda de {fmt(c.celda_usada.lat, 3)}°, {fmt(c.celda_usada.lon, 3)}° (~5 km), del 01/01/2006 al 31/10/2026.
        {verAltura && " La línea punteada es la altura observada (K1) en metros, con su propio eje a la derecha: son series distintas y no se convierten entre sí."}
      </Text>
    </Box>
  );
}

function TablaAnual({ c, k1 }: { c: RespuestaCaudal; k1: SerieDiaria }) {
  const filas = useMemo(() => maximosAnuales(c, k1), [c, k1]);
  return (
    <Box as="details" mt={4} data-testid="caudal-tabla">
      <Box as="summary" cursor="pointer" textStyle="rotulo" color="texto" py={1} minH="2.75rem" display="flex" alignItems="center">
        Ver los mismos datos en tabla (máximo anual)
      </Box>
      <TablaDesplazable etiqueta="Máximo anual de caudal modelado y de altura observada" maxH="20rem" overflowY="auto">
        <Table size="sm" aria-label="Máximo anual de caudal modelado y de altura observada">
          <Thead position="sticky" top={0} bg="superficie">
            <Tr>
              <Th>Año</Th>
              <Th isNumeric>Caudal modelado máx. (m³/s)</Th>
              <Th>Fecha del caudal</Th>
              <Th isNumeric>Altura observada máx. (m)</Th>
              <Th>Fecha de la altura</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filas.map((f) => (
              <Tr key={f.anio}>
                <Td>{f.anio}</Td>
                <Td isNumeric>{f.caudal ? fmtCaudal(f.caudal.valor) : "sin dato"}</Td>
                <Td>{f.caudal ? fechaLarga(f.caudal.fecha) : "—"}</Td>
                <Td isNumeric>{f.altura ? fmt(f.altura.valor) : "sin dato"}</Td>
                <Td>{f.altura ? fechaLarga(f.altura.fecha) : "—"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TablaDesplazable>
      <Text textStyle="microdato" mt={1}>
        Caudal: DOCUMENTO DE REFERENCIA (GloFAS, modelado). Altura: DATO OBSERVADO (K1). Son series independientes: sus máximos no coinciden necesariamente en fecha.
      </Text>
    </Box>
  );
}

function Contenido({ c, k1 }: { c: RespuestaCaudal; k1: SerieDiaria }) {
  const post = c.posterior_al_corte;
  return (
    <>
      <Flex gap={6} wrap="wrap" mb={4} data-testid="caudal-cifras">
        {c.ultima && (
          <Box>
            <Text textStyle="rotulo">Caudal modelado al {fechaLarga(c.ultima.fecha)}</Text>
            <Text textStyle="cifraMedia" data-testid="caudal-ultima">
              {fmtCaudal(c.ultima.caudal_m3s)} m³/s
            </Text>
          </Box>
        )}
        {c.picos.map((p) => (
          <Box key={p.anio}>
            <Text textStyle="rotulo">Pico modelado de {p.anio} ({fechaLarga(p.fecha)})</Text>
            <Text textStyle="cifraMedia" data-testid={`caudal-pico-${p.anio}`}>
              {fmtCaudal(p.caudal_m3s)} m³/s
            </Text>
          </Box>
        ))}
      </Flex>
      <Alert status="info" variant="subtle" mb={4} alignItems="flex-start" data-testid="caudal-nota">
        <AlertIcon />
        <Box>
          <Text>{NOTA_CAUDAL}</Text>
          <Text mt={1}>
            No se pudo obtener el pronóstico tal como se emitió el 31/10/2026 (la fuente solo ofrece la ejecución vigente al descargar), por lo que hasta el corte se muestra solo caudal modelado, sin pronóstico ni rango de incertidumbre. Es un modelo global de ~5 km: puede diferir del caudal real y no es un pronóstico oficial.
          </Text>
        </Box>
      </Alert>
      {post && (
        <Alert status="warning" variant="subtle" mb={4} data-testid="caudal-posterior">
          <AlertIcon />
          <Box>
            <Text fontWeight={600}>{post.rotulo}</Text>
            <Text>
              Horizonte: {post.horizonte_dias} días desde el 01/11/2026. Banda oscura: p25–p75 del ensamble; banda clara: mínimo–máximo. {post.supuesto}
            </Text>
          </Box>
        </Alert>
      )}
      <Grafico c={c} k1={k1} />
      <TablaAnual c={c} k1={k1} />
      <Text textStyle="microdato" mt={3}>
        Fuente: {c.fuente}. Licencia: {c.licencia} Datos hasta el {fechaLarga(c.fecha_dato)}; descargados el {c.fecha_descarga.slice(0, 10)}.
      </Text>
    </>
  );
}

/** Caudal modelado del río Paraguay (GloFAS) con superposición opcional de la altura observada (K1). */
export function CaudalGlofas({ k1 = SERIE_K1 }: { k1?: SerieDiaria }) {
  const carga = useCarga(() => pedirCaudal("formosa"));
  if (carga.estado === "cargando") return <EstadoCargando />;
  if (carga.estado === "error" || !carga.datos) {
    return (
      <Text role="alert" data-testid="caudal-error">
        No se pudo cargar el caudal modelado (GloFAS). Reintentá más tarde; el resto de la información no depende de este dato.{" "}
        <Button size="xs" variant="outline" onClick={carga.recargar}>
          Reintentar
        </Button>
      </Text>
    );
  }
  if (carga.datos.n === 0) return <Text>La serie de caudal no tiene datos.</Text>;
  // Dato con forma inesperada: se trata como error de carga en vez de romper la pantalla.
  if (!Array.isArray(carga.datos.fechas) || carga.datos.fechas.length === 0 || !carga.datos.celda_usada) {
    return <Text role="alert">La serie de caudal llegó incompleta. Reintentá más tarde.</Text>;
  }
  return <Contenido c={carga.datos} k1={k1} />;
}
