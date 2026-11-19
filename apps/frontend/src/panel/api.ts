import { API_BASE, ApiError, obtenerToken, solicitar } from "../lib/api";
import type {
  AfirmacionK6,
  Alternativas,
  Ascenso,
  CalculoGanadero,
  CamposBitacora,
  Centro,
  CierreEvacuacion,
  ConsultaConfirmacion,
  Evacuacion,
  ListaEvacuaciones,
  Cuadrilla,
  EntradaBitacora,
  EntradaEscenario,
  Escenario,
  Estacion,
  Geo,
  Lectura,
  Notificacion,
  Lluvia,
  Orden,
  Puesto,
  Recomendacion,
  ResumenAdmin,
  ResumenPanel,
  RelacionK7,
  Ruta,
  SerieFormosa,
  Solicitud,
  Tarea,
  UsuarioAdmin,
} from "./tipos";

/** Todas las llamadas del panel van autenticadas con el token en memoria. */
const a = { autenticado: true } as const;

export type EditableAlternativa = { nombre?: string; orden_sectores?: string[]; centros_excluidos?: number[] };

export type ConsultaRuta = {
  perfil: string;
  origen: { lon: number; lat: number };
  destino?: { lon: number; lat: number };
  centro_id?: number;
  altura_formosa_m: number;
  lluvia_mm: number;
  caminos_cerrados: number[];
};

export const api = {
  serie: () => solicitar<SerieFormosa>("/serie/formosa"),
  ascenso: (altura?: number) => solicitar<Ascenso>(`/serie/ascenso${altura === undefined ? "" : `?altura_actual_m=${altura}`}`),
  lluvia: (limite = 60) => solicitar<Lluvia>(`/lluvia?limite=${limite}`),
  puestos: () => solicitar<{ puestos: Puesto[] }>("/lluvia/puestos"),
  cargarLluvia: (c: { puesto: string; fecha: string; turno: "07" | "17"; mm: number | null; origen: "carga_manual" | "parte_policial" | "simulado" }) =>
    solicitar<Lectura>("/lluvia", { ...a, cuerpo: c }),
  estaciones: () => solicitar<{ estaciones: Estacion[] }>("/estaciones"),
  sectores: () => solicitar<Geo>("/sectores"),
  accesos: () => solicitar<Geo>("/accesos", a),
  marcarAcceso: (id: number, transitable: boolean, motivo?: string) =>
    solicitar<unknown>(`/accesos/${id}`, { ...a, metodo: "PATCH", cuerpo: { transitable, motivo: transitable ? null : motivo } }),
  centros: () => solicitar<{ centros: Centro[] }>("/centros", a),
  escenario: (e: EntradaEscenario) => solicitar<Escenario>("/simulacion/escenario", { ...a, cuerpo: e }),
  recomendacion: (e: EntradaEscenario, prioridad: "riesgo" | "poblacion") =>
    solicitar<Recomendacion>("/simulacion/recomendacion", { ...a, cuerpo: { ...e, prioridad } }),
  alternativas: (e: EntradaEscenario, editable?: EditableAlternativa) =>
    solicitar<Alternativas>("/simulacion/alternativas", { ...a, cuerpo: { ...e, ...(editable ? { editable } : {}) } }),
  ruteo: (c: ConsultaRuta) => solicitar<Ruta>("/ruteo", { ...a, cuerpo: c }),
  ganaderia: (c: unknown) => solicitar<CalculoGanadero>("/ganaderia/calculo", { ...a, cuerpo: c }),
  cuadrillas: () => solicitar<{ cuadrillas: Cuadrilla[] }>("/cuadrillas", a),
  crearCuadrilla: (c: { nombre: string; tipo_incidente: string }) => solicitar<Cuadrilla>("/cuadrillas", { ...a, cuerpo: { ...c, integrantes: [] } }),
  tareas: () => solicitar<{ tareas: Tarea[] }>("/tareas", a),
  actualizarTarea: (id: number, c: { estado?: string; cuadrilla_id?: number; checklist?: { item: string; hecho: boolean }[] }) => solicitar<Tarea>(`/tareas/${id}`, { ...a, metodo: "PATCH", cuerpo: c }),
  notificaciones: () => solicitar<{ notificaciones: Notificacion[]; no_leidas: number }>("/mi/notificaciones", a),
  marcarLeida: (id: number) => solicitar<Notificacion>(`/mi/notificaciones/${id}/leida`, { ...a, metodo: "PATCH", cuerpo: {} }),
  solicitudes: (f: { estado?: string; sector_id?: string; limite?: number } = {}) => {
    const q = new URLSearchParams();
    if (f.estado) q.set("estado", f.estado);
    if (f.sector_id) q.set("sector_id", f.sector_id);
    if (f.limite) q.set("limite", String(f.limite));
    const s = q.toString();
    return solicitar<{ solicitudes: Solicitud[]; total?: number }>(`/solicitudes${s ? `?${s}` : ""}`, a);
  },
  evacuaciones: (f: { estado?: string; sector_id?: string; limite?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (f.estado) q.set("estado", f.estado);
    if (f.sector_id) q.set("sector_id", f.sector_id);
    q.set("limite", String(f.limite ?? 200));
    if (f.offset) q.set("offset", String(f.offset));
    return solicitar<ListaEvacuaciones>(`/evacuaciones?${q.toString()}`, a);
  },
  constancia: (tareaId: number) => solicitar<Evacuacion>(`/tareas/${tareaId}/constancia`, a),
  cerrarConConstancia: (tareaId: number, c: CierreEvacuacion, claveIdempotencia: string) =>
    solicitar<{ repetida: boolean; evacuacion: { estado: string } }>(`/tareas/${tareaId}/cierre`, { ...a, cuerpo: c, cabeceras: { "Idempotency-Key": claveIdempotencia } }),
  reabrirConfirmacion: (tareaId: number, motivo?: string) =>
    solicitar<{ tarea_id: number; estado: string; respuesta_previa: string | null; reabierta: boolean; nota: string }>(`/evacuaciones/${tareaId}/confirmacion/reabrir`, { ...a, cuerpo: motivo ? { motivo } : {} }),
  misConfirmaciones: () => solicitar<{ confirmaciones: ConsultaConfirmacion[]; pendientes: number }>("/mi/confirmaciones", a),
  responderConfirmacion: (c: { solicitud_id?: number; codigo?: string; respuesta: "si" | "no" | "problema"; comentario?: string }) =>
    solicitar<{ respuesta: string; repetida: boolean; nota: string }>("/mi/confirmaciones", { ...a, cuerpo: c }),
  resumenPanel: () => solicitar<ResumenPanel>("/panel/resumen", a),
  resumenAdmin: () => solicitar<ResumenAdmin>("/admin/resumen", a),
  avanzarSolicitud: (id: number, estado: string, cuadrilla_id?: number) =>
    solicitar<Solicitud>(`/solicitudes/${id}`, { ...a, metodo: "PATCH", cuerpo: { estado, ...(cuadrilla_id ? { cuadrilla_id } : {}) } }),
  ordenes: () => solicitar<{ ordenes: Orden[] }>("/ordenes", a),
  emitirOrden: (c: { tipo: string; sectores: string[]; fundamento: string; fecha_simulada?: string }, claveIdempotencia?: string) =>
    solicitar<Orden>("/ordenes", { ...a, cuerpo: c, ...(claveIdempotencia ? { cabeceras: { "Idempotency-Key": claveIdempotencia } } : {}) }),
  bitacora: () => solicitar<{ entradas: EntradaBitacora[] }>("/bitacora", a),
  crearBitacora: (c: CamposBitacora) => solicitar<EntradaBitacora>("/bitacora", { ...a, cuerpo: c }),
  completarBitacora: (id: number, c: CamposBitacora) => solicitar<EntradaBitacora>(`/bitacora/${id}`, { ...a, metodo: "PATCH", cuerpo: c }),
  k6: () => solicitar<{ informe: string; afirmaciones: AfirmacionK6[]; nota: string }>("/verificador/k6"),
  k7: () => solicitar<{ esquema: string; relaciones: RelacionK7[]; nota: string }>("/verificador/k7"),
  rolesOperativos: () => solicitar<{ roles: { codigo: string; nombre: string; descripcion: string | null }[] }>("/roles-operativos", a),
  usuarios: () => solicitar<UsuarioAdmin[]>("/usuarios?limite=200", a),
  crearUsuario: (c: { email: string; password: string; nombre_visible: string; rol: string; rol_operativo?: string | null }) =>
    solicitar<UsuarioAdmin>("/usuarios", { ...a, cuerpo: c }),
  modificarUsuario: (id: number, c: Record<string, unknown>) => solicitar<UsuarioAdmin>(`/usuarios/${id}`, { ...a, metodo: "PATCH", cuerpo: c }),
};

function cabeceras(): Record<string, string> {
  const token = obtenerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SIN_CONEXION = "No hay conexión con el servicio. Revisá tu red e intentá de nuevo.";

/** Descarga un recurso autenticado (Markdown de la bitácora, Excel de lluvia). */
export async function descargar(ruta: string): Promise<Blob> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}${ruta}`, { headers: cabeceras(), credentials: "include" });
  } catch {
    throw new ApiError(0, "sin_conexion", SIN_CONEXION);
  }
  if (!r.ok) throw new ApiError(r.status, "error", `No se pudo descargar (error ${r.status}).`);
  return r.blob();
}

/** Importa la planilla de lluvia (multipart; no usa el cuerpo JSON de `solicitar`). */
export async function importarPlanilla(archivo: File): Promise<{ insertadas: number } & Record<string, unknown>> {
  const f = new FormData();
  f.append("archivo", archivo);
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/lluvia/importar-planilla`, { method: "POST", headers: cabeceras(), body: f, credentials: "include" });
  } catch {
    throw new ApiError(0, "sin_conexion", SIN_CONEXION);
  }
  const datos = (await r.json().catch(() => null)) as { error?: { mensaje?: string } } | null;
  if (!r.ok) throw new ApiError(r.status, "error", datos?.error?.mensaje ?? `Error ${r.status}`);
  return datos as { insertadas: number };
}

export function guardarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = "none";
  document.body.appendChild(enlace); // Firefox exige el ancla dentro del DOM
  enlace.click();
  enlace.remove();
  // Se libera tarde: revocar enseguida puede cortar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Sube una foto de la constancia (multipart, campo `archivo`). El backend responde 200 con `duplicado` si ya estaba. */
export async function subirFotoCierre(tareaId: number, archivo: File): Promise<{ duplicado?: boolean }> {
  const f = new FormData();
  f.append("archivo", archivo);
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/tareas/${tareaId}/cierre/adjuntos`, { method: "POST", headers: cabeceras(), body: f, credentials: "include" });
  } catch {
    throw new ApiError(0, "sin_conexion", SIN_CONEXION);
  }
  const datos = (await r.json().catch(() => null)) as { error?: { mensaje?: string }; duplicado?: boolean } | null;
  if (!r.ok) throw new ApiError(r.status, "error", datos?.error?.mensaje ?? `No se pudo subir la foto (error ${r.status}).`);
  return { duplicado: datos?.duplicado };
}

/** Descarga una foto de la constancia con la sesión (no se puede usar <img src> directo: lleva token). */
export const fotoCierre = (tareaId: number, n: number): Promise<Blob> => descargar(`/tareas/${tareaId}/cierre/adjuntos/${n}`);
