import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Heading, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { etiquetaRespuestaConfirmacion, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../../panel/api";
import type { ConsultaConfirmacion } from "../../panel/tipos";

type Respuesta = "si" | "no" | "problema";

function Tarjeta({ c, alResponder }: { c: ConsultaConfirmacion; alResponder: () => void }) {
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState<Respuesta | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [gracias, setGracias] = useState<string | null>(null);
  const destino = c.centro_nombre ? c.centro_nombre : "el lugar al que te llevaron";

  async function responder(r: Respuesta) {
    setError(null);
    setEnviando(r);
    try {
      const res = await api.responderConfirmacion({ ...(c.solicitud_id !== null ? { solicitud_id: c.solicitud_id } : { codigo: c.codigo }), respuesta: r, ...(comentario.trim() ? { comentario: comentario.trim() } : {}) });
      setGracias(res.nota);
      alResponder();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(null);
    }
  }

  if (gracias) {
    return (
      <Alert status="success" variant="subtle" fontSize="sm" role="status" data-testid={`confirmacion-gracias-${c.id}`}>
        <AlertIcon />
        <AlertDescription>{gracias}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Box as="article" aria-label={`Consulta ${c.id}`} layerStyle="tarjeta" p={4} mb={3} data-testid={`confirmacion-${c.id}`}>
      <Heading as="h3" size="sm" mb={1}>
        ¿Llegaste a {destino}?
      </Heading>
      <Text fontSize="sm" mb={3}>
        La cuadrilla informó que te trasladó. Contanos cómo fue: tu respuesta ayuda a revisar que el traslado salió bien. No es una denuncia ni cambia nada para vos.
      </Text>
      <FormControl mb={3}>
        <FormLabel htmlFor={`conf-comentario-${c.id}`} fontSize="sm">
          Comentario (opcional)
        </FormLabel>
        <Textarea id={`conf-comentario-${c.id}`} size="sm" bg="superficie" rows={2} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </FormControl>
      <Flex gap={2} wrap="wrap">
        <Button size="md" minH="2.75rem" isLoading={enviando === "si"} isDisabled={enviando !== null} onClick={() => void responder("si")}>
          Sí, llegué
        </Button>
        <Button size="md" minH="2.75rem" variant="outline" isLoading={enviando === "no"} isDisabled={enviando !== null} onClick={() => void responder("no")}>
          No llegué
        </Button>
        <Button size="md" minH="2.75rem" variant="outline" isLoading={enviando === "problema"} isDisabled={enviando !== null} onClick={() => void responder("problema")}>
          Hubo un problema
        </Button>
      </Flex>
      {error !== null && (
        <Box mt={2}>
          <AlertaError error={error} />
        </Box>
      )}
      <Text fontSize="xs" color="textoSuave" mt={3}>
        Si no tenés internet, también podés responder por SMS desde tu teléfono registrado: SI {c.codigo}, NO {c.codigo} o PROBLEMA {c.codigo} y el detalle.
      </Text>
    </Box>
  );
}

/** Consultas pendientes de confirmación del traslado. Sin consultas, no muestra nada. */
export function ConfirmarTraslado() {
  const carga = useCarga(() => api.misConfirmaciones());
  const lista = carga.datos?.confirmaciones ?? [];
  const pendientes = lista.filter((c) => !c.respondida);
  const respondidas = lista.filter((c) => c.respondida);
  if (carga.estado !== "ok" || lista.length === 0) return null;
  return (
    <Box as="section" aria-label="Confirmar tu traslado" py={5} borderTop="1px solid" borderColor="borde" data-testid="confirmar-traslado">
      <Heading as="h2" size="md" mb={3}>
        Confirmar tu traslado
      </Heading>
      {pendientes.map((c) => (
        <Tarjeta key={c.id} c={c} alResponder={carga.recargar} />
      ))}
      {pendientes.length === 0 && <Text fontSize="sm">No tenés consultas pendientes.</Text>}
      {respondidas.length > 0 && (
        <Box as="ul" listStyleType="none" m={0} p={0} mt={2} fontSize="sm" color="textoSuave">
          {respondidas.map((c) => (
            <li key={c.id}>
              {c.centro_nombre ?? "Traslado"}: respondiste «{c.respuesta ? etiquetaRespuestaConfirmacion(c.respuesta) : ""}» el {fechaHora(c.respondida_en)}.
            </li>
          ))}
        </Box>
      )}
    </Box>
  );
}
