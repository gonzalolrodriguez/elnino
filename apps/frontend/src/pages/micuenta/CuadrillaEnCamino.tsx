import { Alert, AlertDescription, AlertIcon, Box, Heading, Spinner, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";

import { Insignia } from "../../components/Insignia";
import { ETIQUETA_TIPO_CUADRILLA, formatearDistancia, formatearLlegada, horaCorta } from "../../lib/seguimiento";
import { useCargaViva } from "../../lib/vivo";
import { api } from "../../panel/api";
import type { SeguimientoCuadrilla } from "../../panel/tipos";

const REFRESCO_MS = 20_000;

function Item({ s }: { s: SeguimientoCuadrilla }) {
  const llegada = formatearLlegada(s.llegada_estimada_min);
  const distancia = formatearDistancia(s.distancia_m);
  const hora = horaCorta(s.actualizada_en);
  const tipo = ETIQUETA_TIPO_CUADRILLA[s.tipo_cuadrilla] ?? s.tipo_cuadrilla;
  return (
    <Box as="article" aria-label={`Cuadrilla del pedido ${s.solicitud_id}`} layerStyle="tarjeta" p={4} mb={3} data-testid={`seguimiento-${s.solicitud_id}`}>
      <Text fontSize="sm" color="textoSuave" mb={1}>
        Pedido n.º {s.solicitud_id} · cuadrilla {tipo}
      </Text>
      {s.estado === "asignada_sin_posicion" ? (
        <Text fontWeight={600} data-testid="seguimiento-sin-posicion">
          Una cuadrilla tomó tu pedido. Todavía no recibimos su posición: apenas la comparta, la vas a ver acá.
        </Text>
      ) : (
        <>
          <Text fontWeight={700} fontSize="lg" data-testid="seguimiento-estado">
            {distancia ? `A ${distancia} de tu pedido` : "La cuadrilla está en camino"}
            {llegada ? ` · llegada estimada: ${llegada}` : ""}
          </Text>
          {!llegada && (
            <Text fontSize="sm">No podemos calcular la llegada porque tu pedido no tiene una ubicación exacta. Un operador la va a verificar.</Text>
          )}
          {hora && (
            <Text fontSize="sm" color="textoSuave">
              Última posición recibida a las {hora}.
            </Text>
          )}
          {s.posicion_vieja && (
            <Alert status="warning" fontSize="sm" mt={2} role="status" data-testid="seguimiento-vieja">
              <AlertIcon />
              <AlertDescription>
                La última posición tiene más de {s.supuestos.posicion_vieja_minutos} minutos, así que la distancia y la llegada pueden no ser confiables. Si es urgente, llamá al 103.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
      <Text fontSize="xs" color="textoSuave" mt={2}>
        Es una estimación (SUPUESTO: línea recta por un factor de desvío de {String(s.supuestos.factor_desvio).replace(".", ",")} y una velocidad media de {s.supuestos.velocidad_cuadrilla_kmh} km/h), no una promesa de llegada.{" "}
        <Insignia categoria={CATEGORIAS.SIMULADO} />
      </Text>
    </Box>
  );
}

/**
 * «Cuadrilla en camino»: para cada pedido propio con una tarea en curso, distancia y llegada estimada de la cuadrilla.
 * Se refresca sola cada 20 s mientras la pestaña está visible. Sin pedidos en curso no muestra nada.
 */
export function CuadrillaEnCamino() {
  const carga = useCargaViva(() => api.miSeguimiento(), { cadaMs: REFRESCO_MS });
  const lista = carga.datos?.seguimientos ?? [];
  if (carga.cargando) return null;
  if (carga.datos === null && carga.error === null) return null;
  if (carga.datos !== null && lista.length === 0 && carga.error === null) return null;
  return (
    <Box as="section" aria-label="Cuadrilla en camino" py={5} borderTop="1px solid" borderColor="borde" data-testid="cuadrilla-en-camino">
      <Heading as="h2" size="md" mb={3}>
        Cuadrilla en camino
      </Heading>
      {carga.datos === null && carga.error !== null && (
        <Alert status="error" fontSize="sm" role="alert" data-testid="seguimiento-error">
          <AlertIcon />
          No pudimos consultar el seguimiento de tu pedido. Vamos a reintentar solos; si es urgente, llamá al 103.
        </Alert>
      )}
      {lista.map((s) => (
        <Item key={s.tarea_id} s={s} />
      ))}
      {carga.datos !== null && carga.error !== null && (
        <Text fontSize="xs" color="textoSuave" role="status" data-testid="seguimiento-sin-actualizar">
          <Spinner size="xs" mr={1} /> No pudimos actualizar el seguimiento; te mostramos lo último que recibimos.
        </Text>
      )}
    </Box>
  );
}
