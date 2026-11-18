import type { Rol } from "@evacuaciones/shared";
import type { ReactNode } from "react";

import { Vacio } from "@/components/ui";
import { useSesion } from "@/lib/SesionContext";

/** Muestra el contenido solo a los roles indicados; para el resto no renderiza nada útil. */
export function SoloRol({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { estado } = useSesion();
  if (estado.tipo !== "autenticado" || !roles.includes(estado.usuario.rol)) {
    return <Vacio texto="Esta sección no está disponible para tu rol." />;
  }
  return <>{children}</>;
}
