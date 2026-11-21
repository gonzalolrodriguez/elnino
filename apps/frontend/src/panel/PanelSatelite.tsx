import { Box, Button, Flex, Text } from "@chakra-ui/react";

import { EstadoCargando } from "../components/EstadoCargando";
import { AlertaError, CampoSelect } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { Opcion } from "../components/Opcion";
import { hexDe } from "../estilo/paleta";
import type { Carga } from "../lib/useCarga";
import { etiquetaEscena, LEYENDA_SATELITE, textoCobertura, textoNubes, type CatalogoSatelite, type EscenaSatelite } from "./satelite";
import { fmtFecha, fmtM, fmtNum, Seccion } from "./ui";

type Cargado = Carga<CatalogoSatelite | null> & { recargar: () => void };

/** Dato de la escena: rótulo arriba y valor debajo, en una rejilla de dos columnas (13 px el rótulo, valor tabular). */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box minW={0}>
      <Text as="dt" textStyle="rotulo" color="textoSuave">
        {etiqueta}
      </Text>
      <Text as="dd" m={0} sx={{ fontVariantNumeric: "tabular-nums" }}>
        {children}
      </Text>
    </Box>
  );
}

function FichaEscena({ e }: { e: EscenaSatelite }) {
  return (
    <Box data-testid="satelite-escena" mt={4}>
      <Box as="dl" m={0} display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" columnGap={4} rowGap={3}>
        <Dato etiqueta="Sensor">
          {e.sensor} ({e.tipo})
        </Dato>
        <Dato etiqueta="Agua en la zona">{e.area_agua_km2 === null ? "sin dato" : `${fmtNum(e.area_agua_km2, 2)} km²`}</Dato>
        <Dato etiqueta="Nubes">{textoNubes(e)}</Dato>
        <Dato etiqueta="Cobertura de la zona">{textoCobertura(e)}</Dato>
      </Box>
      <Flex align="center" gap={2} wrap="wrap" mt={3} data-testid="satelite-k1">
        <Text>
          Río en Puerto Formosa ese día ({fmtFecha(e.fecha_k1)}): <strong>{fmtM(e.altura_k1_m)}</strong>
        </Text>
        <Insignia categoria="DATO OBSERVADO" />
      </Flex>
      {e.evento && (
        <Text textStyle="microdato" mt={2}>
          {e.evento}.
        </Text>
      )}
    </Box>
  );
}

/**
 * Capa "Agua observada por satélite" del mapa operativo: casilla para encenderla, selector de fecha (las ocho escenas)
 * y los datos de la escena elegida. Los GeoJSON y la lista se piden recién al encenderla.
 */
export function PanelSatelite({
  activa,
  setActiva,
  carga,
  escenaId,
  setEscenaId,
}: {
  activa: boolean;
  setActiva: (v: boolean) => void;
  carga: Cargado;
  escenaId: string | null;
  setEscenaId: (id: string) => void;
}) {
  const catalogo = carga.datos;
  const escena = catalogo?.escenas.find((e) => e.id === escenaId) ?? null;
  return (
    <Seccion titulo="Imágenes de satélite" categoria="DOCUMENTO DE REFERENCIA" id="sec-satelite">
      <Opcion etiqueta="Agua observada por satélite" isChecked={activa} onChange={setActiva} id="satelite-activar" />
      {!activa && (
        <Text textStyle="microdato" mt={2}>
          Muestra dónde vio agua el satélite en una fecha pasada, sobre el corredor de Puerto Formosa. No es un pronóstico.
        </Text>
      )}
      {activa && carga.estado === "cargando" && <EstadoCargando py={4} />}
      {activa && carga.estado === "error" && (
        <Box mt={3}>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </Box>
      )}
      {activa && catalogo && escena && (
        <>
          <Box mt={3}>
            <CampoSelect id="satelite-fecha" etiqueta="Fecha de la imagen" value={escena.id} onChange={(ev) => setEscenaId(ev.target.value)}>
              {catalogo.escenas.map((e) => (
                <option key={e.id} value={e.id}>
                  {etiquetaEscena(e)}
                </option>
              ))}
            </CampoSelect>
          </Box>
          <FichaEscena e={escena} />
        </>
      )}
    </Seccion>
  );
}

/** Leyenda de la capa, debajo del mapa (no lo tapa): muestra de color, fuente, categoría y límites del método. */
export function LeyendaSatelite({ escena }: { escena: EscenaSatelite | null }) {
  return (
    <Flex gap={3} align="flex-start" mt={3} data-testid="leyenda-satelite" role="group" aria-label="Leyenda del agua observada por satélite">
      <Box
        aria-hidden="true"
        flexShrink={0}
        w="1.25rem"
        h="1.25rem"
        mt="2px"
        borderRadius="sm"
        border="1.5px solid"
        style={{ background: `${hexDe("agua.600")}80`, borderColor: hexDe("agua.800") }}
      />
      <Box minW={0}>
        <Text textStyle="microdato" maxW="70ch">
          {LEYENDA_SATELITE}
        </Text>
        {escena && (
          <Text textStyle="microdato" mt={1}>
            Contiene datos Copernicus Sentinel modificados [{escena.fecha.slice(0, 4)}].
          </Text>
        )}
      </Box>
    </Flex>
  );
}
