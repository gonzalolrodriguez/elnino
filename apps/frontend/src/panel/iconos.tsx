import type { ReactNode } from "react";

import type { PropsIcono } from "../components/iconos/Iconos";

/**
 * Íconos propios del panel operativo, con el mismo trazo que el juego de `components/iconos` (24 px, 1,75 px,
 * extremos redondeados). Los que ya existen allí se reutilizan; aquí solo se agregan los que faltaban.
 */
function crear(trazos: ReactNode, nombre: string) {
  const Icono = ({ tam = "1.25em", ...resto }: PropsIcono) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: "none" }} {...resto}>
      {trazos}
    </svg>
  );
  Icono.displayName = nombre;
  return Icono;
}

export const IconoTablero = crear(
  <>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
  </>,
  "IconoTablero",
);
export const IconoChevron = crear(<path d="m6 9 6 6 6-6" />, "IconoChevron");
export const IconoActualizar = crear(
  <>
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </>,
  "IconoActualizar",
);
export const IconoCerrado = crear(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </>,
  "IconoCerrado",
);
