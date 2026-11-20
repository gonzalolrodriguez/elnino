import { rutaInicio, useAuth, type Usuario } from "../auth/AuthContext";

/** Acción principal de la portada según el rol de quien tiene sesión. */
export function accionPorRol(rol: Usuario["rol"]): { texto: string; a: string } {
  const a = rutaInicio(rol);
  if (rol === "ciudadano" || rol === "productor") return { texto: "Ir a mi cuenta", a };
  if (rol === "cuadrilla") return { texto: "Ver mis tareas", a };
  if (rol === "admin") return { texto: "Ir a administración", a };
  return { texto: "Ir al panel operativo", a };
}

/** Usuario con sesión iniciada (null si es anónimo o la sesión todavía se está restaurando). */
export function useSesionPortada() {
  const { estado, usuario } = useAuth();
  return estado === "autenticado" && usuario ? usuario : null;
}
