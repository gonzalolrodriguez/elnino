import { Linking } from "react-native";

import { SMS_DESTINO } from "@/lib/ayudaSms";
import type { RespuestaEvacuado } from "@/lib/servicios";
import type { DatosConfirmacionEvacuacion, Notificacion } from "@/lib/servicios";
import { enlaceSMS } from "@/lib/sos";

/** Tope del comentario (`POST /mi/confirmaciones`). */
export const MAX_COMENTARIO = 500;

export const ETIQUETA_RESPUESTA: Record<RespuestaEvacuado, string> = {
  si: "Sí, llegué",
  no: "No llegué",
  problema: "Hubo un problema",
};

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
    respuestas: d.respuestas ?? ["si", "no", "problema"],
  };
}

/**
 * Texto del SMS de respuesta: `SI <codigo>`, `NO <codigo>` o `PROBLEMA <codigo> <texto>`. El código
 * viene de la notificación; el comentario se limpia de saltos de línea y se acota.
 */
export function textoSMSConfirmacion(respuesta: RespuestaEvacuado, codigo: string, comentario = ""): string {
  const base = respuesta === "si" ? "SI" : respuesta === "no" ? "NO" : "PROBLEMA";
  const limpio = comentario.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  return respuesta === "problema" && limpio ? `${base} ${codigo} ${limpio}` : `${base} ${codigo}`;
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
