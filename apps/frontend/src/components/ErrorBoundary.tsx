import { Box, Button, Heading, Text } from "@chakra-ui/react";
import { Component, type ReactNode } from "react";

import { Layout } from "./Layout";

/** Tarjeta de error con la leyenda a la vista: un fallo de una pantalla nunca la deja en blanco. */
export function PantallaError() {
  return (
    <Layout titulo="Algo salió mal">
      <Box role="alert" data-testid="pantalla-error" maxW="40rem" mx="auto" p={{ base: 5, md: 8 }} borderWidth="1px" borderRadius="xl" bg="superficie">
        <Heading as="h1" size="lg" mb={3}>
          Algo salió mal
        </Heading>
        <Text mb={5}>No pudimos mostrar esta pantalla. Tus datos no se perdieron. Recargá la página; si el problema sigue, volvé más tarde.</Text>
        <Button colorScheme="blue" onClick={() => window.location.reload()}>
          Recargar
        </Button>
      </Box>
    </Layout>
  );
}

/**
 * Límite de error global: captura fallos de dibujado de cualquier ruta y muestra una alternativa amable.
 * Se rearma cuando cambia `ruta` sin remontar a sus hijos: usar `key={pathname}` remontaba toda la app en cada
 * navegación y se perdía el estado compartido (por ejemplo, el escenario del panel).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; ruta?: string }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Error de pantalla", error);
  }
  componentDidUpdate(previas: { ruta?: string }) {
    if (this.state.fallo && previas.ruta !== this.props.ruta) this.setState({ fallo: false });
  }
  render() {
    return this.state.fallo ? <PantallaError /> : this.props.children;
  }
}
