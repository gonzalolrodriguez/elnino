import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** `true` si la persona pidió reducir el movimiento en los ajustes del sistema (sin animaciones del mapa). */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (vivo) setReducido(!!v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => setReducido(!!v));
    return () => {
      vivo = false;
      sub?.remove?.();
    };
  }, []);
  return reducido;
}
