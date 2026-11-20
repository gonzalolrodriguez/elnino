import { etiquetaEstadoSolicitud } from "@/lib/etiquetas";
import { etiquetaRespuesta } from "@/lib/respuestas";
import type { PedidoCiudadano } from "@/lib/servicios";

/**
 * Lógica pura de «Mis pedidos» (`GET /mi/pedidos`): línea de tiempo de cinco pasos más la confirmación
 * de la persona, etiquetas del vehículo (SIMULADO) y separación entre pedido activo e historial.
 */

export type PasoLinea = { clave: string; etiqueta: string; alcanzado: boolean; en: string | null };

const PASOS: { clave: PedidoCiudadano["estado"]; etiqueta: string }[] = [
  { clave: "recibida", etiqueta: "Recibido" },
  { clave: "verificada", etiqueta: "Verificado" },
  { clave: "asignada", etiqueta: "Cuadrilla asignada" },
  { clave: "en_curso", etiqueta: "En camino" },
  { clave: "resuelta", etiqueta: "Asistido" },
];

/** Los cinco pasos del contrato y, al final, «Confirmado por vos» cuando la persona ya respondió. */
export function lineaDeTiempo(p: PedidoCiudadano): PasoLinea[] {
  const pasos: PasoLinea[] = PASOS.map(({ clave, etiqueta }) => {
    const en = p.linea_tiempo?.find((x) => x.estado === clave)?.en ?? null;
    return { clave, etiqueta, alcanzado: en !== null, en };
  });
  pasos.push({ clave: "confirmada", etiqueta: "Confirmado por vos", alcanzado: Boolean(p.confirmacion?.respondida), en: null });
  return pasos;
}

const VEHICULO: Record<string, string> = {
  "4x4": "4x4",
  camion_jaula: "Camión jaula",
  colectivo: "Colectivo",
  lancha: "Lancha",
  moto: "Moto",
};
export const etiquetaVehiculo = (v: string | null | undefined): string | null => (v ? (VEHICULO[v] ?? v) : null);

const TIPO_CUADRILLA: Record<string, string> = { humana: "Asistencia a personas", ganadera: "Traslado de ganado", apicola: "Apicultura" };
export const etiquetaTipoCuadrilla = (t: string): string => TIPO_CUADRILLA[t] ?? t;

/** Activo: todavía no se resolvió o falta que la persona confirme. El resto va al historial. */
export const esPedidoActivo = (p: PedidoCiudadano): boolean =>
  p.estado !== "resuelta" || Boolean(p.confirmacion && !p.confirmacion.respondida);

/** Estado final en texto con ícono (nunca solo color): "✓ Asistido · Me asistieron en parte". */
export function estadoFinal(p: PedidoCiudadano): { icono: string; texto: string } {
  if (p.estado !== "resuelta") return { icono: "…", texto: etiquetaEstadoSolicitud(p.estado) };
  const r = p.confirmacion?.respondida && p.confirmacion.respuesta ? ` · ${etiquetaRespuesta(p.confirmacion.respuesta)}` : "";
  return { icono: "✓", texto: `Asistido${r}` };
}
