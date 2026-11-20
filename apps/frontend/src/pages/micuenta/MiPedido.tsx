import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { CATEGORIAS } from "@evacuaciones/shared";

import { IconoEdificio, IconoPersonas, IconoReloj, IconoTriangulo, IconoVehiculo } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { etiquetaTipoSolicitud, etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { ETAPAS, etiquetaVehiculo, pideConfirmacion, rutaDe, type Pedido } from "../../lib/pedidos";
import { ETIQUETA_TIPO_CUADRILLA, formatearDistancia, formatearLlegada, horaCorta } from "../../lib/seguimiento";
import { ConfirmacionPedido } from "./ConfirmacionPedido";
import { LineaTiempoPedido } from "./LineaTiempoPedido";
import { MapaPedido } from "./MapaPedido";
import { FichaIcono, Vacio } from "./Panel";

/** Cifra grande con su rótulo, sobre el fondo oscuro de la cabecera del pedido. */
function CifraSeguimiento({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Box minW={0}>
      <Text fontSize="sm" color="oscuro.suave">
        {rotulo}
      </Text>
      <Text textStyle="cifraMedia" fontSize={{ base: "1.75rem", md: "2.25rem" }} color="oscuro.fg" mt={0.5}>
        {valor}
      </Text>
    </Box>
  );
}

/** Cabecera: lo que pasa ahora (en palabras) y, si hay seguimiento, la llegada estimada y la distancia como cifras. */
function CabeceraSeguimiento({ p }: { p: Pedido }) {
  const s = p.seguimiento;
  const ahora = ETAPAS[p.estado]?.larga ?? "Tu pedido está en curso";
  if (!s) {
    return (
      <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} lineHeight={1.2} letterSpacing="-0.015em">
        {ahora}
      </Text>
    );
  }
  if (s.estado === "asignada_sin_posicion") {
    return (
      <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} lineHeight={1.25} letterSpacing="-0.015em" maxW="38rem" data-testid="seguimiento-sin-posicion">
        Una cuadrilla tomó tu pedido. Todavía no recibimos su posición: apenas la comparta, la vas a ver acá.
      </Text>
    );
  }
  const llegada = formatearLlegada(s.llegada_estimada_min);
  const distancia = formatearDistancia(s.distancia_m);
  return (
    <Flex direction={{ base: "column", lg: "row" }} align={{ lg: "flex-end" }} justify="space-between" gap={{ base: 4, lg: 8 }}>
      <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight={700} lineHeight={1.2} letterSpacing="-0.015em" maxW="22rem">
        {ahora}
      </Text>
      <Flex gap={{ base: 8, md: 12 }} wrap="wrap" data-testid="seguimiento-estado">
        {llegada && <CifraSeguimiento rotulo="Llegada estimada" valor={llegada} />}
        {distancia && <CifraSeguimiento rotulo="Distancia a tu pedido" valor={distancia} />}
        {!llegada && !distancia && <Text fontSize="sm">La cuadrilla está en camino.</Text>}
      </Flex>
    </Flex>
  );
}

function NotasSeguimiento({ p }: { p: Pedido }) {
  const s = p.seguimiento;
  if (!s) return null;
  const llegada = formatearLlegada(s.llegada_estimada_min);
  const hora = horaCorta(s.actualizada_en);
  const conPosicion = s.estado !== "asignada_sin_posicion";
  return (
    <Box data-testid={`seguimiento-${s.solicitud_id}`}>
      {conPosicion && !llegada && (
        <Text fontSize="sm" mb={1}>
          No podemos calcular la llegada porque tu pedido no tiene una ubicación exacta. Un operador la va a verificar.
        </Text>
      )}
      {conPosicion && hora && (
        <Flex align="center" gap={1.5} fontSize="sm" color="textoSuave">
          <IconoReloj tam="1rem" />
          <Text>Última posición recibida a las {hora}.</Text>
        </Flex>
      )}
      {conPosicion && s.posicion_vieja && (
        <Flex align="flex-start" gap={2} mt={2} p={3} borderRadius="xl" bg="alerta.50" border="1px solid" borderColor="alerta.200" color="alerta.900" fontSize="sm" role="status" data-testid="seguimiento-vieja">
          <Box aria-hidden="true" display="flex" mt="2px" color="alerta.700">
            <IconoTriangulo tam="1rem" />
          </Box>
          <Text>La última posición tiene más de {s.supuestos.posicion_vieja_minutos} minutos, así que la distancia y la llegada pueden no ser confiables. Si es urgente, llamá al 103.</Text>
        </Flex>
      )}
      <Text fontSize="xs" color="textoSuave" mt={2}>
        Es una estimación (SUPUESTO: línea recta por un factor de desvío de {String(s.supuestos.factor_desvio).replace(".", ",")} y una velocidad media de {s.supuestos.velocidad_cuadrilla_kmh} km/h), no una promesa de llegada.
      </Text>
    </Box>
  );
}

/** «Mi pedido activo»: qué pasa ahora, línea de tiempo, cuadrilla por rol y vehículo, llegada estimada, mapa y confirmación. */
export function MiPedido({ pedido: p, alResponder }: { pedido: Pedido; alResponder: () => void }) {
  const cuad = p.tarea?.cuadrilla ?? null;
  const vehiculo = etiquetaVehiculo(cuad?.vehiculo);
  const posicion = p.seguimiento?.posicion ?? null;
  const tipoCuadrilla = cuad ? (ETIQUETA_TIPO_CUADRILLA[cuad.tipo_incidente] ?? cuad.tipo_incidente) : null;
  return (
    <Box as="section" aria-labelledby="mi-pedido" bg="superficie" border="1px solid" borderColor="borde" borderRadius="2xl" overflow="hidden" data-testid={`pedido-activo-${p.id}`}>
      <Box className="sobre-oscuro" bg="limo.900" color="oscuro.fg" px={{ base: 4, md: 6 }} py={{ base: 5, md: 6 }}>
        <Flex align="center" gap={3} wrap="wrap" mb={1}>
          <Heading as="h2" id="mi-pedido" size="md" color="oscuro.fg">
            Mi pedido activo
          </Heading>
          <Insignia categoria={CATEGORIAS.SIMULADO} />
        </Flex>
        <Text color="oscuro.suave" fontSize="sm" mb={5}>
          Pedido n.º {p.id} · {etiquetaTipoSolicitud(p.tipo)}
          {p.personas !== null ? ` · ${p.personas} ${p.personas === 1 ? "persona" : "personas"}` : ""} · enviado el {fechaHora(p.creada_en)}
        </Text>
        <CabeceraSeguimiento p={p} />
      </Box>

      <Box p={{ base: 4, md: 6 }}>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 17rem) minmax(0, 1fr)" }} columnGap={10} rowGap={6} alignItems="start">
          <LineaTiempoPedido pedido={p} />
          <Flex direction="column" gap={4} minW={0}>
            {cuad ? (
              <Flex gap={3.5} align="flex-start" data-testid="cuadrilla-asignada">
                <FichaIcono tono="tinta" tam="3rem">
                  <IconoVehiculo vehiculo={cuad.vehiculo} tam="1.5rem" />
                </FichaIcono>
                <Box minW={0}>
                  <Text fontWeight={700} lineHeight={1.3}>
                    Cuadrilla {tipoCuadrilla}
                  </Text>
                  <Text fontSize="sm" color="textoSuave">
                    {cuad.rol_encargado ? `Encargado: ${etiquetaRolOperativo(cuad.rol_encargado)}` : "Encargado sin rol informado"}
                  </Text>
                  <Flex align="center" gap={2} wrap="wrap" mt={1.5}>
                    {vehiculo && (
                      <Flex as="span" align="center" gap={1.5} px={2.5} py="2px" borderRadius="full" bg="limo.50" color="limo.800" fontSize="sm" fontWeight={600}>
                        <IconoVehiculo vehiculo={cuad.vehiculo} tam="1rem" />
                        {vehiculo}
                      </Flex>
                    )}
                    <Insignia categoria={CATEGORIAS.SIMULADO} />
                  </Flex>
                </Box>
              </Flex>
            ) : (
              <Vacio icono={<IconoPersonas />} data-testid="sin-cuadrilla">
                Todavía no hay una cuadrilla asignada. Cuando la haya, vas a ver acá quién va, en qué vehículo y cuánto falta.
              </Vacio>
            )}
            {p.centro && (
              <Flex gap={3.5} align="center" data-testid="centro-pedido">
                <FichaIcono tono="verde" tam="3rem">
                  <IconoEdificio tam="1.5rem" />
                </FichaIcono>
                <Box minW={0}>
                  <Text fontSize="sm" color="textoSuave">
                    Centro de destino: <strong>{p.centro.nombre}</strong>
                  </Text>
                  <Insignia categoria={CATEGORIAS.SIMULADO} />
                </Box>
              </Flex>
            )}
            {p.lat !== null && p.lon !== null && (
              <MapaPedido pedido={{ lat: p.lat, lon: p.lon }} cuadrilla={posicion ? { lat: posicion.lat, lon: posicion.lon } : null} centro={p.centro} ruta={rutaDe(p)} vehiculo={cuad?.vehiculo ?? null} />
            )}
            <NotasSeguimiento p={p} />
          </Flex>
        </Box>

        {pideConfirmacion(p) && (
          <Box mt={6}>
            <ConfirmacionPedido solicitudId={p.id} codigo={p.confirmacion?.codigo} alResponder={alResponder} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
