import { Box, Button, Flex, FormControl, FormErrorIcon, FormErrorMessage, FormHelperText, FormLabel, Heading, SimpleGrid, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoAlerta, IconoEnviar, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { GrupoOpciones } from "../../components/Opcion";
import { ApiError } from "../../lib/api";
import { AYUDA_RESULTADO, enviarParte, ETIQUETA_RESULTADO, MAX_OBSERVACION, ORDEN_RESULTADOS, subirAdjuntoParte, validarParte, type ResultadoParte, type TipoParte } from "../../lib/partes";
import { SelectorAdjuntos, type ProgresoArchivo } from "./AdjuntosParte";

type Modo = "avance" | "dificultad" | "terminar";

const TITULO: Record<Modo, string> = { avance: "Informar avance", dificultad: "Informar dificultad", terminar: "Terminar tarea" };
const EJEMPLOS_DIFICULTAD = "Por ejemplo: camino cortado, falta vehículo, no responden en el domicilio.";

/** Botón de acción de la tarea: ancho completo en el celular, 44 px o más, y marcado con claridad cuando su panel está abierto. */
const ACCION = { size: "lg", whiteSpace: "normal", h: "auto", minH: "3rem", py: 2, _pressed: { bg: "suave", borderColor: "primario" } } as const;

/**
 * Acciones de la cuadrilla sobre una tarea: informar avance, informar una dificultad o terminarla (completa, a medias, no se pudo, reprogramar).
 * Cada una crea un parte (`POST /tareas/{id}/partes`). Si la tarea exige constancia de cierre y se elige «Completa», no se envía el parte:
 * se pasa al cierre con constancia, que crea el parte de resultado por su cuenta.
 * `destacarTerminar` resalta «Terminar tarea» como acción principal cuando la tarea ya está en curso.
 */
export function AccionesParte({
  tareaId,
  exigeConstancia,
  destacarTerminar = false,
  alEnviado,
  alConstancia,
}: {
  tareaId: number;
  exigeConstancia: boolean;
  destacarTerminar?: boolean;
  alEnviado: () => void;
  alConstancia: () => void;
}) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [observacion, setObservacion] = useState("");
  const [resultado, setResultado] = useState<ResultadoParte | "">("");
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [errorResultado, setErrorResultado] = useState<string | null>(null);
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
    setErrorResultado(null);
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
      // Falta elegir cómo terminó: el error va junto a las opciones, no debajo de la observación.
      if (tipo === "resultado" && resultado === "") {
        setErrorResultado(r.error);
        setErrorCampo(null);
      } else {
        setErrorCampo(r.error);
        setErrorResultado(null);
      }
      return;
    }
    setErrorCampo(null);
    setErrorResultado(null);
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
        <Button {...ACCION} variant="outline" leftIcon={<IconoEnviar />} aria-pressed={modo === "avance"} onClick={() => abrir("avance")}>
          Informar avance
        </Button>
        <Button {...ACCION} variant="outline" leftIcon={<IconoTriangulo />} aria-pressed={modo === "dificultad"} onClick={() => abrir("dificultad")}>
          Informar dificultad
        </Button>
        <Button {...ACCION} variant={destacarTerminar ? "solid" : "outline"} leftIcon={<IconoTilde />} aria-pressed={modo === "terminar"} onClick={() => abrir("terminar")}>
          Terminar tarea
        </Button>
      </SimpleGrid>

      {aviso && (
        <Flex align="center" gap={2} mt={3} color="verde.800" role="status">
          <IconoTilde tam="1rem" />
          <Text>{aviso}</Text>
        </Flex>
      )}

      {modo !== null && (
        <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate mt={3} p={{ base: 3, md: 4 }} bg="fondo" border="1px solid" borderColor="borde" borderRadius="xl" aria-label={`${TITULO[modo]} de la tarea ${tareaId}`}>
          <Heading as="h4" size="bloque" textStyle="tituloBloque" mb={3}>
            {TITULO[modo]}
          </Heading>

          {modo === "terminar" && (
            <Box mb={4}>
              <GrupoOpciones
                leyenda="¿Cómo terminó?"
                value={resultado}
                onChange={(v) => {
                  setResultado(v as ResultadoParte);
                  setErrorResultado(null);
                }}
                minAncho="15rem"
                opciones={ORDEN_RESULTADOS.map((k) => ({ valor: k, etiqueta: ETIQUETA_RESULTADO[k], ayuda: AYUDA_RESULTADO[k] }))}
              />
              {errorResultado && (
                <Flex align="center" gap={1.5} mt={2} textStyle="microdato" color="evacuacion.700" role="alert">
                  <IconoAlerta tam="1rem" />
                  <Text as="span">{errorResultado}</Text>
                </Flex>
              )}
            </Box>
          )}

          <FormControl isInvalid={errorCampo !== null} isRequired={obligatoria}>
            <FormLabel htmlFor={idObs}>{modo === "avance" ? "Novedad (opcional)" : "Observación"}</FormLabel>
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
            <Flex align="flex-start" gap={2} mt={3} textStyle="microdato">
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
            <Text mt={3} role="status" data-testid="parte-sin-archivos">
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
