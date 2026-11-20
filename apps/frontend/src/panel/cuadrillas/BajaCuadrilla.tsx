import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Button, Text, useToast } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { api } from "../api";
import { TACTIL } from "./partes";

/** Confirmación de baja. Si la API responde 409 (tiene una tarea en curso), se muestra su mensaje y no se da de baja. */
export function BajaCuadrilla({ cuadrilla, alCerrar, alBaja }: { cuadrilla: { id: number; nombre: string } | null; alCerrar: () => void; alBaja: () => void }) {
  const toast = useToast();
  const cancelar = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setError(null);
  }, [cuadrilla?.id]);

  async function confirmar() {
    if (!cuadrilla) return;
    setError(null);
    setEnviando(true);
    try {
      await api.bajaCuadrilla(cuadrilla.id);
      toast({ title: "Cuadrilla dada de baja", description: cuadrilla.nombre, status: "success", duration: 3000 });
      alBaja();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AlertDialog isOpen={cuadrilla !== null} leastDestructiveRef={cancelar} onClose={alCerrar} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent mx={3}>
          <AlertDialogHeader>Dar de baja la cuadrilla</AlertDialogHeader>
          <AlertDialogBody>
            <Text mb={3}>
              ¿Dar de baja a <strong>{cuadrilla?.nombre}</strong>? Si tiene historial de tareas se conserva y la cuadrilla queda como «baja»; si no, se elimina.
            </Text>
            <AlertaError error={error} />
          </AlertDialogBody>
          <AlertDialogFooter gap={2}>
            <Button ref={cancelar} variant="outline" {...TACTIL} onClick={alCerrar}>
              Cancelar
            </Button>
            <Button colorScheme="red" {...TACTIL} onClick={() => void confirmar()} isLoading={enviando} loadingText="Dando de baja">
              Dar de baja
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}
