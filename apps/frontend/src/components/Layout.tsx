import { Box, Button, Flex, HStack, Link, Text } from "@chakra-ui/react";
import { LEYENDA } from "@evacuaciones/shared";
import { useEffect, type ReactNode } from "react";
import { Link as RouterLink, NavLink } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";

/** Marca: una escala limnimétrica con el nivel del agua. */
function Marca() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true" focusable="false">
      <rect x="6" y="1.5" width="10" height="23" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {[6.5, 11, 15.5].map((y) => (
        <line key={y} x1="6" x2="11" y1={y} y2={y} stroke="currentColor" strokeWidth="1.4" />
      ))}
      <rect x="6.8" y="16.5" width="8.4" height="7.2" style={{ fill: "var(--chakra-colors-agua-400)" }} />
      <line x1="2" x2="20" y1="9" y2="9" strokeWidth="1.6" style={{ stroke: "var(--chakra-colors-escala-alerta)" }} />
    </svg>
  );
}

function Enlace({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      as={NavLink}
      to={to}
      end={to === "/"}
      display="inline-flex"
      alignItems="center"
      minH="2.75rem"
      px={1}
      color="nav.fg"
      fontWeight={600}
      textDecoration="none"
      borderBottom="3px solid"
      borderColor="transparent"
      _hover={{ color: "nav.fg", textDecoration: "none", borderColor: "pizarra.400" }}
      _activeLink={{ borderColor: "nav.activo" }}
    >
      {children}
    </Link>
  );
}

function etiquetaPrivada(rol: string) {
  if (rol === "ciudadano" || rol === "productor") return "Mi cuenta";
  return rol === "cuadrilla" ? "Mis tareas" : "Panel";
}

function Navegacion() {
  const { estado, usuario, cerrarSesion } = useAuth();
  return (
    <Box as="header" role="banner" bg="nav.bg" color="nav.fg" className="sobre-oscuro">
      <Flex
        as="nav"
        aria-label="Navegación principal"
        maxW="7xl"
        mx="auto"
        px={{ base: 4, md: 8 }}
        pt={2}
        align="center"
        justify="space-between"
        wrap="wrap"
        columnGap={6}
        rowGap={0}
        fontSize="sm"
      >
        <Link
          as={RouterLink}
          to="/"
          display="inline-flex"
          alignItems="center"
          gap={2}
          minH="2.75rem"
          color="nav.fg"
          textDecoration="none"
          _hover={{ color: "nav.fg", textDecoration: "none" }}
        >
          <Marca />
          <Text as="span" fontFamily="heading" fontSize="lg" fontWeight={600} lineHeight={1.1} letterSpacing="-0.01em">
            Operación Agua
            <Text as="span" display="block" fontFamily="body" fontSize="xs" fontWeight={500} color="pizarra.300" letterSpacing="0.01em">
              Gestión de evacuaciones
            </Text>
          </Text>
        </Link>
        <HStack as="ul" listStyleType="none" m={0} p={0} spacing={{ base: 3, md: 6 }} wrap="wrap" rowGap={0}>
          <li><Enlace to="/">Inicio</Enlace></li>
          <li><Enlace to="/informacion">Información</Enlace></li>
          <li><Enlace to="/app">App móvil</Enlace></li>
          {estado === "autenticado" && usuario ? (
            <>
              <li><Enlace to={rutaInicio(usuario.rol)}>{etiquetaPrivada(usuario.rol)}</Enlace></li>
              {usuario.rol === "admin" && <li><Enlace to="/cuadrilla">Cuadrilla</Enlace></li>}
              <li>
                <Button size="sm" variant="sobreOscuro" onClick={() => void cerrarSesion()}>
                  Cerrar sesión
                </Button>
              </li>
            </>
          ) : (
            <li><Enlace to="/login">Ingresar</Enlace></li>
          )}
        </HStack>
      </Flex>
      <Box className="regla-escala" aria-hidden="true" mt={1} />
    </Box>
  );
}

/** Diseño base: la leyenda obligatoria queda fija en toda pantalla. */
export function Layout({ children, contenedor = true, titulo }: { children: ReactNode; contenedor?: boolean; titulo?: string }) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Operación Agua` : "Operación Agua · Gestión de evacuaciones";
  }, [titulo]);
  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Link
        href="#contenido"
        position="absolute"
        zIndex={40}
        left={2}
        top={2}
        px={4}
        py={2}
        bg="superficie"
        color="texto"
        fontWeight={700}
        borderRadius="sm"
        border="2px solid"
        borderColor="texto"
        transform="translateY(-200%)"
        _focus={{ transform: "translateY(0)" }}
        transition="transform 140ms var(--ease-out)"
      >
        Saltar al contenido
      </Link>
      <Box
        role="note"
        aria-label="Aviso de prototipo"
        position="sticky"
        top={0}
        zIndex={30}
        bg="leyenda.bg"
        color="leyenda.fg"
        py={1.5}
        px={4}
        fontSize="0.8125rem"
        fontWeight={600}
        lineHeight={1.35}
        textAlign="center"
      >
        {LEYENDA}
      </Box>
      <Navegacion />
      <Box
        as="main"
        id="contenido"
        tabIndex={-1}
        flex="1"
        _focus={{ outline: "none" }}
        {...(contenedor ? { maxW: "7xl", w: "100%", mx: "auto", px: { base: 4, md: 8 }, py: { base: 8, md: 12 } } : {})}
      >
        {children}
      </Box>
      <Box as="footer" bg="nav.bg" color="pizarra.200" className="sobre-oscuro" py={6} fontSize="sm">
        <Flex maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} gap={{ base: 3, md: 10 }} direction={{ base: "column", md: "row" }} justify="space-between">
          <Text maxW="44rem">
            Datos con corte al 31/10/2026. Cada cifra indica su categoría y su fuente; lo que no está en la ficha de fuentes no se muestra.
          </Text>
          <Link as={RouterLink} to="/informacion#fuentes" color="pizarra.100" fontWeight={600} whiteSpace="nowrap" _hover={{ color: "papel" }}>
            Fuentes y supuestos
          </Link>
        </Flex>
      </Box>
    </Box>
  );
}
