import type { SerieDiaria } from "../datos/kit";
import { solicitar } from "../lib/api";

export type PosteriorCaudal = {
  rotulo: string;
  categoria: string;
  horizonte_dias: number;
  supuesto: string;
  fechas: string[];
  caudal_m3s: (number | null)[];
  p25: (number | null)[];
  p75: (number | null)[];
  minimo: (number | null)[];
  maximo: (number | null)[];
  mediana: (number | null)[];
  fecha_descarga_utc: string;
};

/** Respuesta de `GET /serie/caudal-glofas`. */
export type RespuestaCaudal = {
  estacion: { clave: string; nombre: string };
  unidad: string;
  fechas: string[];
  caudal_m3s: (number | null)[];
  n: number;
  picos: { anio: number; caudal_m3s: number; fecha: string }[];
  ultima: { fecha: string; caudal_m3s: number } | null;
  posterior_al_corte: PosteriorCaudal | null;
  notas: string[];
  celda_usada: { lat: number; lon: number; elevacion_m: number | null };
  fuente: string;
  licencia: string;
  atribucion: string;
  fecha_dato: string;
  fecha_descarga: string;
};

export function pedirCaudal(estacion: "formosa" | "pilcomayo" = "formosa"): Promise<RespuestaCaudal> {
  return solicitar<RespuestaCaudal>(`/serie/caudal-glofas?estacion=${estacion}`);
}

export const NOTA_CAUDAL =
  "GloFAS da caudal (m³/s), no altura de escala; no hay curva altura-caudal oficial en el kit, así que no se convierte a metros. El INA no publica pronósticos a más de 15 días.";

export function fmtCaudal(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export type FilaAnual = {
  anio: number;
  caudal: { valor: number; fecha: string } | null;
  altura: { valor: number; fecha: string } | null;
};

/** Máximo anual del caudal modelado y de la altura observada (K1), cada uno con su propia fecha. */
export function maximosAnuales(c: RespuestaCaudal, k1: SerieDiaria): FilaAnual[] {
  const filas = new Map<number, FilaAnual>();
  const fila = (anio: number) => {
    let f = filas.get(anio);
    if (!f) {
      f = { anio, caudal: null, altura: null };
      filas.set(anio, f);
    }
    return f;
  };
  c.fechas.forEach((fecha, i) => {
    const v = c.caudal_m3s[i];
    if (v === null || v === undefined) return;
    const f = fila(Number(fecha.slice(0, 4)));
    if (!f.caudal || v > f.caudal.valor) f.caudal = { valor: v, fecha };
  });
  const base = Date.parse(`${k1.desde}T00:00:00Z`);
  k1.valores.forEach((v, i) => {
    if (v === null || v === undefined) return;
    const fecha = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    if (fecha > c.fecha_dato) return;
    const f = fila(Number(fecha.slice(0, 4)));
    if (!f.altura || v > f.altura.valor) f.altura = { valor: v, fecha };
  });
  return [...filas.values()].sort((a, b) => a.anio - b.anio);
}
