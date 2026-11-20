import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Heading, RadioGroup, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoPersonas } from "../../components/iconos/Iconos";
import { Opcion } from "../../components/Opcion";
import { OPCIONES_ASISTENCIA, type RespuestaAsistencia } from "../../lib/confirmacion";
import { solicitar } from "../../lib/api";

/** «¿Te asistieron?»: cinco respuestas para que la persona cuente qué pasó. No es una denuncia: marca el pedido para que lo revisen. */
export function ConfirmacionPedido({ solicitudId, codigo, alResponder }: { solicitudId: number; codigo?: string | null; alResponder: () => void }) {
  const [respuesta, setRespuesta] = useState<RespuestaAsistencia | "">("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nota, setNota] = useState<string | null>(null);
  const conforme = respuesta === "completa";

  async function enviar() {
    if (!respuesta) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await solicitar<{ nota?: string }>("/mi/confirmaciones", {
        autenticado: true,
        metodo: "POST",
        cuerpo: { solicitud_id: solicitudId, respuesta, ...(comentario.trim() ? { comentario: comentario.trim() } : {}) },
      });
      setNota(r?.nota ?? "Gracias por responder.");
      alResponder();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  if (nota) {
    return (
      <Alert status="success" variant="subtle" fontSize="sm" role="status" data-testid="confirmacion-gracias" borderRadius="lg">
        <AlertIcon />
        <AlertDescription>{nota}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Box as="section" aria-labelledby={`conf-${solicitudId}`} bg="alerta.50" border="1px solid" borderColor="alerta.300" borderRadius="xl" p={{ base: 4, md: 5 }} data-testid="confirmacion-asistencia">
      <Flex align="center" gap={2.5} mb={1} color="alerta.900">
        <IconoPersonas tam="1.5rem" />
        <Heading as="h3" size="md" id={`conf-${solicitudId}`}>
          ¿Te asistieron?
        </Heading>
      </Flex>
      <Text fontSize="sm" mb={3}>
        La cuadrilla cerró tu pedido n.º {solicitudId}. Contanos cómo fue: tu respuesta ayuda a revisar que la asistencia salió bien. No es una denuncia.
      </Text>
      <RadioGroup value={respuesta} onChange={(v) => setRespuesta(v as RespuestaAsistencia)}>
        <Stack spacing={2} role="radiogroup" aria-label="Cómo te fue con la asistencia">
          {OPCIONES_ASISTENCIA.map((o) => (
            <Opcion key={o.valor} tipo="radio" valor={o.valor} etiqueta={o.etiqueta} ayuda={o.ayuda} />
          ))}
        </Stack>
      </RadioGroup>
      <FormControl mt={3}>
        <FormLabel htmlFor={`conf-comentario-${solicitudId}`} fontSize="sm">
          {respuesta && !conforme ? "Contanos qué pasó (nos ayuda a revisarlo)" : "Comentario (opcional)"}
        </FormLabel>
        <Textarea id={`conf-comentario-${solicitudId}`} size="sm" bg="superficie" rows={3} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </FormControl>
      {codigo && (
        <Text fontSize="sm" mt={3} data-testid="confirmacion-sms">
          También podés responder por SMS: <Text as="strong" fontFamily="mono">SI {codigo}</Text> si te asistieron, o{" "}
          <Text as="strong" fontFamily="mono">PARCIAL {codigo}</Text> si faltó alguien o algo. Solo vale desde el teléfono que registraste.
        </Text>
      )}
      <Button mt={3} minH="2.75rem" isDisabled={!respuesta} isLoading={enviando} onClick={() => void enviar()}>
        Enviar respuesta
      </Button>
      {error !== null && (
        <Box mt={2}>
          <AlertaError error={error} />
        </Box>
      )}
    </Box>
  );
}
