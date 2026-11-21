import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../lib/api";
import { avisosDeCuadrilla, marcarAvisoLeido, type Aviso } from "../../lib/avisos";

export const INTERVALO_AVISOS_MS = 30_000;

export type EstadoAvisos = "cargando" | "ok" | "error";

/**
 * Avisos del operativo para las cuadrillas del usuario. Se refrescan con el evento de tiempo real `aviso_cuadrilla`
 * (`senal` sube cada vez que llega uno) y, como respaldo si el socket cae, cada 30 s y a pedido.
 * Un 403/404 (sin avisos o sin permiso sobre esa cuadrilla) cuenta como lista vacía.
 */
export function useAvisos(cuadrillaIds: number[], senal = 0) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [estado, setEstado] = useState<EstadoAvisos>("cargando");
  const [error, setError] = useState<unknown>(null);
  const clave = cuadrillaIds.join(",");
  const ids = useRef(cuadrillaIds);
  ids.current = cuadrillaIds;

  const cargar = useCallback(async () => {
    if (ids.current.length === 0) {
      setAvisos([]);
      setEstado("ok");
      return;
    }
    const r = await Promise.allSettled(ids.current.map((id) => avisosDeCuadrilla(id).then((l) => l.map((x) => ({ ...x, cuadrilla_id: x.cuadrilla_id ?? id })))));
    const falla = r.find((x): x is PromiseRejectedResult => x.status === "rejected" && !(x.reason instanceof ApiError && (x.reason.estado === 403 || x.reason.estado === 404)));
    const lista = r.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
    if (falla && lista.length === 0) {
      setError(falla.reason);
      setEstado("error");
    } else {
      setError(null);
      setAvisos(lista);
      setEstado("ok");
    }
  }, []);

  useEffect(() => {
    let activo = true;
    const seguro = () => {
      if (activo) void cargar();
    };
    seguro();
    const t = setInterval(seguro, INTERVALO_AVISOS_MS);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [clave, cargar]);

  useEffect(() => {
    if (senal > 0) void cargar();
  }, [senal, cargar]);

  /** Marca el aviso como leído en el servidor; solo al confirmarse cambia la lista. Devuelve el error si falla. */
  const marcar = useCallback(async (id: number): Promise<unknown> => {
    try {
      const r = await marcarAvisoLeido(id);
      const leido_en = r.leido_en ?? new Date().toISOString();
      setAvisos((l) => l.map((x) => (x.id === id ? { ...x, leido_en, leido_por_rol: r.leido_por_rol ?? x.leido_por_rol ?? null } : x)));
      return null;
    } catch (e) {
      return e;
    }
  }, []);

  return { avisos, estado, error, recargar: cargar, marcar };
}
