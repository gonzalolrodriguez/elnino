import { Box } from "@chakra-ui/react";
import { LEYENDA } from "@evacuaciones/shared";
import type { ReactNode } from "react";

/** Diseño base: la leyenda obligatoria queda fija en toda pantalla. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <Box minH="100vh">
      <Box
        as="header"
        role="banner"
        position="sticky"
        top={0}
        zIndex={10}
        bg="orange.800"
        color="white"
        py={2}
        px={4}
        fontSize="sm"
        fontWeight="semibold"
        textAlign="center"
      >
        {LEYENDA}
      </Box>
      <Box as="main" maxW="4xl" mx="auto" p={6}>
        {children}
      </Box>
    </Box>
  );
}
