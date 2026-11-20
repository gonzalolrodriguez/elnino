import type { RespuestaCanonica, RespuestaEvacuado } from "@/lib/servicios";

/**
 * Respuestas de la persona evacuada a «¿te asistieron?». El servidor acepta las cinco canónicas y,
 * por compatibilidad (SMS, cola guardada antes de esta versión), `si/no/problema`.
 */
export const RESPUESTAS_CANONICAS: RespuestaCanonica[] = ["completa", "parcial", "no_encontraron", "no_vinieron", "otro_problema"];

/** Textos de los botones. */
export const ETIQUETA_OPCION: Record<RespuestaCanonica, string> = {
  completa: "Me asistieron por completo",
  parcial: "Me asistieron en parte",
  no_encontraron: "Vinieron pero no me encontraron",
  no_vinieron: "No vinieron",
  otro_problema: "Otro problema",
};

const LEGADA: Record<string, RespuestaCanonica> = { si: "completa", no: "no_vinieron", problema: "otro_problema" };

/** Lleva cualquier valor (viejo o nuevo) al canónico; lo desconocido pasa a `otro_problema`. */
export function canonicaRespuesta(r: RespuestaEvacuado | string): RespuestaCanonica {
  if ((RESPUESTAS_CANONICAS as string[]).includes(r)) return r as RespuestaCanonica;
  return LEGADA[r] ?? "otro_problema";
}

/** Etiqueta de cualquier respuesta, también de las viejas guardadas en el servidor. */
export const etiquetaRespuesta = (r: RespuestaEvacuado | string): string => ETIQUETA_OPCION[canonicaRespuesta(r)];

/**
 * Palabra clave del SMS. Se conservan las del canal vigente (SI / NO / PROBLEMA) porque el parser del
 * servidor las entiende desde siempre: `completa` es SI, `no_vinieron` es NO y el resto va como PROBLEMA
 * con el motivo en el comentario.
 */
export function palabraSMS(r: RespuestaEvacuado | string): "SI" | "NO" | "PROBLEMA" {
  const c = canonicaRespuesta(r);
  return c === "completa" ? "SI" : c === "no_vinieron" ? "NO" : "PROBLEMA";
}
