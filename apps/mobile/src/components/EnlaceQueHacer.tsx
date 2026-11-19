import { useRouter } from "expo-router";

import { Boton } from "@/components/ui";

/** Acceso a la guía fija «Qué hacer» (funciona sin conexión y sin cuenta). */
export function EnlaceQueHacer({ variante = "secundario" }: { variante?: "primario" | "secundario" }) {
  const router = useRouter();
  return <Boton titulo="Qué hacer y a quién llamar" variante={variante} onPress={() => router.push("/que-hacer")} />;
}
