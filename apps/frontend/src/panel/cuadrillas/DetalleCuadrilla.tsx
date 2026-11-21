import { Box, Button, Flex, Link, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { IconoCamion, IconoCaja, IconoHistorial, IconoPersonas, IconoVehiculo } from "../../components/iconos/Iconos";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaRolOperativo } from "../../lib/etiquetas";
import { etiquetaVehiculo } from "../../lib/pedidos";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { CuadrillaCompleta, CuadrillaResumen } from "../tipos";
import { APILAR, Cargando, Chip, Seccion } from "../ui";
import { AsistenteCuadrilla } from "./AsistenteCuadrilla";
import { AvisosCuadrilla } from "./AvisosCuadrilla";
import { BajaCuadrilla } from "./BajaCuadrilla";
import { etiquetaProfesion, etiquetaTipoOperativo } from "./catalogos";
import { HistorialPartes } from "./HistorialPartes";
import type { Punto } from "./MapaDesvioGL";
import { AvisoAtencion, ChipEstadoTarea, TACTIL } from "./partes";
import { ESTADO_CUADRILLA } from "./TarjetaCuadrilla";

/** Ficha completa de una cuadrilla para el operativo: integrantes, equipamiento, tarea con partes y evidencia, y avisos. */
export default function DetalleCuadrilla() {
  const { id } = useParams();
  const idNum = Number(id);
  const navegar = useNavigate();
  const { usuario } = useAuth();
  const senal = useSenalTiempoReal();
  const puedeGestionar = usuario?.rol === "operador" || usuario?.rol === "admin";
  const carga = useCarga(() => api.cuadrillaCompleta(idNum), [idNum, senal]);
  const resumen = useCarga(() => api.cuadrillasResumen(), [idNum, senal]);
  const [referencia, setReferencia] = useState<Punto[] | null>(null);
  const [editando, setEditando] = useState(false);
  const [baja, setBaja] = useState(false);

  // El recorrido actual sirve de referencia al dibujar un desvío; si no está disponible, el mapa sigue sin él.
  useEffect(() => {
    let activo = true;
    void api
      .seguimientoCuadrillas()
      .then((r) => activo && setReferencia(r.posiciones.find((p) => p.cuadrilla_id === idNum)?.ruta?.coordenadas ?? null))
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [idNum]);

  const fila: CuadrillaResumen | undefined = resumen.datos?.items.find((c) => c.id === idNum);
  const tarea = fila?.tarea_actual ?? null;

  return (
    <>
      <Cargando
        carga={carga}
        hijos={(c: CuadrillaCompleta) => (
          <>
            <CabeceraPagina
              titulo={c.nombre}
              icono={<IconoPersonas tam="1.5rem" />}
              categoria="SIMULADO"
              ayuda={`${etiquetaTipoOperativo(c.tipo_operativo)}. Las personas se identifican por rol y profesión; los nombres de las cuentas solo se ven en el panel operativo.`}
              acciones={
                <>
                  <Button as={RouterLink} to="/comando/cuadrillas" size="sm" variant="outline" {...TACTIL}>
                    Volver a cuadrillas
                  </Button>
                  {puedeGestionar && c.estado !== "baja" && (
                    <>
                      <Button size="sm" {...TACTIL} onClick={() => setEditando(true)}>
                        Editar
                      </Button>
                      <Button size="sm" {...TACTIL} variant="outline" colorScheme="red" onClick={() => setBaja(true)}>
                        Dar de baja
                      </Button>
                    </>
                  )}
                </>
              }
            />

            <Seccion titulo="Datos de la cuadrilla" id="sec-datos" icono={<IconoVehiculo vehiculo={c.vehiculo} tam="1.25rem" />}>
              <Flex gap={2} wrap="wrap" mb={3}>
                <Chip tono={tarea ? "info" : c.estado === "baja" ? "neutro" : "ok"}>{ESTADO_CUADRILLA[c.estado] ?? c.estado.replace("_", " ")}</Chip>
                {c.vehiculo && <Chip tono="neutro">{etiquetaVehiculo(c.vehiculo)}</Chip>}
                <Chip tono="neutro">{c.cantidad_integrantes} integrantes</Chip>
              </Flex>
              <Box as="dl" display="grid" gridTemplateColumns={{ base: "1fr", sm: "9rem 1fr" }} columnGap={4} rowGap={1}>
                <dt>Tipo de operativo</dt>
                <dd>{etiquetaTipoOperativo(c.tipo_operativo)}</dd>
                <dt>Base</dt>
                <dd>{c.base ? `${c.base.lat.toFixed(4)}, ${c.base.lon.toFixed(4)}` : "Sin base"}</dd>
                {c.notas && (
                  <>
                    <dt>Notas</dt>
                    <dd>{c.notas}</dd>
                  </>
                )}
              </Box>
            </Seccion>

            <Seccion titulo="Integrantes" id="sec-integrantes" icono={<IconoPersonas tam="1.25rem" />}>
              {c.integrantes.length === 0 ? (
                <Text textStyle="microdato">
                  Sin integrantes cargados.
                </Text>
              ) : (
                <TablaDesplazable etiqueta="Integrantes">
                  <Table size="sm" aria-label="Integrantes" sx={APILAR}>
                    <Thead>
                      <Tr>
                        <Th>Rol operativo</Th>
                        <Th>Profesión</Th>
                        <Th>Cuenta institucional</Th>
                        <Th>Función</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {c.integrantes.map((i) => (
                        <Tr key={i.id} data-testid="integrante">
                          <Td>{etiquetaRolOperativo(i.rol_operativo)}</Td>
                          <Td data-etiqueta="Profesión">{etiquetaProfesion(i.profesion)}</Td>
                          <Td data-etiqueta="Cuenta institucional">{i.nombre_visible ?? "Sin cuenta vinculada"}</Td>
                          <Td data-etiqueta="Función">{i.es_encargado ? <Chip tono="ok" data-testid="encargado">Encargado</Chip> : "Integrante"}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TablaDesplazable>
              )}
            </Seccion>

            <Seccion titulo="Equipamiento" id="sec-equipamiento" icono={<IconoCaja tam="1.25rem" />}>
              {c.equipamiento.length === 0 ? (
                <Text textStyle="microdato">
                  Sin equipamiento cargado.
                </Text>
              ) : (
                <Flex as="ul" listStyleType="none" m={0} p={0} gap={2} wrap="wrap" aria-label="Equipamiento">
                  {c.equipamiento.map((e) => (
                    <Chip as="li" key={e} tono="neutro">
                      {e}
                    </Chip>
                  ))}
                </Flex>
              )}
            </Seccion>

            <Seccion titulo="Tarea actual y partes" id="sec-tarea" icono={<IconoCamion tam="1.25rem" />}>
              {tarea ? (
                <>
                  <Flex align="center" gap={2} wrap="wrap" mb={3}>
                    <Link as={RouterLink} to={`/comando/operacion?tarea=${tarea.id}#sec-tareas`} fontWeight={700}>
                      Tarea n.º {tarea.id}
                    </Link>
                    {tarea.sector_id && <span>Sector {tarea.sector_id}</span>}
                    <ChipEstadoTarea estado={tarea.estado} />
                    {tarea.requiere_atencion && <AvisoAtencion />}
                  </Flex>
                  <HistorialPartes tareaId={tarea.id} requiereAtencion={tarea.requiere_atencion} alCambiar={resumen.recargar} />
                </>
              ) : (
                <Flex align="center" gap={2} textStyle="microdato">
                  <IconoHistorial tam="1rem" />
                  <Text>La cuadrilla no tiene tarea en curso.</Text>
                </Flex>
              )}
            </Seccion>

            {c.estado !== "baja" && <AvisosCuadrilla cuadrilla={c} tareaId={tarea?.id ?? null} referencia={referencia} puedeGestionar={puedeGestionar} />}

            {puedeGestionar && editando && (
              <AsistenteCuadrilla
                abierto
                inicial={c}
                alCerrar={() => setEditando(false)}
                alGuardar={() => {
                  setEditando(false);
                  carga.recargar();
                  resumen.recargar();
                }}
              />
            )}
            <BajaCuadrilla
              cuadrilla={baja ? { id: c.id, nombre: c.nombre } : null}
              alCerrar={() => setBaja(false)}
              alBaja={() => {
                setBaja(false);
                navegar("/comando/cuadrillas");
              }}
            />
          </>
        )}
      />
    </>
  );
}
