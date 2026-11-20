import { Badge, Box, Button, Checkbox, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { useCallback, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { AlertaError } from "../components/Formulario";
import { Insignia } from "../components/Insignia";
import { Layout } from "../components/Layout";
import { useCarga } from "../lib/useCarga";
import { useTiempoReal, type EventoTiempoReal } from "../lib/ws";
import { api } from "../panel/api";
import type { Notificacion, Tarea } from "../panel/tipos";
import { Cargando, fmtFecha, Seccion } from "../panel/ui";
import { CerrarConConstancia } from "./cuadrilla/CerrarConConstancia";
import { CompartirUbicacion } from "./cuadrilla/CompartirUbicacion";

const ETIQUETA: Record<Tarea["estado"], string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};
const COLOR: Record<Tarea["estado"], string> = { pendiente: "yellow", en_curso: "blue", completada: "green", cancelada: "gray" };
const ESTADOS_WS = { conectado: "Tiempo real conectado", conectando: "Conectando tiempo real…", desconectado: "Tiempo real desconectado" } as const;

function TarjetaTarea({ tarea, alCambiar, alRecargar }: { tarea: Tarea; alCambiar: (t: Tarea) => void; alRecargar: () => void }) {
  const [cerrando, setCerrando] = useState(false);
  // Las tareas de una orden o de un pedido son evacuaciones: se cierran con constancia, no con un simple "Completar".
  const esEvacuacion = tarea.solicitud_id !== null || tarea.orden_id !== null;
  const [error, setError] = useState<unknown>(null);
  const [trabajando, setTrabajando] = useState(false);
  const cerrada = tarea.estado === "completada" || tarea.estado === "cancelada";

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
    const lista = (tarea.checklist ?? []).map((c, j) => (j === i ? { ...c, hecho: !c.hecho } : c));
    void aplicar({ checklist: lista });
  }

  return (
    <Box as="article" aria-label={`Tarea ${tarea.id}`} layerStyle="tarjeta" p={4}>
      <Flex gap={2} align="center" wrap="wrap" mb={1}>
        <Heading as="h3" size="sm">
          {tarea.titulo}
        </Heading>
        <Badge colorScheme={COLOR[tarea.estado]} data-testid={`estado-${tarea.id}`}>
          {ETIQUETA[tarea.estado]}
        </Badge>
        <Insignia categoria="SIMULADO" />
      </Flex>
      <Text fontSize="xs" color="textoSuave" mb={2}>
        {[
          tarea.sector_id ? `Sector ${tarea.sector_id}` : null,
          tarea.solicitud_id ? `Solicitud n.º ${tarea.solicitud_id}` : null,
          tarea.orden_id ? `Orden n.º ${tarea.orden_id}` : null,
          `Creada ${fmtFecha(tarea.creado_en)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {tarea.descripcion && <Text fontSize="sm" mb={2}>{tarea.descripcion}</Text>}
      {(tarea.checklist ?? []).length > 0 && (
        <Stack role="group" aria-label={`Checklist de la tarea ${tarea.id}`} spacing={1} mb={3}>
          {(tarea.checklist ?? []).map((c, i) => (
            <Checkbox key={`${tarea.id}-${i}`} isChecked={c.hecho} isDisabled={trabajando || cerrada} onChange={() => alternar(i)}>
              {c.item}
            </Checkbox>
          ))}
        </Stack>
      )}
      {error !== null && <AlertaError error={error} />}
      <Flex gap={2}>
        {tarea.estado === "pendiente" && (
          <Button size="sm" isLoading={trabajando} onClick={() => void aplicar({ estado: "en_curso" })}>
            Iniciar
          </Button>
        )}
        {tarea.estado === "en_curso" && !esEvacuacion && (
          <Button size="sm" isLoading={trabajando} onClick={() => void aplicar({ estado: "completada" })}>
            Completar
          </Button>
        )}
        {tarea.estado === "en_curso" && esEvacuacion && !cerrando && (
          <Button size="sm" onClick={() => setCerrando(true)}>
            Cerrar con constancia
          </Button>
        )}
        {!cerrada && (
          <Button size="sm" variant="outline" isDisabled={trabajando} onClick={() => void aplicar({ estado: "cancelada" })}>
            Cancelar tarea
          </Button>
        )}
      </Flex>
      {cerrando && tarea.estado === "en_curso" && (
        <CerrarConConstancia
          tareaId={tarea.id}
          alCancelar={() => setCerrando(false)}
          alTerminar={() => {
            setCerrando(false);
            alRecargar();
          }}
        />
      )}
    </Box>
  );
}

function Avisos({ avisos, alMarcar }: { avisos: Notificacion[]; alMarcar: (id: number) => void }) {
  return (
    <Stack as="ul" listStyleType="none" spacing={2}>
      {avisos.map((n) => (
        <Flex as="li" key={n.id} gap={3} align="center" justify="space-between" borderLeft="3px solid" borderColor={n.leida ? "pizarra.200" : "acento"} pl={3}>
          <Box>
            <Text fontSize="sm" fontWeight={n.leida ? 400 : 700}>{n.mensaje}</Text>
            <Text fontSize="xs" color="textoSuave">{fmtFecha(n.creada_en)}</Text>
          </Box>
          {!n.leida && (
            <Button size="xs" variant="outline" onClick={() => alMarcar(n.id)}>
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
  const [locales, setLocales] = useState<Record<number, Tarea>>({});
  const [leidas, setLeidas] = useState<number[]>([]);
  const [errorAviso, setErrorAviso] = useState<unknown>(null);
  const { recargar: recargarTareas } = tareas;
  const { recargar: recargarAvisos } = avisos;

  const alEvento = useCallback(
    (e: EventoTiempoReal) => {
      if (e.tipo === "tarea" || e.tipo === "constancia") {
        setLocales({});
        recargarTareas();
      } else if (e.tipo === "orden") recargarAvisos();
    },
    [recargarTareas, recargarAvisos],
  );
  const ws = useTiempoReal(token, alEvento);

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
      <Heading as="h1" size="xl" mb={1}>
        Mis tareas
      </Heading>
      <Text fontSize="sm" color="textoSuave" mb={4} role="status">
        {ESTADOS_WS[ws]}. Las tareas y checklists de abajo son datos de demostración.
      </Text>

      <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "minmax(0, 3fr) minmax(0, 2fr)" }} columnGap={6} alignItems="start" maxW="90rem">
      <Seccion titulo="Tareas asignadas" categoria="SIMULADO" id="sec-mis-tareas" derecha={<Button size="xs" variant="outline" onClick={recargarTareas}>Actualizar</Button>}>
        <Cargando
          carga={tareas}
          esVacio={(d) => d.length === 0}
          vacio="No tenés tareas asignadas."
          hijos={(d) => (
            <Stack spacing={3}>
              {d.map((t) => (
                <TarjetaTarea
                  key={t.id}
                  tarea={locales[t.id] ?? t}
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
      </Seccion>

      <Seccion titulo="Mi ubicación" categoria="SIMULADO" id="sec-ubicacion">
        <CompartirUbicacion hayTareaEnCurso={(tareas.datos ?? []).some((t) => (locales[t.id] ?? t).estado === "en_curso")} />
      </Seccion>

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
    </Layout>
  );
}
