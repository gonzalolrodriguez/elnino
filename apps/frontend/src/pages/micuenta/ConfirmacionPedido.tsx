import { Alert, AlertDescription, AlertIcon, Box, Button, FormControl, FormLabel, Heading, Radio, RadioGroup, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { OPCIONES_ASISTENCIA, type RespuestaAsistencia } from "../../lib/confirmacion";
import { solicitar } from "../../lib/api";

/** «¿Te asistieron?»: cinco respuestas para que la persona cuente qué pasó. No es una denuncia: marca el pedido para que lo revisen. */
export function ConfirmacionPedido({ solicitudId, alResponder }: { solicitudId: number; alResponder: () => void }) {
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
    <Box as="section" aria-labelledby={`conf-${solicitudId}`} bg="alerta.50" border="2px solid" borderColor="alerta.600" borderRadius="xl" p={{ base: 4, md: 5 }} data-testid="confirmacion-asistencia">
      <Heading as="h3" size="md" id={`conf-${solicitudId}`} mb={1}>
        ¿Te asistieron?
      </Heading>
      <Text fontSize="sm" mb={3}>
        La cuadrilla cerró tu pedido n.º {solicitudId}. Contanos cómo fue: tu respuesta ayuda a revisar que la asistencia salió bien. No es una denuncia.
      </Text>
      <RadioGroup value={respuesta} onChange={(v) => setRespuesta(v as RespuestaAsistencia)}>
        <Stack spacing={2} role="radiogroup" aria-label="Cómo te fue con la asistencia">
          {OPCIONES_ASISTENCIA.map((o) => (
            <Box key={o.valor} layerStyle="tarjeta" px={3} py={2} borderColor={respuesta === o.valor ? "primario" : "borde"} minH="2.75rem" display="flex" alignItems="center">
              <Radio value={o.valor} size="lg" alignItems="flex-start">
                <Text fontWeight={600} lineHeight={1.3}>
                  {o.etiqueta}
                </Text>
                <Text fontSize="sm" color="textoSuave">
                  {o.ayuda}
                </Text>
              </Radio>
            </Box>
          ))}
        </Stack>
      </RadioGroup>
      <FormControl mt={3}>
        <FormLabel htmlFor={`conf-comentario-${solicitudId}`} fontSize="sm">
          {respuesta && !conforme ? "Contanos qué pasó (nos ayuda a revisarlo)" : "Comentario (opcional)"}
        </FormLabel>
        <Textarea id={`conf-comentario-${solicitudId}`} size="sm" bg="superficie" rows={3} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </FormControl>
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
