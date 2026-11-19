import { Text, View } from "react-native";

import { COLOR, RADIO } from "@/components/tema";

export const MENSAJE_HTTP =
  "Conexión sin cifrar (http). Tu contraseña viaja sin protección: usala solo en la red de la demo y con datos de prueba.";

/** Advertencia visible (y anunciada por lectores de pantalla) de que la conexión no va cifrada. */
export function AvisoHttp() {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: COLOR.avisoFondo, borderRadius: RADIO.boton, padding: 12 }}
    >
      <Text style={{ color: COLOR.avisoTexto, fontSize: 13, lineHeight: 18, fontWeight: "600" }}>
        {MENSAJE_HTTP}
      </Text>
    </View>
  );
}
