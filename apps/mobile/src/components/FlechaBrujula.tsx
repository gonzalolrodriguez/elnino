import { StyleSheet, View } from "react-native";

import { COLOR } from "@/components/tema";

const TAMANO = 200;

/**
 * Flecha que apunta hacia arriba y gira `grados` (sentido horario). Se dibuja con vistas (triángulo
 * por bordes + asta), sin imágenes ni mapa, para que funcione sin conexión. La etiqueta de
 * accesibilidad la recibe quien la usa.
 */
export function FlechaBrujula({ grados, etiqueta }: { grados: number; etiqueta: string }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiqueta} style={estilos.disco}>
      <View testID="flecha-giro" style={[estilos.giro, { transform: [{ rotate: `${grados}deg` }] }]}>
        <View style={estilos.punta} />
        <View style={estilos.asta} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  disco: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    backgroundColor: COLOR.cielo,
    borderWidth: 2,
    borderColor: COLOR.primario,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  giro: { width: TAMANO, height: TAMANO, alignItems: "center", justifyContent: "center" },
  punta: {
    width: 0,
    height: 0,
    borderLeftWidth: 38,
    borderRightWidth: 38,
    borderBottomWidth: 70,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: COLOR.primario,
  },
  asta: { width: 26, height: 60, backgroundColor: COLOR.primario, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
});
