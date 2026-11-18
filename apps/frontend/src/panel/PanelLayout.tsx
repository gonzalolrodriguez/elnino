import { Box, Flex, Link, Text, useToast } from "@chakra-ui/react";
import { useCallback } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Layout } from "../components/Layout";
import { describirEvento, useTiempoReal, type EventoTiempoReal } from "../lib/ws";
import { EscenarioProvider } from "./EscenarioContext";

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

  const alEvento = useCallback(
    (e: EventoTiempoReal) => {
      const { titulo, detalle } = describirEvento(e);
      toast({ title: titulo, description: detalle, status: e.tipo === "orden" ? "warning" : "info", duration: 6000, isClosable: true, position: "bottom-right" });
    },
    [toast],
  );
  const ws = useTiempoReal(token, alEvento);
  const estadoWs = ESTADOS_WS[ws];

  return (
    <Layout contenedor={false} titulo="Panel operativo">
      <EscenarioProvider>
        <Flex direction={{ base: "column", lg: "row" }} minH="70vh">
          <Box
            as="nav"
            aria-label="Secciones del panel operativo"
            w={{ base: "100%", lg: "15.5rem" }}
            flexShrink={0}
            bg="pizarra.100"
            borderRight={{ lg: "1px solid" }}
            borderBottom={{ base: "1px solid", lg: "none" }}
            borderColor="borde"
            px={3}
            py={4}
          >
            <Text fontFamily="heading" fontWeight={600} fontSize="lg" mb={0.5}>
              Panel operativo
            </Text>
            <Text fontSize="sm" color="textoSuave" mb={3}>
              {usuario ? `${usuario.rol}${usuario.rol_operativo ? ` · ${usuario.rol_operativo}` : ""}` : ""}
            </Text>
            <Flex
              as="ul"
              listStyleType="none"
              m={0}
              p={0}
              direction={{ base: "row", lg: "column" }}
              overflowX={{ base: "auto", lg: "visible" }}
              gap={{ base: 1, lg: 0.5 }}
              pb={{ base: 1, lg: 0 }}
            >
              {SECCIONES.map((s) => (
                <li key={s.to} style={{ flex: "none" }}>
                  <Link
                    as={NavLink}
                    to={s.to}
                    end={"fin" in s}
                    display="flex"
                    alignItems="center"
                    minH="2.75rem"
                    px={3}
                    fontSize="sm"
                    fontWeight={600}
                    whiteSpace="nowrap"
                    color="texto"
                    textDecoration="none"
                    borderLeft={{ lg: "4px solid" }}
                    borderBottom={{ base: "3px solid", lg: "none" }}
                    borderColor="transparent"
                    transition="background-color 140ms var(--ease-out)"
                    _hover={{ bg: "pizarra.200", color: "texto", textDecoration: "none" }}
                    _activeLink={{ bg: "superficie", borderColor: "acento", fontWeight: 700 }}
                  >
                    {s.texto}
                  </Link>
                </li>
              ))}
            </Flex>
            <Flex align="center" gap={2} mt={4} fontSize="sm" role="status" aria-live="polite" data-testid="estado-ws">
              <Box as="span" w="10px" h="10px" borderRadius="full" bg={estadoWs.color} aria-hidden="true" />
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
