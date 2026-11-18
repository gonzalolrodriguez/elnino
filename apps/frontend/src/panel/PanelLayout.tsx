import { Box, Flex, Text, useToast } from "@chakra-ui/react";
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
  conectado: { texto: "Tiempo real conectado", color: "#1B5C58" },
  conectando: { texto: "Conectando tiempo real…", color: "#B07A12" },
  desconectado: { texto: "Tiempo real desconectado", color: "#9B2D20" },
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
    <Layout contenedor={false}>
      <EscenarioProvider>
        <Flex direction={{ base: "column", lg: "row" }} minH="70vh">
          <Box
            as="nav"
            aria-label="Secciones del panel operativo"
            w={{ base: "100%", lg: "14.5rem" }}
            flexShrink={0}
            bg="pizarra.100"
            borderRight={{ lg: "1px solid" }}
            borderColor="pizarra.200"
            px={3}
            py={4}
          >
            <Text fontFamily="heading" fontWeight={600} fontSize="md" mb={1}>
              Panel operativo
            </Text>
            <Text fontSize="xs" color="pizarra.500" mb={3}>
              {usuario ? `${usuario.rol}${usuario.rol_operativo ? ` · ${usuario.rol_operativo}` : ""}` : ""}
            </Text>
            <Flex direction={{ base: "row", lg: "column" }} wrap="wrap" gap={1}>
              {SECCIONES.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={"fin" in s}
                  style={({ isActive }) => ({
                    padding: "6px 10px",
                    fontSize: "14px",
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? "white" : "transparent",
                    borderLeft: `4px solid ${isActive ? "#D99A1E" : "transparent"}`,
                  })}
                >
                  {s.texto}
                </NavLink>
              ))}
            </Flex>
            <Flex align="center" gap={2} mt={4} fontSize="xs" role="status" aria-live="polite" data-testid="estado-ws">
              <Box as="span" w="9px" h="9px" borderRadius="full" bg={estadoWs.color} />
              {estadoWs.texto}
            </Flex>
          </Box>
          <Box flex="1" minW={0} px={{ base: 3, md: 5 }} py={5}>
            <Outlet />
          </Box>
        </Flex>
      </EscenarioProvider>
    </Layout>
  );
}
