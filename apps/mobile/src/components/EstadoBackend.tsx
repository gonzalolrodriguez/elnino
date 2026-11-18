import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { obtenerSalud } from "@/lib/api";

type Estado = { tipo: "cargando" } | { tipo: "ok" } | { tipo: "error"; mensaje: string };

export function EstadoBackend() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let activo = true;
    obtenerSalud()
      .then(() => activo && setEstado({ tipo: "ok" }))
      .catch((e: unknown) =>
        activo &&
        setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "Error desconocido" }),
      );
    return () => {
      activo = false;
    };
  }, []);

  return (
    <View style={styles.caja}>
      <Text style={styles.titulo}>Estado del backend</Text>
      {estado.tipo === "cargando" && <ActivityIndicator />}
      {estado.tipo === "ok" && <Text style={styles.ok}>backend OK</Text>}
      {estado.tipo === "error" && (
        <Text style={styles.error}>No se pudo conectar con el backend ({estado.mensaje})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { padding: 16, borderWidth: 1, borderColor: "#d4d4d8", borderRadius: 8, gap: 8 },
  titulo: { fontSize: 16, fontWeight: "600" },
  ok: { color: "#15803d", fontWeight: "700" },
  error: { color: "#b91c1c" },
});
