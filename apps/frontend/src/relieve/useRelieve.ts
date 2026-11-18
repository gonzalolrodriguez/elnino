import { useEffect, useState } from "react";

import { cargarRelieve, type DatosRelieve } from "./datos";

/** Carga las capas de relieve una vez. `fallo` avisa que no hay datos (el llamador muestra el esquema de respaldo). */
export function useRelieve(): { datos: DatosRelieve | null; fallo: boolean } {
  const [estado, setEstado] = useState<{ datos: DatosRelieve | null; fallo: boolean }>({ datos: null, fallo: false });
  useEffect(() => {
    let activo = true;
    cargarRelieve()
      .then((d) => activo && setEstado({ datos: d, fallo: false }))
      .catch(() => activo && setEstado({ datos: null, fallo: true }));
    return () => {
      activo = false;
    };
  }, []);
  return estado;
}
