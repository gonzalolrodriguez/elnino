import { Alert, AlertIcon, Box, Button, Skeleton, Text } from "@chakra-ui/react";
import { lazy, Suspense, useState } from "react";

import { hayWebGL } from "../lib/entorno";
import { textoPuntoEnSector } from "../lib/puntoEnSector";
import { decimal } from "../lib/validacion";
import { Insignia } from "./Insignia";

const MapaGL = lazy(() => import("./ElegirEnMapaGL"));

type Props = {
  /** Texto de los campos (acepta coma decimal); el mapa lo lee y devuelve el punto por `onChange`. */
  lon: string;
  lat: string;
  onChange: (p: { lat: number; lon: number }) => void;
};

/**
 * Tercera vía para ubicarse (además del GPS y las coordenadas a mano): un mapa que se abre a demanda.
 * Sectores K10 = SIMULADO; mapa base = DOCUMENTO DE REFERENCIA (OpenStreetMap, ODbL). Los campos de coordenadas
 * siguen siendo la alternativa de teclado y lector de pantalla.
 */
export function ElegirEnMapa({ lon, lat, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [fallo, setFallo] = useState(false);
  const x = decimal(lon);
  const y = decimal(lat);
  const lonN = x !== null && !Number.isNaN(x) ? x : null;
  const latN = y !== null && !Number.isNaN(y) ? y : null;
  const sinMapa = fallo || !hayWebGL();

  return (
    <Box>
      <Button type="button" variant="outline" size="sm" minH="2.75rem" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        {abierto ? "Ocultar el mapa" : "Marcar en el mapa"}
      </Button>
      {abierto && (
        <Box mt={3}>
          {sinMapa ? (
            <Alert status="info" role="status" fontSize="sm" alignItems="flex-start">
              <AlertIcon />
              El mapa no está disponible en este dispositivo. Usá la ubicación actual o escribí las coordenadas a mano.
            </Alert>
          ) : (
            <>
              <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
                <Insignia categoria="SIMULADO" />
                <Text fontSize="xs">Sectores K10. Tocá el mapa o arrastrá el marcador.</Text>
              </Box>
              <Box borderWidth="1px" borderRadius="md" overflow="hidden">
                <Suspense fallback={<Skeleton height="20rem" />}>
                  <MapaGL lon={lonN} lat={latN} onChange={onChange} onFallo={() => setFallo(true)} />
                </Suspense>
              </Box>
              <Text fontSize="sm" mt={2} role="status" aria-live="polite">
                {textoPuntoEnSector(lonN, latN)}
              </Text>
              <Text fontSize="xs" mt={1} color="textoSuave">
                Mapa base: OpenStreetMap (ODbL), documento de referencia. Sectores: SIMULADO.
              </Text>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
