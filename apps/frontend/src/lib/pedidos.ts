import type { SeguimientoCuadrilla } from "../panel/tipos";
import { solicitar } from "./api";

/** Contrato de `GET /mi/pedidos` (SIMULADO; sin nombres de personas: la cuadrilla se identifica por rol y tipo). */
export type EtapaPedido = "recibida" | "verificada" | "asignada" | "en_curso" | "resuelta";

export type PasoLineaTiempo = { estado: EtapaPedido | string; en: string | null; alcanzado?: boolean };

export type Pedido = {
  id: number;
  tipo: string;
  personas: number | null;
  estado: string;
  origen: string;
  creada_en: string;
  lat: number | null;
  lon: number | null;
  sector_id: string | null;
  linea_tiempo: PasoLineaTiempo[];
  tarea: null | {
    id: number;
    estado: string;
    cuadrilla: { id: number; tipo_incidente: string; rol_encargado: string | null; vehiculo: string | null };
    iniciada_en: string | null;
    cerrada_en: string | null;
  };
  seguimiento: SeguimientoCuadrilla | null;
  confirmacion: null | { solicitud_id: number; codigo?: string; respondida: boolean; respuesta: string | null; comentario: string | null };
  centro: null | { id: number; nombre: string; lat: number; lon: number };
};

export type RespuestaPedidos = { categoria: string; items: Pedido[] };

export const misPedidos = () => solicitar<RespuestaPedidos>("/mi/pedidos", { autenticado: true });

export const ORDEN_ETAPAS: EtapaPedido[] = ["recibida", "verificada", "asignada", "en_curso", "resuelta"];

export const ETAPAS: Record<string, { corta: string; larga: string }> = {
  recibida: { corta: "Recibido", larga: "Recibimos tu pedido" },
  verificada: { corta: "Verificado", larga: "Un operador verificó tu pedido" },
  asignada: { corta: "Cuadrilla asignada", larga: "Una cuadrilla tomó tu pedido" },
  en_curso: { corta: "En camino", larga: "La cuadrilla está en camino" },
  resuelta: { corta: "Asistido", larga: "La cuadrilla cerró tu pedido" },
};

/** SIMULADO: vehículo de la cuadrilla. */
export const VEHICULOS: Record<string, string> = {
  "4x4": "4x4",
  camion_jaula: "Camión jaula",
  colectivo: "Colectivo",
  lancha: "Lancha",
  moto: "Moto",
};
export const etiquetaVehiculo = (v: string | null | undefined): string | null => (v ? (VEHICULOS[v] ?? v) : null);

export type PasoVista = { clave: string; etiqueta: string; en: string | null; alcanzado: boolean; actual: boolean };

/** Cinco pasos del pedido y, si el ciudadano ya respondió, un sexto «Confirmado por vos». */
export function pasosDe(p: Pedido): PasoVista[] {
  const idxEstado = ORDEN_ETAPAS.indexOf(p.estado as EtapaPedido);
  const pasos: PasoVista[] = ORDEN_ETAPAS.map((clave, i) => {
    const t = p.linea_tiempo.find((x) => x.estado === clave);
    const alcanzado = t?.alcanzado === true || (t?.en ?? null) !== null || i <= idxEstado;
    return { clave, etiqueta: ETAPAS[clave].corta, en: t?.en ?? null, alcanzado, actual: false };
  });
  if (p.confirmacion?.respondida) pasos.push({ clave: "confirmada", etiqueta: "Confirmado por vos", en: null, alcanzado: true, actual: false });
  let ultimo = -1;
  pasos.forEach((s, i) => {
    if (s.alcanzado) ultimo = i;
  });
  if (ultimo >= 0 && ultimo < ORDEN_ETAPAS.length - 1) pasos[ultimo].actual = true;
  return pasos;
}

/** Pedido activo: el más nuevo que no está resuelto, o que está resuelto pero espera tu confirmación. */
export function pedidoActivo(items: Pedido[]): Pedido | null {
  return items.find((p) => p.estado !== "resuelta" || (p.confirmacion !== null && !p.confirmacion.respondida)) ?? null;
}

/** La cuadrilla cerró la tarea y falta la respuesta de la persona. */
export const pideConfirmacion = (p: Pedido): boolean => p.confirmacion !== null && !p.confirmacion.respondida;

export const ORDEN_SEVERIDAD: Record<string, number> = { evacuacion: 3, evacuacion_preventiva: 2, alerta: 1 };
export const severidad = (tipo: string): number => ORDEN_SEVERIDAD[tipo] ?? 0;
