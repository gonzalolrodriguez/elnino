import { Box, Button, Flex, FormControl, FormLabel, IconButton, Menu, MenuButton, MenuItem, MenuList, Select, Text, useToast } from "@chakra-ui/react";
import { ESTADOS_SOLICITUD } from "@evacuaciones/shared";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { EstadoCargando } from "../../components/EstadoCargando";
import { AlertaError } from "../../components/Formulario";
import {
  IconoBandeja,
  IconoCamion,
  IconoEnviar,
  IconoFormulario,
  IconoInfo,
  IconoMascota,
  IconoPersonas,
  IconoPuntos,
  IconoReloj,
  IconoRumbo,
  IconoSalvavidas,
  IconoTelefono,
  IconoTilde,
  IconoMegafono,
  type PropsIcono,
} from "../../components/iconos/Iconos";
import { etiquetaEstadoSolicitud, etiquetaOrigenSolicitud, etiquetaTipoSolicitud } from "../../lib/etiquetas";
import { hace, useAhora } from "../../lib/vivo";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { TACTIL } from "../cuadrillas/partes";
import type { Cuadrilla, Solicitud, Tarea } from "../tipos";
import { Chip, FichaIcono, fmtNum, Seccion, type TonoChip } from "../ui";
import { ANCHO_AMPLIO, ANCHO_MEDIO, CONTENEDOR, ChipFiltro, FilaLista, GrupoFiltros, SOLO_LECTOR } from "./lista";

const SECTORES = ["S1", "S2", "S3", "S4"] as const;
const TONO_SOLICITUD: Record<string, TonoChip> = { recibida: "aviso", verificada: "info", asignada: "info", en_curso: "info", resuelta: "ok" };

const ICONO_TIPO: Record<string, ComponentType<PropsIcono>> = { evacuacion: IconoRumbo, asistencia: IconoSalvavidas, ganado: IconoMascota, logistica: IconoCamion, otro: IconoInfo };
const ICONO_ORIGEN: Record<string, ComponentType<PropsIcono>> = { app: IconoTelefono, web: IconoFormulario, whatsapp_sim: IconoEnviar, sms_sim: IconoEnviar, ivr_sim: IconoMegafono };

/** Próximo paso de cada estado: texto del botón principal y estado de destino. `asignada` pide elegir la cuadrilla en la misma fila. */
const PASO: Record<string, { texto: string; destino: string }> = {
  recibida: { texto: "Verificar", destino: "verificada" },
  verificada: { texto: "Asignar cuadrilla…", destino: "asignada" },
  asignada: { texto: "Pasar a en curso", destino: "en_curso" },
  en_curso: { texto: "Marcar resuelta", destino: "resuelta" },
};

const COLUMNAS = "minmax(9rem,1.5fr) 4.5rem minmax(7rem,1fr) 5.5rem 5rem 5rem 7.5rem 13rem";
const AREAS_AMPLIO = (n: number) => ['"tipo sector origen edad pers anim estado acc"', ...Array.from({ length: n }, () => '"texto texto texto texto texto texto texto texto"')];

const REJILLA = {
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gridTemplateAreas: '"tipo estado" "meta meta" "texto texto" "acc acc" "asignar asignar"',
  "& [data-area='tipo']": { gridArea: "tipo" },
  "& [data-area='estado']": { gridArea: "estado", justifySelf: "end" },
  "& [data-area='meta']": { gridArea: "meta", display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "0.875rem", rowGap: "0.25rem", marginTop: "0.5rem" },
  "& [data-area='texto']": { gridArea: "texto", marginTop: "0.5rem" },
  "& [data-area='acc']": { gridArea: "acc", display: "flex", gap: "0.5rem", marginTop: "0.75rem" },
  "& [data-area='acc'] > button:first-of-type": { flex: "1 1 auto" },
  "& [data-area='asignar']": { gridArea: "asignar", marginTop: "0.75rem" },
  "& [data-etiqueta-corta]": { display: "inline" },
  [`@container (min-width: ${ANCHO_MEDIO})`]: {
    gridTemplateAreas: '"tipo estado" "meta acc" "texto texto" "asignar asignar"',
    "& [data-area='meta']": { marginTop: "0.375rem" },
    "& [data-area='acc']": { marginTop: "0.375rem", justifySelf: "end" },
    "& [data-area='acc'] > button:first-of-type": { flex: "0 0 auto" },
  },
  [`@container (min-width: ${ANCHO_AMPLIO})`]: {
    gridTemplateColumns: COLUMNAS,
    gridTemplateAreas: AREAS_AMPLIO(1).join(" ") + ' "asignar asignar asignar asignar asignar asignar asignar asignar"',
    "& [data-area='meta']": { display: "contents" },
    "& [data-area='tipo']": { gridArea: "tipo" },
    "& [data-area='sector']": { gridArea: "sector" },
    "& [data-area='origen']": { gridArea: "origen" },
    "& [data-area='edad']": { gridArea: "edad" },
    "& [data-area='pers']": { gridArea: "pers", justifySelf: "end" },
    "& [data-area='anim']": { gridArea: "anim", justifySelf: "end" },
    "& [data-area='estado']": { gridArea: "estado", justifySelf: "start" },
    "& [data-area='acc']": { gridArea: "acc", marginTop: 0, justifySelf: "end" },
    "& [data-etiqueta-corta]": SOLO_LECTOR,
  },
} as const;

const CABECERA = {
  display: "none",
  [`@container (min-width: ${ANCHO_AMPLIO})`]: { display: "grid", gridTemplateColumns: COLUMNAS, columnGap: "0.75rem", padding: "0 1rem 0.25rem" },
} as const;

/** Cifra con ícono. La palabra («personas») se ve en la tarjeta y queda solo para lectores en la columna alineada. */
function Figura({ icono, valor, etiqueta, area }: { icono: ReactNode; valor: number; etiqueta: string; area: string }) {
  return (
    <Flex data-area={area} align="center" gap={1.5} color={valor === 0 ? "textoSuave" : "texto"} fontSize="sm" sx={{ fontVariantNumeric: "tabular-nums" }}>
      {icono}
      <Box as="span" fontWeight={valor === 0 ? 500 : 700}>
        {fmtNum(valor)}
      </Box>
      <Box as="span" data-etiqueta-corta="">
        {etiqueta}
      </Box>
    </Flex>
  );
}

function FilaSolicitud({
  s,
  tarea,
  cuadrillas,
  ahora,
  ocupada,
  asignando,
  alAvanzar,
  alAbrirAsignar,
  alCerrarAsignar,
}: {
  s: Solicitud;
  tarea?: Tarea;
  cuadrillas: Cuadrilla[];
  ahora: number;
  ocupada: boolean;
  asignando: boolean;
  alAvanzar: (s: Solicitud, destino: string, cuadrillaId?: number) => void;
  alAbrirAsignar: () => void;
  alCerrarAsignar: () => void;
}) {
  const [cuadrilla, setCuadrilla] = useState("");
  const [mensajeAbierto, setMensajeAbierto] = useState(false);
  const paso = PASO[s.estado];
  const resuelta = s.estado === "resuelta";
  const Tipo = ICONO_TIPO[s.tipo] ?? IconoInfo;
  const Origen = ICONO_ORIGEN[s.origen] ?? IconoInfo;
  const edad = hace(Math.max(0, ahora - new Date(s.creado_en).getTime()));
  const hayMenu = Boolean(tarea) || Boolean(s.texto);

  return (
    <FilaLista sx={REJILLA} atenuada={resuelta} acento={s.estado === "recibida"} data-testid={`solicitud-${s.id}`} aria-label={`Solicitud n.º ${s.id}`}>
      <Flex data-area="tipo" align="center" gap={2.5} minW={0}>
        <FichaIcono icono={<Tipo tam="1.125rem" />} tam="2.25rem" tono={resuelta ? "neutro" : s.estado === "recibida" ? "aviso" : "info"} />
        <Box minW={0}>
          <Text fontWeight={700} lineHeight={1.25} noOfLines={1}>
            {etiquetaTipoSolicitud(s.tipo)}
          </Text>
          <Text textStyle="microdato">Solicitud n.º {s.id}</Text>
        </Box>
      </Flex>

      <Flex data-area="estado" align="center">
        <Chip tono={TONO_SOLICITUD[s.estado] ?? "neutro"} icono={resuelta ? <IconoTilde tam="0.9rem" /> : <IconoReloj tam="0.9rem" />}>
          {etiquetaEstadoSolicitud(s.estado)}
        </Chip>
      </Flex>

      <Box data-area="meta">
        <Box data-area="sector" fontSize="sm" fontWeight={600}>
          {s.sector_id ? <Chip tono="neutro">{s.sector_id}</Chip> : <Box as="span" color="textoSuave">Sin sector</Box>}
        </Box>
        <Flex data-area="origen" align="center" gap={1.5} fontSize="sm" color="textoSuave" minW={0}>
          <Origen tam="1rem" />
          <Box as="span" lineHeight={1.25}>
            {etiquetaOrigenSolicitud(s.origen)}
          </Box>
        </Flex>
        <Box data-area="edad" textStyle="microdato" title={new Date(s.creado_en).toLocaleString("es-AR")}>
          {edad}
        </Box>
        <Figura area="pers" icono={<IconoPersonas tam="1rem" />} valor={s.personas} etiqueta={s.personas === 1 ? "persona" : "personas"} />
        <Figura area="anim" icono={<IconoMascota tam="1rem" />} valor={s.animales} etiqueta={s.animales === 1 ? "animal" : "animales"} />
      </Box>

      {s.texto && (
        <Text data-area="texto" fontSize="sm" color="textoSuave" noOfLines={mensajeAbierto ? undefined : 1}>
          «{s.texto}»
        </Text>
      )}

      <Flex data-area="acc" align="center" justify="flex-end">
        {paso ? (
          s.estado === "verificada" ? (
            <Button size="sm" {...TACTIL} variant="solid" isDisabled={ocupada} aria-expanded={asignando} aria-label={`Asignar cuadrilla a la solicitud ${s.id}`} onClick={asignando ? alCerrarAsignar : alAbrirAsignar}>
              {paso.texto}
            </Button>
          ) : (
            <Button size="sm" {...TACTIL} variant={s.estado === "recibida" ? "solid" : "outline"} isDisabled={ocupada} aria-label={`${paso.texto} la solicitud ${s.id}`} onClick={() => alAvanzar(s, paso.destino)}>
              {paso.texto}
            </Button>
          )
        ) : (
          <Text fontSize="sm" color="textoSuave">
            Sin pasos pendientes
          </Text>
        )}
        {hayMenu && (
          <Menu placement="bottom-end" isLazy>
            <MenuButton as={IconButton} aria-label={`Más acciones de la solicitud ${s.id}`} icon={<IconoPuntos tam="1.25rem" />} variant="ghost" size="sm" {...TACTIL} minW={{ base: "2.75rem", md: "2rem" }} />
            <MenuList>
              {tarea && (
                <MenuItem as="a" href="#sec-tareas" minH="2.5rem">
                  Ver la tarea {tarea.id}
                </MenuItem>
              )}
              {s.texto && (
                <MenuItem minH="2.5rem" onClick={() => setMensajeAbierto((v) => !v)}>
                  {mensajeAbierto ? "Contraer el mensaje" : "Ver el mensaje completo"}
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        )}
      </Flex>

      {asignando && s.estado === "verificada" && (
        <Flex data-area="asignar" gap={2} align="flex-end" wrap="wrap" p={3} bg="fondo" borderRadius="lg" border="1px solid" borderColor="borde">
          <FormControl flex="1 1 12rem" minW={0}>
            <FormLabel htmlFor={`asignar-${s.id}`} fontSize="sm" mb={1}>
              Cuadrilla para la solicitud {s.id}
            </FormLabel>
            <Select id={`asignar-${s.id}`} size="sm" {...TACTIL} bg="superficie" placeholder="Sin cuadrilla por ahora" value={cuadrilla} onChange={(e) => setCuadrilla(e.target.value)}>
              {cuadrillas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </FormControl>
          <Button size="sm" {...TACTIL} isDisabled={ocupada} aria-label={`Confirmar la asignación de la solicitud ${s.id}`} onClick={() => alAvanzar(s, "asignada", cuadrilla ? Number(cuadrilla) : undefined)}>
            Asignar
          </Button>
          <Button size="sm" {...TACTIL} variant="ghost" onClick={alCerrarAsignar}>
            Cancelar
          </Button>
        </Flex>
      )}
    </FilaLista>
  );
}

/** Cola de solicitudes de asistencia: lista de triaje con filtros de estado y sector, lo más viejo sin resolver primero. */
export function ColaAsistencia({ cuadrillas, tareas }: { cuadrillas: Cuadrilla[]; tareas: Tarea[] }) {
  // Los filtros viven en la URL: el tablero enlaza acá con `?estado=recibida` o `?sector=S4`.
  const [params, setParams] = useSearchParams();
  const estadoFiltro = params.get("estado") ?? "";
  const sectorFiltro = params.get("sector") ?? "";
  // El sector se filtra en el servidor; el estado, en la pantalla, para poder mostrar cuántas hay de cada uno.
  const carga = useCarga(() => api.solicitudes({ sector_id: sectorFiltro || undefined, limite: 200 }), [sectorFiltro]);
  const toast = useToast();
  const ahora = useAhora();
  const [error, setError] = useState<unknown>(null);
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [asignando, setAsignando] = useState<number | null>(null);
  const [verResueltas, setVerResueltas] = useState(false);

  const cambiarFiltro = (clave: "estado" | "sector", valor: string) => {
    const nuevo = new URLSearchParams(params);
    if (valor) nuevo.set(clave, valor);
    else nuevo.delete(clave);
    setParams(nuevo, { replace: true });
  };

  async function avanzar(s: Solicitud, destino: string, cuadrillaId?: number) {
    setError(null);
    setOcupada(s.id);
    try {
      await api.avanzarSolicitud(s.id, destino, destino === "asignada" ? cuadrillaId : undefined);
      toast({ title: `Solicitud ${s.id}: ${destino.replace("_", " ")}`, status: "success", duration: 2500 });
      setAsignando(null);
      carga.recargar();
    } catch (e) {
      setError(e);
    } finally {
      setOcupada(null);
    }
  }

  const todas = useMemo(() => carga.datos?.solicitudes ?? [], [carga.datos]);
  const cuentas = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of todas) c[s.estado] = (c[s.estado] ?? 0) + 1;
    return c;
  }, [todas]);
  const porSolicitud = useMemo(() => new Map(tareas.filter((t) => t.solicitud_id !== null).map((t) => [t.solicitud_id as number, t])), [tareas]);

  const visibles = estadoFiltro ? todas.filter((s) => s.estado === estadoFiltro) : todas;
  const t = (s: Solicitud) => new Date(s.creado_en).getTime();
  // Triaje: primero lo que espera una acción (recibida, verificada, asignada, en curso) y, dentro de cada estado, lo más viejo.
  const orden = (s: Solicitud) => ESTADOS_SOLICITUD.indexOf(s.estado);
  const abiertas = visibles.filter((s) => s.estado !== "resuelta").sort((a, b) => orden(a) - orden(b) || t(a) - t(b));
  const resueltas = visibles.filter((s) => s.estado === "resuelta").sort((a, b) => t(b) - t(a));
  const resueltasVisibles = estadoFiltro === "resuelta" || verResueltas;
  const hayFiltros = Boolean(estadoFiltro || sectorFiltro);
  const sinResolver = todas.length - (cuentas.resuelta ?? 0);
  const total = carga.datos?.total ?? todas.length;

  const fila = (s: Solicitud) => (
    <FilaSolicitud
      key={s.id}
      s={s}
      tarea={porSolicitud.get(s.id)}
      cuadrillas={cuadrillas}
      ahora={ahora}
      ocupada={ocupada === s.id}
      asignando={asignando === s.id}
      alAvanzar={(sol, destino, c) => void avanzar(sol, destino, c)}
      alAbrirAsignar={() => setAsignando(s.id)}
      alCerrarAsignar={() => setAsignando(null)}
    />
  );

  return (
    <Seccion
      titulo="Cola de solicitudes de asistencia"
      categoria="SIMULADO"
      id="sec-solicitudes"
      icono={<IconoBandeja tam="1.25rem" />}
      derecha={carga.estado === "ok" ? `${sinResolver} sin resolver` : undefined}
    >
      <Flex direction="column" gap={3} mb={4}>
        <GrupoFiltros rotulo="Estado">
          <ChipFiltro activo={!estadoFiltro} onClick={() => cambiarFiltro("estado", "")} cantidad={carga.estado === "ok" ? todas.length : undefined}>
            Todas
          </ChipFiltro>
          {ESTADOS_SOLICITUD.map((e) => (
            <ChipFiltro key={e} activo={estadoFiltro === e} onClick={() => cambiarFiltro("estado", e)} cantidad={carga.estado === "ok" ? (cuentas[e] ?? 0) : undefined}>
              {etiquetaEstadoSolicitud(e)}
            </ChipFiltro>
          ))}
        </GrupoFiltros>
        <GrupoFiltros rotulo="Sector">
          <ChipFiltro activo={!sectorFiltro} onClick={() => cambiarFiltro("sector", "")}>
            Todos
          </ChipFiltro>
          {SECTORES.map((s) => (
            <ChipFiltro key={s} activo={sectorFiltro === s} onClick={() => cambiarFiltro("sector", s)}>
              {s}
            </ChipFiltro>
          ))}
        </GrupoFiltros>
      </Flex>

      {carga.estado === "cargando" && <EstadoCargando />}
      {carga.estado === "error" && (
        <Box>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </Box>
      )}
      {carga.estado === "ok" && visibles.length === 0 && (
        <Flex direction="column" align="flex-start" gap={2} p={4} bg="fondo" borderRadius="xl" border="1px dashed" borderColor="bordeControl">
          <Text fontWeight={700}>{hayFiltros ? "No hay solicitudes con esos filtros." : "No hay solicitudes en la cola."}</Text>
          <Text textStyle="microdato">{hayFiltros ? "Probá con otro estado o sector." : "Cuando llegue una desde la app, la web o un canal simulado, aparece acá."}</Text>
          {hayFiltros && (
            <Button size="sm" variant="outline" {...TACTIL} onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Quitar los filtros
            </Button>
          )}
        </Flex>
      )}
      {carga.estado === "ok" && visibles.length > 0 && (
        <Box sx={CONTENEDOR}>
          {abiertas.length > 0 && (
            <>
              <Box aria-hidden="true" textStyle="rotulo" sx={CABECERA} mb={1}>
                <span>Solicitud</span>
                <span>Sector</span>
                <span>Origen</span>
                <span>Recibida</span>
                <Box textAlign="right">Personas</Box>
                <Box textAlign="right">Animales</Box>
                <span>Estado</span>
                <span />
              </Box>
              <Flex as="ul" direction="column" gap={2} m={0} p={0} aria-label="Solicitudes sin resolver" aria-busy={carga.estado !== "ok"}>
                {abiertas.map(fila)}
              </Flex>
            </>
          )}
          {estadoFiltro !== "resuelta" && resueltas.length > 0 && (
            <Button
              mt={abiertas.length > 0 ? 4 : 0}
              size="sm"
              variant="ghost"
              {...TACTIL}
              aria-expanded={verResueltas}
              aria-controls="solicitudes-resueltas"
              onClick={() => setVerResueltas((v) => !v)}
            >
              {verResueltas ? "Ocultar" : "Mostrar"} las resueltas ({resueltas.length})
            </Button>
          )}
          {resueltasVisibles && resueltas.length > 0 && (
            <Flex as="ul" id="solicitudes-resueltas" direction="column" gap={2} m={0} mt={2} p={0} aria-label="Solicitudes resueltas">
              {resueltas.map(fila)}
            </Flex>
          )}
          {total > todas.length && (
            <Text textStyle="microdato" mt={3}>
              Se muestran las {todas.length} más recientes de {total}.
            </Text>
          )}
        </Box>
      )}
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Seccion>
  );
}
