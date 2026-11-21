import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  List,
  ListItem,
  SimpleGrid,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { TIPOS_ORDEN, type TipoOrden } from "@evacuaciones/shared";
import { type ReactNode, useRef, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { Campo, CampoArea, CampoSelect, AlertaError } from "../../components/Formulario";
import { IconoAlerta, IconoInfo, IconoMegafono, IconoReloj } from "../../components/iconos/Iconos";
import { Opcion } from "../../components/Opcion";
import { etiquetaOrigenLluvia, etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { useEscenario } from "../EscenarioContext";
import type { Orden } from "../tipos";
import { Cargando, Chip, fmtM, Seccion, type TonoChip } from "../ui";

const TEXTO_TIPO: Record<TipoOrden, string> = {
  alerta: "Alerta",
  evacuacion_preventiva: "Evacuación preventiva",
  evacuacion: "Evacuación",
};
/** Qué significa cada tipo, para elegirlo sin dudar. */
const AYUDA_TIPO: Record<TipoOrden, string> = {
  alerta: "Avisa del riesgo; no pide que nadie se mueva todavía.",
  evacuacion_preventiva: "Pide salir antes de que el sector se comprometa, mientras los caminos están secos.",
  evacuacion: "Pide salir ya: el sector está comprometido o aislado.",
};
const ASPECTO_TIPO: Record<TipoOrden, { tono: TonoChip; icono: ReactNode }> = {
  alerta: { tono: "info", icono: <IconoInfo tam="1em" /> },
  evacuacion_preventiva: { tono: "aviso", icono: <IconoReloj tam="1em" /> },
  evacuacion: { tono: "alerta", icono: <IconoAlerta tam="1em" /> },
};
const SECTORES = ["S1", "S2", "S3", "S4"];
const MAX_FUNDAMENTO = 2000;

/** Sectores válidos del parámetro `?sectores=S4,S3` (los que no existen se descartan). */
function sectoresDeLaUrl(valor: string | null): string[] {
  if (!valor) return [];
  const pedidos = valor.split(",").map((x) => x.trim().toUpperCase());
  return SECTORES.filter((s) => pedidos.includes(s));
}

function errorDelFundamento(texto: string): string | null {
  if (texto.trim().length < 10) return "El fundamento debe tener al menos 10 caracteres.";
  if (texto.trim().length > MAX_FUNDAMENTO) return `El fundamento no puede pasar de ${MAX_FUNDAMENTO.toLocaleString("es-AR")} caracteres.`;
  return null;
}

function FormOrden({ alEmitir }: { alEmitir: (o: Orden) => void }) {
  const { usuario } = useAuth();
  const { entrada, escenario, desactualizado } = useEscenario();
  const esDecisor = usuario?.rol === "decisor";
  const dialogo = useDisclosure();
  const cancelar = useRef<HTMLButtonElement>(null);
  const [tipo, setTipo] = useState<TipoOrden>("evacuacion_preventiva");
  const [params] = useSearchParams();
  // Si llegan sectores por la URL (botón "Preparar orden" de Recomendación) mandan sobre los del escenario calculado.
  const deLaUrl = useRef(sectoresDeLaUrl(params.get("sectores")));
  const [sectores, setSectores] = useState<string[]>(() => {
    if (deLaUrl.current.length > 0) return deLaUrl.current;
    return escenario && !desactualizado ? escenario.resumen.comprometidos : [];
  });
  const [fundamento, setFundamento] = useState("");
  const [fecha, setFecha] = useState("");
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  // Una clave por envío: un reintento del mismo envío (red caída, doble clic) no emite la orden dos veces.
  const claveEnvio = useRef<{ clave: string; firma: string } | null>(null);

  const errorFundamento = intento ? errorDelFundamento(fundamento) : null;
  const errorSectores = intento && sectores.length === 0 ? "Elegí al menos un sector." : null;

  function revisar() {
    setIntento(true);
    if (errorDelFundamento(fundamento) || sectores.length === 0) return;
    dialogo.onOpen();
  }

  async function emitir() {
    if (emitiendo) return;
    setEmitiendo(true);
    setError(null);
    try {
      const cuerpo = { tipo, sectores, fundamento: fundamento.trim(), ...(fecha ? { fecha_simulada: fecha } : {}) };
      // Misma clave mientras el envío sea el mismo; si se editó el formulario, es otro envío.
      const firma = JSON.stringify(cuerpo);
      if (claveEnvio.current?.firma !== firma) claveEnvio.current = { clave: crypto.randomUUID(), firma };
      const o = await api.emitirOrden(cuerpo, claveEnvio.current.clave);
      claveEnvio.current = null;
      dialogo.onClose();
      setFundamento("");
      setIntento(false);
      alEmitir(o);
    } catch (e) {
      dialogo.onClose();
      setError(e);
    } finally {
      setEmitiendo(false);
    }
  }

  const ayudaSectores = deLaUrl.current.length > 0 ? "Vienen de la recomendación; podés cambiarlos." : "Elegí los sectores que recibirán la orden.";

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); revisar(); }} noValidate maxW="46rem">
      {!esDecisor && (
        <Alert status="info" mb={4} data-testid="aviso-solo-decisor">
          <AlertIcon />
          <AlertDescription>
            Solo el decisor puede emitir órdenes. Con tu rol podés preparar la recomendación y la bitácora, pero el formulario queda deshabilitado: la orden la emite una persona autorizada y queda registrada con su rol.
          </AlertDescription>
        </Alert>
      )}
      <Box as="fieldset" disabled={!esDecisor} border="none" m={0} p={0} minW={0} display="grid" rowGap={5}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <CampoSelect id="orden-tipo" etiqueta="Tipo de orden" ayuda={AYUDA_TIPO[tipo]} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOrden)}>
            {TIPOS_ORDEN.map((t) => (
              <option key={t} value={t}>
                {TEXTO_TIPO[t]}
              </option>
            ))}
          </CampoSelect>
          <Campo id="orden-fecha" type="date" etiqueta="Día simulado (opcional)" ayuda="El día del escenario que queda en el registro." value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </SimpleGrid>

        <FormControl as="fieldset" isInvalid={!!errorSectores} minW={0}>
          <Text as="legend" fontWeight={600} fontSize="sm" color="texto" mb={0.5}>
            Sectores <span aria-hidden="true">*</span>
          </Text>
          <Text textStyle="microdato" mb={2}>
            {ayudaSectores}
          </Text>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
            {SECTORES.map((s) => (
              <Opcion
                key={s}
                etiqueta={s}
                isChecked={sectores.includes(s)}
                isInvalid={!!errorSectores}
                onChange={(marcado) => setSectores((x) => (marcado ? [...x, s] : x.filter((i) => i !== s)))}
              />
            ))}
          </SimpleGrid>
          <FormErrorMessage>{errorSectores}</FormErrorMessage>
        </FormControl>

        <CampoArea
          id="orden-fundamento"
          etiqueta="Fundamento"
          isRequired
          rows={4}
          value={fundamento}
          onChange={(e) => setFundamento(e.target.value)}
          error={errorFundamento ?? undefined}
          ayuda={`Citá la evidencia. Escenario de referencia: ${fmtM(entrada.altura_formosa_m)} en Puerto Formosa y ${entrada.lluvia_mm} mm de lluvia (${etiquetaOrigenLluvia(entrada.lluvia_origen).toLowerCase()}).`}
        />

        <Box>
          <Button type="submit" w={{ base: "100%", md: "auto" }} isDisabled={!esDecisor || emitiendo}>
            Revisar y emitir orden
          </Button>
        </Box>
      </Box>
      <Box mt={3}>
        <AlertaError error={error} />
      </Box>

      <AlertDialog isOpen={dialogo.isOpen} leastDestructiveRef={cancelar} onClose={dialogo.onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader textStyle="tituloBloque">Emitir orden</AlertDialogHeader>
            <AlertDialogBody>
              <Text>
                Vas a emitir una orden de <strong>{TEXTO_TIPO[tipo].toLowerCase()}</strong> para los sectores <strong>{sectores.join(", ")}</strong>.
              </Text>
              <List mt={3} spacing={1} styleType="disc" pl={5} color="textoSuave">
                <ListItem>Se notifica a quienes viven o producen en esos sectores.</ListItem>
                <ListItem>Se crean tareas para las cuadrillas.</ListItem>
                <ListItem>Queda registrada con tu rol y un borrador de bitácora.</ListItem>
              </List>
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelar} variant="outline" onClick={dialogo.onClose}>
                Cancelar
              </Button>
              <Button onClick={() => void emitir()} isLoading={emitiendo} isDisabled={emitiendo}>
                Emitir orden
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

/** Una orden ya emitida: tipo, sectores y fecha arriba; fundamento y alcance debajo. */
function FilaOrden({ o }: { o: Orden }) {
  const a = ASPECTO_TIPO[o.tipo] ?? { tono: "neutro" as TonoChip, icono: null };
  const emisor = o.emitida_por_rol ? `Emitida por ${etiquetaRolOperativo(o.emitida_por_rol)}` : "Emisor sin rol registrado";
  const alcance = [
    o.notificaciones_creadas !== undefined && o.notificaciones_creadas !== null ? `${o.notificaciones_creadas} notificaciones` : null,
    o.tareas_creadas !== undefined && o.tareas_creadas !== null ? `${o.tareas_creadas} tareas` : null,
  ].filter(Boolean);
  return (
    <ListItem as="li" py={3} borderTop="1px solid" borderColor="borde" _first={{ borderTop: "none", pt: 0 }} data-testid={`orden-${o.id}`}>
      <Flex align="center" columnGap={3} rowGap={1.5} wrap="wrap">
        <Text as="span" fontWeight={700}>
          Orden N.º {o.id}
        </Text>
        <Chip tono={a.tono} icono={a.icono}>
          {TEXTO_TIPO[o.tipo] ?? o.tipo}
        </Chip>
        <Text as="span" fontWeight={600}>
          Sectores {o.sectores.join(", ")}
        </Text>
        <Text as="span" textStyle="microdato" ml={{ md: "auto" }}>
          {fechaHora(o.creada_en)}
        </Text>
      </Flex>
      {o.fundamento && o.fundamento.length > 1 && (
        <Text mt={1.5} maxW="70ch">
          {o.fundamento}
        </Text>
      )}
      <Text textStyle="microdato" mt={1}>
        {emisor}
        {alcance.length > 0 ? ` · ${alcance.join(" y ")}` : ""}
      </Text>
    </ListItem>
  );
}

export default function Ordenes() {
  const ordenes = useCarga(() => api.ordenes());
  const [emitida, setEmitida] = useState<Orden | null>(null);

  return (
    <>
      <CabeceraPagina
        titulo="Órdenes y alertas"
        icono={<IconoMegafono tam="1.5rem" />}
        ayuda="Solo el decisor emite órdenes. Cada una queda registrada con su rol, avisa a quienes viven o producen en los sectores y crea tareas para las cuadrillas."
      />
      <Seccion titulo="Emitir una orden" categoria="SIMULADO" id="sec-emitir">
        <FormOrden
          alEmitir={(o) => {
            setEmitida(o);
            ordenes.recargar();
          }}
        />
        {emitida && (
          <Alert status="success" mt={4} flexDirection="column" alignItems="flex-start" data-testid="orden-emitida" role="status">
            <Flex align="center">
              <AlertIcon />
              <strong>Orden {emitida.id} emitida.</strong>
            </Flex>
            <Text>
              {emitida.notificaciones_creadas ?? 0} notificaciones y {emitida.tareas_creadas ?? 0} tareas creadas.
            </Text>
            {emitida.bitacora_borrador_id ? (
              <Button as={RouterLink} to={`/comando/bitacora?borrador=${emitida.bitacora_borrador_id}`} variant="outline" mt={2}>
                Completar el borrador de bitácora
              </Button>
            ) : (
              <Text>No se generó borrador de bitácora.</Text>
            )}
          </Alert>
        )}
      </Seccion>
      <Seccion titulo="Órdenes emitidas" categoria="SIMULADO" id="sec-lista">
        <Cargando
          carga={ordenes}
          esVacio={(d) => d.ordenes.length === 0}
          vacio="Todavía no se emitió ninguna orden. Cuando el decisor emita una, aparece acá."
          hijos={(d) => (
            <List aria-labelledby="sec-lista">
              {d.ordenes.map((o) => (
                <FilaOrden key={o.id} o={o} />
              ))}
            </List>
          )}
        />
      </Seccion>
    </>
  );
}
