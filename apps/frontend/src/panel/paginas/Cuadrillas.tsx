import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Insignia } from "../../components/Insignia";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { TarjetaCuadrilla } from "../cuadrillas/TarjetaCuadrilla";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { CuadrillaResumen } from "../tipos";
import { Cargando } from "../ui";

type Filtro = "todas" | "dificultades" | "atencion" | "libres";

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "todas", texto: "Todas" },
  { id: "dificultades", texto: "Con dificultades" },
  { id: "atencion", texto: "Requieren atención" },
  { id: "libres", texto: "Libres" },
];

export function aplicarFiltro(lista: CuadrillaResumen[], f: Filtro): CuadrillaResumen[] {
  switch (f) {
    case "dificultades":
      return lista.filter((c) => c.dificultades_abiertas > 0);
    case "atencion":
      return lista.filter((c) => c.tarea_actual?.requiere_atencion === true);
    case "libres":
      return lista.filter((c) => c.tarea_actual === null);
    default:
      return lista;
  }
}

/** Cuadrillas, sus designados (por rol) y lo último que informaron. */
export default function Cuadrillas() {
  const { usuario } = useAuth();
  const senal = useSenalTiempoReal();
  const carga = useCarga(() => api.cuadrillasResumen(), [senal]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const puedeGestionar = usuario?.rol === "operador" || usuario?.rol === "admin";

  return (
    <>
      <Heading as="h1" size="lg" mb={1}>
        Cuadrillas
      </Heading>
      <Flex align="center" gap={2} mb={4}>
        <Insignia categoria="SIMULADO" />
        <Text fontSize="sm" color="textoSuave">
          Quién integra cada cuadrilla (por rol, sin nombres), en qué tarea está y qué informó. Datos de demostración.
        </Text>
      </Flex>
      <Cargando
        carga={carga}
        esVacio={(d) => d.items.length === 0}
        vacio="Todavía no hay cuadrillas. Se crean desde «Solicitudes y cuadrillas»."
        hijos={(d) => {
          const visibles = aplicarFiltro(d.items, filtro);
          return (
            <>
              <Flex as="div" role="group" aria-label="Filtrar cuadrillas" gap={2} wrap="wrap" mb={4}>
                {FILTROS.map((f) => (
                  <Button key={f.id} size="xs" variant={filtro === f.id ? "solid" : "outline"} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
                    {f.texto}
                    {f.id !== "todas" ? ` (${aplicarFiltro(d.items, f.id).length})` : ""}
                  </Button>
                ))}
              </Flex>
              {visibles.length === 0 ? (
                <Text fontSize="sm" color="textoSuave" data-testid="cuadrillas-sin-resultados">
                  Ninguna cuadrilla coincide con este filtro.
                </Text>
              ) : (
                <Box as="div" display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "repeat(2, minmax(0, 1fr))" }} gap={4}>
                  {visibles.map((c) => (
                    <TarjetaCuadrilla key={c.id} c={c} puedeGestionar={puedeGestionar} alCambiar={carga.recargar} />
                  ))}
                </Box>
              )}
            </>
          );
        }}
      />
    </>
  );
}
