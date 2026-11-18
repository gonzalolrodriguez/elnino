import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configurado = false;

/**
 * Notificaciones LOCALES (P7): se disparan mientras la app está abierta, a partir del WebSocket o
 * del sondeo. El push remoto (FCM) queda fuera del alcance y se documenta como hoja de ruta.
 */
export async function prepararNotificaciones(): Promise<boolean> {
  try {
    if (!configurado) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("ordenes", {
          name: "Órdenes y alertas",
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      configurado = true;
    }
    const actual = await Notifications.getPermissionsAsync();
    if (actual.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function avisarLocal(titulo: string, cuerpo: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: cuerpo },
      trigger: Platform.OS === "android" ? { channelId: "ordenes" } : null,
    });
  } catch {
    // Sin permiso o sin soporte (p. ej. Expo Go): la alerta igual queda en la pantalla de alertas.
  }
}
