import { Box, Flex, FormControl, FormLabel, Input, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { textoPuntoEnSector } from "../lib/puntoEnSector";
import { decimal } from "../lib/validacion";
import { BotonUbicacion } from "./BotonUbicacion";
import { MapaUbicacion } from "./ElegirEnMapa";
import { IconoMapa, IconoMira, IconoNumeral, IconoPunto } from "./iconos/Iconos";

export type ModoUbicacion = "ubicacion" | "mapa" | "coordenadas";
const MODOS: ModoUbicacion[] = ["ubicacion", "mapa", "coordenadas"];

type Props = {
  /** Texto de los campos (acepta coma decimal). */
  lon: string;
  lat: string;
  /** Punto elegido con el GPS o con el mapa. */
  onPunto: (lon: number, lat: number) => void;
  /** Texto escrito a mano en los campos de coordenadas. */
  onTexto: (campo: "lon" | "lat", valor: string) => void;
  errorLon?: string;
  errorLat?: string;
  /** Prefijo de los ids de los campos (p. ej. «g» da `g-lat` y `g-lon`). */
  idBase: string;
  /** Solapa con la que arranca: con domicilio cargado conviene «mapa» para ver y ajustar el punto. */
  inicial?: ModoUbicacion;
  /** Cada vez que sube este número se abre la solapa del mapa (p. ej. desde «Marcá tu domicilio»). */
  abrirMapa?: number;
  /** Id del contenedor, para llevar la vista hasta el selector. */
  id?: string;
};

const estiloSolapa = {
  flexDirection: { base: "column", sm: "row" },
  gap: { base: 1, sm: 2 },
  minH: "3.25rem",
  px: { base: 1, sm: 3 },
  py: 2,
  fontSize: { base: "0.8125rem", sm: "sm" },
  fontWeight: 600,
  lineHeight: 1.15,
  textAlign: "center",
  borderRadius: "lg",
  color: "textoSuave",
  transition: "background-color 160ms var(--ease-out), color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)",
  _selected: { bg: "superficie", color: "agua.800", boxShadow: "0 1px 2px rgba(14, 27, 44, 0.12), 0 0 0 1px var(--chakra-colors-borde)" },
  _hover: { color: "texto" },
  _focusVisible: { boxShadow: "none", outline: "3px solid", outlineColor: "foco", outlineOffset: "1px" },
} as const;

/**
 * Una sola decisión para ubicarse: «Mi ubicación actual», «Marcar en el mapa» o «Coordenadas». Las tres leen y
 * escriben el mismo punto; debajo, una línea en vivo dice en qué sector cae. El mapa se crea recién cuando se
 * elige su solapa; los campos de coordenadas existen siempre (teclado y lectores de pantalla).
 */
export function SelectorUbicacion({ lon, lat, onPunto, onTexto, errorLon, errorLat, idBase, inicial = "ubicacion", abrirMapa = 0, id }: Props) {
  const [indice, setIndice] = useState(MODOS.indexOf(inicial));
  const [vistoMapa, setVistoMapa] = useState(inicial === "mapa");
  const ir = (i: number) => {
    setIndice(i);
    if (MODOS[i] === "mapa") setVistoMapa(true);
  };
  useEffect(() => {
    if (abrirMapa > 0) {
      setIndice(1);
      setVistoMapa(true);
    }
  }, [abrirMapa]);

  const x = decimal(lon);
  const y = decimal(lat);
  const lonN = x !== null && !Number.isNaN(x) ? x : null;
  const latN = y !== null && !Number.isNaN(y) ? y : null;
  const hayPunto = lonN !== null && latN !== null;
  const mensajes = [errorLon, errorLat].filter((m): m is string => !!m);

  return (
    <Box id={id}>
      <Tabs index={indice} onChange={ir} variant="unstyled" isFitted>
        <TabList bg="pizarra.100" p={1} borderRadius="xl" gap={1} aria-label="Cómo querés indicar el lugar">
          <Tab {...estiloSolapa}>
            <IconoMira />
            <span>Mi ubicación actual</span>
          </Tab>
          <Tab {...estiloSolapa}>
            <IconoMapa />
            <span>Marcar en el mapa</span>
          </Tab>
          <Tab {...estiloSolapa}>
            <IconoNumeral />
            <span>Coordenadas</span>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0} pt={4} pb={0}>
            <BotonUbicacion primario onUbicacion={(lo, la) => onPunto(lo, la)} />
          </TabPanel>
          <TabPanel px={0} pt={4} pb={0}>
            {vistoMapa && <MapaUbicacion lon={lon} lat={lat} onChange={(p) => onPunto(p.lon, p.lat)} alto="clamp(18rem, 52vh, 26rem)" estado={false} />}
          </TabPanel>
          <TabPanel px={0} pt={4} pb={0}>
            <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap={4}>
              <FormControl isInvalid={!!errorLat}>
                <FormLabel htmlFor={`${idBase}-lat`}>Latitud</FormLabel>
                <Input id={`${idBase}-lat`} name={`${idBase}-lat`} inputMode="decimal" value={lat} onChange={(e) => onTexto("lat", e.target.value)} placeholder="-26,183" />
              </FormControl>
              <FormControl isInvalid={!!errorLon}>
                <FormLabel htmlFor={`${idBase}-lon`}>Longitud</FormLabel>
                <Input id={`${idBase}-lon`} name={`${idBase}-lon`} inputMode="decimal" value={lon} onChange={(e) => onTexto("lon", e.target.value)} placeholder="-58,183" />
              </FormControl>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Flex align="flex-start" gap={2.5} mt={3} px={3.5} py={2.5} borderRadius="xl" bg={hayPunto ? "agua.50" : "fondo"} border="1px solid" borderColor={hayPunto ? "agua.200" : "borde"}>
        <Box aria-hidden="true" mt="2px" display="flex" color={hayPunto ? "agua.700" : "pizarra.500"}>
          <IconoPunto />
        </Box>
        <Box minW={0}>
          <Text fontSize="sm" fontWeight={600} role="status" aria-live="polite">
            {textoPuntoEnSector(lonN, latN)}
          </Text>
          {hayPunto && (
            <Text fontSize="xs" color="textoSuave" sx={{ fontVariantNumeric: "tabular-nums" }}>
              Lat {lat.trim()} · Lon {lon.trim()}
            </Text>
          )}
        </Box>
      </Flex>
      {mensajes.length > 0 && (
        <Box mt={2} role="alert" color="umbral.textoEvacuacion" fontSize="sm" fontWeight={600}>
          {mensajes.map((m) => (
            <Text key={m}>{m}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
