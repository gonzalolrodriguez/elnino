import { ErrorApi, peticion } from "@/lib/api";
import type { DatosSolicitud, ResultadoEnvio, ResultadoFoto } from "@/lib/cola";

/** Tipos de las respuestas de la API que consume la app (contrato: docs/contrato_api.md). */
export type Categoria = "DATO OBSERVADO" | "DOCUMENTO DE REFERENCIA" | "SIMULADO";

export type Solicitud = {
  id: number;
  origen: string;
  tipo: string;
  personas: number;
  animales: number;
  texto: string | null;
  estado: "recibida" | "verificada" | "asignada" | "en_curso" | "resuelta";
  sector_id: string | null;
  creado_en: string;
  actualizado_en: string;
  categoria: Categoria;
};

export type Notificacion = {
  id: number;
  orden_id: number | null;
  mensaje: string;
  leida: boolean;
  creada_en: string;
};

export type GrupoFamiliar = {
  integrantes: number;
  menores: number;
  mayores: number;
  mascotas: number;
  telefono?: string | null;
  /** La app no los edita, pero se reenvían intactos para no borrarlos al guardar. */
  salud?: string | null;
  vulnerabilidad?: string | null;
  lon: number | null;
  lat: number | null;
  sector_id: string | null;
};

export type ItemStock = { especie: string; categoria_animal: string; cantidad: number };

export type Establecimiento = {
  id: number;
  nombre: string;
  renspa: string | null;
  lon: number;
  lat: number;
  sector_id: string | null;
  stock: ItemStock[];
};

export type AccesoSector = { nombre: string; superficie: string; estado: string };

export type SectorPropio = {
  id: string;
  nombre: string;
  estado: "normal" | "en_riesgo" | "comprometido";
  aislado: boolean;
  altura_compromiso_m: number;
  margen_a_compromiso_m: number;
  accesos: AccesoSector[];
  alertas: { orden_id: number; tipo: string; fundamento: string; creada_en: string }[];
  categoria: Categoria;
  fuente: string;
  /** GeoJSON Polygon (EPSG:4326, K10 sin cambios). Ausente en backends anteriores. */
  geometria?: { type: string; coordinates: number[][][] } | null;
};

export type CentroSugerido = {
  id: number;
  nombre: string;
  tipo: string;
  distancia_linea_recta_m: number;
  lon?: number | null;
  lat?: number | null;
  categoria: Categoria;
};

export type MiSector = {
  sectores: SectorPropio[];
  altura_referencia: { altura_m: number; fecha: string; categoria: Categoria; fuente: string };
  centro_asignado: {
    personas: CentroSugerido | null;
    animales: CentroSugerido | null;
    nota: string;
  } | null;
  nota: string;
};

export type Centro = {
  id: number;
  nombre: string;
  tipo: string;
  lon: number;
  lat: number;
  sector_id: string | null;
  capacidad_personas: number;
  cupo_libre_personas: number;
  categoria: Categoria;
};

export type ItemChecklist = { item: string; hecho: boolean };

export type Tarea = {
  id: number;
  titulo: string;
  descripcion: string | null;
  estado: "pendiente" | "en_curso" | "completada" | "cancelada";
  sector_id: string | null;
  checklist: ItemChecklist[] | null;
  actualizado_en: string;
};

export type GeoSectores = {
  features: {
    geometry: { type: string; coordinates: number[][][] };
    properties: { id: string; nombre: string; categoria: Categoria };
  }[];
};

type Falla = { ok: false; tipo: "red" | "sesion" | "rechazo"; mensaje: string };

/** Traduce un error de la API al vocabulario de la cola: reintentable, sesión o rechazo definitivo. */
function clasificar(e: unknown): Falla {
  if (e instanceof ErrorApi) {
    if (e.esRed || e.estado >= 500 || e.estado === 429) return { ok: false, tipo: "red", mensaje: e.message };
    if (e.estado === 401) return { ok: false, tipo: "sesion", mensaje: e.message };
    return { ok: false, tipo: "rechazo", mensaje: e.message };
  }
  return { ok: false, tipo: "red", mensaje: "Error inesperado" };
}

/**
 * Primer tiempo del envío. La cabecera `Idempotency-Key` hace que un reintento tras una respuesta
 * perdida devuelva la solicitud original (200) en lugar de duplicarla.
 */
export async function enviarSolicitud(
  datos: DatosSolicitud,
  claveIdempotencia: string,
): Promise<ResultadoEnvio> {
  try {
    const s = await peticion<Solicitud>("/solicitudes", {
      metodo: "POST",
      cuerpo: datos,
      cabeceras: { "Idempotency-Key": claveIdempotencia },
    });
    return { ok: true, servidorId: s.id };
  } catch (e) {
    return clasificar(e);
  }
}

/** Segundo tiempo: sube la foto ya comprimida (JPEG) como adjunto de la solicitud. */
export async function subirFotoSolicitud(servidorId: number, fotoUri: string): Promise<ResultadoFoto> {
  try {
    const form = new FormData();
    // En React Native un archivo local se adjunta como { uri, name, type }.
    form.append("archivo", { uri: fotoUri, name: "foto.jpg", type: "image/jpeg" } as unknown as Blob);
    await peticion<unknown>(`/solicitudes/${servidorId}/adjuntos`, { metodo: "POST", cuerpo: form });
    return { ok: true };
  } catch (e) {
    return clasificar(e);
  }
}

export const api = {
  solicitudes: () => peticion<{ solicitudes: Solicitud[] }>("/solicitudes"),
  notificaciones: () =>
    peticion<{ notificaciones: Notificacion[]; no_leidas: number }>("/mi/notificaciones"),
  marcarLeida: (id: number) =>
    peticion<Notificacion>(`/mi/notificaciones/${id}/leida`, { metodo: "PATCH" }),
  grupo: () => peticion<GrupoFamiliar>("/mi/grupo-familiar"),
  guardarGrupo: (cuerpo: Record<string, unknown>) =>
    peticion<GrupoFamiliar>("/mi/grupo-familiar", { metodo: "PUT", cuerpo }),
  establecimientos: () => peticion<{ establecimientos: Establecimiento[] }>("/mi/establecimientos"),
  guardarStock: (id: number, stock: ItemStock[]) =>
    peticion<unknown>(`/mi/establecimientos/${id}/stock`, { metodo: "PUT", cuerpo: { stock } }),
  miSector: () => peticion<MiSector>("/mi/sector"),
  centros: () => peticion<{ centros: Centro[] }>("/centros"),
  sectoresGeo: () => peticion<GeoSectores>("/sectores", { auth: false }),
  tareas: () => peticion<{ tareas: Tarea[] }>("/tareas"),
  actualizarTarea: (
    id: number,
    cambios: { estado?: Tarea["estado"]; checklist?: ItemChecklist[] },
  ) => peticion<Tarea>(`/tareas/${id}`, { metodo: "PATCH", cuerpo: cambios }),
  registroCiudadano: (cuerpo: Record<string, unknown>) =>
    peticion<unknown>("/auth/registro/ciudadano", { metodo: "POST", cuerpo, auth: false }),
  registroProductor: (cuerpo: Record<string, unknown>) =>
    peticion<unknown>("/auth/registro/productor", { metodo: "POST", cuerpo, auth: false }),
};
