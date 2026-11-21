import { esAvisoLeido, esCierre, esConfirmacion, esParte, type DatosCola } from "@/lib/cola";
import { descripcionParte } from "@/lib/partes";
import { etiquetaRespuesta } from "@/lib/respuestas";

/**
 * Etiquetas legibles (español rioplatense) para los códigos que devuelve la API. Ningún código crudo
 * (`en_curso`, `sms_sim`, `evacuacion`) debe llegar a la pantalla: se pasa siempre por acá.
 */

const ESTADO_SOLICITUD: Record<string, string> = {
  recibida: "Recibida",
  verificada: "Verificada",
  asignada: "Asignada a una cuadrilla",
  en_curso: "En curso",
  resuelta: "Resuelta",
};

const ESTADO_TAREA: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const ESTADO_SECTOR: Record<string, string> = {
  normal: "Normal",
  en_riesgo: "En riesgo",
  comprometido: "Comprometido",
};

const ESTADO_ACCESO: Record<string, string> = {
  transitable: "Transitable",
  cerrado_operador: "Cerrado por el operador",
  intransitable_lluvia: "Intransitable por la lluvia",
  anegado: "Anegado",
};

const SUPERFICIE: Record<string, string> = { tierra: "tierra", ripio: "ripio", pavimentado: "pavimento", pavimento: "pavimento" };

const ORIGEN: Record<string, string> = {
  app: "Aplicación",
  web: "Web",
  whatsapp_sim: "WhatsApp (simulado)",
  sms_sim: "SMS (simulado)",
  ivr_sim: "Llamada 103 (simulada)",
};

const TIPO_SOLICITUD: Record<string, string> = {
  asistencia: "Asistencia",
  evacuacion: "Evacuación",
  ganado: "Ganado",
  logistica: "Logística",
  otro: "Otro",
};

const TIPO_ORDEN: Record<string, string> = {
  alerta: "Alerta",
  evacuacion_preventiva: "Evacuación preventiva",
  evacuacion: "Evacuación",
};

const ROL: Record<string, string> = {
  ciudadano: "Ciudadanía",
  productor: "Productor",
  cuadrilla: "Cuadrilla",
  operador: "Operador",
  decisor: "Decisor",
  admin: "Administración",
};



/** Resumen de un ítem de la cola local en palabras simples (solicitud, cierre o respuesta). */
export function descripcionItemCola(d: DatosCola): string {
  if (esCierre(d)) return `Cierre con constancia de la tarea #${d.tarea_id}`;
  if (esConfirmacion(d)) return `Tu respuesta sobre el traslado: ${etiquetaRespuesta(d.respuesta)}`;
  if (esParte(d)) return descripcionParte(d);
  if (esAvisoLeido(d)) return "Aviso del operativo marcado como leído";
  return `${etiquetaTipoSolicitud(d.tipo)} · ${d.personas} personas · ${d.animales} animales`;
}

/** Estados derivados de una evacuación, en palabras simples. */
const ESTADO_EVACUACION: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  cerrada_cuadrilla: "Cerrada por la cuadrilla, a la espera de la confirmación de la persona evacuada",
  verificada: "Verificada: la persona evacuada confirmó la llegada",
  con_discrepancia: "Marcada para revisar: un operador va a mirar el caso (no es una acusación)",
};
export const etiquetaEstadoEvacuacion = (c: string) => buscar(ESTADO_EVACUACION, c);
export const etiquetaEstadoEvacuacionCorta = (c: string) =>
  buscar({ ...ESTADO_EVACUACION, cerrada_cuadrilla: "Cerrada por la cuadrilla", verificada: "Verificadas", con_discrepancia: "Con discrepancia" }, c);

/** Códigos desconocidos: se muestran sin guiones bajos y con la primera letra en mayúscula. */
function legible(codigo: string): string {
  const t = codigo.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

const buscar = (tabla: Record<string, string>, codigo: string | null | undefined): string =>
  codigo ? (tabla[codigo] ?? legible(codigo)) : "";

export const etiquetaEstadoSolicitud = (c: string) => buscar(ESTADO_SOLICITUD, c);
export const etiquetaEstadoTarea = (c: string) => buscar(ESTADO_TAREA, c);
export const etiquetaEstadoSector = (c: string) => buscar(ESTADO_SECTOR, c);
export const etiquetaEstadoAcceso = (c: string) => buscar(ESTADO_ACCESO, c);
export const etiquetaSuperficie = (c: string) => buscar(SUPERFICIE, c);
export const etiquetaOrigen = (c: string) => buscar(ORIGEN, c);
export const etiquetaTipoSolicitud = (c: string) => buscar(TIPO_SOLICITUD, c);
export const etiquetaTipoOrden = (c: string) => buscar(TIPO_ORDEN, c);
export const etiquetaRol = (c: string) => buscar(ROL, c);
/** El rol operativo viene de un catálogo abierto: se muestra legible aunque no esté en la tabla. */
export const etiquetaRolOperativo = (c: string | null | undefined) => legible(c ?? "");

/** Fecha y hora en formato es-AR (ej. 19/11/2026 14:05). Si no se puede interpretar, "—". */
export function formatearFechaHora(valor: string | number | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export type GravedadAviso = { nivel: "evacuacion" | "preventiva" | "alerta" | "discrepancia" | "aviso"; texto: string };

/**
 * Gravedad de una notificación para mostrarla con chip (ícono + texto + color). El backend arma el
 * mensaje de las órdenes empezando por el rótulo del tipo («Evacuación preventiva para S4 …»), así que
 * se lee de ahí; lo que no se reconoce queda como «Aviso» neutro, nunca como alarma.
 */
export function gravedadAviso(mensaje: string, tipo?: string): GravedadAviso {
  if (tipo === "discrepancia") return { nivel: "discrepancia", texto: "Discrepancia" };
  const m = mensaje.trimStart().toLowerCase();
  if (m.startsWith("evacuación preventiva") || m.startsWith("evacuacion preventiva")) return { nivel: "preventiva", texto: "Evacuación preventiva" };
  if (m.startsWith("evacuación") || m.startsWith("evacuacion")) return { nivel: "evacuacion", texto: "Evacuación" };
  if (m.startsWith("alerta")) return { nivel: "alerta", texto: "Alerta" };
  return { nivel: "aviso", texto: "Aviso" };
}
