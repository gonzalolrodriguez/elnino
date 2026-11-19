import { createContext, useContext } from "react";

/** Contador que sube cuando llega un evento de tiempo real relevante: los tableros lo usan para refrescarse. */
export const TiempoRealContext = createContext<number>(0);
export const useSenalTiempoReal = () => useContext(TiempoRealContext);
