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
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react";
import { TIPOS_ORDEN, type TipoOrden } from "@evacuaciones/shared";
import { useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AlertaError } from "../../components/Formulario";
import { Insignia } from "../../components/Insignia";
import { etiquetaOrigenLluvia } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useEscenario } from "../EscenarioContext";
import type { Orden } from "../tipos";
import { Cargando, fmtFecha, fmtM, Seccion } from "../ui";
import { TablaDesplazable } from "../../components/TablaDesplazable";

const TEXTO_TIPO: Record<TipoOrden, string> = {
  alerta: "Alerta",
  evacuacion_preventiva: "Evacuación preventiva",
  evacuacion: "Evacuación",
};
const SECTORES = ["S1", "S2", "S3", "S4"];

function FormOrden({ alEmitir }: { alEmitir: (o: Orden) => void }) {
  const { usuario } = useAuth();
  const { entrada, escenario, desactualizado } = useEscenario();
  const esDecisor = usuario?.rol === "decisor";
  const dialogo = useDisclosure();
  const cancelar = useRef<HTMLButtonElement>(null);
  const [tipo, setTipo] = useState<TipoOrden>("evacuacion_preventiva");
  const [sectores, setSectores] = useState<string[]>(escenario && !desactualizado ? escenario.resumen.comprometidos : []);
  const [fundamento, setFundamento] = useState("");
  const [fecha, setFecha] = useState("");
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  // Una clave por envío: un reintento del mismo envío (red caída, doble clic) no emite la orden dos veces.
  const claveEnvio = useRef<{ clave: string; firma: string } | null>(null);

  const errorFundamento = intento && fundamento.trim().length < 10 ? "El fundamento debe tener al menos 10 caracteres." : null;
  const errorSectores = intento && sectores.length === 0 ? "Elegí al menos un sector." : null;

  function revisar() {
    setIntento(true);
    if (fundamento.trim().length < 10 || sectores.length === 0) return;
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

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); revisar(); }} noValidate>
      {!esDecisor && (
        <Alert status="info" mb={3} fontSize="sm" data-testid="aviso-solo-decisor">
          <AlertIcon />
          <AlertDescription>
            Solo el decisor puede emitir órdenes. Con tu rol podés preparar la recomendación y la bitácora, pero el formulario queda deshabilitado: la orden la emite una persona autorizada y queda registrada con su rol.
          </AlertDescription>
        </Alert>
      )}
      <fieldset disabled={!esDecisor} style={{ border: 0, padding: 0, margin: 0 }}>
        <Flex gap={3} wrap="wrap" mb={3}>
          <FormControl w="16rem">
            <FormLabel htmlFor="orden-tipo" fontSize="sm" mb={0}>
              Tipo de orden
            </FormLabel>
            <Select id="orden-tipo" size="sm" bg="superficie" value={tipo} onChange={(e) => setTipo(e.target.value as TipoOrden)}>
              {TIPOS_ORDEN.map((t) => (
                <option key={t} value={t}>
                  {TEXTO_TIPO[t]}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl w="11rem">
            <FormLabel htmlFor="orden-fecha" fontSize="sm" mb={0}>
              Día simulado (opcional)
            </FormLabel>
            <Input id="orden-fecha" type="date" size="sm" bg="superficie" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </FormControl>
        </Flex>
        <FormControl as="fieldset" isInvalid={!!errorSectores} mb={3}>
          <FormLabel as="legend" fontSize="sm" mb={0}>
            Sectores
          </FormLabel>
          <Flex gap={4}>
            {SECTORES.map((s) => (
              <Checkbox key={s} size="sm" isChecked={sectores.includes(s)} onChange={() => setSectores((x) => (x.includes(s) ? x.filter((i) => i !== s) : [...x, s]))}>
                {s}
              </Checkbox>
            ))}
          </Flex>
          <FormErrorMessage>{errorSectores}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errorFundamento} mb={3}>
          <FormLabel htmlFor="orden-fundamento" fontSize="sm" mb={0}>
            Fundamento (obligatorio)
          </FormLabel>
          <Textarea id="orden-fundamento" size="sm" bg="superficie" rows={3} maxLength={2000} value={fundamento} onChange={(e) => setFundamento(e.target.value)} />
          <FormErrorMessage>{errorFundamento}</FormErrorMessage>
        </FormControl>
        <Text fontSize="xs" color="textoSuave" mb={2}>
          Escenario de referencia: {fmtM(entrada.altura_formosa_m)} en Puerto Formosa, {entrada.lluvia_mm} mm ({etiquetaOrigenLluvia(entrada.lluvia_origen)}). Citá la evidencia en el fundamento.
        </Text>
        <Button type="submit" size="sm" colorScheme="red" isDisabled={!esDecisor || emitiendo}>
          Revisar y emitir orden
        </Button>
      </fieldset>
      <Box mt={3}>
        <AlertaError error={error} />
      </Box>

      <AlertDialog isOpen={dialogo.isOpen} leastDestructiveRef={cancelar} onClose={dialogo.onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg">Confirmar emisión de la orden</AlertDialogHeader>
            <AlertDialogBody>
              <Text>
                Vas a emitir una orden de <strong>{TEXTO_TIPO[tipo].toLowerCase()}</strong> para los sectores <strong>{sectores.join(", ")}</strong>. Se notificará a quienes viven o producen allí, se crearán tareas para las cuadrillas y quedará registrada con tu rol y un borrador de bitácora.
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelar} onClick={dialogo.onClose}>
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={() => void emitir()} isLoading={emitiendo} isDisabled={emitiendo}>
                Emitir orden
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

export default function Ordenes() {
  const ordenes = useCarga(() => api.ordenes());
  const [emitida, setEmitida] = useState<Orden | null>(null);

  return (
    <>
      <Heading as="h1" size="lg" mb={4}>
        Órdenes y alertas
      </Heading>
      <Seccion titulo="Emitir una orden" categoria="SIMULADO" id="sec-emitir">
        <FormOrden
          alEmitir={(o) => {
            setEmitida(o);
            ordenes.recargar();
          }}
        />
        {emitida && (
          <Alert status="success" mt={3} flexDirection="column" alignItems="flex-start" data-testid="orden-emitida">
            <Flex align="center">
              <AlertIcon />
              <strong>Orden {emitida.id} emitida.</strong>
            </Flex>
            <Text fontSize="sm">
              {emitida.notificaciones_creadas ?? 0} notificaciones y {emitida.tareas_creadas ?? 0} tareas creadas.
            </Text>
            {emitida.bitacora_borrador_id ? (
              <Button as={RouterLink} to={`/comando/bitacora?borrador=${emitida.bitacora_borrador_id}`} size="sm" mt={2}>
                Completar el borrador de bitácora
              </Button>
            ) : (
              <Text fontSize="sm">No se generó borrador de bitácora.</Text>
            )}
          </Alert>
        )}
      </Seccion>
      <Seccion titulo="Órdenes emitidas" id="sec-lista">
        <Cargando carga={ordenes} esVacio={(d) => d.ordenes.length === 0} vacio="Todavía no se emitió ninguna orden." hijos={(d) => (
          <TablaDesplazable etiqueta="Órdenes emitidas">
            <Table size="sm" aria-label="Órdenes emitidas">
              <Thead>
                <Tr>
                  <Th>N.º</Th>
                  <Th>Tipo</Th>
                  <Th>Sectores</Th>
                  <Th>Emitida por (rol)</Th>
                  <Th>Fecha</Th>
                  <Th>Categoría</Th>
                </Tr>
              </Thead>
              <Tbody>
                {d.ordenes.map((o) => (
                  <Tr key={o.id}>
                    <Td>{o.id}</Td>
                    <Td>{TEXTO_TIPO[o.tipo] ?? o.tipo}</Td>
                    <Td>{o.sectores.join(", ")}</Td>
                    <Td>{o.emitida_por_rol ?? "sin rol"}</Td>
                    <Td>{fmtFecha(o.creada_en)}</Td>
                    <Td>
                      <Insignia categoria="SIMULADO" />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TablaDesplazable>
        )} />
      </Seccion>
    </>
  );
}
