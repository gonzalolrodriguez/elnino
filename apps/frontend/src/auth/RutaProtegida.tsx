import { Center, Spinner } from "@chakra-ui/react";
import type { Rol } from "@evacuaciones/shared";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { rutaInicio, useAuth } from "./AuthContext";

/** Exige sesión y, si se indica, uno de los roles permitidos. */
export function RutaProtegida({ roles, children }: { roles: readonly Rol[]; children: ReactNode }) {
  const { estado, usuario } = useAuth();
  const ubicacion = useLocation();

  if (estado === "cargando") {
    return (
      <Center py={20} role="status" aria-label="Verificando sesión">
        <Spinner />
      </Center>
    );
  }
  if (estado !== "autenticado" || !usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }
  if (!roles.includes(usuario.rol)) {
    return <Navigate to={rutaInicio(usuario.rol)} replace />;
  }
  return <>{children}</>;
}
