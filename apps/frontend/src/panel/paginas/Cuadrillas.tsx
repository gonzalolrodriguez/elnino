import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { IconoMapa, IconoMas, IconoPersonas } from "../../components/iconos/Iconos";
import { AlertaError } from "../../components/Formulario";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { AsistenteCuadrilla } from "../cuadrillas/AsistenteCuadrilla";
import { BajaCuadrilla } from "../cuadrillas/BajaCuadrilla";
import { TACTIL } from "../cuadrillas/partes";
import { SeguimientoCuadrillas } from "../cuadrillas/SeguimientoCuadrillas";
import { TarjetaCuadrilla } from "../cuadrillas/TarjetaCuadrilla";
import { IconoActualizar } from "../iconos";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { CuadrillaCompleta, CuadrillaResumen } from "../tipos";
import { Cargando } from "../ui";

type Filtro = "todas" | "dificultades" | "atencion" | "libres";
type Vista = "lista" | "mapa";

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

/** Cuadrillas: alta y edición en pasos, baja, seguimiento en el mapa y acceso a la ficha de cada una. */
export default function Cuadrillas() {
  const { usuario } = useAuth();
  const senal = useSenalTiempoReal();
  const carga = useCarga(() => api.cuadrillasResumen(), [senal]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [vista, setVista] = useState<Vista>("lista");
  const [asistente, setAsistente] = useState<{ inicial: CuadrillaCompleta | null } | null>(null);
  const [baja, setBaja] = useState<{ id: number; nombre: string } | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<unknown>(null);
  const puedeGestionar = usuario?.rol === "operador" || usuario?.rol === "admin";
  const vehiculos = useMemo(() => Object.fromEntries((carga.datos?.items ?? []).map((c) => [c.id, c.vehiculo])), [carga.datos]);

  async function abrirEdicion(id: number) {
    setErrorEdicion(null);
    try {
      setAsistente({ inicial: await api.cuadrillaCompleta(id) });
    } catch (e) {
      setErrorEdicion(e);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Cuadrillas"
        icono={<IconoPersonas tam="1.5rem" />}
        categoria="SIMULADO"
        ayuda="Armá cada cuadrilla con su equipo interdisciplinario, vehículo y equipamiento; seguí su recorrido y mandale avisos. Las personas se identifican por rol y profesión. Datos de demostración."
        acciones={
          <>
            {puedeGestionar && (
              <Button size="sm" {...TACTIL} leftIcon={<IconoMas tam="1rem" />} onClick={() => setAsistente({ inicial: null })}>
                Nueva cuadrilla
              </Button>
            )}
            <Button size="sm" {...TACTIL} variant="outline" onClick={carga.recargar} leftIcon={<IconoActualizar tam="1.125rem" />}>
              Actualizar
            </Button>
          </>
        }
      />

      <Flex role="group" aria-label="Vista de cuadrillas" gap={2} mb={4}>
        <Button size="sm" {...TACTIL} borderRadius="full" variant={vista === "lista" ? "solid" : "outline"} aria-pressed={vista === "lista"} leftIcon={<IconoPersonas tam="1rem" />} onClick={() => setVista("lista")}>
          Lista
        </Button>
        <Button size="sm" {...TACTIL} borderRadius="full" variant={vista === "mapa" ? "solid" : "outline"} aria-pressed={vista === "mapa"} leftIcon={<IconoMapa tam="1rem" />} onClick={() => setVista("mapa")}>
          Mapa
        </Button>
      </Flex>

      <Box mb={3}>
        <AlertaError error={errorEdicion} />
      </Box>

      {vista === "mapa" ? (
        <SeguimientoCuadrillas vehiculos={vehiculos} />
      ) : (
        <Cargando
          carga={carga}
          esVacio={(d) => d.items.length === 0}
          vacio={puedeGestionar ? "Todavía no hay cuadrillas. Creá la primera con «Nueva cuadrilla»." : "Todavía no hay cuadrillas."}
          hijos={(d) => {
            const visibles = aplicarFiltro(d.items, filtro);
            return (
              <>
                <Flex as="div" role="group" aria-label="Filtrar cuadrillas" gap={2} wrap="wrap" mb={4}>
                  {FILTROS.map((f) => (
                    <Button key={f.id} size="sm" {...TACTIL} borderRadius="full" variant={filtro === f.id ? "solid" : "outline"} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
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
                  <Box as="div" display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "repeat(2, minmax(0, 1fr))" }} gap={4} alignItems="start">
                    {visibles.map((c) => (
                      <TarjetaCuadrilla key={c.id} c={c} puedeGestionar={puedeGestionar} alCambiar={carga.recargar} alEditar={(id) => void abrirEdicion(id)} alBaja={setBaja} />
                    ))}
                  </Box>
                )}
              </>
            );
          }}
        />
      )}

      {asistente && (
        <AsistenteCuadrilla
          key={asistente.inicial?.id ?? "nueva"}
          abierto
          inicial={asistente.inicial}
          alCerrar={() => setAsistente(null)}
          alGuardar={() => {
            setAsistente(null);
            carga.recargar();
          }}
        />
      )}
      <BajaCuadrilla
        cuadrilla={baja}
        alCerrar={() => setBaja(null)}
        alBaja={() => {
          setBaja(null);
          carga.recargar();
        }}
      />
    </>
  );
}
