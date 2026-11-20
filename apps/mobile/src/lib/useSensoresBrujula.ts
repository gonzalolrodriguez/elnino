import * as Location from "expo-location";
import { useEffect, useState } from "react";

import type { LecturaRumbo, Punto } from "@/lib/brujula";

export type EstadoSensores = {
  permiso: "pidiendo" | "concedido" | "denegado";
  posicion: Punto | null;
  /** Precisión horizontal del GPS en metros, si el sistema la informa. */
  precisionM: number | null;
  rumbo: LecturaRumbo | null;
};

/**
 * Posición (GPS, permiso «cuando se usa») y rumbo del teléfono (`watchHeadingAsync`) mientras la
 * pantalla está abierta. No guarda ni envía la posición: solo se usa para dibujar la flecha.
 */
export function useSensoresBrujula(): EstadoSensores {
  const [estado, setEstado] = useState<EstadoSensores>({ permiso: "pidiendo", posicion: null, precisionM: null, rumbo: null });

  useEffect(() => {
    let vivo = true;
    const subs: { remove: () => void }[] = [];

    const alPosicion = (p: Location.LocationObject) => {
      if (!vivo) return;
      setEstado((e) => ({
        ...e,
        posicion: { lat: p.coords.latitude, lon: p.coords.longitude },
        precisionM: p.coords.accuracy ?? null,
      }));
    };

    (async () => {
      try {
        const permiso = await Location.requestForegroundPermissionsAsync();
        if (!vivo) return;
        if (!permiso.granted) {
          setEstado((e) => ({ ...e, permiso: "denegado" }));
          return;
        }
        setEstado((e) => ({ ...e, permiso: "concedido" }));

        // Primero la última posición conocida (llega al instante, aun sin señal), después el GPS.
        const ultima = await Location.getLastKnownPositionAsync().catch(() => null);
        if (ultima) alPosicion(ultima);

        try {
          const gps = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 5 },
            alPosicion,
          );
          if (vivo) subs.push(gps);
          else gps.remove();
        } catch {
          // Sin GPS: se queda con la última posición conocida, si la hubo.
        }

        try {
          const brujula = await Location.watchHeadingAsync((h) => {
            if (!vivo) return;
            setEstado((e) => ({ ...e, rumbo: { trueHeading: h.trueHeading, magHeading: h.magHeading, accuracy: h.accuracy } }));
          });
          if (vivo) subs.push(brujula);
          else brujula.remove();
        } catch {
          // Sin sensor de rumbo: la pantalla muestra el rumbo como texto.
        }
      } catch {
        // Falló el permiso: la pantalla lo informa.
      }
    })();

    return () => {
      vivo = false;
      subs.forEach((s) => s.remove());
    };
  }, []);

  return estado;
}
