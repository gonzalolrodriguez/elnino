import { Alert, AlertDescription, AlertIcon, Box, Flex, Heading, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";

import { Insignia } from "../../components/Insignia";
import { etiquetaTipoSolicitud, etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { etiquetaVehiculo, pideConfirmacion, type Pedido } from "../../lib/pedidos";
import { ETIQUETA_TIPO_CUADRILLA, formatearDistancia, formatearLlegada, horaCorta } from "../../lib/seguimiento";
import { ConfirmacionPedido } from "./ConfirmacionPedido";
import { LineaTiempoPedido } from "./LineaTiempoPedido";
import { MapaPedido } from "./MapaPedido";

function Seguimiento({ p }: { p: Pedido }) {
  const s = p.seguimiento;
  if (!s) return null;
  const llegada = formatearLlegada(s.llegada_estimada_min);
  const distancia = formatearDistancia(s.distancia_m);
  const hora = horaCorta(s.actualizada_en);
  return (
    <Box data-testid={`seguimiento-${s.solicitud_id}`}>
      {s.estado === "asignada_sin_posicion" ? (
        <Text fontWeight={600} data-testid="seguimiento-sin-posicion">
          Una cuadrilla tomó tu pedido. Todavía no recibimos su posición: apenas la comparta, la vas a ver acá.
        </Text>
      ) : (
        <>
          <Text fontWeight={700} fontSize="xl" lineHeight={1.25} data-testid="seguimiento-estado">
            {distancia ? `A ${distancia} de tu pedido` : "La cuadrilla está en camino"}
            {llegada ? ` · llegada estimada: ${llegada}` : ""}
          </Text>
          {!llegada && <Text fontSize="sm">No podemos calcular la llegada porque tu pedido no tiene una ubicación exacta. Un operador la va a verificar.</Text>}
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
        Es una estimación (SUPUESTO: línea recta por un factor de desvío de {String(s.supuestos.factor_desvio).replace(".", ",")} y una velocidad media de {s.supuestos.velocidad_cuadrilla_kmh} km/h), no una promesa de llegada.
      </Text>
    </Box>
  );
}

/** «Mi pedido activo»: tipo, línea de tiempo, cuadrilla por rol y vehículo, llegada estimada, mapa y confirmación. */
export function MiPedido({ pedido: p, alResponder }: { pedido: Pedido; alResponder: () => void }) {
  const cuad = p.tarea?.cuadrilla ?? null;
  const vehiculo = etiquetaVehiculo(cuad?.vehiculo);
  const posicion = p.seguimiento?.posicion ?? null;
  const tipoCuadrilla = cuad ? (ETIQUETA_TIPO_CUADRILLA[cuad.tipo_incidente] ?? cuad.tipo_incidente) : null;
  return (
    <Box as="section" aria-labelledby="mi-pedido" layerStyle="tarjeta" p={{ base: 4, md: 6 }} mb={5} data-testid={`pedido-activo-${p.id}`}>
      <Flex align="baseline" gap={3} wrap="wrap" mb={1}>
        <Heading as="h2" id="mi-pedido" size="md">
          Mi pedido activo
        </Heading>
        <Insignia categoria={CATEGORIAS.SIMULADO} />
      </Flex>
      <Text color="textoSuave" fontSize="sm" mb={4}>
        Pedido n.º {p.id} · {etiquetaTipoSolicitud(p.tipo)}
        {p.personas !== null ? ` · ${p.personas} ${p.personas === 1 ? "persona" : "personas"}` : ""} · enviado el {fechaHora(p.creada_en)}
      </Text>

      <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 16rem) minmax(0, 1fr)" }} columnGap={8} rowGap={5} alignItems="start">
        <LineaTiempoPedido pedido={p} />
        <Box>
          {cuad ? (
            <Box mb={3} data-testid="cuadrilla-asignada">
              <Text fontWeight={700}>Cuadrilla {tipoCuadrilla}</Text>
              <Text fontSize="sm">
                {cuad.rol_encargado ? `Encargado: ${etiquetaRolOperativo(cuad.rol_encargado)}` : "Encargado sin rol informado"}
                {vehiculo ? ` · Vehículo: ${vehiculo}` : ""} <Insignia categoria={CATEGORIAS.SIMULADO} />
              </Text>
            </Box>
          ) : (
            <Text mb={3} data-testid="sin-cuadrilla">
              Todavía no hay una cuadrilla asignada. Cuando la haya, vas a ver acá quién va, en qué vehículo y cuánto falta.
            </Text>
          )}
          <Seguimiento p={p} />
          {p.centro && (
            <Text fontSize="sm" mt={3} data-testid="centro-pedido">
              Centro de destino: <strong>{p.centro.nombre}</strong> <Insignia categoria={CATEGORIAS.SIMULADO} />
            </Text>
          )}
          {p.lat !== null && p.lon !== null && (
            <Box mt={4}>
              <MapaPedido pedido={{ lat: p.lat, lon: p.lon }} cuadrilla={posicion ? { lat: posicion.lat, lon: posicion.lon } : null} centro={p.centro} />
            </Box>
          )}
        </Box>
      </Box>

      {pideConfirmacion(p) && (
        <Box mt={5}>
          <ConfirmacionPedido solicitudId={p.id} alResponder={alResponder} />
        </Box>
      )}
    </Box>
  );
}
