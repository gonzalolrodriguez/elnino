import { Box, Button, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Radio, RadioGroup, SimpleGrid, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoAlerta, IconoEnviar, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { ApiError } from "../../lib/api";
import { AYUDA_RESULTADO, enviarParte, ETIQUETA_RESULTADO, MAX_OBSERVACION, ORDEN_RESULTADOS, validarParte, type ResultadoParte, type TipoParte } from "../../lib/partes";

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

  function abrir(m: Modo) {
    setAviso(null);
    setError(null);
    setErrorCampo(null);
    setModo((actual) => (actual === m ? null : m));
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
      await enviarParte(tareaId, r.cuerpo);
      setAviso(tipo === "avance" ? "Avance informado." : tipo === "dificultad" ? "Dificultad informada: el operador la ve en su panel." : "Resultado informado.");
      setModo(null);
      setObservacion("");
      setResultado("");
      alEnviado();
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
        <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate mt={3} p={3} border="1px solid" borderColor="borde" borderRadius="lg" aria-label={`${TITULO[modo]} de la tarea ${tareaId}`}>
          <Text fontWeight={700} mb={2}>
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
              bg="superficie"
              rows={3}
              maxLength={MAX_OBSERVACION}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder={modo === "dificultad" ? EJEMPLOS_DIFICULTAD : modo === "avance" ? "Por ejemplo: llegamos al paraje, empezamos a cargar." : "Contá qué pasó."}
            />
            {modo === "dificultad" && <FormHelperText>El operador lo ve enseguida. No incluyas nombres ni datos personales.</FormHelperText>}
            <FormErrorMessage>{errorCampo}</FormErrorMessage>
          </FormControl>

          {modo === "terminar" && resultado === "completa" && exigeConstancia && (
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
          <Flex gap={2} mt={3}>
            <Button type="submit" isLoading={enviando} leftIcon={<IconoEnviar />}>
              {modo === "terminar" && resultado === "completa" && exigeConstancia ? "Continuar con la constancia" : "Enviar"}
            </Button>
            <Button type="button" variant="outline" isDisabled={enviando} onClick={() => setModo(null)}>
              Volver
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
