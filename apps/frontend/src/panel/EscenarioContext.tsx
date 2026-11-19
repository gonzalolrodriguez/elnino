import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { api } from "./api";
import type { EntradaEscenario, Escenario, OrigenLluvia } from "./tipos";

type Contexto = {
  entrada: EntradaEscenario;
  fijarAltura: (m: number) => void;
  fijarLluvia: (mm: number, origen?: OrigenLluvia) => void;
  alternarCamino: (id: number) => void;
  escenario: Escenario | null;
  /** Entrada con la que se calculó `escenario` (null si todavía no se calculó). */
  entradaCalculada: EntradaEscenario | null;
  /** true si hay un resultado pero los controles ya no coinciden con lo que se calculó. */
  desactualizado: boolean;
  calculando: boolean;
  error: unknown;
  simular: () => Promise<Escenario | null>;
  /** Altura observada (DATO OBSERVADO) con la que se compara el escenario activo. */
  alturaObservada: number;
  fijarAlturaObservada: (m: number) => void;
  /** true si la altura elegida difiere de la observada: lo que se ve en el panel es una simulación. */
  escenarioSimulado: boolean;
  /** Vuelve a la altura observada y deja la lluvia simulada en cero. */
  volverAObservado: () => void;
};

function mismaEntrada(a: EntradaEscenario, b: EntradaEscenario): boolean {
  return (
    a.altura_formosa_m === b.altura_formosa_m &&
    a.lluvia_mm === b.lluvia_mm &&
    a.lluvia_origen === b.lluvia_origen &&
    a.caminos_cerrados.length === b.caminos_cerrados.length &&
    [...a.caminos_cerrados].sort().join(",") === [...b.caminos_cerrados].sort().join(",")
  );
}

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
  const [entradaCalculada, setEntradaCalculada] = useState<EntradaEscenario | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [alturaObservada, setAlturaObservada] = useState(ALTURA_CORTE_M);

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
      setEntradaCalculada(entrada);
      return r;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setCalculando(false);
    }
  }, [entrada]);

  const fijarAlturaObservada = useCallback((m: number) => setAlturaObservada(m), []);
  const volverAObservado = useCallback(() => setEntrada((e) => ({ ...e, altura_formosa_m: alturaObservada, lluvia_mm: 0 })), [alturaObservada]);
  const escenarioSimulado = Math.abs(entrada.altura_formosa_m - alturaObservada) >= 0.005;

  const desactualizado = escenario !== null && entradaCalculada !== null && !mismaEntrada(entrada, entradaCalculada);
  const valor = useMemo(
    () => ({ entrada, fijarAltura, fijarLluvia, alternarCamino, escenario, entradaCalculada, desactualizado, calculando, error, simular, alturaObservada, fijarAlturaObservada, escenarioSimulado, volverAObservado }),
    [entrada, fijarAltura, fijarLluvia, alternarCamino, escenario, entradaCalculada, desactualizado, calculando, error, simular, alturaObservada, fijarAlturaObservada, escenarioSimulado, volverAObservado],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEscenario(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEscenario requiere <EscenarioProvider>");
  return c;
}
