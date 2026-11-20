import { Box, Button, Flex, FormControl, FormErrorIcon, FormErrorMessage, FormHelperText, FormLabel, Radio, RadioGroup, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoAlerta, IconoEnviar, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { ApiError } from "../../lib/api";
import { AYUDA_RESULTADO, enviarParte, ETIQUETA_RESULTADO, MAX_OBSERVACION, ORDEN_RESULTADOS, subirAdjuntoParte, validarParte, type ResultadoParte, type TipoParte } from "../../lib/partes";
import { SelectorAdjuntos, type ProgresoArchivo } from "./AdjuntosParte";

type Modo = "avance" | "dificultad" | "terminar";

const TITULO: Record<Modo, string> = { avance: "Informar avance", dificultad: "Informar dificultad", terminar: "Terminar tarea" };
const EJEMPLOS_DIFICULTAD = "Por ejemplo: camino cortado, falta vehículo, no responden en el domicilio.";

/**
 * Acciones de la cuadrilla sobre una tarea: informar avance, informar una dificultad o terminarla (completa, a medias, no se pudo, reprogramar).
 * Cada una crea un parte (`POST /tareas/{id}/partes`). Si la tarea exige constancia de cierre y se elige «Completa», no se envía el parte:
 * se pasa al cierre con constancia, que crea el parte de resultado por su cuenta.
 */
export function AccionesParte({ tareaId, exigeConstancia, alEnviado, alConstancia }: { tareaId: number; exigeConstancia: boolean; alEnviado: () => void; alConstancia: () => void }) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [observacion, setObservacion] = useState("");
  const [resultado, setResultado] = useState<ResultadoParte | "">("");
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [progreso, setProgreso] = useState<Record<number, ProgresoArchivo>>({});
  // Parte ya creado cuyos archivos todavía no terminaron de subirse: el parte no se vuelve a crear al reintentar.
  const [parteCreado, setParteCreado] = useState<{ id: number; mensaje: string } | null>(null);

  function abrir(m: Modo) {
    setAviso(null);
    setError(null);
    setErrorCampo(null);
    setModo((actual) => (actual === m ? null : m));
  }

  function terminar(mensaje: string) {
    setAviso(mensaje);
    setModo(null);
    setObservacion("");
    setResultado("");
    setArchivos([]);
    setProgreso({});
    setParteCreado(null);
    alEnviado();
  }

  /** Sube los archivos indicados de a uno. Devuelve cuántos quedaron sin subir (los errores quedan por archivo). */
  async function subir(parteId: number, indices: number[]): Promise<number> {
    let fallidos = 0;
    for (const i of indices) {
      setProgreso((p) => ({ ...p, [i]: { estado: "subiendo" } }));
      try {
        await subirAdjuntoParte(tareaId, parteId, archivos[i]);
        setProgreso((p) => ({ ...p, [i]: { estado: "ok" } }));
      } catch (e) {
        fallidos++;
        setProgreso((p) => ({ ...p, [i]: { estado: "error", mensaje: e instanceof Error ? e.message : "No se pudo subir el archivo." } }));
      }
    }
    return fallidos;
  }

  async function reintentarAdjuntos() {
    if (!parteCreado) return;
    setEnviando(true);
    const pendientes = archivos.map((_, i) => i).filter((i) => progreso[i]?.estado !== "ok");
    const fallidos = await subir(parteCreado.id, pendientes);
    setEnviando(false);
    if (fallidos === 0) terminar(parteCreado.mensaje);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === null) return;
    setError(null);
    const tipo: TipoParte = modo === "terminar" ? "resultado" : modo;
    const r = validarParte(tipo, tipo === "resultado" ? (resultado || null) : null, observacion);
    if ("error" in r) {
      setErrorCampo(r.error);
      return;
    }
    setErrorCampo(null);
    if (r.cuerpo.resultado === "completa" && exigeConstancia) {
      alConstancia();
      return;
    }
    setEnviando(true);
    try {
      const parte = await enviarParte(tareaId, r.cuerpo);
      const mensaje = tipo === "avance" ? "Avance informado." : tipo === "dificultad" ? "Dificultad informada: el operador la ve en su panel." : "Resultado informado.";
      if (archivos.length === 0) terminar(mensaje);
      else {
        setParteCreado({ id: parte.id, mensaje });
        alEnviado(); // el parte ya existe: el historial lo muestra aunque falten archivos
        const fallidos = await subir(parte.id, archivos.map((_, i) => i));
        if (fallidos === 0) terminar(mensaje);
      }
    } catch (err) {
      // El servidor puede exigir la constancia aunque el cliente no lo supiera: se pasa a ese formulario en vez de mostrar un error.
      if (err instanceof ApiError && err.estado === 409 && /constancia/i.test(err.message)) {
        setModo(null);
        alConstancia();
      } else setError(err);
    } finally {
      setEnviando(false);
    }
  }

  const exigeConstanciaAhora = modo === "terminar" && resultado === "completa" && exigeConstancia;
  const faltanArchivos = parteCreado !== null && archivos.some((_, i) => progreso[i]?.estado !== "ok");
  const obligatoria = modo === "dificultad" || (modo === "terminar" && resultado !== "completa");
  const idObs = `parte-obs-${tareaId}`;

  return (
    <Box data-testid={`acciones-${tareaId}`}>
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={2}>
        <Button size="lg" variant="outline" leftIcon={<IconoEnviar />} aria-pressed={modo === "avance"} onClick={() => abrir("avance")} whiteSpace="normal" h="auto" minH="3rem" py={2}>
          Informar avance
        </Button>
        <Button size="lg" variant="outline" leftIcon={<IconoTriangulo />} aria-pressed={modo === "dificultad"} onClick={() => abrir("dificultad")} whiteSpace="normal" h="auto" minH="3rem" py={2}>
          Informar dificultad
        </Button>
        <Button size="lg" leftIcon={<IconoTilde />} aria-pressed={modo === "terminar"} onClick={() => abrir("terminar")} whiteSpace="normal" h="auto" minH="3rem" py={2}>
          Terminar tarea
        </Button>
      </SimpleGrid>

      {aviso && (
        <Flex align="center" gap={2} mt={3} fontSize="sm" color="verde.800" role="status">
          <IconoTilde tam="1rem" />
          <Text>{aviso}</Text>
        </Flex>
      )}

      {modo !== null && (
        <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate mt={3} p={{ base: 3, md: 4 }} bg="fondo" border="1px solid" borderColor="borde" borderRadius="lg" aria-label={`${TITULO[modo]} de la tarea ${tareaId}`}>
          <Text fontWeight={700} fontSize="md" mb={3}>
            {TITULO[modo]}
          </Text>

          {modo === "terminar" && (
            <FormControl as="fieldset" mb={3}>
              <FormLabel as="legend" fontSize="sm">
                ¿Cómo terminó?
              </FormLabel>
              <RadioGroup value={resultado} onChange={(v) => setResultado(v as ResultadoParte)}>
                <Stack spacing={2}>
                  {ORDEN_RESULTADOS.map((k) => (
                    <Radio key={k} value={k} size="lg" alignItems="flex-start">
                      <Text as="span" fontWeight={600}>
                        {ETIQUETA_RESULTADO[k]}
                      </Text>
                      <Text as="span" display="block" fontSize="sm" color="textoSuave">
                        {AYUDA_RESULTADO[k]}
                      </Text>
                    </Radio>
                  ))}
                </Stack>
              </RadioGroup>
            </FormControl>
          )}

          <FormControl isInvalid={errorCampo !== null} isRequired={obligatoria}>
            <FormLabel htmlFor={idObs} fontSize="sm">
              {modo === "avance" ? "Novedad (opcional)" : "Observación"}
            </FormLabel>
            <Textarea
              id={idObs}
              autoFocus={modo !== "terminar"}
              bg="superficie"
              rows={3}
              maxLength={MAX_OBSERVACION}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder={modo === "dificultad" ? EJEMPLOS_DIFICULTAD : modo === "avance" ? "Por ejemplo: llegamos al paraje, empezamos a cargar." : "Contá qué pasó."}
            />
            {modo === "dificultad" && <FormHelperText>El operador lo ve enseguida. No incluyas nombres ni datos personales.</FormHelperText>}
            <FormErrorMessage>
              <FormErrorIcon />
              {errorCampo}
            </FormErrorMessage>
          </FormControl>

          {!exigeConstanciaAhora && <SelectorAdjuntos idBase={String(tareaId)} archivos={archivos} alCambiar={setArchivos} progreso={progreso} bloqueado={enviando || parteCreado !== null} />}

          {exigeConstanciaAhora && (
            <Flex align="flex-start" gap={2} mt={3} fontSize="sm" color="textoSuave">
              <Box mt="2px" aria-hidden="true" display="flex">
                <IconoAlerta tam="1rem" />
              </Box>
              <Text>Esta tarea se cierra con constancia: te pedimos el destino, las personas y los animales trasladados.</Text>
            </Flex>
          )}

          {error !== null && (
            <Box mt={3}>
              <AlertaError error={error} />
            </Box>
          )}
          {faltanArchivos && !enviando && (
            <Text mt={3} fontSize="sm" role="status" data-testid="parte-sin-archivos">
              El parte ya se envió, pero faltan archivos por subir. Podés reintentar solo esos archivos o seguir sin ellos.
            </Text>
          )}
          <Flex gap={2} mt={4} direction={{ base: "column", sm: "row" }}>
            {parteCreado ? (
              <>
                <Button type="button" size="lg" isLoading={enviando} leftIcon={<IconoEnviar />} onClick={() => void reintentarAdjuntos()}>
                  Reintentar archivos
                </Button>
                <Button type="button" size="lg" variant="outline" isDisabled={enviando} onClick={() => terminar(parteCreado.mensaje)}>
                  Seguir sin esos archivos
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" size="lg" isLoading={enviando} leftIcon={<IconoEnviar />}>
                  {exigeConstanciaAhora ? "Continuar con la constancia" : "Enviar"}
                </Button>
                <Button type="button" size="lg" variant="outline" isDisabled={enviando} onClick={() => setModo(null)}>
                  Volver
                </Button>
              </>
            )}
          </Flex>
        </Box>
      )}
    </Box>
  );
}
