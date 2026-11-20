import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, Text, useToast } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { Cargando, Chip } from "../ui";
import { GaleriaEvidencia } from "./GaleriaEvidencia";
import { AvisoAtencion, ChipParte, TACTIL } from "./partes";

/** Historial de partes de una tarea (más nuevo primero), con la acción de resolver dificultades. */
export function HistorialPartes({ tareaId, requiereAtencion, alCambiar }: { tareaId: number; requiereAtencion: boolean; alCambiar: () => void }) {
  const carga = useCarga(() => api.partesDeTarea(tareaId), [tareaId]);
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);

  async function resolver(parteId: number) {
    setError(null);
    try {
      await api.resolverParte(parteId);
      toast({ title: "Dificultad marcada como resuelta", status: "success", duration: 2500 });
      carga.recargar();
      alCambiar();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Box data-testid={`partes-tarea-${tareaId}`} p={{ base: 2.5, md: 3 }} bg="fondo" borderRadius="lg" border="1px solid" borderColor="borde" minW={0} fontWeight={400}>
      {requiereAtencion && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} borderRadius="md" alignItems="flex-start">
          <AlertIcon mt="2px" />
          <AlertDescription>
            <AvisoAtencion /> La cuadrilla no pudo cerrar esta tarea. Revisá los partes y, si hace falta, reasignala a otra cuadrilla en la columna «Cuadrilla».
          </AlertDescription>
        </Alert>
      )}
      <Cargando
        carga={carga}
        esVacio={(d) => d.items.length === 0}
        vacio="La cuadrilla todavía no informó nada sobre esta tarea."
        hijos={(d) => (
          <Box as="ol" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={2}>
            {d.items.map((p) => {
              const abierta = p.tipo === "dificultad" && p.resuelta === false;
              return (
                <Box as="li" key={p.id} p={3} bg={abierta ? "alerta.50" : "superficie"} border="1px solid" borderColor={abierta ? "alerta.200" : "borde"} borderRadius="lg" data-testid="parte-historial">
                  <Flex align="center" columnGap={2} rowGap={1} wrap="wrap">
                    <ChipParte parte={p} />
                    {p.tipo === "dificultad" && (
                      <Chip tono={p.resuelta ? "ok" : "alerta"}>{p.resuelta ? "Resuelta" : "Sin resolver"}</Chip>
                    )}
                    {p.autor_rol && (
                      <Text as="span" fontSize="sm" color="textoSuave">
                        {etiquetaRolOperativo(p.autor_rol)}
                      </Text>
                    )}
                    <Text as="time" dateTime={p.creado_en} textStyle="microdato" ml={{ md: "auto" }}>
                      {fechaHora(p.creado_en)}
                    </Text>
                  </Flex>
                  {p.observacion && (
                    <Text fontSize="sm" mt={1.5} overflowWrap="anywhere">
                      {p.observacion}
                    </Text>
                  )}
                  {p.adjuntos && p.adjuntos.length > 0 && <GaleriaEvidencia tareaId={tareaId} parteId={p.id} adjuntos={p.adjuntos} />}
                  {abierta && (
                    <Button size="sm" {...TACTIL} variant="outline" mt={2} onClick={() => void resolver(p.id)}>
                      Marcar dificultad como resuelta
                    </Button>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      />
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}
