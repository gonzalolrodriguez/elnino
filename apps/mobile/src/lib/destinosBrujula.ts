import type { Destino } from "@/lib/brujula";
import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api, type Centro, type CentroSugerido, type MiSector } from "@/lib/servicios";

/**
 * Destinos de la brújula guardados en el teléfono: el centro asignado (`/mi/sector`) y la lista de
 * centros (`/centros`). Son ubicaciones de lugares (no datos de salud ni de contacto): se guardan con
 * la misma caché SQLite que «Estado de tu sector» y se borran al cerrar sesión.
 */
export type DestinosGuardados = {
  asignado: Destino | null;
  centros: Destino[];
};

export type DestinosCargados = DestinosGuardados & {
  /** Marca de tiempo (ms) de la última vez que se guardó con conexión. */
  guardadoEn: number;
  /** `true` si no se pudo consultar el servidor y se usa lo guardado. */
  desdeCache: boolean;
};

export const claveBrujula = (usuarioId: number | null) => `brujula:${usuarioId ?? "anonimo"}:${obtenerUrlServidor()}`;

function aDestino(c: Pick<CentroSugerido, "id" | "nombre" | "lat" | "lon" | "categoria">): Destino | null {
  if (c.lat == null || c.lon == null || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return null;
  return { id: c.id, nombre: c.nombre, lat: c.lat, lon: c.lon, categoria: c.categoria };
}

/** Centro asignado de `/mi/sector`; si trae el punto lo usa y si no lo busca en la lista de centros. */
export function destinoAsignado(sector: MiSector | null, centros: Centro[]): Destino | null {
  const sug = sector?.centro_asignado?.personas ?? sector?.centro_asignado?.animales ?? null;
  if (!sug) return null;
  const enLista = centros.find((c) => c.id === sug.id);
  return aDestino(sug) ?? (enLista ? aDestino(enLista) : null);
}

/**
 * Consulta el servidor (cada pedido por separado: si uno falla se conserva lo guardado de ese dato) y
 * guarda el resultado. Sin conexión devuelve lo último guardado, o `null` si no hay nada.
 */
export async function cargarDestinos(usuarioId: number | null): Promise<DestinosCargados | null> {
  const clave = claveBrujula(usuarioId);
  const previo = await leerCache<DestinosGuardados>(clave);
  const [sector, lista] = await Promise.all([
    usuarioId === null ? Promise.resolve(null) : api.miSector().catch(() => null),
    api.centros().then((r) => r.centros).catch(() => null),
  ]);

  if (sector === null && lista === null) {
    return previo ? { ...previo.valor, guardadoEn: previo.guardadoEn, desdeCache: true } : null;
  }

  const centros = lista ? lista.map(aDestino).filter((d): d is Destino => d !== null) : (previo?.valor.centros ?? []);
  const asignado = sector ? destinoAsignado(sector, lista ?? []) : (previo?.valor.asignado ?? null);
  const ahora = Date.now();
  const nuevo: DestinosGuardados = { asignado, centros };
  await guardarCache(clave, nuevo, ahora);
  return { ...nuevo, guardadoEn: ahora, desdeCache: false };
}
