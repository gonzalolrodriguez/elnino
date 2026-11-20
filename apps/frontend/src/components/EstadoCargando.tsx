import { Center, Spinner } from "@chakra-ui/react";

/** Indicador de carga compartido por el panel y las páginas públicas: anuncia «Cargando» a los lectores de pantalla. */
export function EstadoCargando({ py = 8 }: { py?: number }) {
  return (
    <Center py={py} role="status" aria-label="Cargando" gap={3} color="textoSuave">
      <Spinner />
    </Center>
  );
}
