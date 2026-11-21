import { Box, Button, Flex, Link, Text } from "@chakra-ui/react";
import { LEYENDA } from "@evacuaciones/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link as RouterLink, NavLink, useLocation } from "react-router-dom";

import { rutaInicio, useAuth } from "../auth/AuthContext";
import { ANCHO_CONTENEDOR, GUTTER, type AnchoContenedor } from "./Contenedor";
import { Marca } from "./Marca";

function Enlace({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      as={NavLink}
      to={to}
      end={to === "/"}
      display="flex"
      alignItems="center"
      minH="2.5rem"
      px={3.5}
      borderRadius="full"
      color="texto"
      fontWeight={600}
      textDecoration="none"
      transition="background-color 160ms var(--ease-out), color 160ms var(--ease-out)"
      _hover={{ color: "primarioHover", textDecoration: "none", bg: "pizarra.100" }}
      _activeLink={{ color: "primarioHover", bg: "suave" }}
    >
      {children}
    </Link>
  );
}

function etiquetaPrivada(rol: string) {
  if (rol === "ciudadano" || rol === "productor") return "Mi cuenta";
  if (rol === "admin") return "Administración";
  return rol === "cuadrilla" ? "Mis tareas" : "Panel operativo";
}

function IconoMenu({ abierto }: { abierto: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {abierto ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
    </svg>
  );
}

function Navegacion() {
  const { estado, usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const ubicacion = useLocation();

  // Al navegar, el menú se pliega (en pantallas angostas cubriría el contenido nuevo).
  useEffect(() => {
    setAbierto(false);
  }, [ubicacion.pathname, ubicacion.hash]);

  // Escape cierra el menú y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    const salir = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("keydown", salir);
    return () => document.removeEventListener("keydown", salir);
  }, [abierto]);

  return (
    <Box as="header" role="banner" bg="nav.bg" color="nav.fg" borderBottom="1px solid" borderColor="borde">
      <Flex
        as="nav"
        aria-label="Navegación principal"
        maxW={ANCHO_CONTENEDOR.datos}
        mx="auto"
        px={GUTTER}
        py={2}
        align="center"
        justify="space-between"
        wrap="wrap"
        fontSize="sm"
        data-testid="navegacion-principal"
      >
        <Link
          as={RouterLink}
          to="/"
          display="inline-flex"
          alignItems="center"
          minH="2.75rem"
          color="texto"
          textDecoration="none"
          _hover={{ color: "texto", textDecoration: "none" }}
        >
          <Box as="span" mr={2.5} display="inline-flex" color="primario">
            <Marca />
          </Box>
          <Text as="span" fontSize="lg" fontWeight={700} lineHeight={1.1} letterSpacing="-0.02em">
            EvacuaFor
            <Text as="span" display="block" fontSize="xs" fontWeight={400} color="textoSuave" letterSpacing="0">
              Gestión de evacuaciones
            </Text>
          </Text>
        </Link>
        <Button
          ref={boton}
          type="button"
          variant="outline"
          size="sm"
          display={{ base: "inline-flex", md: "none" }}
          aria-expanded={abierto}
          aria-controls="menu-principal"
          aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"}
          onClick={() => setAbierto((v) => !v)}
          data-testid="boton-menu"
        >
          <IconoMenu abierto={abierto} />
          <Text as="span" ml={2}>
            Menú
          </Text>
        </Button>
        <Box
          as="ul"
          id="menu-principal"
          listStyleType="none"
          m={0}
          p={0}
          display={{ base: abierto ? "flex" : "none", md: "flex" }}
          flexDirection={{ base: "column", md: "row" }}
          alignItems={{ base: "stretch", md: "center" }}
          flexWrap="wrap"
          w={{ base: "100%", md: "auto" }}
          pt={{ base: 2, md: 0 }}
          sx={{ "& > li": { marginLeft: 0 }, "@media (min-width: 48em)": { "& > li + li": { marginLeft: "0.25rem" } } }}
        >
          <li><Enlace to="/">Inicio</Enlace></li>
          <li><Enlace to="/informacion">Información</Enlace></li>
          <li><Enlace to="/app">App móvil</Enlace></li>
          {estado === "autenticado" && usuario ? (
            <>
              <li><Enlace to={rutaInicio(usuario.rol)}>{etiquetaPrivada(usuario.rol)}</Enlace></li>
              {usuario.rol === "admin" && <li><Enlace to="/comando">Panel operativo</Enlace></li>}
              {usuario.rol === "admin" && <li><Enlace to="/cuadrilla">Tareas de cuadrilla</Enlace></li>}
              <li>
                <Button size="sm" variant="outline" onClick={() => void cerrarSesion()} my={{ base: 1, md: 0 }} ml={{ md: 2 }}>
                  Cerrar sesión
                </Button>
              </li>
            </>
          ) : (
            <li>
              <Button as={RouterLink} to="/login" size="sm" ml={{ md: 2 }} my={{ base: 1, md: 0 }}>
                Ingresar
              </Button>
            </li>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

function ColumnaPie({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box as="nav" aria-label={titulo} minW={0}>
      <Text fontWeight={700} color="oscuro.fg" mb={3}>
        {titulo}
      </Text>
      <Box as="ul" listStyleType="none" m={0} p={0} sx={{ "& > li + li": { marginTop: "0.25rem" } }}>
        {children}
      </Box>
    </Box>
  );
}

function EnlacePie({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  // Área táctil de al menos 24 px de alto (WCAG 2.2, 2.5.8) sin cambiar la separación visual entre enlaces.
  const comun = { display: "inline-block", py: "0.25rem", color: "oscuro.suave", textDecoration: "none", _hover: { color: "oscuro.fg", textDecoration: "underline" } } as const;
  return (
    <li>
      {to ? (
        <Link as={RouterLink} to={to} {...comun}>
          {children}
        </Link>
      ) : (
        <Link href={href} isExternal {...comun}>
          {children}
        </Link>
      )}
    </li>
  );
}

const REPOSITORIO = "https://github.com/gonzalolrodriguez/elnino";

/** Pie profesional: identidad, navegación, datos y fuentes, ayuda y privacidad, y la leyenda obligatoria. */
function Pie() {
  return (
    <Box as="footer" role="contentinfo" bg="oscuro.bg" color="oscuro.suave" className="sobre-oscuro" fontSize="sm">
      <Box maxW={ANCHO_CONTENEDOR.datos} mx="auto" px={GUTTER} pt={{ base: 10, md: 14 }} pb={6}>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "1.5fr 1fr 1.2fr 1.5fr" }} gap={{ base: 8, lg: 10 }}>
          <Box minW={0}>
            <Flex align="center" color="oscuro.fg" mb={3}>
              <Box as="span" mr={2.5} display="inline-flex" color="agua.300">
                <Marca />
              </Box>
              <Text as="span" fontSize="lg" fontWeight={700} letterSpacing="-0.02em">
                EvacuaFor
              </Text>
            </Flex>
            <Text color="oscuro.fg" fontWeight={600}>
              Gestión de evacuaciones
            </Text>
            <Text mt={1}>Equipo 3 · Instituto Politécnico Formosa</Text>
            <Text>AI LAB Misión: Código Formosa</Text>
          </Box>

          <ColumnaPie titulo="Navegación">
            <EnlacePie to="/">Inicio</EnlacePie>
            <EnlacePie to="/informacion">Información</EnlacePie>
            <EnlacePie to="/app">App móvil</EnlacePie>
            <EnlacePie to="/login">Ingresar</EnlacePie>
          </ColumnaPie>

          <ColumnaPie titulo="Datos y fuentes">
            <li>Datos con corte al 31/10/2026.</li>
            <EnlacePie to="/informacion#fuentes">Ficha de fuentes y supuestos</EnlacePie>
            <EnlacePie to="/#limites">Límites de la plataforma</EnlacePie>
          </ColumnaPie>

          <Box minW={0}>
            <Text fontWeight={700} color="oscuro.fg" mb={3}>
              Ayuda y privacidad
            </Text>
            <Text>Esta plataforma no reemplaza al 103 ni a Defensa Civil. Ante una emergencia, llamá al 103.</Text>
            <Text mt={2}>
              Tus datos se usan solo para la gestión de emergencias, según la Ley 25.326. Podés pedir el acceso, la rectificación o la supresión.
            </Text>
          </Box>
        </Box>

        <Flex
          mt={{ base: 8, md: 10 }}
          pt={5}
          borderTop="1px solid"
          borderColor="oscuro.linea"
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ md: "center" }}
          gap={3}
          fontSize="xs"
        >
          <Text role="note" aria-label="Aviso de prototipo (pie)">
            {LEYENDA}
          </Text>
          <Link href={REPOSITORIO} isExternal color="oscuro.suave" textDecoration="none" _hover={{ color: "oscuro.fg", textDecoration: "underline" }}>
            Código fuente en GitHub
          </Link>
        </Flex>
      </Box>
    </Box>
  );
}

/** Diseño base: la leyenda obligatoria queda fija arriba en toda pantalla y se repite en el pie. */
export function Layout({
  children,
  contenedor = true,
  ancho = "lectura",
  titulo,
}: {
  children: ReactNode;
  /** `false` deja el contenido a sangre (landing, panel): la página arma su propio contenedor. */
  contenedor?: boolean;
  /** Ancho del contenedor: `lectura` (72rem: público, formularios, ciudadano) o `datos` (90rem: paneles y tableros). */
  ancho?: AnchoContenedor;
  titulo?: string;
}) {
  const { hash } = useLocation();
  useEffect(() => {
    document.title = titulo ? `${titulo} · EvacuaFor` : "EvacuaFor · Gestión de evacuaciones";
  }, [titulo]);
  // Los enlaces con ancla (p. ej. el pie) llevan a la sección aunque cambie de ruta.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [hash]);
  return (
    <Box minH="100vh" className="alto-pantalla" display="flex" flexDirection="column">
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
        borderRadius="lg"
        transform="translateY(-200%)"
        _focus={{ transform: "translateY(0)" }}
        transition="transform 140ms var(--ease-out)"
      >
        Saltar al contenido
      </Link>
      {/* La cinta vive dentro de una región con nombre: así no queda fuera de ningún landmark (axe `region`). */}
      <Box
        as="section"
        aria-label="Prototipo"
        position="sticky"
        top={0}
        zIndex={30}
        bg="leyenda.bg"
        color="leyenda.fg"
        py={1.5}
        px={4}
        fontSize="xs"
        fontWeight={600}
        lineHeight={1.35}
        textAlign="center"
      >
        <Box role="note" aria-label="Aviso de prototipo">
          {LEYENDA}
        </Box>
      </Box>
      <Navegacion />
      <Box
        as="main"
        id="contenido"
        tabIndex={-1}
        flex="1"
        _focus={{ outline: "none" }}
        {...(contenedor ? { maxW: ANCHO_CONTENEDOR[ancho], w: "100%", mx: "auto", px: GUTTER, py: { base: 8, md: 12 } } : {})}
      >
        {children}
      </Box>
      <Pie />
    </Box>
  );
}
