import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { mimeDeArchivo, type AdjuntoLocal } from "@/lib/adjuntos";

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

export type ResultadoAdjunto =
  | { ok: true; adjunto: AdjuntoLocal }
  | { ok: false; motivo: "permiso" | "cancelado" | "error" };

/** Tamaño de un archivo local; `null` si no se pudo medir (el servidor valida igual). */
async function medirArchivo(uri: string): Promise<number | null> {
  try {
    const r = await fetch(uri);
    const b = await r.blob();
    return typeof b.size === "number" ? b.size : null;
  } catch {
    return null;
  }
}

/**
 * Evidencia para un parte: foto o video, desde la cámara o la galería. Las imágenes se comprimen como las
 * demás fotos (1280 px, JPEG 60 %); el video se conserva tal cual (se limita a 30 s con la cámara) y su
 * tamaño y formato los valida `validarAdjunto`.
 */
export async function elegirAdjunto(fuente: "camara" | "galeria"): Promise<ResultadoAdjunto> {
  try {
    if (fuente === "camara") {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return { ok: false, motivo: "permiso" };
    }
    const opciones = { mediaTypes: ["images", "videos"] as ImagePicker.MediaType[], quality: 1, videoMaxDuration: 30 };
    const r = fuente === "camara" ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (r.canceled || r.assets.length === 0) return { ok: false, motivo: "cancelado" };
    const a = r.assets[0];
    if (a.type === "video") {
      return {
        ok: true,
        adjunto: { uri: a.uri, tipo: "video", mime: mimeDeArchivo(a.uri, a.mimeType), bytes: a.fileSize ?? (await medirArchivo(a.uri)) },
      };
    }
    const comprimida = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: 1280 } }], {
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { ok: true, adjunto: { uri: comprimida.uri, tipo: "imagen", mime: "image/jpeg", bytes: await medirArchivo(comprimida.uri) } };
  } catch {
    return { ok: false, motivo: "error" };
  }
}
