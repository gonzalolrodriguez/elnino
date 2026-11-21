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
import { ChipFiltro, GrupoFiltros } from "../operacion/lista";
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

      <Flex role="group" aria-label="Vista de cuadrillas" display="inline-flex" gap={1} p={1} mb={4} bg="suave" borderRadius="full">
        {(["lista", "mapa"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            {...TACTIL}
            borderRadius="full"
            px={4}
            variant={vista === v ? "solid" : "ghost"}
            aria-pressed={vista === v}
            leftIcon={v === "lista" ? <IconoPersonas tam="1rem" /> : <IconoMapa tam="1rem" />}
            onClick={() => setVista(v)}
          >
            {v === "lista" ? "Lista" : "Mapa"}
          </Button>
        ))}
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
                <Box mb={4}>
                  <GrupoFiltros rotulo="Mostrar">
                    {FILTROS.map((f) => (
                      <ChipFiltro key={f.id} activo={filtro === f.id} onClick={() => setFiltro(f.id)} cantidad={f.id === "todas" ? undefined : aplicarFiltro(d.items, f.id).length}>
                        {f.texto}
                      </ChipFiltro>
                    ))}
                  </GrupoFiltros>
                </Box>
                {visibles.length === 0 ? (
                  <Flex direction="column" align="flex-start" gap={2} p={4} bg="superficie" borderRadius="xl" border="1px dashed" borderColor="bordeControl" data-testid="cuadrillas-sin-resultados">
                    <Text fontWeight={700}>Ninguna cuadrilla coincide con este filtro.</Text>
                    <Button size="sm" variant="outline" {...TACTIL} onClick={() => setFiltro("todas")}>
                      Ver todas las cuadrillas
                    </Button>
                  </Flex>
                ) : (
                  <Box as="div" display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "repeat(2, minmax(0, 1fr))" }} gap={4} alignItems="stretch">
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
