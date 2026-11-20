import { Box, Button, Flex, Text, VisuallyHidden } from "@chakra-ui/react";
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";

import { EstadoCargando } from "../../components/EstadoCargando";
import { acumuladas, largoTotal, minutosRestantes } from "../../lib/animacionRuta";
import { hayWebGL, useMenosMovimiento } from "../../lib/entorno";
import type { RutaPedido } from "../../lib/pedidos";
import { formatearDistancia } from "../../lib/seguimiento";
import type { PropsMapaPedido } from "./MapaPedidoGL";

const MapaPedidoGL = lazy(() => import("./MapaPedidoGL"));

/** A esta distancia del pedido se considera que la cuadrilla llegó. */
const LLEGADA_M = 25;

export const TEXTO_METODO: Record<RutaPedido["metodo"], string> = {
  red_vial: "Recorrido por la red vial (OpenStreetMap)",
  aproximado: "Recorrido aproximado (línea recta × 1,3)",
};

export function textoLlegada(min: number): string {
  if (min < 60) return `Llega en ~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `Llega en ~${h} h` : `Llega en ~${h} h ${m} min`;
}

type Avance = { restanteM: number; largoM: number };

/** Largo de la ruta y lo que falta según el progreso informado por el servidor (valor inicial hasta que el mapa anima). */
function avanceInicial(ruta: RutaPedido): Avance {
  const largoM = largoTotal(acumuladas(ruta.coordenadas));
  const progreso = Math.min(1, Math.max(0, ruta.progreso));
  return { largoM, restanteM: largoM * (1 - progreso) };
}

/** Tarjeta sobre el mapa: llegada en vivo, distancia que falta, método del recorrido y, si es demostración, el rótulo SIMULADO. */
function TarjetaRecorrido({ ruta, avance }: { ruta: RutaPedido; avance: Avance }) {
  const llego = avance.restanteM <= LLEGADA_M || ruta.progreso >= 1;
  const min = minutosRestantes(avance.restanteM, ruta.velocidad_kmh) ?? ruta.llegada_estimada_min;
  const distancia = formatearDistancia(Math.round(avance.restanteM));
  return (
    <Box data-testid="tarjeta-recorrido" bg="superficie" border="1px solid" borderColor="borde" borderRadius="lg" boxShadow="sm" px={3} py={2} maxW="15rem" fontSize="xs">
      {ruta.simulada && (
        <Text data-testid="recorrido-simulado" display="inline-block" mb={1} px={1.5} py="1px" borderRadius="sm" bg="alerta.50" color="alerta.900" border="1px solid" borderColor="alerta.200" fontWeight={700} letterSpacing="0.02em">
          SIMULADO · recorrido de demostración
        </Text>
      )}
      {llego ? (
        <Text data-testid="recorrido-llegada" fontSize="sm" fontWeight={700} lineHeight={1.25}>
          La cuadrilla llegó a tu ubicación
        </Text>
      ) : (
        <>
          <Text data-testid="recorrido-eta" fontSize="sm" fontWeight={700} lineHeight={1.25}>
            {min !== null && min !== undefined ? textoLlegada(min) : "La cuadrilla está en camino"}
          </Text>
          {distancia && (
            <Text data-testid="recorrido-distancia" color="textoSuave">
              Faltan {distancia}
            </Text>
          )}
        </>
      )}
      <Text data-testid="recorrido-metodo" color="textoSuave" mt={0.5}>
        {TEXTO_METODO[ruta.metodo]}
      </Text>
    </Box>
  );
}

/** Mapa del pedido (carga diferida). Sin WebGL no se dibuja el mapa: queda la tarjeta de texto (o nada si no hay ruta). */
export function MapaPedido(props: Omit<PropsMapaPedido, "pedido" | "reducido" | "seguir" | "alCambiarSeguir" | "alAvanzar"> & { pedido: { lon: number | null; lat: number | null } }) {
  const { pedido, cuadrilla, centro, ruta = null, vehiculo = null } = props;
  const reducido = useMenosMovimiento();
  const [seguir, setSeguir] = useState(true);
  const [vivo, setVivo] = useState<Avance | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const ultimoAnuncio = useRef<{ en: number; min: number | null; llego: boolean }>({ en: 0, min: null, llego: false });

  const inicial = useMemo(() => (ruta ? avanceInicial(ruta) : null), [ruta]);
  const avance = vivo ?? inicial;

  const alAvanzar = useCallback(
    (restanteM: number, largoM: number) => {
      setVivo({ restanteM, largoM });
      if (!ruta) return;
      // Aviso para lectores de pantalla: como mucho una vez por minuto, y enseguida al llegar.
      const llego = restanteM <= LLEGADA_M;
      const min = minutosRestantes(restanteM, ruta.velocidad_kmh);
      const u = ultimoAnuncio.current;
      const ahora = Date.now();
      if (llego && !u.llego) {
        ultimoAnuncio.current = { en: ahora, min, llego: true };
        setAnuncio("La cuadrilla llegó a tu ubicación");
      } else if (!llego && min !== null && min !== u.min && ahora - u.en >= 60_000) {
        ultimoAnuncio.current = { en: ahora, min, llego: false };
        setAnuncio(textoLlegada(min));
      }
    },
    [ruta],
  );

  if (pedido.lon === null || pedido.lat === null) return null;
  const punto = { lon: pedido.lon, lat: pedido.lat };

  if (!hayWebGL()) {
    return ruta && avance ? (
      <Box data-testid="mapa-pedido">
        <TarjetaRecorrido ruta={ruta} avance={avance} />
      </Box>
    ) : null;
  }

  return (
    <Box data-testid="mapa-pedido">
      <Box position="relative" h={{ base: "17rem", md: "20rem" }} borderRadius="xl" overflow="hidden" border="1px solid" borderColor="borde" bg="suave" role="group" aria-label={ruta ? "Mapa del recorrido de la cuadrilla hasta tu pedido" : "Mapa de tu pedido"}>
        <Suspense fallback={<EstadoCargando py={10} />}>
          <MapaPedidoGL pedido={punto} cuadrilla={cuadrilla} centro={centro} ruta={ruta} vehiculo={vehiculo} reducido={reducido} seguir={seguir} alCambiarSeguir={setSeguir} alAvanzar={alAvanzar} />
        </Suspense>
        {ruta && avance && (
          <Box position="absolute" top={2} left={2} zIndex={2} pointerEvents="none">
            <TarjetaRecorrido ruta={ruta} avance={avance} />
          </Box>
        )}
      </Box>
      {ruta && (
        <VisuallyHidden role="status" aria-live="polite" data-testid="recorrido-anuncio">
          {anuncio}
        </VisuallyHidden>
      )}
      <Flex gap={4} wrap="wrap" mt={2} fontSize="xs" color="textoSuave" align="center">
        <Flex align="center" gap={1.5}>
          <Box aria-hidden="true" w="0.75rem" h="0.75rem" borderRadius="full" bg="agua.700" />
          <Text>Tu pedido</Text>
        </Flex>
        {(cuadrilla || ruta) && (
          <Flex align="center" gap={1.5}>
            <Box aria-hidden="true" w="0.625rem" h="0.625rem" bg="evacuacion.600" transform={ruta ? undefined : "rotate(45deg)"} borderRadius={ruta ? "full" : undefined} />
            <Text>Cuadrilla</Text>
          </Flex>
        )}
        {centro && (
          <Flex align="center" gap={1.5}>
            <Box aria-hidden="true" w="0.75rem" h="0.75rem" borderRadius="3px" bg="verde.600" />
            <Text>Centro asignado</Text>
          </Flex>
        )}
        {ruta && !reducido && (
          <Button size="xs" variant="outline" ml="auto" onClick={() => setSeguir((s) => !s)} aria-pressed={!seguir} data-testid="alternar-vista">
            {seguir ? "Ver todo el recorrido" : "Seguir a la cuadrilla"}
          </Button>
        )}
      </Flex>
    </Box>
  );
}
