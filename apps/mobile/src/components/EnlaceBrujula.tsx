import { useRouter } from "expo-router";

import { Boton } from "@/components/ui";

/** Acceso a la brújula sin conexión «¿Hacia dónde voy?» (disponible con o sin sesión). */
export function EnlaceBrujula({ variante = "secundario" }: { variante?: "primario" | "secundario" }) {
  const router = useRouter();
  return <Boton titulo="¿Hacia dónde voy?" variante={variante} onPress={() => router.push("/brujula")} />;
}
