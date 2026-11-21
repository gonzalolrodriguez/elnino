import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useState, type ReactElement } from "react";

import { EstadoCargando } from "../../components/EstadoCargando";
import { AlertaError } from "../../components/Formulario";
import { IconoAlerta, IconoHistorial, IconoReloj, IconoRumbo, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { ETIQUETA_RESULTADO, partesDeTarea, type Parte } from "../../lib/partes";
import { useCarga } from "../../lib/useCarga";
import { TACTIL } from "../../panel/cuadrillas/partes";
import { Chip, type TonoChip } from "../../panel/ui";
import { MiniaturaAdjunto } from "./AdjuntosParte";

const VISIBLES = 5;

type Vista = { icono: ReactElement; etiqueta: string; tono: TonoChip };

/** Ícono, texto y tono del parte: el significado va siempre en el texto, el color solo refuerza. */
function vistaDe(p: Parte): Vista {
  if (p.tipo === "dificultad") {
    return p.resuelta
      ? { icono: <IconoTilde tam="0.9rem" />, etiqueta: "Dificultad resuelta", tono: "ok" }
      : { icono: <IconoTriangulo tam="0.9rem" />, etiqueta: "Dificultad abierta", tono: "aviso" };
  }
  if (p.tipo === "resultado") {
    const r = p.resultado;
    const etiqueta = r ? `Resultado: ${ETIQUETA_RESULTADO[r].toLowerCase()}` : "Resultado";
    if (r === "completa") return { icono: <IconoTilde tam="0.9rem" />, etiqueta, tono: "ok" };
    if (r === "reprogramada") return { icono: <IconoReloj tam="0.9rem" />, etiqueta, tono: "info" };
    return { icono: <IconoAlerta tam="0.9rem" />, etiqueta, tono: "aviso" };
  }
  return { icono: <IconoRumbo tam="0.9rem" />, etiqueta: "Avance", tono: "info" };
}

function FilaParte({ p }: { p: Parte }) {
  const v = vistaDe(p);
  const abierta = p.tipo === "dificultad" && !p.resuelta;
  return (
    <Box as="li" data-testid={`parte-${p.id}`} data-abierta={abierta} p={abierta ? 3 : 0} borderRadius="lg" bg={abierta ? "alerta.50" : undefined} border={abierta ? "1px solid" : undefined} borderColor={abierta ? "alerta.200" : undefined}>
      <Flex align="center" columnGap={2} rowGap={1} wrap="wrap">
        <Chip tono={v.tono} icono={v.icono}>
          {v.etiqueta}
        </Chip>
        <Text as="time" textStyle="microdato" dateTime={p.creado_en}>
          {fechaHora(p.creado_en)}
          {p.autor_rol ? ` · ${etiquetaRolOperativo(p.autor_rol)}` : ""}
        </Text>
      </Flex>
      {p.observacion && (
        <Text mt={1.5} whiteSpace="pre-wrap" overflowWrap="anywhere" maxW="70ch">
          {p.observacion}
        </Text>
      )}
      {(p.adjuntos ?? []).length > 0 && (
        <Flex gap={2} mt={2} wrap="wrap" role="group" aria-label={`Evidencia del parte ${p.id}`}>
          {(p.adjuntos ?? []).map((ad) => (
            <MiniaturaAdjunto key={ad.n} tareaId={p.tarea_id} parteId={p.id} adjunto={ad} />
          ))}
        </Flex>
      )}
    </Box>
  );
}

/** Historial de partes de una tarea, del más nuevo al más viejo. `refresco` fuerza una nueva lectura tras enviar un parte. */
export function HistorialPartes({ tareaId, refresco }: { tareaId: number; refresco: number }) {
  const carga = useCarga(() => partesDeTarea(tareaId), [tareaId, refresco]);
  const [todos, setTodos] = useState(false);

  return (
    <Box data-testid={`historial-${tareaId}`}>
      <Flex align="center" gap={2} mb={2} color="textoSuave">
        <IconoHistorial tam="1rem" />
        <Text as="h4" textStyle="rotulo" color="texto">
          Historial de partes
        </Text>
      </Flex>
      {carga.estado === "cargando" && <EstadoCargando />}
      {carga.estado === "error" && (
        <Box>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" {...TACTIL} variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </Box>
      )}
      {carga.estado === "ok" && carga.datos.length === 0 && (
        <Text textStyle="microdato">
          Todavía no informaste nada sobre esta tarea.
        </Text>
      )}
      {carga.estado === "ok" && carga.datos.length > 0 && (
        <>
          <Flex as="ul" direction="column" gap={3} listStyleType="none" m={0} p={0}>
            {(todos ? carga.datos : carga.datos.slice(0, VISIBLES)).map((p) => (
              <FilaParte key={p.id} p={p} />
            ))}
          </Flex>
          {carga.datos.length > VISIBLES && (
            <Button mt={2} size="sm" {...TACTIL} variant="ghost" onClick={() => setTodos((t) => !t)}>
              {todos ? "Ver menos" : `Ver los ${carga.datos.length} partes`}
            </Button>
          )}
        </>
      )}
    </Box>
  );
}
