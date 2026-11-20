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

/**
 * Cifras de "Tres relojes". Cada una figura en docs/ficha_fuentes.md.
 * Ritmo de ascenso: mayor suba diaria de 2019 (0,36 m/día) y promedio de octubre de 2026 (0,1077 m/día); son los dos extremos que usa
 * `app/domain/ascenso.py` para el rango de tiempo restante (proyección lineal, SUPUESTO).
 */
export const ASCENSO_RAPIDO_M_DIA = 0.36;
export const ASCENSO_LENTO_M_DIA = 0.1077;
/** Lluvia que corta el camino, por superficie (SUPUESTO, supuestos.yaml). */
export const LLUVIA_CORTA_TIERRA_MM = 30;
export const LLUVIA_CORTA_RIPIO_MM = 80;
/** Pronóstico estacional CFS v2, emisión 29/10/2026 (DOCUMENTO DE REFERENCIA): mm proyectados y normal 1991-2020, de noviembre a julio. */
export const CFS_MENSUAL: { mes: string; proyectado: number; normal: number }[] = [
  { mes: "Nov", proyectado: 198, normal: 160 },
  { mes: "Dic", proyectado: 214, normal: 168 },
  { mes: "Ene", proyectado: 216, normal: 172 },
  { mes: "Feb", proyectado: 245, normal: 162 },
  { mes: "Mar", proyectado: 308, normal: 175 },
  { mes: "Abr", proyectado: 246, normal: 182 },
  { mes: "May", proyectado: 80, normal: 110 },
  { mes: "Jun", proyectado: 68, normal: 58 },
  { mes: "Jul", proyectado: 48, normal: 42 },
];
export const CFS_ACUMULADO_MM = 1623;
export const CFS_NORMAL_MM = 1229;
