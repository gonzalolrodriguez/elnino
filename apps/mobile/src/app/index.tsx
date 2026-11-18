import { StyleSheet, Text, View } from "react-native";

import { EstadoBackend } from "@/components/EstadoBackend";

export default function Inicio() {
  return (
    <View style={styles.pantalla}>
      <Text style={styles.titulo}>Plataforma de Gestión de Evacuaciones · Equipo 3</Text>
      <EstadoBackend />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, padding: 16, gap: 16 },
  titulo: { fontSize: 20, fontWeight: "700" },
});
