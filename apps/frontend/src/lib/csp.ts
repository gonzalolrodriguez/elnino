/**
 * Content-Security-Policy del portal (se inserta como `<meta>` en el `index.html` del build; ver
 * `vite.config.ts`). Permite exactamente lo que usa la app:
 *
 * - scripts propios y los cuatro scripts en línea de `@vitejs/plugin-legacy` (por hash);
 * - estilos en línea (Chakra/Emotion los inyecta en tiempo de ejecución);
 * - el backend (`VITE_API_URL`, HTTP y WebSocket) y las teselas de OpenStreetMap;
 * - workers `blob:` de MapLibre; imágenes `data:`/`blob:` (MapLibre, Three.js) y fuentes propias.
 *
 * En `vite dev` no se aplica: el servidor de desarrollo inyecta scripts en línea para la recarga en
 * caliente. `frame-ancestors` no se puede fijar desde un `<meta>` (lo debe enviar el servidor web).
 */
export const ORIGEN_TESELAS_OSM = "https://tile.openstreetmap.org";

/** Origen HTTP y su equivalente WebSocket (`http` → `ws`, `https` → `wss`) de la URL del backend. */
export function origenesApi(apiUrl: string): string[] {
  const u = new URL(apiUrl);
  const ws = u.protocol === "https:" ? "wss:" : "ws:";
  return [u.origin, `${ws}//${u.host}`];
}

export function politicaCsp(apiUrl: string, hashesScripts: readonly string[]): string {
  const api = origenesApi(apiUrl);
  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...hashesScripts.map((h) => `'sha256-${h}'`)],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ORIGEN_TESELAS_OSM],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...api, ORIGEN_TESELAS_OSM, "data:", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "child-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directivas)
    .map(([d, v]) => `${d} ${[...new Set(v)].join(" ")}`)
    .join("; ");
}
