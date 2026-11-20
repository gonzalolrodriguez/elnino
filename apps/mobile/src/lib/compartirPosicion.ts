import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { ErrorApi } from "@/lib/api";
import { obtenerUbicacion } from "@/lib/dispositivo";
import { api } from "@/lib/servicios";
import { INTERVALO_ENVIO_MS, UltimaPosicion } from "@/lib/seguimiento";

/** Una posición guardada que no se pudo enviar se reenvía solo si tiene menos de 90 s; después se descarta. */
export const EDAD_MAXIMA_REENVIO_MS = 90_000;

export type EstadoEnvio =
  | { fase: "pausado" }
  | { fase: "compartiendo"; ultimaEnviada: number | null; pendiente: boolean }
  | { fase: "sin_permiso" }
  | { fase: "sin_tarea" };

/**
 * Un ciclo de envío: toma la posición (si puede), la guarda como «la última» y la manda. Si falla la
 * red conserva solo esa última para el ciclo siguiente. Separado del hook para probarlo sin React.
 * Devuelve el resultado del ciclo.
 */
export async function cicloEnvio(
  buffer: UltimaPosicion,
  obtener: typeof obtenerUbicacion,
  enviar: typeof api.compartirPosicion,
  ahora: number = Date.now(),
): Promise<"enviada" | "pendiente" | "sin_permiso" | "sin_tarea"> {
  const u = await obtener();
  if (u.ok) buffer.guardar(u.coordenadas, u.precisionM, ahora);
  else if (u.motivo === "permiso") return "sin_permiso";
  const p = buffer.pendiente();
  if (!p) return "pendiente"; // sin GPS y sin nada guardado
  if (ahora - p.tomadaEn > EDAD_MAXIMA_REENVIO_MS) {
    // El servidor la tomaría por reciente: mejor no enviar una posición vieja como si fuera de ahora.
    buffer.limpiar();
    return "pendiente";
  }
  try {
    await enviar({
      lat: Number(p.coordenadas.lat.toFixed(5)),
      lon: Number(p.coordenadas.lon.toFixed(5)),
      ...(p.precisionM !== null ? { precision_m: Math.max(0, Math.round(p.precisionM)) } : {}),
    });
    buffer.enviada(p.tomadaEn);
    return "enviada";
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 429) {
      buffer.enviada(p.tomadaEn); // demasiado pronto: el servidor ya tiene una posición reciente
      return "enviada";
    }
    if (e instanceof ErrorApi && e.estado === 409) {
      buffer.limpiar();
      return "sin_tarea"; // ya no hay tarea en curso: no se comparte más
    }
    return "pendiente"; // sin red o error del servidor: se reenvía la última en el próximo ciclo
  }
}

/**
 * Comparte la posición de la cuadrilla cada ~30 s mientras `activo` y la app esté en primer plano (sin
 * permiso de segundo plano). Si falla la red no acumula: guarda solo la última y la reenvía.
 */
export function useCompartirPosicion(activo: boolean) {
  const [estado, setEstado] = useState<EstadoEnvio>({ fase: "pausado" });
  const buffer = useRef(new UltimaPosicion());
  const enCurso = useRef(false);

  const ciclo = useCallback(async () => {
    if (enCurso.current || AppState.currentState !== "active") return;
    enCurso.current = true;
    try {
      const r = await cicloEnvio(buffer.current, obtenerUbicacion, api.compartirPosicion);
      if (r === "sin_permiso") setEstado({ fase: "sin_permiso" });
      else if (r === "sin_tarea") setEstado({ fase: "sin_tarea" });
      else setEstado((e) => ({ fase: "compartiendo", ultimaEnviada: r === "enviada" ? Date.now() : e.fase === "compartiendo" ? e.ultimaEnviada : null, pendiente: r === "pendiente" }));
    } finally {
      enCurso.current = false;
    }
  }, []);

  useEffect(() => {
    if (!activo) {
      setEstado({ fase: "pausado" });
      buffer.current.limpiar(); // al pausar no queda ninguna posición guardada
      return;
    }
    setEstado({ fase: "compartiendo", ultimaEnviada: null, pendiente: false });
    void ciclo();
    const t = setInterval(() => void ciclo(), INTERVALO_ENVIO_MS);
    return () => clearInterval(t);
  }, [activo, ciclo]);

  return estado;
}
