import { useEffect, useState } from "react";

/** WebGL disponible (falso en jsdom y en equipos sin aceleración). */
export function hayWebGL(): boolean {
  try {
    if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
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
