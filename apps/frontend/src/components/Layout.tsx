import { Box, Button, Flex, HStack, Link, Text } from "@chakra-ui/react";
import { LEYENDA } from "@evacuaciones/shared";
import type { ReactNode } from "react";
import { Link as RouterLink, NavLink } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";

function Enlace({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      style={({ isActive }) => ({
        padding: "4px 2px",
        fontWeight: isActive ? 700 : 500,
        borderBottom: isActive ? "2px solid #D99A1E" : "2px solid transparent",
      })}
    >
      {children}
    </NavLink>
  );
}

function Navegacion() {
  const { estado, usuario, cerrarSesion } = useAuth();
  return (
    <Flex
      as="nav"
      aria-label="Navegación principal"
      bg="limo.900"
      color="pizarra.100"
      px={{ base: 4, md: 8 }}
      py={2}
      align="center"
      justify="space-between"
      wrap="wrap"
      gap={3}
      fontSize="sm"
    >
      <Link as={RouterLink} to="/" fontFamily="heading" fontSize="lg" fontWeight={600} _hover={{ textDecoration: "none" }}>
        Operación Agua · Evacuaciones
      </Link>
      <HStack spacing={5} wrap="wrap">
        <Enlace to="/">Inicio</Enlace>
        <Enlace to="/el-nino">El Niño</Enlace>
        <Enlace to="/app">App móvil</Enlace>
        {estado === "autenticado" && usuario ? (
          <>
            <Enlace to={rutaInicio(usuario.rol)}>{usuario.rol === "ciudadano" || usuario.rol === "productor" ? "Mi cuenta" : "Panel"}</Enlace>
            <Button size="xs" variant="outline" color="pizarra.100" _hover={{ bg: "limo.700" }} onClick={() => void cerrarSesion()}>
              Cerrar sesión
            </Button>
          </>
        ) : (
          <Enlace to="/login">Ingresar</Enlace>
        )}
      </HStack>
    </Flex>
  );
}

/** Diseño base: la leyenda obligatoria queda fija en toda pantalla. */
export function Layout({ children, contenedor = true }: { children: ReactNode; contenedor?: boolean }) {
  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Box
        as="header"
        role="banner"
        position="sticky"
        top={0}
        zIndex={20}
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
      <Navegacion />
      <Box as="main" flex="1" {...(contenedor ? { maxW: "5xl", w: "100%", mx: "auto", px: { base: 4, md: 6 }, py: 8 } : {})}>
        {children}
      </Box>
      <Box as="footer" bg="limo.900" color="pizarra.200" px={{ base: 4, md: 8 }} py={5} fontSize="xs">
        <Text maxW="5xl" mx="auto">
          Datos con corte al 31/10/2026. Cada cifra indica su categoría y su fuente; lo que no está en la ficha de fuentes no se muestra.
        </Text>
      </Box>
    </Box>
  );
}
