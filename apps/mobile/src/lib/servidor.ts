import { almacenSeguro } from "@/lib/almacenSeguro";

/**
 * Servidor (URL base del backend) configurable en tiempo de ejecución, para que un mismo APK
 * funcione en cualquier red. La URL no es un secreto; se guarda con el almacén que la app ya usa.
 * Todos los consumidores (HTTP, cola offline, fotos, WebSocket) leen el valor VIGENTE al momento de
 * la llamada con `obtenerUrlServidor()`; no existe una constante de módulo con la URL.
 */

const CLAVE_SERVIDOR = "servidor_url";
export const TIEMPO_PRUEBA_MS = 5000;

export type ResultadoUrl = { ok: true; url: string } | { ok: false; mensaje: string };

/**
 * Valida y normaliza lo que escribe el usuario: exige http(s), quita la barra final y un `/api/v1`
 * escrito por error (la app ya lo agrega).
 */
export function normalizarUrlServidor(texto: string): ResultadoUrl {
  const bruto = texto.trim();
  if (!bruto) return { ok: false, mensaje: "Ingresá la dirección del servidor." };
  const m = /^(https?):\/\/([^\s/?#]+)(\/[^\s?#]*)?$/i.exec(bruto);
  if (!m) {
    return {
      ok: false,
      mensaje: "La dirección debe comenzar con http:// o https://, sin espacios ni parámetros. Ej.: http://192.168.1.50:8000",
    };
  }
  const ruta = (m[3] ?? "")
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/i, "")
    .replace(/\/+$/, "");
  return { ok: true, url: `${m[1]!.toLowerCase()}://${m[2]}${ruta}` };
}

/** Valor de compilación (`EXPO_PUBLIC_API_URL`), normalizado; vacío si no está definido o es inválido. */
export function urlPorDefecto(): string {
  const r = normalizarUrlServidor(process.env.EXPO_PUBLIC_API_URL ?? "");
  return r.ok ? r.url : "";
}

let guardada: string | null = null;
let cargada: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function avisar(): void {
  oyentes.forEach((fn) => fn());
}

/** Lee el valor guardado en el dispositivo una sola vez. */
export function cargarServidor(): Promise<void> {
  if (!cargada) {
    cargada = (async () => {
      try {
        const v = await almacenSeguro.leer(CLAVE_SERVIDOR);
        const r = v ? normalizarUrlServidor(v) : null;
        // Si el usuario ya guardó algo mientras se leía, ese valor manda.
        if (guardada === null) guardada = r?.ok ? r.url : null;
      } catch {
        // Sin almacén legible: rige el valor por defecto.
      }
      avisar();
    })();
  }
  return cargada;
}

/** URL vigente: la guardada por el usuario o, si no hay, la de compilación. Puede ser "". */
export function obtenerUrlServidor(): string {
  return guardada ?? urlPorDefecto();
}

/** `true` si el usuario eligió un servidor distinto del valor por defecto. */
export function hayServidorPersonalizado(): boolean {
  return guardada !== null;
}

export function urlBaseApi(): string {
  return `${obtenerUrlServidor()}/api/v1`;
}

export async function guardarServidor(url: string): Promise<void> {
  const r = normalizarUrlServidor(url);
  if (!r.ok) throw new Error(r.mensaje);
  cargada = cargada ?? Promise.resolve();
  guardada = r.url;
  await almacenSeguro.guardar(CLAVE_SERVIDOR, r.url);
  avisar();
}

export async function restablecerServidor(): Promise<void> {
  cargada = cargada ?? Promise.resolve();
  guardada = null;
  await almacenSeguro.borrar(CLAVE_SERVIDOR);
  avisar();
}

export function escucharServidor(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Solo para pruebas: olvida el estado en memoria. */
export function reiniciarServidorParaPruebas(): void {
  guardada = null;
  cargada = null;
  oyentes.clear();
}

export type ResultadoPrueba =
  | { ok: true; baseDeDatos: "ok" | "no_disponible" }
  | { ok: false; mensaje: string };

/** Llama a `GET /api/v1/salud` del servidor indicado (con su propio tiempo máximo). */
export async function probarConexion(
  url: string,
  tiempoMs: number = TIEMPO_PRUEBA_MS,
): Promise<ResultadoPrueba> {
  const r = normalizarUrlServidor(url);
  if (!r.ok) return { ok: false, mensaje: r.mensaje };
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), tiempoMs);
  try {
    const resp = await fetch(`${r.url}/api/v1/salud`, {
      headers: { Accept: "application/json", "X-Cliente": "movil" },
      signal: control.signal,
    });
    if (!resp.ok) {
      return { ok: false, mensaje: `El servidor respondió con error HTTP ${resp.status}. Revisá la dirección.` };
    }
    let datos: { base_de_datos?: string } | null = null;
    try {
      datos = (await resp.json()) as { base_de_datos?: string } | null;
    } catch {
      datos = null;
    }
    if (!datos || typeof datos.base_de_datos !== "string") {
      return { ok: false, mensaje: "La respuesta no corresponde al backend de Evacuaciones. Revisá la dirección y el puerto." };
    }
    return { ok: true, baseDeDatos: datos.base_de_datos === "ok" ? "ok" : "no_disponible" };
  } catch (e) {
    if (control.signal.aborted) {
      return { ok: false, mensaje: `Sin respuesta en ${Math.round(tiempoMs / 1000)} s. Verificá la IP, el Wi-Fi y que el backend esté encendido (y el puerto 8000 permitido en el firewall).` };
    }
    return {
      ok: false,
      mensaje: `No se pudo conectar (${e instanceof Error ? e.message : "error de red"}). Verificá que el teléfono esté en la misma red que el backend.`,
    };
  } finally {
    clearTimeout(temporizador);
  }
}
