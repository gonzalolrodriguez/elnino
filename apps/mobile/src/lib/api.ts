import type { Rol } from "@evacuaciones/shared";

import { almacenSeguro } from "@/lib/almacenSeguro";
import { cargarServidor, obtenerUrlServidor } from "@/lib/servidor";

export type Salud = {
  estado: string;
  servicio: string;
  version: string;
  base_de_datos: "ok" | "no_disponible";
};

export type Usuario = {
  id: number;
  email: string;
  nombre_visible: string;
  rol: Rol;
  rol_operativo: string | null;
  estado: string;
};

type Sesion = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  usuario: Usuario;
};

/** Error de la API (sobre común `{error: {codigo, mensaje, detalle}}`) o de red (`estado` = 0). */
export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
  get esRed(): boolean {
    return this.estado === 0;
  }
}

const CLAVE_REFRESH = "refresh_token";
const CLAVE_USUARIO = "usuario";

let accessToken: string | null = null;
let refrescando: Promise<boolean> | null = null;
const oyentes = new Set<(token: string | null) => void>();
let alCerrarSesion: (() => void) | null = null;

/** El proveedor de sesión se registra para enterarse de una sesión expirada de forma irrecuperable. */
export function registrarAlCerrarSesion(fn: (() => void) | null): void {
  alCerrarSesion = fn;
}

export function obtenerAccessToken(): string | null {
  return accessToken;
}

/** Notifica a quien escuche (p. ej. el WebSocket) cuando el access token cambia. */
export function escucharToken(fn: (token: string | null) => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function fijarAccess(token: string | null): void {
  accessToken = token;
  oyentes.forEach((fn) => fn(token));
}

async function leerError(r: Response): Promise<ErrorApi> {
  type Sobre = { error?: { codigo?: string; mensaje?: string; detalle?: unknown } };
  let e: Sobre["error"];
  try {
    e = ((await r.json()) as Sobre | null)?.error;
  } catch {
    e = undefined;
  }
  return new ErrorApi(r.status, e?.codigo ?? "error_http", e?.mensaje ?? `Error HTTP ${r.status}`, e?.detalle);
}

async function ejecutar(
  ruta: string,
  metodo: string,
  cuerpo: unknown,
  conAuth: boolean,
  extra: Record<string, string> = {},
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", "X-Cliente": "movil", ...extra };
  // Con FormData no se fija Content-Type: fetch agrega el `boundary` del multipart.
  const esForm = typeof FormData !== "undefined" && cuerpo instanceof FormData;
  if (cuerpo !== undefined && !esForm) headers["Content-Type"] = "application/json";
  if (conAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // La URL del servidor se lee en cada llamada: puede cambiarse desde la app sin reiniciarla.
  await cargarServidor();
  const base = obtenerUrlServidor();
  if (!base) {
    throw new ErrorApi(0, "sin_servidor", "Falta configurar el servidor. Indicalo en «Servidor» (pantalla de inicio o Perfil).");
  }
  try {
    return await fetch(`${base}/api/v1${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : esForm ? (cuerpo as FormData) : JSON.stringify(cuerpo),
    });
  } catch (e) {
    throw new ErrorApi(0, "sin_conexion", "Sin conexión con el servidor", e instanceof Error ? e.message : e);
  }
}

async function guardarSesion(s: Sesion): Promise<Usuario> {
  fijarAccess(s.access_token);
  if (s.refresh_token) await almacenSeguro.guardar(CLAVE_REFRESH, s.refresh_token);
  await almacenSeguro.guardar(CLAVE_USUARIO, JSON.stringify(s.usuario));
  return s.usuario;
}

/** Renueva el access token con rotación del refresh token. Una sola renovación en vuelo a la vez. */
export function renovarSesion(): Promise<boolean> {
  if (refrescando) return refrescando;
  refrescando = (async () => {
    const refresh = await almacenSeguro.leer(CLAVE_REFRESH);
    if (!refresh) return false;
    const r = await ejecutar("/auth/refresh", "POST", { refresh_token: refresh }, false);
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        await limpiarSesionLocal();
        alCerrarSesion?.();
        return false;
      }
      throw await leerError(r);
    }
    await guardarSesion((await r.json()) as Sesion);
    return true;
  })().finally(() => {
    refrescando = null;
  });
  return refrescando;
}

export async function limpiarSesionLocal(): Promise<void> {
  fijarAccess(null);
  await almacenSeguro.borrar(CLAVE_REFRESH);
  await almacenSeguro.borrar(CLAVE_USUARIO);
}

export async function usuarioGuardado(): Promise<Usuario | null> {
  const bruto = await almacenSeguro.leer(CLAVE_USUARIO);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Usuario;
  } catch {
    return null;
  }
}

export async function hayRefreshGuardado(): Promise<boolean> {
  return (await almacenSeguro.leer(CLAVE_REFRESH)) !== null;
}

/** Petición autenticada con un reintento tras renovar el token si responde 401. */
export async function peticion<T>(
  ruta: string,
  opciones: {
    metodo?: string;
    /** JSON, o `FormData` para multipart. */
    cuerpo?: unknown;
    auth?: boolean;
    cabeceras?: Record<string, string>;
  } = {},
): Promise<T> {
  const { metodo = "GET", cuerpo, auth = true, cabeceras } = opciones;
  let r = await ejecutar(ruta, metodo, cuerpo, auth, cabeceras);
  if (r.status === 401 && auth && (await renovarSesion())) {
    r = await ejecutar(ruta, metodo, cuerpo, auth, cabeceras);
  }
  if (!r.ok) throw await leerError(r);
  return (await r.json()) as T;
}

export async function iniciarSesion(email: string, password: string): Promise<Usuario> {
  const r = await ejecutar("/auth/login", "POST", { email, password }, false);
  if (!r.ok) throw await leerError(r);
  return guardarSesion((await r.json()) as Sesion);
}

export async function cerrarSesion(): Promise<void> {
  const refresh = await almacenSeguro.leer(CLAVE_REFRESH);
  try {
    if (refresh) await ejecutar("/auth/logout", "POST", { refresh_token: refresh }, false);
  } catch {
    // Sin red: igualmente se borra todo lo local; el refresh expira o se revoca en el próximo uso.
  } finally {
    await limpiarSesionLocal();
  }
}

export async function obtenerSalud(): Promise<Salud> {
  return peticion<Salud>("/salud", { auth: false });
}
