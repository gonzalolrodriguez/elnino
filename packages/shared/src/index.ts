/** Constantes compartidas entre la web y la app móvil. */

export const LEYENDA =
  "PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial";

export const CATEGORIAS = {
  OBSERVADO: "DATO OBSERVADO",
  REFERENCIA: "DOCUMENTO DE REFERENCIA",
  SIMULADO: "SIMULADO",
} as const;

export type Categoria = (typeof CATEGORIAS)[keyof typeof CATEGORIAS];

export const ROLES = [
  "ciudadano",
  "productor",
  "cuadrilla",
  "operador",
  "decisor",
  "admin",
] as const;

export type Rol = (typeof ROLES)[number];

export const FECHA_CORTE = "2026-10-31";

/** Fase 2: valores del motor de simulación (los devuelve la API; ver docs/contrato_api.md). */
export const ESTADOS_SECTOR = ["normal", "en_riesgo", "comprometido"] as const;
export type EstadoSector = (typeof ESTADOS_SECTOR)[number];

export const ESTADOS_ACCESO = [
  "transitable",
  "cerrado_operador",
  "intransitable_lluvia",
  "anegado",
] as const;
export type EstadoAcceso = (typeof ESTADOS_ACCESO)[number];

export const TIPOS_ORDEN = ["alerta", "evacuacion_preventiva", "evacuacion"] as const;
export type TipoOrden = (typeof TIPOS_ORDEN)[number];

export const ESTADOS_SOLICITUD = [
  "recibida",
  "verificada",
  "asignada",
  "en_curso",
  "resuelta",
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADOS_TAREA = ["pendiente", "en_curso", "completada", "cancelada"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const PERFILES_RUTEO = ["vehicular", "camion_jaula", "arreo"] as const;
export type PerfilRuteo = (typeof PERFILES_RUTEO)[number];

export const EVENTOS_WS = ["escenario", "solicitud", "orden", "tarea", "aviso_cuadrilla"] as const;
export type EventoWs = (typeof EVENTOS_WS)[number];

/** Código con que el servidor cierra el WebSocket si el primer mensaje no trae un token válido. */
export const WS_CIERRE_POLITICA = 1008;
