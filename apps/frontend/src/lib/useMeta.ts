import { useEffect, useState } from "react";

import { obtenerMeta, type Meta } from "./api";

export type EstadoMeta = { estado: "cargando" } | { estado: "ok"; meta: Meta } | { estado: "error" };

/** Metadatos del backend (límites, corte). La página sigue funcionando sin ellos. */
export function useMeta(): EstadoMeta {
  const [e, setE] = useState<EstadoMeta>({ estado: "cargando" });
  useEffect(() => {
    let activo = true;
    obtenerMeta()
      .then((meta) => activo && setE({ estado: "ok", meta }))
      .catch(() => activo && setE({ estado: "error" }));
    return () => {
      activo = false;
    };
  }, []);
  return e;
}
