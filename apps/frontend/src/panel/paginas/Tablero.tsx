import { Alert, AlertDescription, AlertIcon, Box, Button, Center, Flex, Heading, SimpleGrid, Spinner, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AlertaError } from "../../components/Formulario";
import { hace, useAhora, useCargaViva } from "../../lib/vivo";
import { api } from "../api";
import { useEscenario } from "../EscenarioContext";
import { AccesosCerrados, BarraEscenario, BloqueCentros, BloqueCuadrillas, BloqueEvacuaciones, BloqueLluvia, BloqueOrdenes, BloqueSolicitudesResumen, CuadrillasLibres, TablaFrescura, TarjetasSectores } from "../tablero/bloques";
import { ColaSolicitudes } from "../tablero/ColaSolicitudes";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { ResumenPanel } from "../tipos";

/** Cada cuánto se vuelve a pedir el resumen aunque no llegue ningún evento de tiempo real. */
export const REFRESCO_TABLERO_MS = 60_000;

function Contenido({ r, decisor, senal }: { r: ResumenPanel; decisor: boolean; senal: number }) {
  return decisor ? (
    <>
      <BarraEscenario rio={r.rio} />
      <TarjetasSectores bloque={r.sectores} />
      <BloqueSolicitudesResumen sol={r.solicitudes} />
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacingX={5} alignItems="start">
        <BloqueCentros bloque={r.centros} />
        <BloqueCuadrillas bloque={r.cuadrillas} />
      </SimpleGrid>
      <BloqueOrdenes bloque={r.ordenes} decisor />
      <BloqueLluvia bloque={r.lluvia_7d} />
      {r.evacuaciones && <BloqueEvacuaciones bloque={r.evacuaciones} />}
      <TablaFrescura resumen={r} />
    </>
  ) : (
    <>
      <ColaSolicitudes senal={senal} />
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacingX={5} alignItems="start">
        <AccesosCerrados sectores={r.sectores.items} />
        <CuadrillasLibres bloque={r.cuadrillas} />
      </SimpleGrid>
      <BarraEscenario rio={r.rio} resumida />
      <TarjetasSectores bloque={r.sectores} />
      <BloqueSolicitudesResumen sol={r.solicitudes} />
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacingX={5} alignItems="start">
        <BloqueCentros bloque={r.centros} />
        <BloqueCuadrillas bloque={r.cuadrillas} />
      </SimpleGrid>
      <BloqueOrdenes bloque={r.ordenes} decisor={false} />
      <BloqueLluvia bloque={r.lluvia_7d} />
      {r.evacuaciones && <BloqueEvacuaciones bloque={r.evacuaciones} />}
      <TablaFrescura resumen={r} />
    </>
  );
}

/**
 * Tablero de decisión. El decisor (y el admin) ve primero el río frente a los umbrales y los sectores; el operador,
 * la cola de pedidos, los accesos cerrados y las cuadrillas libres. Se refresca solo cada 60 s y con los eventos de tiempo real.
 */
export default function Tablero() {
  const { usuario } = useAuth();
  const decisor = usuario?.rol !== "operador";
  const senal = useSenalTiempoReal();
  const { fijarAlturaObservada } = useEscenario();
  const carga = useCargaViva(() => api.resumenPanel(), { cadaMs: REFRESCO_TABLERO_MS, senal });
  const ahora = useAhora();

  const alturaObservada = carga.datos?.rio.disponible ? carga.datos.rio.altura_m : undefined;
  useEffect(() => {
    if (alturaObservada !== undefined) fijarAlturaObservada(alturaObservada);
  }, [alturaObservada, fijarAlturaObservada]);

  return (
    <>
      <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap" mb={4}>
        <Box>
          <Heading as="h1" size="lg">
            Tablero
          </Heading>
          <Text fontSize="sm" color="textoSuave" data-testid="tablero-actualizado">
            {carga.actualizadoEn === null ? "Todavía sin datos" : `Actualizado ${hace(ahora - carga.actualizadoEn)}`} · se renueva solo cada minuto y con cada novedad
          </Text>
        </Box>
        <Flex gap={2} wrap="wrap">
          <Button size="sm" variant="outline" onClick={carga.recargar}>
            Actualizar ahora
          </Button>
          {usuario?.rol === "decisor" && (
            <Button as={RouterLink} to="/comando/ordenes" size="sm" data-testid="tablero-emitir-orden">
              Emitir orden
            </Button>
          )}
        </Flex>
      </Flex>

      {carga.cargando && (
        <Center py={10} role="status" aria-label="Cargando">
          <Spinner />
        </Center>
      )}

      {!carga.cargando && carga.datos === null && (
        <Box mb={4}>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </Box>
      )}

      {carga.datos !== null && carga.error !== null && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={4} data-testid="tablero-sin-actualizar">
          <AlertIcon />
          <AlertDescription>No se pudo actualizar el tablero. Se muestran los datos de {carga.actualizadoEn === null ? "la última lectura" : hace(ahora - carga.actualizadoEn)}.</AlertDescription>
        </Alert>
      )}

      {carga.datos !== null && <Contenido r={carga.datos} decisor={decisor} senal={senal} />}
    </>
  );
}
