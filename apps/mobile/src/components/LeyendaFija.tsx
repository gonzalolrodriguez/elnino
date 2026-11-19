import { LEYENDA } from "@evacuaciones/shared";
import { StyleSheet, Text, View } from "react-native";

import { COLOR } from "@/components/tema";
import { useDiseno } from "@/lib/responsive";

/**
 * Leyenda obligatoria, siempre visible. La fuente sigue la escala del sistema hasta 1,5x (más allá
 * ocuparía demasiado alto y desplazaría el contenido); respeta las zonas seguras laterales
 * (recortes de cámara en apaisado) y se compacta en teléfonos apaisados.
 */
export function LeyendaFija() {
  const d = useDiseno();
  const compacta = d.apaisado && !d.esTablet;
  return (
    <View
      style={[
        styles.banner,
        {
          paddingLeft: 12 + d.insets.left,
          paddingRight: 12 + d.insets.right,
          paddingVertical: compacta ? 3 : 5,
        },
      ]}
      accessibilityRole="header"
    >
      <Text style={styles.texto} maxFontSizeMultiplier={1.5}>
        {LEYENDA}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: COLOR.tinta },
  texto: { color: "#DCE8F5", fontSize: 11, lineHeight: 15, fontWeight: "600", textAlign: "center" },
});
