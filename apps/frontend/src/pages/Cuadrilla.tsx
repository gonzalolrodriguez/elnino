import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { AlertaError } from "../components/Formulario";
import { ApiError } from "../lib/api";
import { IconoCamion, IconoTilde, IconoTriangulo } from "../components/iconos/Iconos";
import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { Opcion } from "../components/Opcion";
import type { TareaConPartes } from "../lib/partes";
import { useCarga } from "../lib/useCarga";
import { useTiempoReal, type EventoTiempoReal } from "../lib/ws";
import { api } from "../panel/api";
import type { Notificacion, Tarea } from "../panel/tipos";
import { CabeceraPagina } from "../panel/CabeceraPagina";
import { ChipEstadoTarea, TACTIL } from "../panel/cuadrillas/partes";
import { IconoActualizar } from "../panel/iconos";
import { Cargando, Chip, fmtFecha, Seccion } from "../panel/ui";
import { AccionesParte } from "./cuadrilla/AccionesParte";
import { CerrarConConstancia } from "./cuadrilla/CerrarConConstancia";
import { CompartirUbicacion } from "./cuadrilla/CompartirUbicacion";
import { AvisosOperativo, InsigniaAvisos } from "./cuadrilla/AvisosOperativo";
import { HistorialPartes } from "./cuadrilla/HistorialPartes";
import { MiCuadrilla } from "./cuadrilla/MiCuadrilla";
import { useAvisos } from "./cuadrilla/useAvisos";
import { contarNoLeidos, miCuadrilla } from "../lib/avisos";

const ESTADOS_WS = { conectado: "Tiempo real conectado", conectando: "Conectando tiempo real…", desconectado: "Tiempo real desconectado" } as const;

function TarjetaTarea({ tarea, alCambiar, alRecargar }: { tarea: TareaConPartes; alCambiar: (t: Tarea) => void; alRecargar: () => void }) {
  const [cerrando, setCerrando] = useState(false);
  // Las tareas de una orden o de un pedido son evacuaciones: se cierran con constancia, no con un simple «Completa».
  const esEvacuacion = tarea.solicitud_id !== null || tarea.orden_id !== null;
  const [error, setError] = useState<unknown>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [versionPartes, setVersionPartes] = useState(0);
  const cerrada = tarea.estado === "completada" || tarea.estado === "cancelada";
  const requiereAtencion = tarea.requiere_atencion === true && tarea.estado === "pendiente";
  const checklist = tarea.checklist ?? [];
  const hechos = checklist.filter((c) => c.hecho).length;

  async function aplicar(cambios: Parameters<typeof api.actualizarTarea>[1]) {
    setError(null);
    setTrabajando(true);
    try {
      alCambiar(await api.actualizarTarea(tarea.id, cambios));
    } catch (e) {
      setError(e);
    } finally {
      setTrabajando(false);
    }
  }

  function alternar(i: number) {
    const lista = checklist.map((c, j) => (j === i ? { ...c, hecho: !c.hecho } : c));
    void aplicar({ checklist: lista });
  }

  return (
    <Box as="article" aria-label={`Tarea ${tarea.id}`} layerStyle="tarjeta" p={{ base: 4, md: 5 }}>
      <Heading as="h3" size="bloque" textStyle="tituloBloque" mb={2}>
        {tarea.titulo}
      </Heading>
      <Flex columnGap={3} rowGap={1} align="center" wrap="wrap" mb={1}>
        <ChipEstadoTarea estado={tarea.estado} testId={`estado-${tarea.id}`} />
        {tarea.sector_id && (
          <Text as="span" fontWeight={600}>
            Sector {tarea.sector_id}
          </Text>
        )}
      </Flex>
      <Text textStyle="microdato" mb={3}>
        {[tarea.solicitud_id ? `Solicitud n.º ${tarea.solicitud_id}` : null, tarea.orden_id ? `Orden n.º ${tarea.orden_id}` : null, `Creada ${fmtFecha(tarea.creado_en)}`].filter(Boolean).join(" · ")}
      </Text>
      {tarea.descripcion && (
        <Text mb={3} maxW="70ch">
          {tarea.descripcion}
        </Text>
      )}

      {requiereAtencion && (
        <Flex align="flex-start" gap={2.5} mb={3} p={3} borderRadius="lg" bg="alerta.50" border="1px solid" borderColor="alerta.200" color="alerta.900" role="status" data-testid={`atencion-${tarea.id}`}>
          <Box aria-hidden="true" display="flex" mt="3px" color="alerta.700">
            <IconoTriangulo tam="1rem" />
          </Box>
          <Text>
            <strong>Requiere atención.</strong> La tarea volvió a pendiente porque no se completó. El operador la va a reprogramar; mientras tanto podés informar novedades.
          </Text>
        </Flex>
      )}

      {tarea.estado === "pendiente" && (
        <Button size="lg" w="full" mb={2} isLoading={trabajando} leftIcon={<IconoCamion />} onClick={() => void aplicar({ estado: "en_curso" })}>
          Iniciar
        </Button>
      )}

      {!cerrada && (
        <AccionesParte
          tareaId={tarea.id}
          exigeConstancia={esEvacuacion}
          destacarTerminar={tarea.estado === "en_curso"}
          alEnviado={() => {
            setVersionPartes((v) => v + 1);
            alRecargar();
          }}
          alConstancia={() => setCerrando(true)}
        />
      )}
      {cerrando && !cerrada && (
        <CerrarConConstancia
          tareaId={tarea.id}
          alCancelar={() => setCerrando(false)}
          alTerminar={() => {
            setCerrando(false);
            setVersionPartes((v) => v + 1);
            alRecargar();
          }}
        />
      )}

      {checklist.length > 0 && (
        <Box role="group" aria-label={`Checklist de la tarea ${tarea.id}`} mt={4}>
          <Text textStyle="rotulo" color="texto" mb={2}>
            Checklist · {hechos} de {checklist.length} hechos
          </Text>
          <Stack spacing={2}>
            {checklist.map((c, i) => (
              <Opcion key={`${tarea.id}-${i}`} etiqueta={c.item} isChecked={c.hecho} isDisabled={trabajando || cerrada} onChange={() => alternar(i)} />
            ))}
          </Stack>
        </Box>
      )}
      {error !== null && (
        <Box mt={3}>
          <AlertaError error={error} />
        </Box>
      )}

      <Box mt={5} pt={4} borderTop="1px solid" borderColor="borde">
        <HistorialPartes tareaId={tarea.id} refresco={versionPartes} />
      </Box>
      {!cerrada && (
        <Button mt={4} size="sm" {...TACTIL} colorScheme="red" variant="ghost" isDisabled={trabajando} onClick={() => void aplicar({ estado: "cancelada" })}>
          Cancelar tarea
        </Button>
      )}
    </Box>
  );
}

function Avisos({ avisos, alMarcar }: { avisos: Notificacion[]; alMarcar: (id: number) => void }) {
  return (
    <Stack as="ul" listStyleType="none" m={0} p={0} spacing={2}>
      {avisos.map((n) => (
        <Flex as="li" key={n.id} direction="column" gap={2} p={3} borderRadius="lg" border="1px solid" borderColor={n.leida ? "borde" : "primario"} bg={n.leida ? undefined : "suave"}>
          <Text fontWeight={n.leida ? 400 : 600}>{n.mensaje}</Text>
          <Flex columnGap={2} rowGap={1} align="center" wrap="wrap">
            <Chip tono={n.leida ? "neutro" : "aviso"} icono={n.leida ? <IconoTilde tam="0.9rem" /> : <IconoTriangulo tam="0.9rem" />}>
              {n.leida ? "Leída" : "Sin leer"}
            </Chip>
            <Text as="time" textStyle="microdato" dateTime={n.creada_en}>
              {fmtFecha(n.creada_en)}
            </Text>
          </Flex>
          {!n.leida && (
            <Button size="sm" {...TACTIL} variant="outline" alignSelf={{ base: "stretch", sm: "flex-start" }} onClick={() => alMarcar(n.id)}>
              Marcar como leída
            </Button>
          )}
        </Flex>
      ))}
    </Stack>
  );
}

export default function Cuadrilla() {
  const { token } = useAuth();
  const tareas = useCarga(() => api.tareas().then((r) => r.tareas));
  const avisos = useCarga(() => api.notificaciones().then((r) => r.notificaciones));
  // La cuadrilla del usuario sale de `GET /mi/cuadrilla`; un 404 es «todavía no integrás ninguna» (estado vacío, no error).
  const cuadrilla = useCarga(() =>
    miCuadrilla().catch((e: unknown) => {
      if (e instanceof ApiError && e.estado === 404) return null;
      throw e;
    }),
  );
  const [senalAvisos, setSenalAvisos] = useState(0);
  const [locales, setLocales] = useState<Record<number, Tarea>>({});
  const [leidas, setLeidas] = useState<number[]>([]);
  const [errorAviso, setErrorAviso] = useState<unknown>(null);
  const { recargar: recargarTareas } = tareas;
  const { recargar: recargarAvisos } = avisos;
  const { recargar: recargarCuadrilla } = cuadrilla;

  const alEvento = useCallback(
    (e: EventoTiempoReal) => {
      if (e.tipo === "tarea" || e.tipo === "constancia") {
        setLocales({});
        recargarTareas();
      } else if (e.tipo === "orden") recargarAvisos();
      else if (e.tipo === "aviso_cuadrilla") {
        setSenalAvisos((n) => n + 1);
        recargarCuadrilla();
      }
    },
    [recargarTareas, recargarAvisos, recargarCuadrilla],
  );
  const ws = useTiempoReal(token, alEvento);

  const propia = cuadrilla.estado === "ok" ? cuadrilla.datos : null;
  const cuadrillaIds = propia ? [propia.id] : [];
  const avisosOp = useAvisos(cuadrillaIds, senalAvisos);
  const noLeidos = contarNoLeidos(avisosOp.avisos);

  async function marcar(id: number) {
    setErrorAviso(null);
    try {
      await api.marcarLeida(id);
      setLeidas((l) => [...l, id]);
    } catch (e) {
      setErrorAviso(e);
    }
  }

  return (
    <Layout titulo="Mis tareas">
      <CabeceraPagina
        titulo="Mis tareas"
        icono={<IconoCamion tam="1.5rem" />}
        categoria="SIMULADO"
        ayuda="Tus tareas, las novedades que informás y las alertas que recibís. Los datos son de demostración."
        actualizado={<span role="status">{ESTADOS_WS[ws]}</span>}
        acciones={
          <>
            <InsigniaAvisos noLeidos={noLeidos} />
            <Button size="sm" {...TACTIL} variant="outline" onClick={recargarTareas} leftIcon={<IconoActualizar tam="1.125rem" />}>
              Actualizar
            </Button>
          </>
        }
      />

      {/* Móvil: una columna (avisos, cuadrilla, tareas, ubicación, alertas). Desde 992 px: tareas a la izquierda y el resto a la derecha. */}
      <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 24rem" }} gridTemplateRows={{ lg: "repeat(4, auto) 1fr" }} columnGap={6} alignItems="start">
        <Box minW={0} w="100%" gridColumn={{ lg: 2 }} gridRow={{ lg: 1 }}>
          <Seccion titulo="Avisos del operativo" categoria="SIMULADO" id="sec-avisos">
            <AvisosOperativo avisos={avisosOp.avisos} estado={avisosOp.estado} error={avisosOp.error} alMarcar={avisosOp.marcar} alReintentar={() => void avisosOp.recargar()} />
          </Seccion>
        </Box>

        <Box minW={0} w="100%" gridColumn={{ lg: 2 }} gridRow={{ lg: 2 }}>
          <Seccion titulo="Mi cuadrilla" categoria="SIMULADO" id="sec-mi-cuadrilla">
            <Cargando
              carga={cuadrilla}
              esVacio={(d) => d === null}
              vacio="Todavía no integrás ninguna cuadrilla. Cuando la administración te sume a una, la vas a ver acá."
              hijos={(d) => (d ? <MiCuadrilla cuadrilla={d} /> : null)}
            />
          </Seccion>
        </Box>

        {/* Las tareas van sin marco de bloque: cada una ya es una tarjeta. */}
        <Box as="section" aria-labelledby="sec-mis-tareas" minW={0} w="100%" mb={5} gridColumn={{ lg: 1 }} gridRow={{ lg: "1 / span 5" }}>
          <Flex align="center" columnGap={3} rowGap={1.5} mb={3} wrap="wrap">
            <Heading as="h2" id="sec-mis-tareas" size="bloque" textStyle="tituloBloque">
              Tareas asignadas
            </Heading>
            <Insignia categoria="SIMULADO" />
          </Flex>
          <Cargando
            carga={tareas}
            esVacio={(d) => d.length === 0}
            vacio="No tenés tareas asignadas."
            hijos={(d) => (
              <Stack spacing={4}>
                {d.map((t) => (
                  <TarjetaTarea
                    key={t.id}
                    tarea={{ ...t, ...(locales[t.id] ?? {}) }}
                    alCambiar={(n) => setLocales((l) => ({ ...l, [n.id]: n }))}
                    alRecargar={() => {
                      setLocales({});
                      recargarTareas();
                    }}
                  />
                ))}
              </Stack>
            )}
          />
        </Box>

        <Box minW={0} w="100%" gridColumn={{ lg: 2 }} gridRow={{ lg: 3 }}>
          <Seccion titulo="Mi ubicación" categoria="SIMULADO" id="sec-ubicacion">
            <CompartirUbicacion hayTareaEnCurso={(tareas.datos ?? []).some((t) => (locales[t.id] ?? t).estado === "en_curso")} />
          </Seccion>
        </Box>

        <Box minW={0} w="100%" gridColumn={{ lg: 2 }} gridRow={{ lg: 4 }}>
          <Seccion titulo="Alertas y órdenes" categoria="SIMULADO" id="sec-alertas">
            {errorAviso !== null && <AlertaError error={errorAviso} />}
            <Cargando
              carga={avisos}
              esVacio={(d) => d.length === 0}
              vacio="No tenés alertas."
              hijos={(d) => <Avisos avisos={d.map((n) => (leidas.includes(n.id) ? { ...n, leida: true } : n))} alMarcar={(id) => void marcar(id)} />}
            />
          </Seccion>
        </Box>
      </Box>
    </Layout>
  );
}
