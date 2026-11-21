/**
 * Etiquetas legibles para los códigos internos que muestra la interfaz.
 * Un solo módulo: ninguna pantalla debe imprimir `whatsapp_sim`, `en_curso` u `operador` tal cual.
 */

function humanizar(codigo: string): string {
  const t = codigo.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function de(mapa: Record<string, string>) {
  return (codigo: string | null | undefined): string => {
    if (codigo === null || codigo === undefined || codigo === "") return "";
    return mapa[codigo] ?? humanizar(codigo);
  };
}

export const ROL: Record<string, string> = {
  ciudadano: "Ciudadanía",
  productor: "Productor",
  cuadrilla: "Cuadrilla",
  operador: "Operador",
  decisor: "Decisor",
  admin: "Administración",
};
export const etiquetaRol = de(ROL);

export const ROL_OPERATIVO: Record<string, string> = {
  comando_emergencia: "Comando de Emergencia",
  defensa_civil: "Defensa Civil",
  coordinador_sector: "Coordinador de sector",
  policia: "Policía",
  sipec: "SIPEC",
  desarrollo_humano: "Desarrollo Humano",
  trabajo_social: "Trabajo social",
  produccion: "Producción",
  paippa: "PAIPPA",
  prefectura: "Prefectura",
  senasa: "SENASA",
  inta: "INTA",
  vialidad: "Vialidad",
  veterinario: "Veterinario o zootecnista",
  transporte: "Transporte",
  tecnico_energia: "Técnico de energía",
  encargado_cuadrilla: "Encargado de cuadrilla",
  administrador_plataforma: "Administración de la plataforma",
};
export const etiquetaRolOperativo = de(ROL_OPERATIVO);

export const ESTADO_SOLICITUD: Record<string, string> = {
  recibida: "Recibida",
  verificada: "Verificada",
  asignada: "Asignada",
  en_curso: "En curso",
  resuelta: "Resuelta",
};
export const etiquetaEstadoSolicitud = de(ESTADO_SOLICITUD);

export const ESTADO_TAREA: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};
export const etiquetaEstadoTarea = de(ESTADO_TAREA);

export const ORIGEN_SOLICITUD: Record<string, string> = {
  app: "App móvil",
  web: "Web",
  whatsapp_sim: "WhatsApp (simulado)",
  sms_sim: "SMS (simulado)",
  ivr_sim: "Llamada 103 (simulada)",
};
export const etiquetaOrigenSolicitud = de(ORIGEN_SOLICITUD);

export const TIPO_SOLICITUD: Record<string, string> = {
  evacuacion: "Evacuación",
  asistencia: "Asistencia",
  ganado: "Ganado",
  logistica: "Logística",
  otro: "Otro",
};
export const etiquetaTipoSolicitud = de(TIPO_SOLICITUD);

export const ESTADO_USUARIO: Record<string, string> = { activo: "Activo", inactivo: "Inactivo" };
export const etiquetaEstadoUsuario = de(ESTADO_USUARIO);

export const ESTADO_BITACORA: Record<string, string> = { borrador: "Borrador", completa: "Completa", completada: "Completa" };
export const etiquetaEstadoBitacora = de(ESTADO_BITACORA);

export const ORIGEN_LLUVIA: Record<string, string> = {
  parte_policial: "Parte policial",
  carga_manual: "Carga manual",
  planilla_upca: "Planilla UPCA",
  simulado: "Simulado",
};
export const etiquetaOrigenLluvia = de(ORIGEN_LLUVIA);

export const ESTADO_EVACUACION: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  cerrada_cuadrilla: "Cerrada por la cuadrilla, sin confirmar",
  verificada: "Verificada por el evacuado",
  con_discrepancia: "Con discrepancia a revisar",
};
export const etiquetaEstadoEvacuacion = de(ESTADO_EVACUACION);

/** Motivos de discrepancia en palabras corrientes: son una marca para revisar, no una acusación. */
export const MOTIVO_DISCREPANCIA: Record<string, string> = {
  evacuado_dice_no: "La persona evacuada respondió que no llegó al destino informado.",
  evacuado_reporta_problema: "La persona evacuada avisó que hubo un problema en el traslado.",
  evacuado_parcial: "La persona evacuada avisó que fue asistida solo en parte.",
  evacuado_no_encontraron: "La persona evacuada avisó que la cuadrilla no la encontró en el lugar indicado.",
  destino_lejos_del_centro: "El punto de destino marcado queda lejos del centro de recepción elegido.",
};
export const etiquetaMotivoDiscrepancia = de(MOTIVO_DISCREPANCIA);

export const RESPUESTA_CONFIRMACION: Record<string, string> = { si: "Sí, llegó", no: "No llegó", problema: "Hubo un problema" };
export const etiquetaRespuestaConfirmacion = de(RESPUESTA_CONFIRMACION);

export const CANAL_CONFIRMACION: Record<string, string> = {
  app: "App o web",
  sms_sim: "SMS (simulado)",
  whatsapp_sim: "WhatsApp (simulado)",
  ivr_sim: "Llamada 103 (simulada)",
};
export const etiquetaCanalConfirmacion = de(CANAL_CONFIRMACION);

/**
 * Origen de un dato o de un pedido, sea cual sea su familia (solicitud, lluvia, canal de confirmación): busca el
 * código en cada catálogo y, si no está, lo humaniza. Úsese cuando una columna mezcla orígenes de distinta fuente.
 */
export function etiquetaOrigen(codigo: string | null | undefined): string {
  if (codigo === null || codigo === undefined || codigo === "") return "";
  return ORIGEN_SOLICITUD[codigo] ?? ORIGEN_LLUVIA[codigo] ?? CANAL_CONFIRMACION[codigo] ?? humanizar(codigo);
}

/** Códigos internos del kit y del equipo, con el nombre que entiende quien lee (DESIGN.md, Copy y voz). */
export const CODIGO: Record<string, string> = {
  K1: "Serie histórica del río",
  K2: "Alturas del río Paraguay (INA)",
  K3: "Estaciones y umbrales",
  K4: "Reporte del INA",
  K5: "Boletín ENSO",
  K6: "Informe de inteligencia artificial",
  K7: "Red hidrográfica",
  K8: "Escenarios y bitácora",
  K9: "Fuentes del kit",
  K10: "Sectores de evaluación",
  SUPUESTO: "Supuesto del equipo",
};

/**
 * Nombre llano de un código interno: "K1" pasa a "Serie histórica del río (K1)". Con `conCodigo: false` devuelve solo
 * el nombre. Si el código no es del catálogo, prueba con roles y orígenes y, al final, lo humaniza.
 */
export function etiquetaCodigo(codigo: string | null | undefined, { conCodigo = true }: { conCodigo?: boolean } = {}): string {
  if (codigo === null || codigo === undefined || codigo === "") return "";
  const clave = codigo.trim().toUpperCase();
  const nombre = CODIGO[clave];
  if (nombre) return conCodigo && clave !== "SUPUESTO" ? `${nombre} (${clave})` : nombre;
  return ROL_OPERATIVO[codigo] ?? ROL[codigo] ?? etiquetaOrigen(codigo);
}

/**
 * Pasa a lenguaje llano un texto de la API que trae códigos internos: "K1 · serie limpia; umbrales K3" pasa a
 * "Serie histórica del río · serie limpia; Estaciones y umbrales" y "es un SUPUESTO" a "es un supuesto del equipo".
 */
export function sinCodigos(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .replace(/\b[A-Za-z0-9_]+\.(?:geojson|csv|pdf|json|xlsx)\b/g, "")
    .replace(/\bK(\d+)\b/g, (cod) => CODIGO[cod] ?? cod)
    .replace(/\bSUPUESTO\b/g, "supuesto del equipo")
    .replace(/\s+·\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fecha y hora en horario de Argentina (UTC-3): "19/11/2026, 21:40". */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

/** Solo la fecha: "19/11/2026". */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "sin fecha";
  // Una fecha sin hora ("2026-10-31") es un día de calendario, no un instante: `new Date` la toma como
  // medianoche UTC y en horario de Argentina (UTC-3) caería el día anterior. Se formatea sin convertir.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (soloFecha) {
    const [, a, m, dia] = soloFecha;
    if (Number.isNaN(new Date(`${a}-${m}-${dia}T00:00:00Z`).getTime())) return "sin fecha";
    return `${dia}/${m}/${a}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}
