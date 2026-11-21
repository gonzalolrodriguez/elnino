import { Alert, AlertDescription, AlertIcon, Box, Button, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../lib/api";
import { horaCorta } from "../../lib/seguimiento";
import { OPCIONES_UBICACION, redondear5 } from "../../lib/useUbicacionDispositivo";
import { api } from "../../panel/api";

/** Cada cuánto se envía la posición (el backend admite una cada 10 s). */
export const INTERVALO_ENVIO_MS = 30_000;

type Estado =
  | { fase: "pausado" }
  | { fase: "compartiendo"; ultima: string | null }
  | { fase: "error"; mensaje: string };

/**
 * «Compartir mi ubicación»: mientras haya una tarea en curso y la página esté abierta, envía la posición cada 30 s
 * (solo en primer plano). La ven la persona que pidió ayuda y los roles operativos; se puede pausar cuando quieras.
 */
export function CompartirUbicacion({ hayTareaEnCurso }: { hayTareaEnCurso: boolean }) {
  const [activo, setActivo] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: "pausado" });
  const enVuelo = useRef(false);

  const enviar = useCallback(() => {
    if (enVuelo.current) return;
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setEstado({ fase: "error", mensaje: "El navegador solo comparte la ubicación en una página segura (https). Probá desde la app o desde una dirección https." });
      setActivo(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setEstado({ fase: "error", mensaje: "Este dispositivo no permite compartir la ubicación desde el navegador." });
      setActivo(false);
      return;
    }
    enVuelo.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api
          .compartirPosicion({ lat: redondear5(pos.coords.latitude), lon: redondear5(pos.coords.longitude), precision_m: Math.max(1, Math.round(pos.coords.accuracy)) })
          .then(() => setEstado({ fase: "compartiendo", ultima: horaCorta(new Date().toISOString()) }))
          .catch((e: unknown) => {
            if (e instanceof ApiError && e.estado === 429) return; // demasiado pronto: el próximo envío lo resuelve
            if (e instanceof ApiError && e.estado === 409) {
              setEstado({ fase: "pausado" });
              setActivo(false);
              return;
            }
            setEstado({ fase: "error", mensaje: "No pudimos enviar tu posición. Vamos a reintentar en unos segundos." });
          })
          .finally(() => {
            enVuelo.current = false;
          });
      },
      (err) => {
        enVuelo.current = false;
        if (err.code === 1) {
          setEstado({ fase: "error", mensaje: "No diste permiso para usar la ubicación. Habilitalo en el navegador para compartirla." });
          setActivo(false);
        } else setEstado({ fase: "error", mensaje: "No pudimos obtener tu ubicación. Vamos a reintentar." });
      },
      OPCIONES_UBICACION,
    );
  }, []);

  useEffect(() => {
    if (!activo || !hayTareaEnCurso) return;
    setEstado({ fase: "compartiendo", ultima: null });
    enviar();
    const t = setInterval(enviar, INTERVALO_ENVIO_MS);
    return () => clearInterval(t);
  }, [activo, hayTareaEnCurso, enviar]);

  if (!hayTareaEnCurso) {
    return (
      <Text textStyle="microdato" data-testid="ubicacion-sin-tarea">
        Cuando inicies una tarea vas a poder compartir tu ubicación con quien pidió ayuda. Solo se comparte mientras la tarea está en curso.
      </Text>
    );
  }
  const compartiendo = activo && estado.fase !== "pausado";
  return (
    <Box data-testid="compartir-ubicacion">
      <Button size="sm" variant={activo ? "outline" : "solid"} aria-pressed={activo} onClick={() => setActivo((a) => !a)} minH="2.75rem" w="full" mb={3}>
        {activo ? "Pausar el envío de mi ubicación" : "Compartir mi ubicación"}
      </Button>
      <Text role="status">
        {compartiendo
          ? `Compartiendo tu ubicación con el solicitante${estado.fase === "compartiendo" && estado.ultima ? ` · último envío a las ${estado.ultima}` : ""}.`
          : "No estás compartiendo tu ubicación."}
      </Text>
      {estado.fase === "error" && (
        <Alert status="warning" mt={2} role="alert">
          <AlertIcon />
          <AlertDescription>{estado.mensaje}</AlertDescription>
        </Alert>
      )}
      <Text textStyle="microdato" mt={2}>
        Se envía cada 30 segundos mientras esta página esté abierta. La ven quien pidió ayuda y los operadores, solo mientras la tarea está en curso; no se guarda un historial.
      </Text>
    </Box>
  );
}
