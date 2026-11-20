import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, Link, Skeleton, Text } from "@chakra-ui/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { Insignia } from "../../components/Insignia";
import { hayWebGL, useMenosMovimiento } from "../../lib/entorno";
import { fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import type { PosicionSeguimiento } from "../tipos";
import { Cargando, Chip } from "../ui";
import { TACTIL } from "./partes";

const MapaSeguimientoGL = lazy(() => import("./MapaSeguimientoGL"));

/** Cada cuánto se vuelve a pedir la posición de las cuadrillas (ms). */
export const PERIODO_SEGUIMIENTO_MS = 20_000;

function textoLlegada(p: PosicionSeguimiento): string {
  const r = p.ruta;
  if (!r) return "Sin recorrido: se muestra su última posición.";
  const min = r.llegada_estimada_min;
  return `${r.distancia_km.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km${min === null ? "" : `, llega en unos ${Math.max(1, Math.round(min))} min`}`;
}

/** Seguimiento de todas las cuadrillas en un mapa: recorrido animado como el que ve la ciudadanía, más una lista para elegir. */
export function SeguimientoCuadrillas({ vehiculos }: { vehiculos: Record<number, string | null> }) {
  const navegar = useNavigate();
  const reducido = useMenosMovimiento();
  const [tic, setTic] = useState(0);
  const [fallo, setFallo] = useState(false);
  const carga = useCarga(() => api.seguimientoCuadrillas(), [tic]);

  useEffect(() => {
    const id = window.setInterval(() => setTic((t) => t + 1), PERIODO_SEGUIMIENTO_MS);
    return () => window.clearInterval(id);
  }, []);

  const sinMapa = fallo || !hayWebGL();
  return (
    <Cargando
      carga={carga}
      esVacio={(d) => d.posiciones.length === 0}
      vacio="Ninguna cuadrilla tiene tarea en curso con posición compartida. Cuando salgan a una tarea, aparecen acá."
      hijos={(d) => (
        <Box data-testid="seguimiento-cuadrillas">
          <Flex align="center" gap={2} wrap="wrap" mb={3}>
            <Insignia categoria="SIMULADO" />
            <Text textStyle="microdato">
              Se actualiza cada {PERIODO_SEGUIMIENTO_MS / 1000} s. Base: OpenStreetMap (ODbL), documento de referencia. Última lectura: {fechaHora(d.fecha_dato)}.
            </Text>
          </Flex>
          <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "minmax(0, 2fr) minmax(0, 1fr)" }} gap={4} alignItems="start">
            {sinMapa ? (
              <Alert status="info" role="status" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription>El mapa no está disponible en este dispositivo. La lista muestra el estado de cada cuadrilla.</AlertDescription>
              </Alert>
            ) : (
              <Box borderWidth="1px" borderRadius="xl" overflow="hidden" h={{ base: "22rem", md: "32rem" }} data-testid="mapa-seguimiento">
                <Suspense fallback={<Skeleton h="full" />}>
                  <MapaSeguimientoGL items={d.posiciones} vehiculos={vehiculos} reducido={reducido} onSeleccionar={(id) => navegar(`/comando/cuadrillas/${id}`)} onFallo={() => setFallo(true)} />
                </Suspense>
              </Box>
            )}
            <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={2} aria-label="Cuadrillas en el mapa">
              {d.posiciones.map((p) => (
                <Box as="li" key={p.cuadrilla_id} layerStyle="tarjeta" p={3} data-testid={`seg-${p.cuadrilla_id}`}>
                  <Flex align="center" gap={2} wrap="wrap">
                    <Link as={RouterLink} to={`/comando/cuadrillas/${p.cuadrilla_id}`} fontWeight={700} display="inline-flex" alignItems="center" minH={{ base: "2.75rem", md: "auto" }}>
                      {p.nombre}
                    </Link>
                    {p.ruta?.simulada && <Chip tono="neutro">Recorrido simulado</Chip>}
                    {p.posicion_vieja && <Chip tono="aviso">Posición vieja</Chip>}
                  </Flex>
                  <Text fontSize="sm" color="textoSuave">
                    {textoLlegada(p)}
                  </Text>
                  <Button as={RouterLink} to={`/comando/cuadrillas/${p.cuadrilla_id}`} size="sm" variant="outline" mt={2} {...TACTIL}>
                    Ver detalle
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    />
  );
}
