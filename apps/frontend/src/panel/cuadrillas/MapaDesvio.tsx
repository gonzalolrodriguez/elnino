import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Input, Skeleton, Text } from "@chakra-ui/react";
import { lazy, Suspense, useRef, useState } from "react";

import { hayWebGL } from "../../lib/entorno";
import { decimal } from "../../lib/validacion";
import { TACTIL } from "./partes";
import type { Punto } from "./MapaDesvioGL";

const MapaDesvioGL = lazy(() => import("./MapaDesvioGL"));

/**
 * Trazado de un desvío: se hace clic en el mapa para sumar puntos (o marcar uno solo). Para quien no usa el mouse
 * hay un botón que suma el centro del mapa y, sin WebGL, campos de coordenadas.
 */
export function MapaDesvio({
  puntos,
  onChange,
  referencia,
  centro,
  modo,
  alCambiarModo,
}: {
  puntos: Punto[];
  onChange: (p: Punto[]) => void;
  referencia?: Punto[] | null;
  centro?: Punto | null;
  modo: "linea" | "punto";
  alCambiarModo: (m: "linea" | "punto") => void;
}) {
  const [fallo, setFallo] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const centroRef = useRef<(() => Punto) | null>(null);
  const sinMapa = fallo || !hayWebGL();

  const sumar = (p: Punto) => onChange(modo === "punto" ? [p] : [...puntos, p]);
  const la = decimal(lat);
  const lo = decimal(lon);
  const coordsOk = la !== null && lo !== null && !Number.isNaN(la) && !Number.isNaN(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;

  return (
    <Box data-testid="mapa-desvio">
      <Flex gap={2} wrap="wrap" mb={2} role="group" aria-label="Qué marcar en el mapa">
        <Button size="sm" {...TACTIL} borderRadius="full" variant={modo === "linea" ? "solid" : "outline"} aria-pressed={modo === "linea"} onClick={() => alCambiarModo("linea")}>
          Trazar desvío
        </Button>
        <Button size="sm" {...TACTIL} borderRadius="full" variant={modo === "punto" ? "solid" : "outline"} aria-pressed={modo === "punto"} onClick={() => alCambiarModo("punto")}>
          Marcar un punto
        </Button>
      </Flex>
      {sinMapa ? (
        <Alert status="info" role="status" alignItems="flex-start" mb={2}>
          <AlertIcon />
          El mapa no está disponible en este dispositivo. Escribí las coordenadas de cada punto.
        </Alert>
      ) : (
        <Box borderWidth="1px" borderRadius="xl" overflow="hidden" h={{ base: "18rem", md: "22rem" }}>
          <Suspense fallback={<Skeleton h="full" />}>
            <MapaDesvioGL puntos={puntos} onChange={onChange} modo={modo} referencia={referencia} centro={centro} centroRef={centroRef} onFallo={() => setFallo(true)} />
          </Suspense>
        </Box>
      )}
      <Text textStyle="microdato" mt={1}>
        {modo === "linea" ? "Hacé clic en el mapa para sumar puntos al desvío." : "Hacé clic en el mapa para marcar el punto."} La línea gris es el recorrido actual de la cuadrilla, si lo tiene. Mapa base: OpenStreetMap (ODbL).
      </Text>
      <Flex gap={2} wrap="wrap" mt={2} align="center">
        {!sinMapa && (
          <Button size="sm" {...TACTIL} variant="outline" onClick={() => centroRef.current && sumar(centroRef.current())}>
            Sumar el centro del mapa
          </Button>
        )}
        <Button size="sm" {...TACTIL} variant="outline" onClick={() => onChange(puntos.slice(0, -1))} isDisabled={puntos.length === 0}>
          Deshacer último punto
        </Button>
        <Button size="sm" {...TACTIL} variant="outline" onClick={() => onChange([])} isDisabled={puntos.length === 0}>
          Borrar trazado
        </Button>
        <Text role="status" aria-live="polite" data-testid="desvio-estado">
          {puntos.length === 0 ? "Sin puntos" : modo === "punto" || puntos.length === 1 ? "1 punto marcado" : `${puntos.length} puntos en el desvío`}
        </Text>
      </Flex>
      {sinMapa && (
        <Flex gap={2} mt={2} align="flex-end" wrap="wrap">
          <FormControl w="9rem">
            <FormLabel htmlFor="desvio-lat" textStyle="rotulo" color="texto" mb={1}>
              Latitud
            </FormLabel>
            <Input id="desvio-lat" bg="superficie" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </FormControl>
          <FormControl w="9rem">
            <FormLabel htmlFor="desvio-lon" textStyle="rotulo" color="texto" mb={1}>
              Longitud
            </FormLabel>
            <Input id="desvio-lon" bg="superficie" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
          </FormControl>
          <Button
            size="sm"
            {...TACTIL}
            isDisabled={!coordsOk}
            onClick={() => {
              sumar([Number(lo), Number(la)]);
              setLat("");
              setLon("");
            }}
          >
            Sumar punto
          </Button>
        </Flex>
      )}
    </Box>
  );
}
