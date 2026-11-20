import { Alert, AlertIcon, Box, Button, Skeleton, Text } from "@chakra-ui/react";
import { lazy, Suspense, useState } from "react";

import { hayWebGL } from "../lib/entorno";
import { textoPuntoEnSector } from "../lib/puntoEnSector";
import { decimal } from "../lib/validacion";
import { IconoMapa } from "./iconos/Iconos";
import { Insignia } from "./Insignia";

/**
 * Controles de MapLibre (zoom y atribución) a 44 px en pantallas táctiles (DESIGN.md, Mapas). Se aplica con `sx` al
 * contenedor del mapa; en puntero fino quedan los 29 px de la biblioteca.
 */
export const CONTROLES_MAPA_TACTIL = {
  "@media (pointer: coarse)": {
    ".maplibregl-ctrl-group button": { width: "44px", height: "44px" },
    ".maplibregl-ctrl-attrib.maplibregl-compact": { minHeight: "44px", minWidth: "44px", borderRadius: "22px" },
    ".maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button": { width: "44px", height: "44px", backgroundSize: "24px" },
    ".maplibregl-ctrl-attrib.maplibregl-compact-show": { paddingRight: "44px" },
  },
} as const;

const MapaGL = lazy(() => import("./ElegirEnMapaGL"));

type Props = {
  /** Texto de los campos (acepta coma decimal); el mapa lo lee y devuelve el punto por `onChange`. */
  lon: string;
  lat: string;
  onChange: (p: { lat: number; lon: number }) => void;
};

/**
 * Mapa para marcar un punto, ya desplegado: sectores K10 (SIMULADO) sobre OpenStreetMap (DOCUMENTO DE REFERENCIA).
 * Lo usan el botón plegable `ElegirEnMapa` y el selector de ubicación del panel personal.
 */
export function MapaUbicacion({ lon, lat, onChange, alto = "20rem", leyenda = true, estado = true }: Props & { alto?: string; leyenda?: boolean; estado?: boolean }) {
  const [fallo, setFallo] = useState(false);
  const x = decimal(lon);
  const y = decimal(lat);
  const lonN = x !== null && !Number.isNaN(x) ? x : null;
  const latN = y !== null && !Number.isNaN(y) ? y : null;
  const sinMapa = fallo || !hayWebGL();

  if (sinMapa) {
    return (
      <Alert status="info" role="status" fontSize="sm" alignItems="flex-start">
        <AlertIcon />
        El mapa no está disponible en este dispositivo. Usá la ubicación actual o escribí las coordenadas a mano.
      </Alert>
    );
  }
  return (
    <>
      <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
        <Insignia categoria="SIMULADO" />
        <Text fontSize="xs">Sectores K10. Tocá el mapa o arrastrá el marcador.</Text>
      </Box>
      <Box borderWidth="1px" borderRadius="xl" overflow="hidden" sx={CONTROLES_MAPA_TACTIL}>
        <Suspense fallback={<Skeleton height={alto} />}>
          <MapaGL lon={lonN} lat={latN} onChange={onChange} onFallo={() => setFallo(true)} alto={alto} />
        </Suspense>
      </Box>
      {estado && (
        <Text fontSize="sm" mt={2} role="status" aria-live="polite">
          {textoPuntoEnSector(lonN, latN)}
        </Text>
      )}
      {leyenda && (
        <Text fontSize="xs" mt={1} color="textoSuave">
          Mapa base: OpenStreetMap (ODbL), documento de referencia. Sectores: SIMULADO. Las imágenes del mapa se piden a los servidores de OpenStreetMap, que ven tu dirección IP y la zona que mirás (no tus datos).
        </Text>
      )}
    </>
  );
}

/**
 * Vía plegable para ubicarse con un mapa que se abre a demanda (registros y constancia de la cuadrilla).
 * Sectores K10 = SIMULADO; mapa base = DOCUMENTO DE REFERENCIA (OpenStreetMap, ODbL). Los campos de coordenadas
 * siguen siendo la alternativa de teclado y lector de pantalla.
 */
export function ElegirEnMapa({ lon, lat, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Box>
      <Button type="button" variant="outline" size="sm" minH="2.75rem" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)} leftIcon={<IconoMapa />}>
        {abierto ? "Ocultar el mapa" : "Marcar en el mapa"}
      </Button>
      {abierto && (
        <Box mt={3}>
          <MapaUbicacion lon={lon} lat={lat} onChange={onChange} />
        </Box>
      )}
    </Box>
  );
}
