import { Text, VisuallyHidden } from "@chakra-ui/react";

import type { RespuestaConfirmacion } from "../tipos";

type Canonica = "completa" | "parcial" | "no_encontraron" | "no_vinieron" | "otro_problema";

const ETIQUETAS: Record<Canonica, string> = {
  completa: "Asistido por completo",
  parcial: "Asistido en parte",
  no_encontraron: "No lo encontraron",
  no_vinieron: "No vinieron",
  otro_problema: "Otro problema",
};

const LEGADO: Record<string, Canonica> = { si: "completa", no: "no_vinieron", problema: "otro_problema" };

/** Lleva los valores históricos (`si`, `no`, `problema`) a las cinco respuestas vigentes. Lo desconocido devuelve null. */
export function normalizarRespuesta(r: RespuestaConfirmacion | string | null | undefined): Canonica | null {
  if (!r) return null;
  if (r in ETIQUETAS) return r as Canonica;
  return LEGADO[r] ?? null;
}

/** Texto legible de la respuesta; un valor desconocido se muestra tal cual. */
export function etiquetaRespuesta(r: RespuestaConfirmacion | string): string {
  const c = normalizarRespuesta(r);
  return c ? ETIQUETAS[c] : r;
}

/** `completa` verifica el traslado; cualquier otra respuesta es una discrepancia a revisar. */
export function esDiscrepancia(r: RespuestaConfirmacion | string | null | undefined): boolean {
  const c = normalizarRespuesta(r);
  return c !== null && c !== "completa";
}

/** Respuesta con marca de forma (✓ o !) además del color: la discrepancia no depende solo del tono. */
export function RespuestaConfirmacionTexto({ respuesta }: { respuesta: RespuestaConfirmacion | string }) {
  const dis = esDiscrepancia(respuesta);
  return (
    <Text as="span" color={dis ? "evacuacion.800" : undefined} fontWeight={dis ? 600 : undefined} data-respuesta={normalizarRespuesta(respuesta) ?? respuesta} data-discrepancia={dis ? "si" : "no"}>
      <span aria-hidden="true">{dis ? "! " : "✓ "}</span>
      {etiquetaRespuesta(respuesta)}
      {dis && <VisuallyHidden> (discrepancia a revisar)</VisuallyHidden>}
    </Text>
  );
}
