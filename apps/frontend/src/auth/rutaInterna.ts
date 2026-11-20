/**
 * Solo rutas internas de la app: empiezan con una sola «/» y no tienen «\» (react-router 6 trata
 * «/\otro.sitio» como URL externa, GHSA de open redirect). Hoy `desde` sale de `location.pathname` de
 * una ruta protegida, así que no es explotable; se valida igual como defensa en profundidad.
 */
export function rutaInterna(valor: unknown): string | undefined {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return undefined;
  return valor;
}
