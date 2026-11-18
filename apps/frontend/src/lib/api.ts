export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Salud = {
  estado: string;
  servicio: string;
  version: string;
  base_de_datos: "ok" | "no_disponible";
};

export async function obtenerSalud(): Promise<Salud> {
  const r = await fetch(`${API_URL}/api/v1/salud`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Salud;
}
