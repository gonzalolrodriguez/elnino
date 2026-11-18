import { ErrorApi } from "@/lib/api";

/** Mensaje legible para el usuario a partir de un error de la API o de red. */
export function mensajeError(e: unknown): string {
  if (!(e instanceof ErrorApi)) return "Ocurrió un error inesperado.";
  if (e.esRed) return "No hay conexión con el servidor. Revisá tu red e intentá de nuevo.";
  if (e.estado === 429) return "Demasiados intentos. Esperá unos minutos antes de volver a probar.";
  if (e.estado === 422 && Array.isArray(e.detalle)) {
    const partes = (e.detalle as { campo?: string; mensaje?: string }[])
      .map((d) => d.mensaje)
      .filter((m): m is string => !!m);
    if (partes.length > 0) return partes.join(" · ");
  }
  return e.message;
}
