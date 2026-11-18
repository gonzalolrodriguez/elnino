import { Box, Button, ButtonGroup, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { Insignia } from "../components/Insignia";
import {
  fechaDeIndice,
  fechaLarga,
  indiceDeFecha,
  SERIE_K1,
  UMBRAL_ALERTA,
  UMBRAL_EVACUACION,
  type SerieDiaria,
} from "../datos/kit";
import { fmt } from "../lib/entorno";

const W = 900;
const H = 320;
const M = { l: 44, r: 12, t: 14, b: 28 };
const Y_MIN = -1;
const Y_MAX = 10.5;

const PRESETS = [
  { id: "todo", etiqueta: "Toda la serie", desde: "2006-01-01", hasta: "2026-10-31" },
  { id: "2015", etiqueta: "2015-16", desde: "2015-06-01", hasta: "2016-03-31" },
  { id: "2019", etiqueta: "2019", desde: "2019-01-01", hasta: "2019-07-31" },
  { id: "2026", etiqueta: "Desde el 01/09/2026", desde: "2026-09-01", hasta: "2026-10-31" },
] as const;

const PICOS = [
  { fecha: "2016-01-05", texto: "9,81 m" },
  { fecha: "2019-06-02", texto: "9,72 m" },
];

/** Tramos continuos; los días sin dato cortan la línea (no se interpola). */
export function construirTrazo(
  serie: SerieDiaria,
  i0: number,
  i1: number,
  x: (i: number) => number,
  y: (v: number) => number,
  anchoPx: number,
): string {
  const n = i1 - i0 + 1;
  const paso = Math.max(1, Math.floor(n / anchoPx));
  let d = "";
  let abierto = false;
  for (let i = i0; i <= i1; i += paso) {
    let max: number | null = null;
    for (let j = i; j < Math.min(i + paso, i1 + 1); j++) {
      const v = serie.valores[j];
      if (v !== null && v !== undefined && (max === null || v > max)) max = v;
    }
    if (max === null) {
      abierto = false;
      continue;
    }
    d += `${abierto ? "L" : "M"}${x(i).toFixed(1)} ${y(max).toFixed(1)}`;
    abierto = true;
  }
  return d;
}

export function SerieK1({ serie = SERIE_K1 }: { serie?: SerieDiaria }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("todo");
  const [cursor, setCursor] = useState<number | null>(null);

  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0];
  const i0 = Math.max(0, indiceDeFecha(serie.desde, p.desde));
  const i1 = Math.min(serie.valores.length - 1, indiceDeFecha(serie.desde, p.hasta));
  const x = (i: number) => M.l + ((i - i0) / Math.max(1, i1 - i0)) * (W - M.l - M.r);
  const y = (v: number) => M.t + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - M.t - M.b);

  const trazo = useMemo(() => construirTrazo(serie, i0, i1, x, y, W - M.l - M.r), [serie, i0, i1]); // eslint-disable-line react-hooks/exhaustive-deps

  const dias = i1 - i0;
  const paso = dias > 3000 ? 24 : dias > 1000 ? 12 : dias > 400 ? 6 : dias > 150 ? 2 : 1;
  const ticksX: { i: number; texto: string }[] = [];
  for (let i = i0; i <= i1; i++) {
    const f = fechaDeIndice(serie.desde, i);
    if (f.endsWith("-01")) {
      const mes = Number(f.slice(5, 7));
      const abs = Number(f.slice(0, 4)) * 12 + mes - 1;
      if (abs % paso === 0) ticksX.push({ i, texto: paso >= 12 ? f.slice(0, 4) : `${f.slice(5, 7)}/${f.slice(2, 4)}` });
    }
  }

  const actual = cursor !== null && cursor >= i0 && cursor <= i1 ? cursor : null;
  const valorActual = actual !== null ? serie.valores[actual] : null;

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = (px - M.l) / (W - M.l - M.r);
    setCursor(Math.min(i1, Math.max(i0, Math.round(i0 + t * (i1 - i0)))));
  }

  return (
    <Box as="figure" m={0}>
      <Box display="flex" gap={3} alignItems="center" flexWrap="wrap" mb={3}>
        <ButtonGroup size="sm" isAttached variant="outline" role="group" aria-label="Período del gráfico">
          {PRESETS.map((x) => (
            <Button key={x.id} onClick={() => { setPreset(x.id); setCursor(null); }} aria-pressed={preset === x.id} variant={preset === x.id ? "solid" : "outline"}>
              {x.etiqueta}
            </Button>
          ))}
        </ButtonGroup>
        <Insignia categoria="DATO OBSERVADO" />
      </Box>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", background: "white", border: "1px solid #D5DEDA", touchAction: "pan-y" }}
        role="img"
        aria-label={`Altura diaria de la escala de Puerto Formosa entre ${fechaLarga(p.desde)} y ${fechaLarga(p.hasta)}, con los umbrales de alerta ${fmt(UMBRAL_ALERTA)} m y evacuación ${fmt(UMBRAL_EVACUACION)} m`}
        onPointerMove={alMover}
        onPointerLeave={() => setCursor(null)}
      >
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#E3E9E6" />
            <text x={M.l - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#5B6B68">
              {v}
            </text>
          </g>
        ))}
        <text x={4} y={12} fontSize="11" fill="#5B6B68">
          m
        </text>
        {ticksX.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={H - M.b} y2={H - M.b + 4} stroke="#5B6B68" />
            <text x={x(t.i)} y={H - 10} fontSize="11" textAnchor="middle" fill="#5B6B68">
              {t.texto}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={y(UMBRAL_ALERTA)} y2={y(UMBRAL_ALERTA)} stroke="#D99A1E" strokeWidth="2" strokeDasharray="6 4" />
        <line x1={M.l} x2={W - M.r} y1={y(UMBRAL_EVACUACION)} y2={y(UMBRAL_EVACUACION)} stroke="#C23B2A" strokeWidth="2" strokeDasharray="6 4" />
        <text x={W - M.r - 4} y={y(UMBRAL_ALERTA) + 14} fontSize="11" textAnchor="end" fill="#8A5A00" fontWeight="700">
          Alerta {fmt(UMBRAL_ALERTA)} m
        </text>
        <text x={W - M.r - 4} y={y(UMBRAL_EVACUACION) - 5} fontSize="11" textAnchor="end" fill="#9B2D20" fontWeight="700">
          Evacuación {fmt(UMBRAL_EVACUACION)} m
        </text>
        <path d={trazo} fill="none" stroke="#1B5C58" strokeWidth="1.6" strokeLinejoin="round" />
        {PICOS.map((pk) => {
          const i = indiceDeFecha(serie.desde, pk.fecha);
          const v = serie.valores[i];
          if (i < i0 || i > i1 || v === null || v === undefined) return null;
          return (
            <g key={pk.fecha}>
              <circle cx={x(i)} cy={y(v)} r="3.5" fill="#1B5C58" />
              <text x={x(i) + 6} y={y(v) - 6} fontSize="11" fontWeight="700" fill="#13242A">
                {pk.texto}
              </text>
            </g>
          );
        })}
        {actual !== null && (
          <g>
            <line x1={x(actual)} x2={x(actual)} y1={M.t} y2={H - M.b} stroke="#13242A" strokeWidth="1" />
            {valorActual !== null && valorActual !== undefined && <circle cx={x(actual)} cy={y(valorActual)} r="4" fill="#13242A" />}
          </g>
        )}
      </svg>

      <Box mt={3}>
        <label htmlFor="cursor-serie" style={{ fontSize: "0.875rem" }}>
          Explorar día por día
        </label>
        <input
          id="cursor-serie"
          type="range"
          min={i0}
          max={i1}
          value={actual ?? i1}
          onChange={(e) => setCursor(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <Text role="status" fontSize="sm" fontWeight={600} minH="1.5rem">
          {actual !== null
            ? `${fechaLarga(fechaDeIndice(serie.desde, actual))}: ${valorActual === null || valorActual === undefined ? "sin dato (no se interpola)" : `${fmt(valorActual)} m`}`
            : "Mové el cursor sobre el gráfico o usá el deslizador para leer un día."}
        </Text>
      </Box>

      <Text as="figcaption" fontSize="sm" color="pizarra.500" mt={1}>
        Máximo diario de la lectura de la escala de Puerto Formosa (INA, siteCode 57), serie K1 limpia desde el 01/01/2006 hasta el
        31/10/2026. Los días sin dato quedan en blanco y no se interpolan. Los umbrales son los de K3.
      </Text>
    </Box>
  );
}
