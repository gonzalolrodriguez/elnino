import type { NombreIcono } from "@/components/Icono";
import type { Tono } from "@/components/Piezas";
import type { Par, LineaCapa, PuntoCapa } from "@/lib/mapaProtocolo";

/**
 * Cuadrilla del usuario y avisos del operativo (contrato: `odd/tasks/gestion-cuadrillas.md`).
 * Lógica pura: tipos, etiquetas y paso de la geometría de un desvío al formato del mapa abierto.
 * Las personas se identifican por rol operativo y profesión, nunca por nombre.
 */

export type TipoOperativo = "personas" | "familias" | "productores_ganado" | "apicola" | "bienes" | "traslado_mixto";

export type Profesion =
  | "medicina"
  | "enfermeria"
  | "veterinaria"
  | "zootecnia"
  | "trabajo_social"
  | "policia"
  | "bomberos"
  | "defensa_civil"
  | "prefectura"
  | "chofer"
  | "tecnico_energia"
  | "logistica"
  | "otra";

export type IntegranteCuadrilla = {
  id: number;
  usuario_id: number | null;
  rol_operativo: string | null;
  profesion: Profesion | string;
  es_encargado: boolean;
};

export type CuadrillaDetalle = {
  id: number;
  nombre: string;
  tipo_operativo: TipoOperativo | string;
  cantidad_integrantes: number;
  vehiculo: string | null;
  equipamiento: string[];
  estado: string;
  integrantes: IntegranteCuadrilla[];
  /** `GET /mi/cuadrilla` informa cuántos avisos nadie leyó todavía. */
  avisos_sin_leer?: number;
};

export type TipoAviso = "desvio" | "equipamiento" | "instruccion" | "seguridad";

export type GeometriaAviso =
  | { type: "LineString"; coordinates: number[][] }
  | { type: "Point"; coordinates: number[] };

export type AvisoCuadrilla = {
  id: number;
  cuadrilla_id: number;
  tipo: TipoAviso;
  texto: string;
  /** Lista de «qué llevar» (aviso de equipamiento). */
  items: string[] | null;
  /** Trazado del desvío (GeoJSON, [lon, lat]). */
  geometria: GeometriaAviso | null;
  tarea_id: number | null;
  creado_en: string;
  creado_por_rol?: string | null;
  leido_en: string | null;
  leido_por_rol: string | null;
};

const TIPO_OPERATIVO: Record<string, string> = {
  personas: "Evacuación de personas",
  familias: "Evacuación de familias",
  productores_ganado: "Productores y ganado",
  apicola: "Apicultura",
  bienes: "Bienes materiales",
  traslado_mixto: "Traslado mixto",
};
export const etiquetaTipoOperativo = (c: string | null | undefined): string => (c ? (TIPO_OPERATIVO[c] ?? legible(c)) : "");

const PROFESION: Record<string, string> = {
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
  otra: "Otra profesión",
};
export const etiquetaProfesion = (c: string | null | undefined): string => (c ? (PROFESION[c] ?? legible(c)) : "");

const VEHICULO: Record<string, string> = {
  "4x4": "Camioneta 4x4",
  camion_jaula: "Camión jaula",
  colectivo: "Colectivo",
  lancha: "Lancha",
  moto: "Moto",
};
export const etiquetaVehiculo = (c: string | null | undefined): string => (c ? (VEHICULO[c] ?? legible(c)) : "Sin vehículo asignado");

function legible(codigo: string): string {
  const t = codigo.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

export const TIPOS_AVISO: TipoAviso[] = ["desvio", "equipamiento", "instruccion", "seguridad"];

const TIPO_AVISO: Record<TipoAviso, { etiqueta: string; tono: Tono; icono: NombreIcono }> = {
  desvio: { etiqueta: "Desvío", tono: "info", icono: "flecha" },
  equipamiento: { etiqueta: "Qué llevar", tono: "neutro", icono: "tarea" },
  instruccion: { etiqueta: "Instrucción", tono: "neutro", icono: "info" },
  seguridad: { etiqueta: "Seguridad", tono: "error", icono: "advertencia" },
};
export const etiquetaTipoAviso = (t: string): string => TIPO_AVISO[t as TipoAviso]?.etiqueta ?? legible(t);
export const estiloTipoAviso = (t: string) => TIPO_AVISO[t as TipoAviso] ?? { etiqueta: legible(t), tono: "neutro" as Tono, icono: "info" as NombreIcono };

/**
 * Un aviso cuenta como leído si el servidor ya lo marcó o si el integrante lo marcó en este teléfono y la
 * marca espera en la cola (`leidosLocales`).
 */
export const estaLeido = (a: AvisoCuadrilla, leidosLocales: ReadonlySet<number>): boolean => a.leido_en !== null || leidosLocales.has(a.id);

/** Sin leer primero; dentro de cada grupo, el más nuevo arriba. */
export function ordenarAvisos(avisos: AvisoCuadrilla[], leidosLocales: ReadonlySet<number> = new Set()): AvisoCuadrilla[] {
  return [...avisos].sort((a, b) => {
    const ua = estaLeido(a, leidosLocales) ? 1 : 0;
    const ub = estaLeido(b, leidosLocales) ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return Date.parse(b.creado_en) - Date.parse(a.creado_en) || b.id - a.id;
  });
}

const esPar = (p: unknown): p is Par =>
  Array.isArray(p) &&
  p.length >= 2 &&
  typeof p[0] === "number" &&
  typeof p[1] === "number" &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

/** Color del trazo del desvío sobre el mapa. */
export const COLOR_DESVIO = "#B7791F";

/**
 * Dibujo de un aviso de desvío para el mapa abierto: la línea del recorrido (con su borde) o el punto, y los
 * puntos que deben quedar a la vista. Una geometría malformada se descarta sin lanzar.
 */
export function capasDeDesvio(aviso: Pick<AvisoCuadrilla, "id" | "geometria">): { lineas: LineaCapa[]; puntos: PuntoCapa[]; encuadre: Par[] } {
  const g = aviso.geometria;
  const vacio = { lineas: [], puntos: [], encuadre: [] };
  if (!g || typeof g !== "object") return vacio;
  if (g.type === "LineString" && Array.isArray(g.coordinates)) {
    const coordenadas = g.coordinates.filter(esPar).map((p): Par => [p[0], p[1]]);
    if (coordenadas.length < 2) return vacio;
    const [ini] = coordenadas;
    const fin = coordenadas[coordenadas.length - 1];
    return {
      lineas: [{ id: `desvio-${aviso.id}`, etiqueta: "Desvío indicado por el operativo", coordenadas, color: COLOR_DESVIO }],
      puntos: [
        { id: `desvio-${aviso.id}-ini`, lon: ini[0], lat: ini[1], etiqueta: "Inicio del desvío", forma: "circulo", color: COLOR_DESVIO },
        { id: `desvio-${aviso.id}-fin`, lon: fin[0], lat: fin[1], etiqueta: "Fin del desvío", forma: "cuadrado", color: COLOR_DESVIO },
      ],
      encuadre: coordenadas,
    };
  }
  if (g.type === "Point" && esPar(g.coordinates)) {
    const [lon, lat] = g.coordinates;
    return {
      lineas: [],
      puntos: [{ id: `desvio-${aviso.id}`, lon, lat, etiqueta: "Punto indicado por el operativo", forma: "rombo", color: COLOR_DESVIO }],
      encuadre: [[lon, lat]],
    };
  }
  return vacio;
}

/** Texto accesible fuera del mapa: qué se dibuja, para quien no ve el mapa o está sin internet. */
export function resumenDesvio(aviso: Pick<AvisoCuadrilla, "id" | "geometria">): string | null {
  const { lineas, puntos } = capasDeDesvio(aviso);
  if (lineas.length > 0) return `Desvío marcado en el mapa: recorrido de ${lineas[0].coordenadas.length} puntos.`;
  if (puntos.length > 0) return "Punto marcado en el mapa.";
  return null;
}

/** Cuántos avisos sin leer hay (para el aviso destacado y el contador). */
export const contarSinLeer = (avisos: AvisoCuadrilla[], leidosLocales: ReadonlySet<number>): number =>
  avisos.filter((a) => !estaLeido(a, leidosLocales)).length;

/** Avisos que no estaban en la lectura anterior y siguen sin leer: los que merecen una notificación local. */
export const avisosNuevos = (vistos: ReadonlySet<number>, actuales: AvisoCuadrilla[]): AvisoCuadrilla[] =>
  actuales.filter((a) => a.leido_en === null && !vistos.has(a.id));

/** Resumen de la cuadrilla para el integrante: su rol, el encargado (por rol, sin nombre) y el equipamiento. */
export function datosDeMiCuadrilla(c: CuadrillaDetalle, usuarioId: number) {
  const yo = c.integrantes.find((i) => i.usuario_id === usuarioId) ?? null;
  const encargado = c.integrantes.find((i) => i.es_encargado) ?? null;
  return { yo, encargado, soyEncargado: !!yo && !!encargado && yo.id === encargado.id };
}
