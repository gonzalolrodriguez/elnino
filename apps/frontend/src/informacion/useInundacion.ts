import { useEffect, useMemo, useState } from "react";

import { SECTORES_K10 } from "../datos/kit";
import { decodificarMalla, urlRelieve, type Bbox, type Malla } from "../relieve/datos";
import { lineasEnCaja, mascaraCauce, ordenarCeldas, type LonLat, type OrdenSector } from "./inundacion";

export type MetaDem = {
  fuente: string;
  fecha_descarga: string;
  zoom: number;
  paso_grados: number;
  ruido_dem_m: number;
  min_m: number;
  max_m: number;
};

export type DatosInundacion = {
  malla: Malla;
  meta: MetaDem;
  cauces: LonLat[][];
  cauce: Uint8Array;
  ordenes: OrdenSector[];
};

type Estado = { datos: DatosInundacion | null; fallo: boolean };

/**
 * Carga la malla de relieve de los sectores K10 (z14, DOCUMENTO DE REFERENCIA) y el trazado IGN de los cursos de agua
 * del recuadro, y deja listo el orden de llenado de cada sector. `fallo` = no cargó: la página usa el mapa esquemático.
 */
export function useInundacion(): Estado {
  const [crudo, setCrudo] = useState<{ malla: Malla; meta: MetaDem; cauces: LonLat[][] } | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    const base = import.meta.env.BASE_URL;
    (async () => {
      const [rDem, rAgua] = await Promise.all([fetch(urlRelieve("dem_sectores.json")), fetch(`${base}capas/cursos_agua.geojson`).catch(() => null)]);
      if (!rDem.ok) throw new Error("dem_sectores");
      const j = (await rDem.json()) as { bbox: Bbox; nx: number; ny: number; min_m: number; max_m: number; datos_b64: string } & MetaDem;
      if (!j?.datos_b64 || !j.nx || !j.ny) throw new Error("dem_sectores incompleto");
      const malla = decodificarMalla(j);
      // Los cursos de agua son un complemento: si no cargan, el relieve y el llenado igual se muestran.
      let cauces: LonLat[][] = [];
      if (rAgua?.ok) {
        const c = (await rAgua.json().catch(() => null)) as { features?: { geometry: { type: string; coordinates: unknown } }[] } | null;
        if (Array.isArray(c?.features)) cauces = lineasEnCaja(c.features, malla.bbox);
      }
      if (vivo) setCrudo({ malla, meta: j, cauces });
    })().catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, []);

  const datos = useMemo<DatosInundacion | null>(() => {
    if (!crudo) return null;
    const cauce = mascaraCauce(crudo.malla, crudo.cauces);
    const ordenes = ordenarCeldas(crudo.malla, SECTORES_K10, cauce);
    return { ...crudo, cauce, ordenes };
  }, [crudo]);

  return { datos, fallo };
}
