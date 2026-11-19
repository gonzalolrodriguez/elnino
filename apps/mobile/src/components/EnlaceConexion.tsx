import { useRouter } from "expo-router";

import { Enlace } from "@/components/ui";

/** Acceso discreto a la pantalla «Conexión» (servidor y estado del backend). */
export function EnlaceConexion() {
  const router = useRouter();
  return <Enlace titulo="Configurar conexión" onPress={() => router.push("/conexion")} />;
}
