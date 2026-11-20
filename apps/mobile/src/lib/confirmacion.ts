import { Linking } from "react-native";

import { SMS_DESTINO } from "@/lib/ayudaSms";
import type { RespuestaEvacuado } from "@/lib/servicios";
import type { DatosConfirmacionEvacuacion, Notificacion } from "@/lib/servicios";
import { etiquetaRespuesta, palabraSMS } from "@/lib/respuestas";
import { enlaceSMS } from "@/lib/sos";

/** Tope del comentario (`POST /mi/confirmaciones`). */
export const MAX_COMENTARIO = 500;

/** Notificación de confirmación con los datos mínimos para responder (si faltan, se la trata como común). */
export function datosDeConfirmacion(n: Notificacion): DatosConfirmacionEvacuacion | null {
  if (n.tipo !== "confirmacion_evacuacion" || !n.datos) return null;
  const d = n.datos as Partial<DatosConfirmacionEvacuacion>;
  if (typeof d.solicitud_id !== "number" || typeof d.codigo !== "string") return null;
  return {
    tarea_id: Number(d.tarea_id ?? 0),
    solicitud_id: d.solicitud_id,
    codigo: d.codigo,
    centro_nombre: d.centro_nombre ?? null,
    respuestas: d.respuestas ?? ["completa", "parcial", "no_encontraron", "no_vinieron", "otro_problema"],
  };
}

/**
 * Texto del SMS de respuesta: `SI <codigo>`, `NO <codigo>` o `PROBLEMA <codigo> <texto>`. El código
 * viene de la notificación. Si la respuesta es de las nuevas que no tienen palabra propia, el motivo
 * va como texto ("Asistencia parcial"), seguido del comentario. Se limpia de saltos de línea y se acota.
 */
export function textoSMSConfirmacion(respuesta: RespuestaEvacuado, codigo: string, comentario = ""): string {
  const base = palabraSMS(respuesta);
  const limpio = comentario.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  if (base !== "PROBLEMA") return `${base} ${codigo}`;
  const motivo = respuesta === "problema" || respuesta === "otro_problema" ? "" : `${etiquetaRespuesta(respuesta)}. `;
  const texto = `${motivo}${limpio}`.trim().slice(0, 140);
  return texto ? `${base} ${codigo} ${texto}` : `${base} ${codigo}`;
}

/** Abre la app de mensajes con la respuesta ya escrita (canal SIMULADO). Nunca envía nada sola. */
export async function abrirSMSConfirmacion(
  respuesta: RespuestaEvacuado,
  codigo: string,
  comentario = "",
  destino: string = SMS_DESTINO,
): Promise<void> {
  await Linking.openURL(enlaceSMS(destino, textoSMSConfirmacion(respuesta, codigo, comentario)));
}
