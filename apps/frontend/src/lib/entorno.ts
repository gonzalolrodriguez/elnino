import { useEffect, useState } from "react";

/** WebGL 2 disponible (three.js y MapLibre lo exigen; falso en jsdom, en equipos sin aceleración y en móviles viejos). */
export function hayWebGL(): boolean {
  try {
    if (typeof window === "undefined" || typeof WebGL2RenderingContext === "undefined") return false;
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

type NavegadorConMemoria = Pick<Navigator, "hardwareConcurrency"> & { deviceMemory?: number };

/**
 * Equipo de pocos recursos: 2 núcleos o menos, o 2 GB de memoria o menos.
 * `deviceMemory` no existe en Safari ni Firefox; si un dato falta, no se infiere nada de él.
 */
export function esDispositivoLimitado(nav: NavegadorConMemoria | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  const nucleos = nav.hardwareConcurrency;
  const memoria = nav.deviceMemory;
  return (typeof nucleos === "number" && nucleos > 0 && nucleos <= 2) || (typeof memoria === "number" && memoria > 0 && memoria <= 2);
}

/** Preferencia del sistema por menos movimiento. */
export function useMenosMovimiento(): boolean {
  const consulta = "(prefers-reduced-motion: reduce)";
  const [valor, setValor] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(consulta).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(consulta);
    const f = () => setValor(m.matches);
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, []);
  return valor;
}

/** Formato numérico argentino: 5,60. */
export function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace(".", ",");
}

/** Miles con punto: 1.200. */
export function fmtMiles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** El 3D de la landing exige WebGL 2 y un equipo con recursos; si no, se usa el respaldo 2D. */
export function puedeUsar3D(): boolean {
  return hayWebGL() && !esDispositivoLimitado();
}
