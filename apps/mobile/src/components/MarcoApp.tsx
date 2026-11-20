import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BarraAyuda } from "@/components/BarraAyuda";
import { LeyendaFija } from "@/components/LeyendaFija";
import { COLOR } from "@/components/tema";

/**
 * Marco común de la app: la leyenda obligatoria queda fija sobre TODO el contenido (pantallas,
 * carga y errores). No se usan pantallas modales nativas porque cubrirían la leyenda.
 */
export function MarcoApp({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.tinta }} edges={["top"]}>
      <LeyendaFija />
      <BarraAyuda />
      <View style={{ flex: 1, backgroundColor: COLOR.fondo }}>{children}</View>
    </SafeAreaView>
  );
}
