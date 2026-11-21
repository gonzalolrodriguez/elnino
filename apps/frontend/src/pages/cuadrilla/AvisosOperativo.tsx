import { Box, Button, Flex, Skeleton, Stack, Text } from "@chakra-ui/react";
import { lazy, Suspense, useState, type ReactElement } from "react";

import { EstadoCargando } from "../../components/EstadoCargando";
import { AlertaError } from "../../components/Formulario";
import { IconoCaja, IconoEscudo, IconoMapa, IconoMegafono, IconoRumbo, IconoTilde } from "../../components/iconos/Iconos";
import { Opcion } from "../../components/Opcion";
import { coordenadasDesvio, ETIQUETA_TIPO_AVISO, guardarTildados, leerTildados, ordenarAvisos, type Aviso, type TipoAviso } from "../../lib/avisos";
import { hayWebGL } from "../../lib/entorno";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { Chip, type TonoChip } from "../../panel/ui";
import type { EstadoAvisos } from "./useAvisos";

const MapaDesvioGL = lazy(() => import("./MapaDesvioGL"));

const ICONO: Record<TipoAviso, ReactElement> = {
  desvio: <IconoRumbo tam="0.9rem" />,
  equipamiento: <IconoCaja tam="0.9rem" />,
  instruccion: <IconoMegafono tam="0.9rem" />,
  seguridad: <IconoEscudo tam="0.9rem" />,
};
const TONO: Record<TipoAviso, TonoChip> = { desvio: "info", equipamiento: "ok", instruccion: "neutro", seguridad: "aviso" };

/** Tipo del aviso: ícono y texto; el color solo refuerza. */
export function ChipTipoAviso({ tipo }: { tipo: TipoAviso }) {
  return (
    <Chip tono={TONO[tipo] ?? "neutro"} icono={ICONO[tipo] ?? ICONO.instruccion} data-testid={`tipo-aviso-${tipo}`}>
      {ETIQUETA_TIPO_AVISO[tipo] ?? "Aviso"}
    </Chip>
  );
}

/** «Qué llevar»: cada elemento se tilda en este dispositivo (se recuerda mientras dure la pestaña). */
function QueLlevar({ avisoId, items }: { avisoId: number; items: string[] }) {
  const [tildados, setTildados] = useState<number[]>(() => leerTildados(avisoId));
  function alternar(i: number) {
    setTildados((t) => {
      const nuevo = t.includes(i) ? t.filter((x) => x !== i) : [...t, i];
      guardarTildados(avisoId, nuevo);
      return nuevo;
    });
  }
  return (
    <Box mt={3} role="group" aria-label="Lista de qué llevar">
      <Text textStyle="microdato" mb={2}>
        {tildados.length} de {items.length} listos · la lista es solo tuya, el operativo no ve lo que tildás.
      </Text>
      <Stack spacing={2}>
        {items.map((it, i) => (
          <Opcion key={`${avisoId}-${i}`} etiqueta={it} isChecked={tildados.includes(i)} onChange={() => alternar(i)} />
        ))}
      </Stack>
    </Box>
  );
}

function DesvioEnMapa({ coordenadas, abiertoAlInicio }: { coordenadas: [number, number][]; abiertoAlInicio: boolean }) {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  const [fallo, setFallo] = useState(false);
  const sinMapa = fallo || !hayWebGL();
  const texto = coordenadas.map(([lo, la]) => `${la.toFixed(5)}, ${lo.toFixed(5)}`).join(" → ");
  return (
    <Box mt={3}>
      <Button size="sm" variant="outline" minH="2.75rem" w={{ base: "full", sm: "auto" }} aria-expanded={abierto} leftIcon={<IconoMapa />} onClick={() => setAbierto((a) => !a)}>
        {abierto ? "Ocultar el desvío en el mapa" : "Ver el desvío en el mapa"}
      </Button>
      {abierto && (
        <Box mt={2}>
          {sinMapa ? (
            <Text textStyle="microdato" data-testid="desvio-texto">
              No se pudo mostrar el mapa en este dispositivo. Desvío (latitud, longitud): {texto}
            </Text>
          ) : (
            <>
              <Box borderWidth="1px" borderRadius="xl" overflow="hidden">
                <Suspense fallback={<Skeleton height="14rem" />}>
                  <MapaDesvioGL coordenadas={coordenadas} onFallo={() => setFallo(true)} />
                </Suspense>
              </Box>
              <Text textStyle="microdato" mt={1}>
                Mapa base: OpenStreetMap (ODbL), documento de referencia. El trazado del desvío lo marcó el operativo.
              </Text>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

function TarjetaAviso({ aviso, alMarcar }: { aviso: Aviso; alMarcar: (id: number) => Promise<unknown> }) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const leido = !!aviso.leido_en;
  const coords = aviso.tipo === "desvio" ? coordenadasDesvio(aviso.geometria) : [];
  const items = (aviso.items ?? []).filter((x) => x.trim() !== "");

  async function marcar() {
    setError(null);
    setTrabajando(true);
    const e = await alMarcar(aviso.id);
    if (e) setError(e);
    setTrabajando(false);
  }

  return (
    <Box as="li" listStyleType="none" data-testid={`aviso-${aviso.id}`} data-leido={leido} p={3} border="1px solid" borderColor={leido ? "borde" : "primario"} borderRadius="lg" bg={leido ? undefined : "suave"}>
      <Flex columnGap={2} rowGap={1} align="center" wrap="wrap" mb={2}>
        <ChipTipoAviso tipo={aviso.tipo} />
        <Chip tono={leido ? "neutro" : "aviso"} icono={leido ? <IconoTilde tam="0.9rem" /> : <IconoMegafono tam="0.9rem" />}>
          {leido ? "Leído" : "Sin leer"}
        </Chip>
        <Text as="time" textStyle="microdato" dateTime={aviso.creado_en}>
          {fechaHora(aviso.creado_en)}
        </Text>
      </Flex>
      <Text fontWeight={leido ? 400 : 600} whiteSpace="pre-wrap" overflowWrap="anywhere">
        {aviso.texto}
      </Text>
      {aviso.tarea_id != null && (
        <Text textStyle="microdato" mt={1}>
          Sobre la tarea n.º {aviso.tarea_id}
        </Text>
      )}
      {aviso.tipo === "equipamiento" && items.length > 0 && <QueLlevar avisoId={aviso.id} items={items} />}
      {coords.length > 0 && <DesvioEnMapa coordenadas={coords} abiertoAlInicio={!leido} />}
      {leido && aviso.leido_por_rol && (
        <Text textStyle="microdato" mt={2}>
          Leído por: {etiquetaRolOperativo(aviso.leido_por_rol)}
        </Text>
      )}
      {!leido && (
        <Button mt={3} size="sm" minH="2.75rem" w={{ base: "full", sm: "auto" }} variant="outline" isLoading={trabajando} onClick={() => void marcar()}>
          Marcar como leído
        </Button>
      )}
      {error !== null && (
        <Box mt={2}>
          <AlertaError error={error} />
        </Box>
      )}
    </Box>
  );
}

/** Cantidad de avisos sin leer (texto + ícono): lleva a la sección de avisos. Es un enlace, no un chip de estado. */
export function InsigniaAvisos({ noLeidos }: { noLeidos: number }) {
  return (
    <Button as="a" href="#sec-avisos" size="sm" variant="outline" minH={{ base: "2.75rem", md: "2rem" }} leftIcon={<IconoMegafono tam="1rem" />} bg={noLeidos > 0 ? "alerta.50" : undefined} borderColor={noLeidos > 0 ? "alerta.200" : undefined} color={noLeidos > 0 ? "alerta.900" : undefined} data-testid="insignia-avisos">
      {noLeidos === 0 ? "Sin avisos nuevos" : noLeidos === 1 ? "1 aviso sin leer" : `${noLeidos} avisos sin leer`}
    </Button>
  );
}

/** Avisos del operativo a la cuadrilla: sin leer primero, con desvío en mapa y lista de qué llevar. */
export function AvisosOperativo({ avisos, estado, error, alMarcar, alReintentar }: { avisos: Aviso[]; estado: EstadoAvisos; error: unknown; alMarcar: (id: number) => Promise<unknown>; alReintentar: () => void }) {
  if (estado === "cargando") return <EstadoCargando />;
  if (estado === "error") {
    return (
      <Box>
        <AlertaError error={error} />
        <Button mt={2} size="sm" minH="2.75rem" variant="outline" onClick={alReintentar}>
          Reintentar
        </Button>
      </Box>
    );
  }
  if (avisos.length === 0) return <Text textStyle="microdato">El operativo no te mandó avisos por ahora.</Text>;
  return (
    <Stack as="ul" m={0} p={0} spacing={3} aria-label="Avisos del operativo">
      {ordenarAvisos(avisos).map((x) => (
        <TarjetaAviso key={x.id} aviso={x} alMarcar={alMarcar} />
      ))}
    </Stack>
  );
}
