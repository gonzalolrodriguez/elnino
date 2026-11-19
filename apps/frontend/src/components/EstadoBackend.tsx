import { Alert, AlertIcon, Box, Heading, Spinner, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { obtenerSalud } from "../lib/api";

type Estado = { tipo: "cargando" } | { tipo: "ok" } | { tipo: "error"; mensaje: string };

export function EstadoBackend() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let activo = true;
    obtenerSalud()
      .then(() => activo && setEstado({ tipo: "ok" }))
      .catch((e: unknown) => {
        if (activo)
          setEstado({
            tipo: "error",
            mensaje: e instanceof Error ? e.message : "Error desconocido",
          });
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <Box layerStyle="tarjeta" p={4}>
      <Heading as="h3" size="sm" mb={3}>
        Estado del backend
      </Heading>
      {estado.tipo === "cargando" && (
        <Text as="div" display="flex" alignItems="center" gap={2}>
          <Spinner size="sm" /> Consultando el backend…
        </Text>
      )}
      {estado.tipo === "ok" && (
        <Alert status="success">
          <AlertIcon />
          backend OK
        </Alert>
      )}
      {estado.tipo === "error" && (
        <Alert status="error">
          <AlertIcon />
          No se pudo conectar con el backend ({estado.mensaje})
        </Alert>
      )}
    </Box>
  );
}
