import { Box, Button, Flex, Link, Select, Text, useToast } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { EstadoCargando } from "../../components/EstadoCargando";
import { AlertaError } from "../../components/Formulario";
import { IconoCamion, IconoPersonas } from "../../components/iconos/Iconos";
import { hace, useAhora } from "../../lib/vivo";
import type { Carga } from "../../lib/useCarga";
import { api } from "../api";
import { HistorialPartes } from "../cuadrillas/HistorialPartes";
import { AvisoAtencion, ChipEstadoTarea, ChipParte, TACTIL } from "../cuadrillas/partes";
import type { Cuadrilla, Tarea } from "../tipos";
import { Chip, FichaIcono, Seccion } from "../ui";
import { ANCHO_AMPLIO, ANCHO_MEDIO, CONTENEDOR, FilaLista } from "./lista";

const SIGUIENTE_TAREA: Record<string, { estado: string; texto: string }[]> = {
  pendiente: [
    { estado: "en_curso", texto: "Iniciar" },
    { estado: "cancelada", texto: "Cancelar" },
  ],
  en_curso: [
    { estado: "completada", texto: "Completar" },
    { estado: "cancelada", texto: "Cancelar" },
  ],
};
/** Primero lo que pide atención, después lo que está en marcha, lo pendiente y, al final, lo cerrado. */
const PESO_ESTADO: Record<string, number> = { en_curso: 1, pendiente: 2, completada: 3, cancelada: 4 };

const COLUMNAS = "minmax(12rem,2fr) 4.5rem minmax(9rem,1fr) minmax(12rem,1.2fr) 19rem";

const REJILLA = {
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateAreas: '"titulo" "estado" "cuadrilla" "acc" "partes"',
  "& [data-area='titulo']": { gridArea: "titulo" },
  "& [data-area='sector']": { display: "none" },
  "& [data-area='estado']": { gridArea: "estado", display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" },
  "& [data-area='cuadrilla']": { gridArea: "cuadrilla", marginTop: "0.75rem" },
  "& [data-area='acc']": { gridArea: "acc", display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" },
  "& [data-area='acc'] > button": { flex: "1 1 6rem" },
  "& [data-area='partes']": { gridArea: "partes", marginTop: "0.75rem" },
  [`@container (min-width: ${ANCHO_MEDIO})`]: {
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gridTemplateAreas: '"titulo estado" "cuadrilla acc" "partes partes"',
    "& [data-area='estado']": { justifyContent: "flex-end", marginTop: 0 },
    "& [data-area='cuadrilla']": { marginTop: "0.5rem" },
    "& [data-area='acc']": { marginTop: "0.5rem", justifySelf: "end" },
    "& [data-area='acc'] > button": { flex: "0 0 auto" },
  },
  [`@container (min-width: ${ANCHO_AMPLIO})`]: {
    gridTemplateColumns: COLUMNAS,
    gridTemplateAreas: '"titulo sector estado cuadrilla acc" "partes partes partes partes partes"',
    "& [data-area='sector']": { display: "block", gridArea: "sector" },
    "& [data-area='estado']": { justifyContent: "flex-start", flexDirection: "column", alignItems: "flex-start" },
    "& [data-area='cuadrilla']": { marginTop: 0 },
    "& [data-area='acc']": { marginTop: 0 },
  },
} as const;

const CABECERA = {
  display: "none",
  [`@container (min-width: ${ANCHO_AMPLIO})`]: { display: "grid", gridTemplateColumns: COLUMNAS, columnGap: "0.75rem", padding: "0 1rem 0.25rem" },
} as const;

function FilaTarea({
  t,
  cuadrillas,
  ahora,
  abierta,
  alternar,
  cambiar,
  recargar,
}: {
  t: Tarea;
  cuadrillas: Cuadrilla[];
  ahora: number;
  abierta: boolean;
  alternar: () => void;
  cambiar: (t: Tarea, c: { estado?: string; cuadrilla_id?: number }) => void;
  recargar: () => void;
}) {
  const cerrada = t.estado === "completada" || t.estado === "cancelada";
  const acciones = SIGUIENTE_TAREA[t.estado] ?? [];
  const cuadrilla = cuadrillas.find((c) => c.id === t.cuadrilla_id);
  return (
    <FilaLista sx={REJILLA} atenuada={cerrada} acento={t.requiere_atencion === true} data-testid={`tarea-${t.id}`}>
      <Flex data-area="titulo" align="flex-start" gap={2.5} minW={0}>
        <FichaIcono icono={<IconoCamion tam="1.125rem" />} tam="2.25rem" tono={t.requiere_atencion ? "aviso" : cerrada ? "neutro" : "info"} />
        <Box minW={0}>
          <Text fontWeight={700} lineHeight={1.3}>
            {t.titulo}
          </Text>
          <Text textStyle="microdato">
            Tarea n.º {t.id}
            {t.solicitud_id !== null && `, de la solicitud n.º ${t.solicitud_id}`}, {hace(Math.max(0, ahora - new Date(t.creado_en).getTime()))}
          </Text>
        </Box>
      </Flex>
      <Box data-area="sector" fontWeight={600}>
        {t.sector_id ? <Chip tono="neutro">{t.sector_id}</Chip> : <Box as="span" color="textoSuave">Sin sector</Box>}
      </Box>
      <Box data-area="estado">
        <ChipEstadoTarea estado={t.estado} />
        {t.requiere_atencion && <AvisoAtencion />}
        {t.ultimo_parte && <ChipParte parte={t.ultimo_parte} />}
      </Box>
      <Flex data-area="cuadrilla" direction="column" gap={1.5} minW={0}>
        <Flex align="center" gap={1.5} minW={0}>
          <IconoPersonas tam="1rem" />
          {cuadrilla ? (
            <Link as={RouterLink} to={`/comando/cuadrillas/${cuadrilla.id}`} className="enlace-toque" fontWeight={600}>
              {cuadrilla.nombre}
            </Link>
          ) : (
            <Text as="span" color="textoSuave">
              Sin cuadrilla
            </Text>
          )}
        </Flex>
        <Select
          aria-label={`Cuadrilla de la tarea ${t.id}`}
          size="sm"
          {...TACTIL}
          bg="superficie"
          value={t.cuadrilla_id ?? ""}
          placeholder="Sin asignar"
          isDisabled={cerrada}
          onChange={(e) => e.target.value && cambiar(t, { cuadrilla_id: Number(e.target.value) })}
        >
          {cuadrillas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Flex>
      <Flex data-area="acc" align="center" justify="flex-end">
        {acciones.map((a, i) => (
          <Button key={a.estado} size="sm" {...TACTIL} variant={i === 0 ? "solid" : "outline"} aria-label={`${a.texto} la tarea ${t.id}`} onClick={() => cambiar(t, { estado: a.estado })}>
            {a.texto}
          </Button>
        ))}
        <Button size="sm" {...TACTIL} variant="ghost" aria-expanded={abierta} aria-controls={`partes-tarea-${t.id}`} onClick={alternar} aria-label={`${abierta ? "Ocultar" : "Ver"} partes de la tarea ${t.id}`}>
          {abierta ? "Ocultar partes" : "Ver partes"}
        </Button>
      </Flex>
      {abierta && (
        <Box data-area="partes" id={`partes-tarea-${t.id}`}>
          <HistorialPartes tareaId={t.id} requiereAtencion={t.requiere_atencion === true} alCambiar={recargar} />
        </Box>
      )}
    </FilaLista>
  );
}

/** Tareas de cuadrillas: misma lista que la cola de solicitudes, con la atención pendiente arriba. */
export function ListaTareas({ cuadrillas, carga }: { cuadrillas: Cuadrilla[]; carga: Carga<{ tareas: Tarea[] }> & { recargar: () => void } }) {
  const toast = useToast();
  const ahora = useAhora();
  const [error, setError] = useState<unknown>(null);
  // `?tarea=N` (enlace desde «Cuadrillas») deja abierto el historial de partes de esa tarea.
  const [params] = useSearchParams();
  const [abiertas, setAbiertas] = useState<number[]>(() => (params.get("tarea") ? [Number(params.get("tarea"))] : []));
  const alternar = (id: number) => setAbiertas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  async function cambiar(t: Tarea, c: { estado?: string; cuadrilla_id?: number }) {
    setError(null);
    try {
      await api.actualizarTarea(t.id, c);
      toast({ title: "Tarea actualizada", status: "success", duration: 2500 });
      carga.recargar();
    } catch (e) {
      setError(e);
    }
  }

  const ordenadas = useMemo(
    () => [...(carga.datos?.tareas ?? [])].sort((a, b) => Number(b.requiere_atencion === true) - Number(a.requiere_atencion === true) || (PESO_ESTADO[a.estado] ?? 5) - (PESO_ESTADO[b.estado] ?? 5) || new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()),
    [carga.datos],
  );
  const conAtencion = ordenadas.filter((t) => t.requiere_atencion).length;

  return (
    <Seccion
      titulo="Tareas de cuadrillas"
      categoria="SIMULADO"
      id="sec-tareas"
      icono={<IconoCamion tam="1.25rem" />}
      derecha={carga.estado === "ok" && ordenadas.length > 0 ? `${ordenadas.length} tareas${conAtencion ? `, ${conAtencion} con atención` : ""}` : undefined}
    >
      {carga.estado === "cargando" && <EstadoCargando />}
      {carga.estado === "error" && (
        <Box>
          <AlertaError error={carga.error} />
          <Button mt={2} size="sm" variant="outline" onClick={carga.recargar}>
            Reintentar
          </Button>
        </Box>
      )}
      {carga.estado === "ok" && ordenadas.length === 0 && (
        <Flex direction="column" gap={1} p={4} bg="fondo" borderRadius="xl" border="1px dashed" borderColor="bordeControl">
          <Text fontWeight={700}>No hay tareas.</Text>
          <Text textStyle="microdato">Se crean al emitir una orden o asignar una solicitud.</Text>
        </Flex>
      )}
      {carga.estado === "ok" && ordenadas.length > 0 && (
        <Box sx={CONTENEDOR}>
          <Box aria-hidden="true" textStyle="rotulo" sx={CABECERA} mb={1}>
            <span>Tarea</span>
            <span>Sector</span>
            <span>Estado</span>
            <span>Cuadrilla</span>
            <span />
          </Box>
          <Flex as="ul" direction="column" gap={2} m={0} p={0} aria-label="Tareas">
            {ordenadas.map((t) => (
              <FilaTarea key={t.id} t={t} cuadrillas={cuadrillas} ahora={ahora} abierta={abiertas.includes(t.id)} alternar={() => alternar(t.id)} cambiar={(tt, c) => void cambiar(tt, c)} recargar={carga.recargar} />
            ))}
          </Flex>
        </Box>
      )}
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Seccion>
  );
}
