import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { api } from "./api";
import type { EntradaEscenario, Escenario, OrigenLluvia } from "./tipos";

type Contexto = {
  entrada: EntradaEscenario;
  fijarAltura: (m: number) => void;
  fijarLluvia: (mm: number, origen?: OrigenLluvia) => void;
  alternarCamino: (id: number) => void;
  escenario: Escenario | null;
  calculando: boolean;
  error: unknown;
  simular: () => Promise<Escenario | null>;
};

const Ctx = createContext<Contexto | null>(null);

/** Altura inicial: el dato del corte (31/10/2026, DATO OBSERVADO). */
export const ALTURA_CORTE_M = 5.6;

/** Parámetros del escenario compartidos por mapa, simulador, recomendador y órdenes. */
export function EscenarioProvider({ children }: { children: ReactNode }) {
  const [entrada, setEntrada] = useState<EntradaEscenario>({
    altura_formosa_m: ALTURA_CORTE_M,
    lluvia_mm: 0,
    lluvia_origen: "simulado",
    caminos_cerrados: [],
  });
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fijarAltura = useCallback((m: number) => setEntrada((e) => ({ ...e, altura_formosa_m: m })), []);
  const fijarLluvia = useCallback((mm: number, origen?: OrigenLluvia) => setEntrada((e) => ({ ...e, lluvia_mm: mm, lluvia_origen: origen ?? e.lluvia_origen })), []);
  const alternarCamino = useCallback(
    (id: number) =>
      setEntrada((e) => ({
        ...e,
        caminos_cerrados: e.caminos_cerrados.includes(id) ? e.caminos_cerrados.filter((x) => x !== id) : [...e.caminos_cerrados, id],
      })),
    [],
  );

  const simular = useCallback(async () => {
    setCalculando(true);
    setError(null);
    try {
      const r = await api.escenario(entrada);
      setEscenario(r);
      return r;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setCalculando(false);
    }
  }, [entrada]);

  const valor = useMemo(
    () => ({ entrada, fijarAltura, fijarLluvia, alternarCamino, escenario, calculando, error, simular }),
    [entrada, fijarAltura, fijarLluvia, alternarCamino, escenario, calculando, error, simular],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEscenario(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEscenario requiere <EscenarioProvider>");
  return c;
}
