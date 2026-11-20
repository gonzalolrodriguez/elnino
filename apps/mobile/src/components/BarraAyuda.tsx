import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { COLOR } from "@/components/tema";
import { usePendientes } from "@/lib/EstadoCola";
import { escucharRed, hayRed } from "@/lib/red";
import { TOQUE_MIN, useDiseno } from "@/lib/responsive";

/** Texto de la cola de envíos, o `null` si no hay nada pendiente. */
export function textoPendientes(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "1 pedido por enviar" : `${n} pedidos por enviar`;
}

/**
 * Barra fina bajo la leyenda fija, en todas las pantallas: llamar al 103 con un toque, estado de
 * conexión y cantidad de pedidos guardados en el teléfono que esperan red. No reemplaza ni tapa la
 * leyenda; la fuente sigue la escala del sistema hasta 1,5x para no crecer sin tope.
 */
export function BarraAyuda() {
  const d = useDiseno();
  const pendientes = usePendientes();
  const [sinRed, setSinRed] = useState(false);

  useEffect(() => {
    let vivo = true;
    void hayRed()
      .then((c) => vivo && setSinRed(!c))
      .catch(() => undefined);
    const quitar = escucharRed((c) => setSinRed(!c));
    return () => {
      vivo = false;
      quitar();
    };
  }, []);

  const cola = textoPendientes(pendientes);
  const estado = [sinRed ? "Sin conexión" : null, cola].filter(Boolean).join(" · ");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 12 + d.insets.left,
        paddingRight: 12 + d.insets.right,
        paddingVertical: 2,
        backgroundColor: sinRed ? COLOR.avisoFondo : COLOR.superficie,
        borderBottomWidth: 1,
        borderBottomColor: COLOR.borde,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Llamar al 103"
        onPress={() => void Linking.openURL("tel:103")}
        style={({ pressed }) => ({
          minHeight: TOQUE_MIN,
          minWidth: TOQUE_MIN,
          paddingHorizontal: 14,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 12,
          backgroundColor: pressed ? COLOR.primarioPresionado : COLOR.primario,
          marginVertical: 2,
        })}
      >
        <Text maxFontSizeMultiplier={1.5} style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          103
        </Text>
      </Pressable>
      <Text
        maxFontSizeMultiplier={1.5}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "600",
          color: sinRed || cola ? COLOR.avisoTexto : COLOR.suave,
        }}
      >
        {estado || "Emergencia: Defensa Civil 103"}
      </Text>
    </View>
  );
}
