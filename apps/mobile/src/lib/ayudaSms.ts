import { Linking } from "react-native";

import { MAX_ANIMALES, MAX_PERSONAS, codificarSOS, enlaceSMS, type EntradaSOS } from "@/lib/sos";

/** Número al que se dirige el SMS; si no está configurado, la persona elige el destinatario. */
export const SMS_DESTINO = process.env.EXPO_PUBLIC_SMS_DESTINO ?? "";

/** Explicación, en palabras simples, de a quién va el mensaje (el canal de la demo es SIMULADO). */
export function textoDestinoSMS(destino: string = SMS_DESTINO): string {
  return destino
    ? `El mensaje se arma para el número ${destino}, que es el canal de la demostración (SIMULADO): no llega a ninguna autoridad real.`
    : "En esta versión de prueba no hay un número cargado: cuando se abra la app de mensajes, elegí vos a quién mandarlo. El canal de la demostración es SIMULADO: el mensaje no llega a ninguna autoridad real. Ante una emergencia de verdad, llamá al 103.";
}

/** Entero positivo o 0 si el texto está vacío. `null` si no es un número válido. */
export function leerEntero(texto: string): number | null {
  const t = texto.trim();
  if (t === "") return 0;
  if (!/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

/** Valida personas y animales contra los límites del backend; devuelve el aviso o null si está bien. */
export function validarCantidades(personas: string, animales: string): string | null {
  const p = leerEntero(personas);
  const a = leerEntero(animales);
  if (p === null || a === null) return "Personas y animales se escriben con números, sin signos ni letras.";
  if (p > MAX_PERSONAS) return `Personas: el máximo por pedido es ${MAX_PERSONAS}.`;
  if (a > MAX_ANIMALES) return `Animales: el máximo por pedido es ${MAX_ANIMALES}.`;
  return null;
}

/** Arma el SOS-FSA y abre la app de mensajes con el texto cargado. Nunca envía nada solo. */
export async function abrirSMS(entrada: EntradaSOS, destino: string = SMS_DESTINO): Promise<void> {
  await Linking.openURL(enlaceSMS(destino, codificarSOS(entrada)));
}
