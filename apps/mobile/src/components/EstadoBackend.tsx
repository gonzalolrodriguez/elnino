import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { COLOR, RADIO, TIPO } from "@/components/tema";
import { obtenerSalud } from "@/lib/api";
import { escucharServidor } from "@/lib/servidor";

type Estado = { tipo: "cargando" } | { tipo: "ok" } | { tipo: "error"; mensaje: string };

/** Estado de la conexión con el backend. Solo se muestra en la pantalla «Conexión». */
export function EstadoBackend() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  // Se vuelve a consultar al guardar otra URL de servidor.
  const [version, setVersion] = useState(0);
  useEffect(() => escucharServidor(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let activo = true;
    setEstado({ tipo: "cargando" });
    obtenerSalud()
      .then(() => activo && setEstado({ tipo: "ok" }))
      .catch((e: unknown) =>
        activo &&
        setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "Error desconocido" }),
      );
    return () => {
      activo = false;
    };
  }, [version]);

  return (
    <View style={styles.caja}>
      <Text style={styles.titulo}>Estado del backend</Text>
      {estado.tipo === "cargando" && <ActivityIndicator color={COLOR.primario} />}
      {estado.tipo === "ok" && <Text style={styles.ok}>backend OK</Text>}
      {estado.tipo === "error" && (
        <Text style={styles.error}>No se pudo conectar con el backend ({estado.mensaje})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { padding: 16, backgroundColor: COLOR.cielo, borderRadius: RADIO.tarjeta, gap: 6 },
  titulo: { ...TIPO.cuerpoFuerte, color: COLOR.texto },
  ok: { ...TIPO.cuerpoFuerte, fontWeight: "700", color: COLOR.okTexto },
  error: { ...TIPO.cuerpo, color: COLOR.errorTexto },
});
