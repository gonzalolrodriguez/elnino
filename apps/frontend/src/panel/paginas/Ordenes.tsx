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
import { Link as RouterLink, useSearchParams } from "react-router-dom";

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

const PLANTILLAS_ORDEN: { etiqueta: string; tipo: TipoOrden; sectores: string[]; fundamento: string }[] = [
  {
    etiqueta: "Evacuación preventiva S4 · Ventana Seca",
    tipo: "evacuacion_preventiva",
    sectores: ["S4"],
    fundamento:
      "Evacuación preventiva en Ventana Seca para Sector S4 Rural Este (compromiso en 7,50 m · K10 v1.0, 0,30 m antes de la alerta oficial de 7,80 m · K3). Único acceso de tierra que se vuelve intransitable con >= 30 mm de lluvia (SUPUESTO); se prioriza despacho de camiones jaula y traslado de 150 personas antes de precipitaciones.",
  },
  {
    etiqueta: "Alerta temprana · S4 y S3",
    tipo: "alerta",
    sectores: ["S3", "S4"],
    fundamento:
      "Alerta operativa para Sectores S4 Rural Este (compromiso 7,50 m) y S3 Sur (compromiso 7,90 m · K10 v1.0) ante ascenso sostenido en Puerto Formosa (lectura al corte 5,60 m · K1 limpio, tasa octubre 0,1077 m/día). Alistamiento de centros de recepción y cuadrillas.",
  },
  {
    etiqueta: "Evacuación general · S4, S3 y S1",
    tipo: "evacuacion",
    sectores: ["S1", "S3", "S4"],
    fundamento:
      "Evacuación inmediata de Sectores S4 (7,50 m), S3 (7,90 m) y S1 Norte (8,10 m · acceso único de ripio) por superación del umbral de alerta (7,80 m · K3) y aproximación al nivel de evacuación (8,30 m · K3). Activación de flota completa y centros de recepción.",
  },
];

function FormOrden({ alEmitir }: { alEmitir: (o: Orden) => void }) {
  const [params] = useSearchParams();
  const { usuario } = useAuth();
  const { entrada, escenario, desactualizado } = useEscenario();
  const esDecisor = usuario?.rol === "decisor";
  const dialogo = useDisclosure();
  const cancelar = useRef<HTMLButtonElement>(null);
  const tipoParam = params.get("tipo") as TipoOrden | null;
  const sectoresParam = (params.get("sectores") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SECTORES.includes(s));
  const [tipo, setTipo] = useState<TipoOrden>(tipoParam && TIPOS_ORDEN.includes(tipoParam) ? tipoParam : "evacuacion_preventiva");
  const [sectores, setSectores] = useState<string[]>(
    sectoresParam.length > 0 ? sectoresParam : escenario && !desactualizado ? escenario.resumen.comprometidos : [],
  );
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
        <Box layerStyle="suave" p={3} mb={3}>
          <Text fontSize="xs" fontWeight={700} mb={1.5}>
            Plantillas rápidas de orden de evacuación (SIMULADO):
          </Text>
          <Flex gap={1.5} wrap="wrap">
            {PLANTILLAS_ORDEN.map((p) => (
              <Button
                key={p.etiqueta}
                size="xs"
                variant="outline"
                type="button"
                onClick={() => {
                  setTipo(p.tipo);
                  setSectores([...p.sectores]);
                  setFundamento(p.fundamento);
                  setIntento(false);
                }}
              >
                {p.etiqueta}
              </Button>
            ))}
          </Flex>
        </Box>
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
