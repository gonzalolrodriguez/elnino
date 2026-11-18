import { LEYENDA } from "@evacuaciones/shared";
import { StyleSheet, Text, View } from "react-native";

export function LeyendaFija() {
  return (
    <View style={styles.banner} accessibilityRole="header">
      <Text style={styles.texto}>{LEYENDA}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#7c2d12", paddingVertical: 6, paddingHorizontal: 10 },
  texto: { color: "#ffffff", fontSize: 11, fontWeight: "600", textAlign: "center" },
});
