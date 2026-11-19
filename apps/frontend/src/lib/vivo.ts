import { useCallback, useEffect, useRef, useState } from "react";

export type CargaViva<T> = {
  /** Última respuesta buena: se conserva si una actualización posterior falla. */
  datos: T | null;
  /** Error de la última carga (null si salió bien). */
  error: unknown;
  /** true solo mientras no hay ningún dato todavía. */
  cargando: boolean;
  /** Marca de tiempo (ms) de la última respuesta buena. */
  actualizadoEn: number | null;
  recargar: () => void;
};

/**
 * Carga que se refresca sola: cada `cadaMs` (si la pestaña está visible) y cada vez que cambia `senal`
 * (por ejemplo, un evento de tiempo real) o `clave` (por ejemplo, los filtros elegidos). Si una actualización falla, los datos anteriores se conservan
 * junto con el error, para no dejar la pantalla vacía por un corte breve.
 */
export function useCargaViva<T>(cargar: () => Promise<T>, { cadaMs = 60_000, senal = 0, clave = "" }: { cadaMs?: number; senal?: number; clave?: string } = {}): CargaViva<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizadoEn, setActualizadoEn] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const funcion = useRef(cargar);
  funcion.current = cargar;

  useEffect(() => {
    let activo = true;
    funcion
      .current()
      .then((d) => {
        if (!activo) return;
        setDatos(d);
        setError(null);
        setActualizadoEn(Date.now());
      })
      .catch((e: unknown) => activo && setError(e))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [version, senal, clave]);

  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) setVersion((v) => v + 1);
    }, cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, error, cargando: cargando && datos === null, actualizadoEn, recargar };
}

/** Hora actual en ms, renovada cada `cadaMs`: sirve para rótulos "hace X" que se mantienen al día. */
export function useAhora(cadaMs = 15_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

/** "hace 12 s", "hace 3 min", "hace 2 h", "hace 4 d" a partir de una diferencia en milisegundos. */
export function hace(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "hace instantes";
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Minutos a texto corto: 45 -> "45 min", 135 -> "2 h 15 min", 3000 -> "2 d 2 h". */
export function duracionCorta(min: number): string {
  if (min < 60) return `${Math.max(0, Math.round(min))} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h${Math.round(min % 60) ? ` ${Math.round(min % 60)} min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d} d${h % 24 ? ` ${h % 24} h` : ""}`;
}
