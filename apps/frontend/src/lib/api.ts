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

type Opciones = { metodo?: string; cuerpo?: unknown; autenticado?: boolean };

/** Llama a la API y convierte las respuestas de error en `ApiError`. */
export async function solicitar<T>(ruta: string, op: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
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
