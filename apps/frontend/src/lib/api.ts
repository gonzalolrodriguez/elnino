export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const API_BASE = `${API_URL}/api/v1`;

export type Salud = {
  estado: string;
  servicio: string;
  version: string;
  base_de_datos: "ok" | "no_disponible";
};

export type Meta = {
  leyenda: string;
  categorias: string[];
  limites: string[];
  fecha_corte: string;
  flags: { permitir_datos_post_corte: boolean };
};

export type DetalleError = { campo?: string; mensaje: string };

/** Error con el sobre común del backend: { error: { codigo, mensaje, detalle } }. */
export class ApiError extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalle: DetalleError[] = [],
  ) {
    super(mensaje);
    this.name = "ApiError";
  }
}

// El token de acceso vive solo en memoria: nunca en localStorage ni sessionStorage.
let tokenAcceso: string | null = null;
export function fijarToken(token: string | null): void {
  tokenAcceso = token;
}
export function obtenerToken(): string | null {
  return tokenAcceso;
}

function normalizarDetalle(d: unknown): DetalleError[] {
  if (!Array.isArray(d)) return [];
  return d
    .map((x): DetalleError | null => {
      if (x && typeof x === "object" && "mensaje" in x) {
        const o = x as { campo?: unknown; mensaje: unknown };
        return {
          campo: typeof o.campo === "string" ? o.campo : undefined,
          mensaje: String(o.mensaje),
        };
      }
      return typeof x === "string" ? { mensaje: x } : null;
    })
    .filter((x): x is DetalleError => x !== null);
}

type Opciones = { metodo?: string; cuerpo?: unknown; autenticado?: boolean; cabeceras?: Record<string, string> };

// --- Renovación de sesión -------------------------------------------------------------------------
// El refresh rota la cookie: dos pedidos simultáneos con la misma cookie hacen que el backend revoque la
// familia y deje la sesión cerrada. Por eso hay una sola renovación en vuelo por pestaña (promesa de módulo)
// y las pestañas se turnan (Web Locks; respaldo con BroadcastChannel).

export type ResultadoRefresh =
  | { estado: "ok"; datos: unknown }
  | { estado: "rechazada" } // 401/403: la sesión ya no sirve
  | { estado: "transitoria" }; // red, 5xx o 429: se conserva la sesión y se reintenta más tarde

/** Esperas entre reintentos de la renovación (ms). Mutable para poder acelerarlas en pruebas. */
export const reintentosRefresh = { esperasMs: [800, 2500] as number[] };

const NOMBRE_CERROJO = "e3_refresh";
let refrescoEnCurso: Promise<ResultadoRefresh> | null = null;
let canal: BroadcastChannel | null | undefined;
let otraPestanaDesde = 0;

function obtenerCanal(): BroadcastChannel | null {
  if (canal !== undefined) return canal;
  try {
    canal = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(NOMBRE_CERROJO);
    canal?.addEventListener("message", (e: MessageEvent) => {
      otraPestanaDesde = e.data === "inicio" ? Date.now() : 0;
    });
  } catch {
    canal = null;
  }
  return canal;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function intentarRefresh(): Promise<ResultadoRefresh> {
  const esperas = reintentosRefresh.esperasMs;
  for (let i = 0; i <= esperas.length; i++) {
    try {
      const datos = await solicitarCrudo<unknown>("/auth/refresh", { metodo: "POST", cuerpo: {} });
      return { estado: "ok", datos };
    } catch (e) {
      if (e instanceof ApiError && (e.estado === 401 || e.estado === 403)) return { estado: "rechazada" };
      if (i < esperas.length) await dormir(esperas[i]);
    }
  }
  return { estado: "transitoria" };
}

async function conTurno(fn: () => Promise<ResultadoRefresh>): Promise<ResultadoRefresh> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return (await locks.request(NOMBRE_CERROJO, fn)) as ResultadoRefresh;
  // Respaldo: si otra pestaña avisó que está renovando, se espera su aviso de fin (hasta 5 s).
  const c = obtenerCanal();
  if (c && Date.now() - otraPestanaDesde < 5000) {
    const limite = Date.now() + 5000;
    while (otraPestanaDesde !== 0 && Date.now() < limite) await dormir(100);
  }
  c?.postMessage("inicio");
  try {
    return await fn();
  } finally {
    c?.postMessage("fin");
  }
}

/** Renueva el token de acceso con la cookie de refresh. Una sola llamada en vuelo, aunque la pidan varios. */
export function refrescarSesion(): Promise<ResultadoRefresh> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = conTurno(intentarRefresh).finally(() => {
      refrescoEnCurso = null;
    });
  }
  return refrescoEnCurso;
}

type ManejadorSesion = { renovar: () => Promise<boolean>; cerrar: () => void };
let manejadorSesion: ManejadorSesion | null = null;
/** El AuthProvider registra cómo renovar y cerrar la sesión para que `solicitar` pueda reintentar tras un 401. */
export function registrarManejadorSesion(m: ManejadorSesion | null): void {
  manejadorSesion = m;
}

async function solicitarCrudo<T>(ruta: string, op: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(op.cabeceras ?? {}) };
  if (op.cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (op.autenticado && tokenAcceso) headers.Authorization = `Bearer ${tokenAcceso}`;
  let r: Response;
  try {
    r = await fetch(`${API_BASE}${ruta}`, {
      method: op.metodo ?? (op.cuerpo !== undefined ? "POST" : "GET"),
      headers,
      credentials: "include",
      body: op.cuerpo !== undefined ? JSON.stringify(op.cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, "sin_conexion", "No hay conexión con el servicio. Revisá tu red e intentá de nuevo.");
  }
  let datos: unknown = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) {
    const e = (datos as { error?: { codigo?: string; mensaje?: string; detalle?: unknown } } | null)?.error;
    throw new ApiError(
      r.status,
      e?.codigo ?? "error",
      e?.mensaje ?? `Error ${r.status}`,
      normalizarDetalle(e?.detalle),
    );
  }
  return datos as T;
}

/**
 * Llama a la API y convierte las respuestas de error en `ApiError`.
 * Ante un 401 con sesión iniciada renueva el token una vez y repite el pedido; si igual falla, cierra la sesión local.
 */
export async function solicitar<T>(ruta: string, op: Opciones = {}): Promise<T> {
  try {
    return await solicitarCrudo<T>(ruta, op);
  } catch (e) {
    const reintentable =
      e instanceof ApiError && e.estado === 401 && op.autenticado && tokenAcceso && manejadorSesion && !ruta.startsWith("/auth/");
    if (!reintentable) throw e;
    const m = manejadorSesion as ManejadorSesion;
    if (!(await m.renovar())) throw e;
    try {
      return await solicitarCrudo<T>(ruta, op);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.estado === 401) m.cerrar();
      throw e2;
    }
  }
}

export async function obtenerSalud(): Promise<Salud> {
  const r = await fetch(`${API_BASE}/salud`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Salud;
}

export async function obtenerMeta(): Promise<Meta> {
  const m = await solicitar<Partial<Meta>>("/meta");
  if (!m || !Array.isArray(m.limites)) throw new ApiError(0, "respuesta_invalida", "Respuesta inesperada de /meta");
  return m as Meta;
}
