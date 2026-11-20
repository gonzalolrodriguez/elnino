import { Alert, AlertDescription, AlertIcon, Box, Button, Center, SimpleGrid, Spinner } from "@chakra-ui/react";
import { useEffect, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { CATEGORIAS } from "@evacuaciones/shared";

import { useAuth } from "../../auth/AuthContext";
import { TresRelojes } from "../../components/TresRelojes";
import { AlertaError } from "../../components/Formulario";
import { IconoMegafono } from "../../components/iconos/Iconos";
import { hace, useAhora, useCargaViva } from "../../lib/vivo";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { useEscenario } from "../EscenarioContext";
import { IconoActualizar, IconoTablero } from "../iconos";
import { AccesosCerrados, BarraEscenario, BloqueCentros, BloqueCuadrillas, BloqueEvacuaciones, BloqueLluvia, BloqueOrdenes, BloqueSolicitudesResumen, CuadrillasLibres, TablaFrescura, TarjetasSectores } from "../tablero/bloques";
import { ColaSolicitudes } from "../tablero/ColaSolicitudes";
import { ResumenSituacion } from "../tablero/ResumenSituacion";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { ResumenPanel } from "../tipos";

/** Cada cuánto se vuelve a pedir el resumen aunque no llegue ningún evento de tiempo real. */
export const REFRESCO_TABLERO_MS = 60_000;

/** Dos columnas desde 1280 px: la principal (pedidos, centros, lluvia) y la lateral (cuadrillas, órdenes, frescura). */
function DosColumnas({ principal, lateral }: { principal: ReactNode; lateral: ReactNode }) {
  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} templateColumns={{ xl: "minmax(0, 1.25fr) minmax(0, 1fr)" }} columnGap={5} alignItems="start">
      <Box minW={0}>{principal}</Box>
      <Box minW={0}>{lateral}</Box>
    </SimpleGrid>
  );
}

function Contenido({ r, decisor, senal }: { r: ResumenPanel; decisor: boolean; senal: number }) {
  const columnas = (
    <DosColumnas
      principal={
        <>
          <BloqueSolicitudesResumen sol={r.solicitudes} />
          <BloqueCentros bloque={r.centros} />
          <BloqueLluvia bloque={r.lluvia_7d} />
        </>
      }
      lateral={
        <>
          <BloqueCuadrillas bloque={r.cuadrillas} />
          {/* NovedadesCuadrillas: lo inserta la integración */}
          <BloqueOrdenes bloque={r.ordenes} decisor={decisor} />
          <TablaFrescura resumen={r} />
        </>
      }
    />
  );
  return (
    <>
      <ResumenSituacion resumen={r} />
      {decisor ? (
        <>
          <BarraEscenario rio={r.rio} />
          <TarjetasSectores bloque={r.sectores} />
        </>
      ) : (
        <>
          <ColaSolicitudes senal={senal} />
          <SimpleGrid columns={{ base: 1, xl: 2 }} columnGap={5} alignItems="start">
            <AccesosCerrados sectores={r.sectores.items} />
            <CuadrillasLibres bloque={r.cuadrillas} />
          </SimpleGrid>
          <BarraEscenario rio={r.rio} resumida />
          <TarjetasSectores bloque={r.sectores} />
        </>
      )}
      {columnas}
      {r.evacuaciones && <BloqueEvacuaciones bloque={r.evacuaciones} />}
    </>
  );
}

/**
 * Tablero de decisión. Arriba, una franja con las cifras que más pesan; el decisor (y el admin) ve después el río frente
 * a los umbrales y los sectores; el operador, la cola de pedidos, los accesos cerrados y las cuadrillas libres. Se
 * refresca solo cada 60 s y con los eventos de tiempo real.
 */
export default function Tablero() {
  const { usuario } = useAuth();
  const decisor = usuario?.rol !== "operador";
  const senal = useSenalTiempoReal();
  const { entrada, escenarioSimulado, fijarAlturaObservada } = useEscenario();
  const carga = useCargaViva(() => api.resumenPanel(), { cadaMs: REFRESCO_TABLERO_MS, senal });
  const ahora = useAhora();

  const alturaObservada = carga.datos?.rio.disponible ? carga.datos.rio.altura_m : undefined;
  useEffect(() => {
    if (alturaObservada !== undefined) fijarAlturaObservada(alturaObservada);
  }, [alturaObservada, fijarAlturaObservada]);

  return (
    <>
      <CabeceraPagina
        titulo="Tablero"
        icono={<IconoTablero tam="1.5rem" />}
        ayuda={decisor ? "La situación del río y de los sectores, y lo que falta para decidir." : "Lo que espera atención ahora: pedidos, accesos cerrados y cuadrillas libres."}
        actualizadoId="tablero-actualizado"
        actualizado={`${carga.actualizadoEn === null ? "Todavía sin datos" : `Actualizado ${hace(ahora - carga.actualizadoEn)}`} · se renueva solo cada minuto y con cada novedad`}
        acciones={
          <>
            <Button size="sm" variant="outline" onClick={carga.recargar} leftIcon={<IconoActualizar tam="1.125rem" />}>
              Actualizar ahora
            </Button>
            {usuario?.rol === "decisor" && (
              <Button as={RouterLink} to="/comando/ordenes" size="sm" data-testid="tablero-emitir-orden" leftIcon={<IconoMegafono tam="1.125rem" />}>
                Emitir orden
              </Button>
            )}
          </>
        }
      />

      <TresRelojes
        variante="compacta"
        alturaM={entrada.altura_formosa_m}
        alturaCategoria={escenarioSimulado ? CATEGORIAS.SIMULADO : CATEGORIAS.OBSERVADO}
        lluviaMm={entrada.lluvia_mm > 0 ? entrada.lluvia_mm : undefined}
      />

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
