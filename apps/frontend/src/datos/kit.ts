import { CATEGORIAS, type Categoria } from "@evacuaciones/shared";

import k1 from "./k1_diario.json";
import k10 from "./k10_sectores.json";

/** Valores derivados del kit (K1, K3, K10). Cada cifra figura en docs/ficha_fuentes.md. */

export type Cifra = {
  id: string;
  etiqueta: string;
  valor: number;
  fecha: string;
  fuente: string;
  categoria: Categoria;
  tono: "actual" | "alerta" | "evacuacion" | "pico";
};

export const CIFRAS_FORMOSA: Cifra[] = [
  {
    id: "pico2016",
    etiqueta: "Máximo de la serie",
    valor: 9.81,
    fecha: "enero de 2016",
    fuente: "K1",
    categoria: CATEGORIAS.OBSERVADO,
    tono: "pico",
  },
  {
    id: "pico2019",
    etiqueta: "Pico de 2019",
    valor: 9.72,
    fecha: "junio de 2019",
    fuente: "K1",
    categoria: CATEGORIAS.OBSERVADO,
    tono: "pico",
  },
  {
    id: "evacuacion",
    etiqueta: "Nivel de evacuación",
    valor: 8.3,
    fecha: "31/10/2026",
    fuente: "K3",
    categoria: CATEGORIAS.OBSERVADO,
    tono: "evacuacion",
  },
  {
    id: "alerta",
    etiqueta: "Nivel de alerta",
    valor: 7.8,
    fecha: "31/10/2026",
    fuente: "K3",
    categoria: CATEGORIAS.OBSERVADO,
    tono: "alerta",
  },
  {
    id: "corte",
    etiqueta: "Altura al corte",
    valor: 5.6,
    fecha: "31/10/2026",
    fuente: "K1",
    categoria: CATEGORIAS.OBSERVADO,
    tono: "actual",
  },
];

export const UMBRAL_ALERTA = 7.8;
export const UMBRAL_EVACUACION = 8.3;
export const MARGEN_RIESGO_M = 0.5; // SUPUESTO (supuestos.yaml)

export type SerieDiaria = {
  desde: string;
  hasta: string;
  valores: (number | null)[];
};
export const SERIE_K1 = k1 as SerieDiaria;

export type Sector = {
  id: string;
  nombre: string;
  compromiso_m: number;
  poblacion: number;
  acceso: string;
  anillo: number[][];
};
export const SECTORES_K10 = (k10 as { sectores: Sector[] }).sectores;
export const K10_FECHA = "12/11/2026";

export type MesPronosticoCFS = {
  mes: string;
  proyectado_mm: number;
  normal_mm: number;
  prob_50mm_pct: number;
};

/**
 * Pronóstico agroclimático estacional 2026/27 Formosa (20261029 Formosa.pptx, modelo NOAA CFS v2,
 * ensamble de 20 miembros, emisión 29/10/2026). Categoría: DOCUMENTO DE REFERENCIA.
 * Todas las cifras figuran en docs/ficha_fuentes.md.
 */
export const PRONOSTICO_CFS_V2 = {
  fuente: "Pronóstico agroclimático estacional 2026/27 Formosa, CFS v2 NOAA (20261029 Formosa.pptx)",
  fecha_emision: "29/10/2026",
  categoria: CATEGORIAS.REFERENCIA,
  acumulado_proyectado_mm: 1623,
  normal_acumulada_mm: 1229,
  anomalia_mm: 394,
  meses: [
    { mes: "Nov 2026", proyectado_mm: 227, normal_mm: 193, prob_50mm_pct: 90 },
    { mes: "Dic 2026", proyectado_mm: 227, normal_mm: 179, prob_50mm_pct: 85 },
    { mes: "Ene 2027", proyectado_mm: 184, normal_mm: 151, prob_50mm_pct: 80 },
    { mes: "Feb 2027", proyectado_mm: 204, normal_mm: 141, prob_50mm_pct: 90 },
    { mes: "Mar 2027", proyectado_mm: 308, normal_mm: 149, prob_50mm_pct: 95 },
    { mes: "Abr 2027", proyectado_mm: 243, normal_mm: 183, prob_50mm_pct: 95 },
    { mes: "May 2027", proyectado_mm: 130, normal_mm: 114, prob_50mm_pct: 75 },
    { mes: "Jun 2027", proyectado_mm: 58, normal_mm: 70, prob_50mm_pct: 25 },
    { mes: "Jul 2027", proyectado_mm: 42, normal_mm: 50, prob_50mm_pct: 25 },
  ] as const satisfies readonly MesPronosticoCFS[],
} as const;

export const LIMITES_ESTATICOS: string[] = [
  "El kit no incluye lluvia observada (la planilla de precipitaciones está vacía).",
  "No existe pronóstico hidrológico más allá de 15 días; las extrapolaciones son supuestos.",
  "El kit no incluye cotas reales.",
  "El kit no incluye barrios reales.",
  "El kit no incluye caminos ni centros de recepción reales; los centros y su capacidad son SIMULADO.",
  "No hay alturas anteriores a 2006 con fuente oficial verificada (1983, 1992 y 1998 no se muestran).",
  "Decidir una evacuación, definir recorridos y disponer recursos corresponde a las autoridades; la plataforma solo recomienda y simula.",
];

/** Fecha ISO del índice i de la serie diaria. */
export function fechaDeIndice(desde: string, i: number): string {
  const d = new Date(`${desde}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
}

export function indiceDeFecha(desde: string, iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Sector K10 que contiene el punto (trazado por rayos); null si cae fuera de todos. */
export function sectorDe(lon: number, lat: number): Sector | null {
  for (const s of SECTORES_K10) {
    let dentro = false;
    const a = s.anillo;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i];
      const [xj, yj] = a[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    if (dentro) return s;
  }
  return null;
}
