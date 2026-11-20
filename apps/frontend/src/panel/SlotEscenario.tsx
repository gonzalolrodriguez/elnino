import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Lugar de la barra del escenario en el panel. La barra pertenece al panel (la monta `PanelLayout`), pero en el orden
 * de lectura tiene que venir **después** del título de la página (DESIGN.md, Cabecera de página). Cada página declara
 * ese lugar con `CabeceraPagina`, que registra un nodo vacío debajo del h1; `PanelLayout` dibuja la barra ahí con un
 * portal. Una página sin cabecera no registra nada y la barra queda arriba, como antes.
 */
type Valor = { slot: HTMLElement | null; registrar: (el: HTMLElement | null) => void };

const Contexto = createContext<Valor | null>(null);

export function SlotEscenarioProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Solo se registra un nodo; al desmontar la página el ref llega con null y la barra vuelve a su lugar de reserva.
  const registrar = useCallback((el: HTMLElement | null) => setSlot(el), []);
  const valor = useMemo(() => ({ slot, registrar }), [slot, registrar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Ref para el nodo que recibe la barra; `undefined` fuera del panel (no hay barra que alojar). */
export function useRegistrarSlotEscenario(): ((el: HTMLElement | null) => void) | undefined {
  return useContext(Contexto)?.registrar;
}

/** Dibuja `children` en el lugar que dejó la cabecera de la página; si no hay ninguno, en su sitio. */
export function EnSlotEscenario({ children }: { children: ReactNode }) {
  const slot = useContext(Contexto)?.slot ?? null;
  return slot ? createPortal(children, slot) : <>{children}</>;
}
