import { Box, Button, Flex, Link, Text, useToast } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Layout } from "../components/Layout";
import { describirEvento, useTiempoReal, type EventoTiempoReal } from "../lib/ws";
import { EscenarioProvider } from "./EscenarioContext";
import { etiquetaRol, etiquetaRolOperativo } from "../lib/etiquetas";

const SECCIONES = [
  { to: "/comando", fin: true, texto: "Monitor" },
  { to: "/comando/mapa", texto: "Mapa y simulador" },
  { to: "/comando/recomendacion", texto: "Recomendación" },
  { to: "/comando/produccion", texto: "Arca Productiva" },
  { to: "/comando/operacion", texto: "Operación" },
  { to: "/comando/lluvia", texto: "Lluvia" },
  { to: "/comando/ordenes", texto: "Órdenes" },
  { to: "/comando/bitacora", texto: "Bitácora K8" },
  { to: "/comando/centinela", texto: "Centinela" },
  { to: "/comando/limites", texto: "Límites" },
] as const;

const ESTADOS_WS = {
  conectado: { texto: "Tiempo real conectado", color: "primario" },
  conectando: { texto: "Conectando tiempo real…", color: "alerta.600" },
  desconectado: { texto: "Tiempo real desconectado", color: "escala.evacuacion" },
} as const;

/** Estructura del panel operativo: navegación lateral, escenario compartido y avisos en tiempo real. */
export function PanelLayout() {
  const { usuario, token } = useAuth();
  const toast = useToast();

  // Solo avisan las órdenes y las solicitudes; el resto (escenario, tareas) actualiza las pantallas sin interrumpir.
  // Si llegan en ráfaga se agrupan en un único aviso con el contador, en vez de apilar uno por evento.
  const acumulados = useRef<Record<string, number>>({});
  const alEvento = useCallback(
    (e: EventoTiempoReal) => {
      if (e.tipo !== "orden" && e.tipo !== "solicitud") return;
      const id = `evento-${e.tipo}`;
      const { titulo, detalle } = describirEvento(e);
      const n = (acumulados.current[id] = (acumulados.current[id] ?? 0) + 1);
      const opciones = {
        title: n > 1 ? `${titulo} (${n} nuevas)` : titulo,
        description: n > 1 ? `Última: ${detalle}` : detalle,
        status: e.tipo === "orden" ? ("warning" as const) : ("info" as const),
        duration: 6000,
        isClosable: true,
        position: "bottom-right" as const,
        onCloseComplete: () => {
          acumulados.current[id] = 0;
        },
      };
      if (toast.isActive(id)) toast.update(id, opciones);
      else toast({ id, ...opciones });
    },
    [toast],
  );
  const ws = useTiempoReal(token, alEvento);
  const estadoWs = ESTADOS_WS[ws];
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  // Por debajo de lg la lista de secciones es plegable: se cierra al cambiar de sección.
  useEffect(() => setAbierto(false), [pathname]);
  const actual = SECCIONES.find((s) => ("fin" in s ? pathname === s.to || pathname === `${s.to}/` : pathname.startsWith(s.to)))?.texto ?? "Secciones";

  return (
    <Layout contenedor={false} titulo="Panel operativo">
      <EscenarioProvider>
        <Flex direction={{ base: "column", lg: "row" }} minH="70vh" maxW="110rem" mx="auto" w="100%">
          <Box
            as="nav"
            aria-label="Secciones del panel operativo"
            w={{ base: "100%", lg: "15.5rem" }}
            flexShrink={0}
            bg="superficie"
            borderRight={{ lg: "1px solid" }}
            borderBottom={{ base: "1px solid", lg: "none" }}
            borderColor="borde"
            px={3}
            py={5}
          >
            <Text fontWeight={700} fontSize="lg" letterSpacing="-0.02em" mb={0.5}>
              Panel operativo
            </Text>
            <Text fontSize="sm" color="textoSuave" mb={3}>
              {usuario ? `${etiquetaRol(usuario.rol)}${usuario.rol_operativo ? ` · ${etiquetaRolOperativo(usuario.rol_operativo)}` : ""}` : ""}
            </Text>
            <Button
              type="button"
              variant="outline"
              size="sm"
              w="100%"
              justifyContent="space-between"
              display={{ base: "flex", lg: "none" }}
              aria-expanded={abierto}
              aria-controls="secciones-panel"
              onClick={() => setAbierto((v) => !v)}
              data-testid="boton-secciones"
              mb={abierto ? 2 : 0}
            >
              <span>Sección: {actual}</span>
              <span aria-hidden="true">{abierto ? "▲" : "▼"}</span>
            </Button>
            <Flex
              id="secciones-panel"
              display={{ base: abierto ? "flex" : "none", lg: "flex" }}
              as="ul"
              listStyleType="none"
              m={0}
              p={0}
              direction="column"
              sx={{ "& > li + li": { marginTop: "0.125rem" } }}
            >
              {SECCIONES.map((s) => (
                <li key={s.to}>
                  <Link
                    as={NavLink}
                    to={s.to}
                    end={"fin" in s}
                    display="flex"
                    alignItems="center"
                    minH="2.75rem"
                    px={3.5}
                    fontSize="sm"
                    fontWeight={600}
                    whiteSpace="nowrap"
                    color="texto"
                    textDecoration="none"
                    borderRadius="lg"
                    transition="background-color 140ms var(--ease-out), color 140ms var(--ease-out)"
                    _hover={{ bg: "pizarra.100", color: "texto", textDecoration: "none" }}
                    _activeLink={{ bg: "suave", color: "primarioHover" }}
                  >
                    {s.texto}
                  </Link>
                </li>
              ))}
            </Flex>
            <Flex align="center" mt={4} fontSize="sm" role="status" aria-live="polite" data-testid="estado-ws">
              <Box as="span" w="10px" h="10px" mr={2} flexShrink={0} borderRadius="full" bg={estadoWs.color} aria-hidden="true" />
              {estadoWs.texto}
            </Flex>
          </Box>
          <Box flex="1" minW={0} px={{ base: 4, md: 6 }} py={{ base: 5, md: 6 }}>
            <Outlet />
          </Box>
        </Flex>
      </EscenarioProvider>
    </Layout>
  );
}
