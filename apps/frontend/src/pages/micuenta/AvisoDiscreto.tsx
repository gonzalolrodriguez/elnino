import { Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { IconoAlerta, IconoInfo } from "../../components/iconos/Iconos";

/** Aviso de una línea para lo que no está disponible o falló: ícono y texto, sin bloque de alerta. */
export function AvisoDiscreto({ children, peligro = false, ...resto }: { children: ReactNode; peligro?: boolean; "data-testid"?: string }) {
  return (
    <Flex role={peligro ? "alert" : "status"} align="flex-start" gap={2} px={3.5} py={2.5} borderRadius="xl" bg={peligro ? "evacuacion.50" : "fondo"} border="1px solid" borderColor={peligro ? "evacuacion.200" : "borde"} color={peligro ? "evacuacion.800" : "textoSuave"} {...resto}>
      <span aria-hidden="true" style={{ display: "flex", marginTop: 2 }}>
        {peligro ? <IconoAlerta /> : <IconoInfo />}
      </span>
      <Text fontSize="sm" lineHeight={1.45}>
        {children}
      </Text>
    </Flex>
  );
}
