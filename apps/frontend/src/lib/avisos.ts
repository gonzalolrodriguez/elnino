import { solicitar } from "./api";

/** Contrato de los avisos del operativo (ver odd/tasks/gestion-cuadrillas.md). Sin nombres de personas: el que lee queda como rol. */
export type TipoAviso = "desvio" | "equipamiento" | "instruccion" | "seguridad";

export type GeometriaAviso = { type: "LineString"; coordinates: [number, number][] } | { type: "Point"; coordinates: [number, number] };

export type Aviso = {
  id: number;
  cuadrilla_id?: number;
  tipo: TipoAviso;
  texto: string;
  items?: string[] | null;
  geometria?: GeometriaAviso | null;
  tarea_id?: number | null;
  creado_en: string;
  leido_en?: string | null;
  leido_por_rol?: string | null;
};

export type IntegranteVista = { id: number; rol_operativo: string; profesion: string; es_encargado: boolean; nombre_visible?: string | null };

/** Resumen de la cuadrilla propia. Los integrantes se muestran por rol y profesión. */
export type CuadrillaPropia = {
  id: number;
  nombre: string;
  tipo_operativo?: string | null;
  tipo_incidente?: string | null;
  vehiculo?: string | null;
  equipamiento?: string[] | null;
  integrantes?: IntegranteVista[];
};

export const ETIQUETA_TIPO_AVISO: Record<TipoAviso, string> = {
  desvio: "Desvío",
  equipamiento: "Qué llevar",
  instruccion: "Instrucción",
  seguridad: "Seguridad",
};

export const ETIQUETA_TIPO_OPERATIVO: Record<string, string> = {
  personas: "Asistencia a personas",
  familias: "Evacuación de familias",
  productores_ganado: "Productores y ganado",
  apicola: "Apicultura",
  bienes: "Bienes materiales",
  traslado_mixto: "Traslado mixto",
};

export const ETIQUETA_PROFESION: Record<string, string> = {
  medicina: "Medicina",
  enfermeria: "Enfermería",
  veterinaria: "Veterinaria",
  zootecnia: "Zootecnia",
  trabajo_social: "Trabajo social",
  policia: "Policía",
  bomberos: "Bomberos",
  defensa_civil: "Defensa Civil",
  prefectura: "Prefectura",
  chofer: "Chofer",
  tecnico_energia: "Técnico de energía",
  logistica: "Logística",
  otra: "Otra",
};

const a = { autenticado: true } as const;

/** Acepta `[...]`, `{ items }` o `{ avisos }`: el contrato no fija el sobre de la lista. */
function comoLista<T>(r: unknown, clave: string): T[] {
  if (Array.isArray(r)) return r as T[];
  const o = r as Record<string, unknown> | null;
  if (o && Array.isArray(o[clave])) return o[clave] as T[];
  if (o && Array.isArray(o.items)) return o.items as T[];
  return [];
}

export const avisosDeCuadrilla = (cuadrillaId: number) => solicitar<unknown>(`/cuadrillas/${cuadrillaId}/avisos`, a).then((r) => comoLista<Aviso>(r, "avisos"));
export const marcarAvisoLeido = (avisoId: number) => solicitar<Partial<Aviso>>(`/avisos/${avisoId}/leido`, { ...a, cuerpo: {} });
export const detalleCuadrilla = (cuadrillaId: number) => solicitar<CuadrillaPropia>(`/cuadrillas/${cuadrillaId}`, a);

/** Sin leer primero; dentro de cada grupo, del más nuevo al más viejo. */
export function ordenarAvisos(avisos: Aviso[]): Aviso[] {
  return [...avisos].sort((x, y) => {
    const lx = x.leido_en ? 1 : 0;
    const ly = y.leido_en ? 1 : 0;
    if (lx !== ly) return lx - ly;
    return new Date(y.creado_en).getTime() - new Date(x.creado_en).getTime();
  });
}

export const contarNoLeidos = (avisos: Aviso[]): number => avisos.filter((x) => !x.leido_en).length;

/** Coordenadas [lon, lat] del desvío para encuadrar y dibujar. Vacío si no hay geometría usable. */
export function coordenadasDesvio(g: GeometriaAviso | null | undefined): [number, number][] {
  if (!g) return [];
  if (g.type === "Point") return Array.isArray(g.coordinates) && g.coordinates.length >= 2 ? [g.coordinates] : [];
  return Array.isArray(g.coordinates) ? g.coordinates.filter((c) => Array.isArray(c) && c.length >= 2) : [];
}

// --- Lista «Qué llevar»: se tilda en el dispositivo y se recuerda mientras dure la pestaña. ---------------------
const claveChecklist = (avisoId: number) => `e3_llevar_${avisoId}`;

export function leerTildados(avisoId: number): number[] {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(claveChecklist(avisoId)) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}

export function guardarTildados(avisoId: number, tildados: number[]): void {
  try {
    window.sessionStorage.setItem(claveChecklist(avisoId), JSON.stringify(tildados));
  } catch {
    /* sin almacenamiento: la lista funciona igual mientras la pantalla siga abierta */
  }
}
