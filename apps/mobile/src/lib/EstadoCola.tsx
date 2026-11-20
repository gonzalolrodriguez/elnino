import { createContext, useContext } from "react";

/**
 * Cantidad de pedidos guardados en el teléfono que esperan enviarse. Vive en su propio contexto para
 * que la barra fija de `MarcoApp` (que está por encima de la sesión y de la cola) lo lea sin depender
 * de `ColaProvider`: fuera de las pantallas con sesión simplemente vale 0.
 */
export const PendientesContext = createContext<number>(0);

export function usePendientes(): number {
  return useContext(PendientesContext);
}
