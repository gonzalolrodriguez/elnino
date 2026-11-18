import { Redirect } from "expo-router";

import { pestanasPorRol, useUsuario } from "@/lib/SesionContext";

/** Lleva a la primera pestaña disponible según el rol. */
export default function InicioApp() {
  const usuario = useUsuario();
  const primera = pestanasPorRol(usuario.rol)[0];
  return <Redirect href={`/(app)/${primera}`} />;
}
