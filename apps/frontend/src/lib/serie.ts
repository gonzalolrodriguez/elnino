import { useEffect, useState } from "react";

import { SERIE_K1, indiceDeFecha, type SerieDiaria } from "../datos/kit";
import { solicitar } from "./api";

/** Respuesta de `GET /serie/formosa` (solo los campos que usa la web). */
export type RespuestaSerie = {
  puntos?: { fecha?: unknown; altura_max_m?: unknown }[];
};

/**
 * Convierte los puntos de la API (solo días con dato) en la serie diaria densa de la web.
 * Los días sin dato quedan en `null` (no se interpola). Devuelve null si la respuesta no es usable.
 */
export function serieDesdeApi(r: RespuestaSerie | null | undefined): SerieDiaria | null {
  const puntos = r?.puntos;
  if (!Array.isArray(puntos) || puntos.length === 0) return null;
  const validos = puntos.filter(
    (p): p is { fecha: string; altura_max_m: number } =>
      typeof p.fecha === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) &&
      typeof p.altura_max_m === "number" &&
      Number.isFinite(p.altura_max_m),
  );
  if (validos.length === 0) return null;
  const fechas = validos.map((p) => p.fecha).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];
  const valores: (number | null)[] = new Array(indiceDeFecha(desde, hasta) + 1).fill(null);
  for (const p of validos) valores[indiceDeFecha(desde, p.fecha)] = p.altura_max_m;
  return { desde, hasta, valores };
}

/** Serie de Puerto Formosa: intenta la API y, si no responde, usa el JSON estático del kit. */
export function useSerieFormosa(): { serie: SerieDiaria; origen: "api" | "estatico" } {
  const [estado, setEstado] = useState<{ serie: SerieDiaria; origen: "api" | "estatico" }>({
    serie: SERIE_K1,
    origen: "estatico",
  });
  useEffect(() => {
    let activo = true;
    solicitar<RespuestaSerie>("/serie/formosa")
      .then((r) => {
        const s = serieDesdeApi(r);
        if (activo && s) setEstado({ serie: s, origen: "api" });
      })
      .catch(() => {
        /* sin backend: se queda la serie estática del kit */
      });
    return () => {
      activo = false;
    };
  }, []);
  return estado;
}
