import { guardarCache, leerCache } from "@/lib/cacheLocal";
import type { DatosSolicitud } from "@/lib/cola";
import { MAX_PERSONAS } from "@/lib/sos";
import { api } from "@/lib/servicios";

/** Segundos de la cuenta regresiva cancelable antes de enviar el pedido rápido. */
export const SEGUNDOS_CONFIRMACION = 5;

const ESPERA_GRUPO_MS = 3000;

const acotar = (n: number): number => Math.min(Math.max(Math.trunc(n), 1), MAX_PERSONAS);

/**
 * Personas del pedido rápido: el grupo familiar registrado (último valor guardado en el teléfono si no
 * hay red) o 1. Nunca demora el pedido más de `ESPERA_GRUPO_MS`.
 */
export async function personasParaPedidoRapido(rol: string, clave: string): Promise<number> {
  if (rol !== "ciudadano" && rol !== "productor") return 1;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const grupo = await Promise.race([
      api.grupo(),
      new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error("tiempo")), ESPERA_GRUPO_MS);
      }),
    ]);
    if (Number.isFinite(grupo.integrantes)) {
      void guardarCache(clave, grupo.integrantes);
      return acotar(grupo.integrantes);
    }
  } catch {
    // Sin red o sin grupo cargado: se usa lo último guardado.
  } finally {
    clearTimeout(temporizador);
  }
  const guardado = await leerCache<number>(clave);
  return guardado && Number.isFinite(guardado.valor) ? acotar(guardado.valor) : 1;
}

/**
 * Pedido mínimo del botón «Necesito ayuda ahora». El backend exige coordenadas o una referencia:
 * sin ninguna de las dos devuelve `null` (no se puede enviar).
 */
export function datosPedidoRapido(
  coordenadas: { lat: number; lon: number } | null,
  personas: number,
  referencia: string,
): DatosSolicitud | null {
  const ref = referencia.trim();
  if (!coordenadas && !ref) return null;
  return {
    tipo: "asistencia",
    personas: acotar(personas),
    animales: 0,
    ...(coordenadas ? { lon: coordenadas.lon, lat: coordenadas.lat } : {}),
    texto: "Pedido rápido «Necesito ayuda ahora» desde la app.",
    ...(ref ? { referencia_ubicacion: ref.slice(0, 60) } : {}),
    origen: "app",
  };
}
