/**
 * Evidencia multimedia de los partes de la cuadrilla (`POST /tareas/{id}/partes/{parte_id}/adjuntos`).
 * Lógica pura: límites del contrato y validación. El servidor vuelve a validar el tipo real del archivo.
 */

export type TipoAdjunto = "imagen" | "video";

/** Un archivo elegido y todavía no subido. `bytes` es `null` si el sistema no pudo medirlo. */
export type AdjuntoLocal = {
  uri: string;
  tipo: TipoAdjunto;
  mime: string;
  bytes: number | null;
};

export const MAX_ADJUNTOS_PARTE = 5;
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

export const MIME_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
export const MIME_VIDEO = ["video/mp4"];

export const formatearBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Tipo MIME a partir de lo que informa el selector o, si falta, de la extensión del archivo. */
export function mimeDeArchivo(uri: string, mimeInformado?: string | null): string {
  if (mimeInformado) return mimeInformado.toLowerCase();
  const ext = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri)?.[1]?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

/**
 * Valida un archivo antes de agregarlo al parte: tipo admitido, tamaño y cupo (5 por parte).
 * Imagen JPEG/PNG/WebP hasta 5 MB; video MP4 hasta 20 MB.
 */
export function validarAdjunto(
  a: Pick<AdjuntoLocal, "tipo" | "mime" | "bytes">,
  yaElegidos: number,
): { ok: true } | { ok: false; mensaje: string } {
  if (yaElegidos >= MAX_ADJUNTOS_PARTE) {
    return { ok: false, mensaje: `Cada parte admite hasta ${MAX_ADJUNTOS_PARTE} archivos.` };
  }
  if (a.tipo === "imagen") {
    if (!MIME_IMAGEN.includes(a.mime)) return { ok: false, mensaje: "Solo se admiten imágenes JPEG, PNG o WebP." };
    if (a.bytes !== null && a.bytes > MAX_IMAGEN_BYTES) {
      return { ok: false, mensaje: `La imagen pesa ${formatearBytes(a.bytes)}; el máximo es ${formatearBytes(MAX_IMAGEN_BYTES)}.` };
    }
    return { ok: true };
  }
  if (!MIME_VIDEO.includes(a.mime)) return { ok: false, mensaje: "Solo se admiten videos en formato MP4." };
  if (a.bytes !== null && a.bytes > MAX_VIDEO_BYTES) {
    return { ok: false, mensaje: `El video pesa ${formatearBytes(a.bytes)}; el máximo es ${formatearBytes(MAX_VIDEO_BYTES)}.` };
  }
  return { ok: true };
}

/** Nombre local para el campo `archivo` del formulario (el servidor genera el nombre definitivo). */
export const nombreParaSubir = (a: Pick<AdjuntoLocal, "tipo">): string => (a.tipo === "video" ? "evidencia.mp4" : "evidencia.jpg");
