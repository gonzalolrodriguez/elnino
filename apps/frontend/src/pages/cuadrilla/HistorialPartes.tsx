import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useState, type ReactElement } from "react";

import { EstadoCargando } from "../../components/EstadoCargando";
import { AlertaError } from "../../components/Formulario";
import { IconoAlerta, IconoHistorial, IconoReloj, IconoRumbo, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { ETIQUETA_RESULTADO, partesDeTarea, type Parte } from "../../lib/partes";
import { useCarga } from "../../lib/useCarga";

const VISIBLES = 5;

type Vista = { icono: ReactElement; etiqueta: string; fondo: string; color: string };

/** Ícono, texto y color del parte: el significado va siempre en el texto, el color solo refuerza. */
function vistaDe(p: Parte): Vista {
  if (p.tipo === "dificultad") {
    return p.resuelta
      ? { icono: <IconoTilde tam="1rem" />, etiqueta: "Dificultad resuelta", fondo: "verde.100", color: "verde.800" }
      : { icono: <IconoTriangulo tam="1rem" />, etiqueta: "Dificultad abierta", fondo: "alerta.100", color: "alerta.900" };
  }
  if (p.tipo === "resultado") {
    const r = p.resultado;
    const etiqueta = r ? `Resultado: ${ETIQUETA_RESULTADO[r].toLowerCase()}` : "Resultado";
    if (r === "completa") return { icono: <IconoTilde tam="1rem" />, etiqueta, fondo: "verde.100", color: "verde.800" };
    if (r === "reprogramada") return { icono: <IconoReloj tam="1rem" />, etiqueta, fondo: "agua.100", color: "agua.800" };
    return { icono: <IconoAlerta tam="1rem" />, etiqueta, fondo: "alerta.100", color: "alerta.900" };
  }
  return { icono: <IconoRumbo tam="1rem" />, etiqueta: "Avance", fondo: "limo.100", color: "limo.800" };
}

function FilaParte({ p }: { p: Parte }) {
  const v = vistaDe(p);
  const abierta = p.tipo === "dificultad" && !p.resuelta;
  return (
    <Flex as="li" gap={3} data-testid={`parte-${p.id}`} data-abierta={abierta} p={abierta ? 2.5 : 0} borderRadius="lg" bg={abierta ? "alerta.50" : undefined} border={abierta ? "1px solid" : undefined} borderColor={abierta ? "alerta.200" : undefined}>
      <Flex aria-hidden="true" align="center" justify="center" flex="none" w="2rem" h="2rem" borderRadius="full" bg={v.fondo} color={v.color}>
        {v.icono}
      </Flex>
      <Box minW={0} flex="1">
        <Flex align="center" gap={2} wrap="wrap">
          <Text as="span" fontSize="sm" fontWeight={700} px={2} borderRadius="full" bg={v.fondo} color={v.color}>
            {v.etiqueta}
          </Text>
          <Text as="time" fontSize="xs" color="textoSuave" dateTime={p.creado_en}>
            {fechaHora(p.creado_en)}
            {p.autor_rol ? ` · ${etiquetaRolOperativo(p.autor_rol)}` : ""}
          </Text>
        </Flex>
        {p.observacion && (
          <Text fontSize="sm" mt={1} whiteSpace="pre-wrap" overflowWrap="anywhere">
            {p.observacion}
          </Text>
        )}
      </Box>
    </Flex>
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
        <Text as="h4" fontSize="sm" fontWeight={700}>
          Historial de partes
        </Text>
      </Flex>
      {carga.estado === "cargando" && <EstadoCargando />}
      {carga.estado === "error" && (
        <Box>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </Box>
      )}
      {carga.estado === "ok" && carga.datos.length === 0 && (
        <Text fontSize="sm" color="textoSuave">
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
            <Button mt={2} size="sm" variant="ghost" onClick={() => setTodos((t) => !t)}>
              {todos ? "Ver menos" : `Ver los ${carga.datos.length} partes`}
            </Button>
          )}
        </>
      )}
    </Box>
  );
}
