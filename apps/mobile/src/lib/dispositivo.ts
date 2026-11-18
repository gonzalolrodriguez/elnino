import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

export type Coordenadas = { lat: number; lon: number };

export type ResultadoUbicacion =
  | { ok: true; coordenadas: Coordenadas; precisionM: number | null }
  | { ok: false; motivo: "permiso" | "error" };

/** Ubicación GPS actual. Pide el permiso en primer plano solo cuando el usuario lo solicita. */
export async function obtenerUbicacion(): Promise<ResultadoUbicacion> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) return { ok: false, motivo: "permiso" };
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      ok: true,
      coordenadas: { lat: p.coords.latitude, lon: p.coords.longitude },
      precisionM: p.coords.accuracy ?? null,
    };
  } catch {
    return { ok: false, motivo: "error" };
  }
}

/**
 * Toma una foto con la cámara y la comprime (ancho máximo 1280 px, JPEG 60 %) para que sea
 * liviana. Devuelve el URI local o null si se cancela o no hay permiso.
 */
export async function tomarFotoComprimida(): Promise<string | null> {
  try {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return null;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || r.assets.length === 0) return null;
    const comprimida = await ImageManipulator.manipulateAsync(
      r.assets[0].uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
    );
    return comprimida.uri;
  } catch {
    return null;
  }
}
