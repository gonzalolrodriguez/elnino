import * as SQLite from "expo-sqlite";

/**
 * Caché local de respuestas JSON (p. ej. «Estado de tu sector») para mostrarlas sin conexión con su
 * fecha de actualización. Usa la misma base SQLite que la cola offline; no guarda credenciales (para
 * eso está expo-secure-store). La clave incluye el usuario y el servidor para no mezclar cuentas.
 */

export type Entrada<T> = { valor: T; guardadoEn: number };

let abierta: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  abierta ??= (async () => {
    const d = await SQLite.openDatabaseAsync("evacuaciones.db");
    await d.execAsync(
      "CREATE TABLE IF NOT EXISTS cache_json (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, guardado_en INTEGER NOT NULL)",
    );
    return d;
  })();
  return abierta;
}

export async function guardarCache<T>(clave: string, valor: T, ahora = Date.now()): Promise<void> {
  try {
    const d = await db();
    await d.runAsync(
      "INSERT OR REPLACE INTO cache_json (clave, valor, guardado_en) VALUES (?, ?, ?)",
      clave,
      JSON.stringify(valor),
      ahora,
    );
  } catch {
    // Sin caché la pantalla sigue funcionando con la red.
  }
}

export async function leerCache<T>(clave: string): Promise<Entrada<T> | null> {
  try {
    const d = await db();
    const f = await d.getFirstAsync<{ valor: string; guardado_en: number }>(
      "SELECT valor, guardado_en FROM cache_json WHERE clave = ?",
      clave,
    );
    return f ? { valor: JSON.parse(f.valor) as T, guardadoEn: f.guardado_en } : null;
  } catch {
    return null;
  }
}

/**
 * Única entrada sin datos de una persona: la lista pública de centros que usa la brújula sin sesión
 * (`claveBrujula(null)`). Todas las demás claves llevan el id de la cuenta.
 */
export const PREFIJO_CACHE_PUBLICA = "brujula:anonimo:";

/**
 * Borra lo personal de la caché (pedidos, ayuda rápida, sector, confirmaciones, destinos con el centro
 * asignado, panel) y conserva solo la lista pública de centros. Se llama cuando la sesión termina por
 * cualquier motivo, también cuando el servidor rechaza el refresh (401/403), no solo al cerrar sesión.
 */
export async function borrarCachePersonal(): Promise<void> {
  try {
    const d = await db();
    await d.runAsync("DELETE FROM cache_json WHERE substr(clave, 1, ?) <> ?", PREFIJO_CACHE_PUBLICA.length, PREFIJO_CACHE_PUBLICA);
  } catch {
    // nada que borrar
  }
}

/** Borra la caché (al cerrar sesión: contiene datos del sector de la persona). */
export async function borrarCache(): Promise<void> {
  try {
    const d = await db();
    await d.runAsync("DELETE FROM cache_json");
  } catch {
    // nada que borrar
  }
}
