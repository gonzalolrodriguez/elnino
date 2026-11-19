import { useCallback, useEffect, useRef, useState } from "react";

export type ErrorUbicacion = "inseguro" | "no_soportado" | "denegado" | "no_disponible" | "tiempo";

export type EstadoUbicacion =
  | { fase: "inactivo" }
  | { fase: "buscando" }
  | { fase: "ok"; lon: number; lat: number; precision: number }
  | { fase: "error"; error: ErrorUbicacion };

export const OPCIONES_UBICACION: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 };

/** Tope duro de espera (ms), por encima del `timeout` de la API del navegador. */
const TOPE_ESPERA_MS = 15_000;

/** Redondea a 5 decimales (≈ 1 m). */
export const redondear5 = (n: number) => Number(n.toFixed(5));

/**
 * Pide la ubicación al dispositivo. Nunca la solicita sola: solo cuando se llama a `pedir()` desde un clic.
 * La geolocalización exige un contexto seguro (https o localhost): sin él no se llama al navegador.
 */
export function useUbicacionDispositivo(alObtener?: (lon: number, lat: number, precision: number) => void) {
  const [estado, setEstado] = useState<EstadoUbicacion>({ fase: "inactivo" });
  const solicitud = useRef(0);
  const callback = useRef(alObtener);
  callback.current = alObtener;

  useEffect(
    () => () => {
      solicitud.current += 1; // invalida respuestas pendientes al desmontar
    },
    [],
  );

  const pedir = useCallback(() => {
    const id = ++solicitud.current;
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setEstado({ fase: "error", error: "inseguro" });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setEstado({ fase: "error", error: "no_soportado" });
      return;
    }
    setEstado({ fase: "buscando" });
    // Respaldo: algunos navegadores no llaman nunca al callback (p. ej. si se ignora el aviso de permiso).
    const respaldo = setTimeout(() => {
      if (id === solicitud.current) setEstado((e) => (e.fase === "buscando" ? { fase: "error", error: "tiempo" } : e));
    }, TOPE_ESPERA_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(respaldo);
        if (id !== solicitud.current) return;
        const lon = redondear5(pos.coords.longitude);
        const lat = redondear5(pos.coords.latitude);
        const precision = Math.max(1, Math.round(pos.coords.accuracy));
        setEstado({ fase: "ok", lon, lat, precision });
        callback.current?.(lon, lat, precision);
      },
      (err) => {
        clearTimeout(respaldo);
        if (id !== solicitud.current) return;
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        const error: ErrorUbicacion = err.code === 1 ? "denegado" : err.code === 3 ? "tiempo" : "no_disponible";
        setEstado({ fase: "error", error });
      },
      OPCIONES_UBICACION,
    );
  }, []);

  return { estado, pedir };
}
