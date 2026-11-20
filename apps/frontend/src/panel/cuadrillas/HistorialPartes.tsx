import { Alert, AlertDescription, AlertIcon, Box, Button, Flex, Text, useToast } from "@chakra-ui/react";
import { useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { Cargando } from "../ui";
import { AvisoAtencion } from "./TarjetaCuadrilla";
import { ChipParte } from "./partes";

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
    <Box data-testid={`partes-tarea-${tareaId}`} p={3} bg="fondo" borderRadius="lg">
      {requiereAtencion && (
        <Alert status="warning" variant="subtle" fontSize="sm" mb={3} borderRadius="md">
          <AlertIcon />
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
            {d.items.map((p) => (
              <Box as="li" key={p.id} p={3} bg="superficie" border="1px solid" borderColor="borde" borderRadius="lg" data-testid="parte-historial">
                <Flex align="center" gap={2} wrap="wrap">
                  <ChipParte parte={p} />
                  {p.tipo === "dificultad" && (
                    <Text as="span" fontSize="sm" fontWeight={600}>
                      {p.resuelta ? "Resuelta" : "Sin resolver"}
                    </Text>
                  )}
                  {p.autor_rol && (
                    <Text as="span" fontSize="sm" color="textoSuave">
                      {etiquetaRolOperativo(p.autor_rol)}
                    </Text>
                  )}
                  <Text as="time" dateTime={p.creado_en} fontSize="sm" color="textoSuave" ml="auto">
                    {fechaHora(p.creado_en)}
                  </Text>
                </Flex>
                {p.observacion && (
                  <Text fontSize="sm" mt={1.5}>
                    {p.observacion}
                  </Text>
                )}
                {p.tipo === "dificultad" && p.resuelta === false && (
                  <Button size="xs" variant="outline" mt={2} onClick={() => void resolver(p.id)}>
                    Marcar dificultad como resuelta
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      />
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}
