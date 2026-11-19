import { Alert, AlertIcon, Box, Button, Text } from "@chakra-ui/react";

import { useDentroDeFormosa } from "../lib/provincia";
import { useUbicacionDispositivo, type ErrorUbicacion } from "../lib/useUbicacionDispositivo";

export const MENSAJES_UBICACION: Record<ErrorUbicacion, string> = {
  inseguro:
    "Abrí la plataforma desde una dirección segura (https) o desde esta misma computadora para usar la ubicación; si no, ingresá las coordenadas a mano.",
  no_soportado: "Este navegador no permite obtener la ubicación. Ingresá las coordenadas a mano.",
  denegado:
    "No diste permiso para usar tu ubicación. Habilitalo en el navegador (icono junto a la dirección, Permisos, Ubicación, Permitir) y volvé a intentar, o ingresá las coordenadas a mano.",
  no_disponible: "No se pudo determinar tu ubicación (sin señal de GPS o de red). Probá de nuevo o ingresá las coordenadas a mano.",
  tiempo: "La búsqueda tardó más de 10 segundos. Probá de nuevo, mejor al aire libre, o ingresá las coordenadas a mano.",
};

type Props = {
  /** Recibe la ubicación del dispositivo (grados decimales, 5 decimales). */
  onUbicacion: (lon: number, lat: number, precisionM: number) => void;
  /** Camino principal del formulario: botón lleno y de tamaño completo (en vez del botón secundario). */
  primario?: boolean;
};

/** Completa longitud y latitud con la ubicación del dispositivo. Solo actúa tras un clic. */
export function BotonUbicacion({ onUbicacion, primario = false }: Props) {
  const { estado, pedir } = useUbicacionDispositivo(onUbicacion);
  const buscando = estado.fase === "buscando";
  return (
    <Box>
      <Button size={primario ? "md" : "sm"} variant={primario ? "solid" : "outline"} minH="2.75rem" type="button" onClick={pedir} isLoading={buscando} loadingText="Buscando tu ubicación…">
        Usar mi ubicación actual
      </Button>
      <Box aria-live="polite" mt={2}>
        {estado.fase === "ok" && (
          <Text fontSize="sm" role="status">
            Ubicación completada. Precisión aproximada: ± {estado.precision} m.
            {estado.precision > 500 ? " La precisión es baja: revisá el punto antes de enviar." : ""}
          </Text>
        )}
        {estado.fase === "error" && (
          <Alert status="warning" role="alert" fontSize="sm" alignItems="flex-start">
            <AlertIcon />
            {MENSAJES_UBICACION[estado.error]}
          </Alert>
        )}
      </Box>
      <Text fontSize="xs" mt={2} color="textoSuave">
        Tu ubicación se usa solo para ubicarte en un sector y organizar la asistencia. No se guarda hasta que envíes el formulario.
      </Text>
    </Box>
  );
}

/** Aviso no bloqueante cuando el punto cae fuera de la provincia de Formosa. */
export function AvisoFueraDeFormosa({ lon, lat }: { lon: number | null; lat: number | null }) {
  const dentro = useDentroDeFormosa(lon, lat);
  if (dentro !== false) return null;
  return (
    <Alert status="warning" role="status" fontSize="sm" alignItems="flex-start">
      <AlertIcon />
      La ubicación queda fuera de la provincia de Formosa. Revisala.
    </Alert>
  );
}
