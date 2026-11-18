import { Heading, VStack } from "@chakra-ui/react";

import { EstadoBackend } from "./components/EstadoBackend";
import { Layout } from "./components/Layout";

export default function App() {
  return (
    <Layout>
      <VStack align="stretch" spacing={6}>
        <Heading as="h1" size="lg">
          Plataforma de Gestión de Evacuaciones · Equipo 3
        </Heading>
        <EstadoBackend />
      </VStack>
    </Layout>
  );
}
