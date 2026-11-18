import { useCallback, useEffect, useRef, useState } from "react";

export type Carga<T> =
  | { estado: "cargando"; datos: null; error: null }
  | { estado: "ok"; datos: T; error: null }
  | { estado: "error"; datos: null; error: unknown };

/** Carga asíncrona con estados de carga, éxito y error, y recarga manual. */
export function useCarga<T>(cargar: () => Promise<T>, dependencias: unknown[] = []): Carga<T> & { recargar: () => void } {
  const [estado, setEstado] = useState<Carga<T>>({ estado: "cargando", datos: null, error: null });
  const [version, setVersion] = useState(0);
  const funcion = useRef(cargar);
  funcion.current = cargar;

  useEffect(() => {
    let activo = true;
    setEstado((e) => (e.estado === "ok" ? e : { estado: "cargando", datos: null, error: null }));
    funcion
      .current()
      .then((datos) => activo && setEstado({ estado: "ok", datos, error: null }))
      .catch((error: unknown) => activo && setEstado({ estado: "error", datos: null, error }));
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...dependencias]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { ...estado, recargar };
}
