import { useEffect, useState } from "react";

import { urlRelieve, type ColeccionGeo, type MetaRelieve } from "./datos";

export type RelieveLocal = { meta: MetaRelieve; curvas: ColeccionGeo; departamentos: ColeccionGeo };

/** Curvas de nivel del corredor de los sectores K10 y departamentos, para el fondo de los mapas SVG. `null` si no cargan. */
export function useRelieveLocal(activo = true): RelieveLocal | null {
  const [datos, setDatos] = useState<RelieveLocal | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const traer = async <T,>(a: string): Promise<T> => {
      const r = await fetch(urlRelieve(a));
      if (!r.ok) throw new Error(a);
      return (await r.json()) as T;
    };
    Promise.all([traer<MetaRelieve>("meta.json"), traer<ColeccionGeo>("curvas_local.geojson"), traer<ColeccionGeo>("departamentos.geojson")])
      .then(([meta, curvas, departamentos]) => {
        if (!meta?.local || !Array.isArray(curvas?.features) || !Array.isArray(departamentos?.features)) throw new Error("Datos de relieve incompletos");
        if (vivo) setDatos({ meta, curvas, departamentos });
      })
      .catch(() => vivo && setDatos(null));
    return () => {
      vivo = false;
    };
  }, [activo]);
  return datos;
}
