import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LeyendaFija } from "@/components/LeyendaFija";

/**
 * Marco común de la app: la leyenda obligatoria queda fija sobre TODO el contenido (pantallas,
 * carga y errores). No se usan pantallas modales nativas porque cubrirían la leyenda.
 */
export function MarcoApp({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#7c2d12" }} edges={["top"]}>
      <LeyendaFija />
      <View style={{ flex: 1, backgroundColor: "#ffffff" }}>{children}</View>
    </SafeAreaView>
  );
}
