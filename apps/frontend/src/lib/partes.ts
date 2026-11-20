import type { Tarea } from "../panel/tipos";
import { API_BASE, ApiError, obtenerToken, solicitar } from "./api";

/** Contrato de los partes de tarea (ver odd/tasks/partes-cuadrilla.md). Sin nombres de personas: el autor es un rol operativo. */
export type TipoParte = "avance" | "dificultad" | "resultado";
export type ResultadoParte = "completa" | "parcial" | "no_realizada" | "reprogramada";

export type Parte = {
  id: number;
  tarea_id: number;
  cuadrilla_id: number | null;
  tipo: TipoParte;
  resultado: ResultadoParte | null;
  observacion: string | null;
  autor_rol: string | null;
  creado_en: string;
  resuelta: boolean | null;
  /** Evidencia multimedia del parte (`GET /tareas/{id}/partes/{parte_id}/adjuntos/{n}`). */
  adjuntos?: AdjuntoParte[];
};

export type AdjuntoParte = { n: number; tipo: string; bytes: number };

export type CuerpoParte = { tipo: TipoParte; resultado: ResultadoParte | null; observacion: string | null };

/** `GET /tareas` agrega estos dos campos a cada tarea. */
export type TareaConPartes = Tarea & { requiere_atencion?: boolean; ultimo_parte?: Parte | null };

const a = { autenticado: true } as const;
export const partesDeTarea = (tareaId: number) => solicitar<{ items: Parte[] }>(`/tareas/${tareaId}/partes`, a).then((r) => r.items);
export const enviarParte = (tareaId: number, c: CuerpoParte) => solicitar<Parte>(`/tareas/${tareaId}/partes`, { ...a, cuerpo: c });

export const MIN_OBSERVACION = 3;
export const MAX_OBSERVACION = 1000;

/** Etiquetas del resultado, como las ve la cuadrilla. */
export const ETIQUETA_RESULTADO: Record<ResultadoParte, string> = {
  completa: "Completa",
  parcial: "A medias",
  no_realizada: "No se pudo",
  reprogramada: "Reprogramar",
};

export const AYUDA_RESULTADO: Record<ResultadoParte, string> = {
  completa: "Se hizo todo lo pedido.",
  parcial: "Se hizo una parte; el resto queda pendiente.",
  no_realizada: "No se pudo hacer. Contá por qué.",
  reprogramada: "Hay que volver otro día u hora. Contá por qué.",
};

export const ORDEN_RESULTADOS: ResultadoParte[] = ["completa", "parcial", "no_realizada", "reprogramada"];

/**
 * Valida un parte antes de enviarlo. La observación es obligatoria para una dificultad y para un resultado que no es «completa»;
 * en un avance es opcional, pero si se escribe tiene que tener sentido (3 a 1000 caracteres).
 */
export function validarParte(tipo: TipoParte, resultado: ResultadoParte | null, observacion: string): { cuerpo: CuerpoParte } | { error: string } {
  const texto = observacion.trim();
  const obligatoria = tipo === "dificultad" || (tipo === "resultado" && resultado !== "completa");
  if (tipo === "resultado" && resultado === null) return { error: "Elegí cómo terminó la tarea." };
  if (texto.length > MAX_OBSERVACION) return { error: `La observación admite hasta ${MAX_OBSERVACION} caracteres.` };
  if ((obligatoria || texto.length > 0) && texto.length < MIN_OBSERVACION) {
    return { error: obligatoria ? `Contá qué pasó: la observación es obligatoria (de ${MIN_OBSERVACION} a ${MAX_OBSERVACION} caracteres).` : `Si agregás un texto, que tenga al menos ${MIN_OBSERVACION} caracteres.` };
  }
  return { cuerpo: { tipo, resultado: tipo === "resultado" ? resultado : null, observacion: texto === "" ? null : texto } };
}

// --- Evidencia multimedia en los partes (ver odd/tasks/gestion-cuadrillas.md) ----------------------------------
export const MAX_ADJUNTOS_PARTE = 5;
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;
export const MAX_BYTES_VIDEO = 20 * 1024 * 1024;
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
export const TIPO_VIDEO = "video/mp4";
/** Para el atributo `accept` del selector: cámara o galería. */
export const ACEPTA_ADJUNTOS = "image/jpeg,image/png,image/webp,video/mp4";

export const esVideo = (tipo: string): boolean => tipo.startsWith("video/");

/** "850 KB", "4,2 MB". */
export function formatearBytes(b: number): string {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Revisa un archivo antes de subirlo: tipo permitido y tamaño máximo. Devuelve el motivo del rechazo o `null`. El servidor vuelve a validar el tipo real. */
export function validarAdjunto(f: { name: string; type: string; size: number }): string | null {
  if (TIPOS_IMAGEN.includes(f.type)) {
    return f.size > MAX_BYTES_IMAGEN ? `${f.name}: la imagen pesa ${formatearBytes(f.size)} y el máximo es 5 MB.` : null;
  }
  if (f.type === TIPO_VIDEO) {
    return f.size > MAX_BYTES_VIDEO ? `${f.name}: el video pesa ${formatearBytes(f.size)} y el máximo es 20 MB.` : null;
  }
  return `${f.name}: solo se aceptan imágenes JPEG, PNG o WebP y videos MP4.`;
}

/** Suma archivos nuevos a los ya elegidos respetando el máximo de 5. Devuelve la lista nueva y los motivos de los rechazados. */
export function sumarAdjuntos<T extends { name: string; type: string; size: number }>(actuales: T[], nuevos: T[]): { lista: T[]; errores: string[] } {
  const lista = [...actuales];
  const errores: string[] = [];
  for (const f of nuevos) {
    const motivo = validarAdjunto(f);
    if (motivo) errores.push(motivo);
    else if (lista.length >= MAX_ADJUNTOS_PARTE) errores.push(`${f.name}: ya elegiste ${MAX_ADJUNTOS_PARTE} archivos, que es el máximo por parte.`);
    else lista.push(f);
  }
  return { lista, errores };
}

function cabecerasAuth(): Record<string, string> {
  const token = obtenerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Sube un archivo de evidencia al parte ya creado (multipart, campo `archivo`). */
export async function subirAdjuntoParte(tareaId: number, parteId: number, archivo: File): Promise<AdjuntoParte | null> {
  const f = new FormData();
  f.append("archivo", archivo);
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/tareas/${tareaId}/partes/${parteId}/adjuntos`, { method: "POST", headers: cabecerasAuth(), body: f, credentials: "include" });
  } catch {
    throw new ApiError(0, "sin_conexion", "No hay conexión con el servicio. Revisá tu red e intentá de nuevo.");
  }
  const datos = (await r.json().catch(() => null)) as ({ error?: { mensaje?: string } } & Partial<AdjuntoParte>) | null;
  if (!r.ok) throw new ApiError(r.status, "error", datos?.error?.mensaje ?? `No se pudo subir el archivo (error ${r.status}).`);
  return datos && typeof datos.n === "number" ? (datos as AdjuntoParte) : null;
}

/** Descarga un adjunto con la sesión (lleva token: no sirve `<img src>` directo). */
export async function descargarAdjuntoParte(tareaId: number, parteId: number, n: number): Promise<Blob> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/tareas/${tareaId}/partes/${parteId}/adjuntos/${n}`, { headers: cabecerasAuth(), credentials: "include" });
  } catch {
    throw new ApiError(0, "sin_conexion", "No hay conexión con el servicio.");
  }
  if (!r.ok) throw new ApiError(r.status, "error", `No se pudo cargar el adjunto (error ${r.status}).`);
  return r.blob();
}
