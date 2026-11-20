import { Box, Flex, Text } from "@chakra-ui/react";
import type { Categoria } from "@evacuaciones/shared";
import type { ReactNode } from "react";

import { IconoAlerta, IconoBandeja, IconoCamion, IconoOlas, IconoPersonas, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { duracionCorta } from "../../lib/vivo";
import type { ResumenPanel } from "../tipos";
import { Chip, fmtM, fmtNum, type TonoChip } from "../ui";

type Indicador = {
  id: string;
  etiqueta: string;
  icono: ReactNode;
  valor: ReactNode;
  detalle: ReactNode;
  categoria: Categoria;
  chip?: { tono: TonoChip; icono: ReactNode; texto: string };
};

/** Las cinco lecturas que más pesan en una decisión, a partir del mismo resumen que alimenta el resto del tablero. */
export function indicadoresDe(r: ResumenPanel): Indicador[] {
  const out: Indicador[] = [];

  // Río frente a los umbrales.
  if (r.rio.disponible && r.rio.altura_m !== undefined && r.rio.umbral_alerta_m !== undefined && r.rio.umbral_evacuacion_m !== undefined) {
    const h = r.rio.altura_m;
    const estado = h >= r.rio.umbral_evacuacion_m ? "evacuacion" : h >= r.rio.umbral_alerta_m ? "alerta" : "normal";
    const dist = r.rio.distancia_a_alerta_m ?? r.rio.umbral_alerta_m - h;
    out.push({
      id: "rio",
      etiqueta: "Río en Puerto Formosa",
      icono: <IconoOlas />,
      valor: fmtM(h),
      detalle: estado === "normal" ? `a ${fmtM(dist)} de la alerta (${fmtM(r.rio.umbral_alerta_m)})` : `alerta ${fmtM(r.rio.umbral_alerta_m)} · evacuación ${fmtM(r.rio.umbral_evacuacion_m)}`,
      categoria: r.rio.categoria,
      chip:
        estado === "normal"
          ? { tono: "ok", icono: <IconoTilde tam="1em" />, texto: "bajo la alerta" }
          : estado === "alerta"
            ? { tono: "aviso", icono: <IconoTriangulo tam="1em" />, texto: "en alerta" }
            : { tono: "alerta", icono: <IconoAlerta tam="1em" />, texto: "en evacuación" },
    });
  } else {
    out.push({ id: "rio", etiqueta: "Río en Puerto Formosa", icono: <IconoOlas />, valor: "sin dato", detalle: "Todavía no hay lecturas cargadas", categoria: r.rio.categoria });
  }

  // Sectores.
  const items = r.sectores.items;
  const comprometidos = items.filter((s) => s.estado === "comprometido").length;
  const enRiesgo = items.filter((s) => s.estado === "en_riesgo").length;
  const aislados = items.filter((s) => s.aislado).length;
  out.push({
    id: "sectores",
    etiqueta: "Sectores comprometidos",
    icono: <IconoAlerta />,
    valor: `${fmtNum(comprometidos)} de ${fmtNum(items.length)}`,
    detalle: `${fmtNum(enRiesgo)} en riesgo · ${fmtNum(aislados)} ${aislados === 1 ? "aislado" : "aislados"}`,
    categoria: r.sectores.categoria,
    chip: comprometidos > 0 ? { tono: "alerta", icono: <IconoAlerta tam="1em" />, texto: "hay que decidir" } : enRiesgo > 0 ? { tono: "aviso", icono: <IconoTriangulo tam="1em" />, texto: "vigilar" } : { tono: "ok", icono: <IconoTilde tam="1em" />, texto: "sin novedad" },
  });

  // Pedidos de asistencia abiertos.
  const s = r.solicitudes;
  const abiertas = Math.max(0, s.total - (s.por_estado.resuelta ?? 0));
  out.push({
    id: "pedidos",
    etiqueta: "Pedidos abiertos",
    icono: <IconoBandeja />,
    valor: fmtNum(abiertas),
    detalle: s.recibidas_mas_antigua_min === null ? "ninguno espera atención" : `el más antiguo espera ${duracionCorta(s.recibidas_mas_antigua_min)}`,
    categoria: s.categoria,
    chip: s.a_verificar > 0 ? { tono: "aviso", icono: <IconoTriangulo tam="1em" />, texto: `${fmtNum(s.a_verificar)} por verificar` } : undefined,
  });

  // Cuadrillas libres.
  const cuadrillas = r.cuadrillas.items;
  const libres = cuadrillas.filter((c) => (c.tareas.pendiente ?? 0) + (c.tareas.en_curso ?? 0) === 0).length;
  out.push({
    id: "cuadrillas",
    etiqueta: "Cuadrillas libres",
    icono: <IconoPersonas />,
    valor: `${fmtNum(libres)} de ${fmtNum(cuadrillas.length)}`,
    detalle: `${fmtNum(cuadrillas.length - libres)} con tareas abiertas`,
    categoria: r.cuadrillas.categoria,
    chip: r.cuadrillas.tareas_sin_cuadrilla > 0 ? { tono: "aviso", icono: <IconoTriangulo tam="1em" />, texto: `${fmtNum(r.cuadrillas.tareas_sin_cuadrilla)} sin cuadrilla` } : undefined,
  });

  // Evacuaciones: solo si el servicio ya las informa.
  if (r.evacuaciones) {
    const e = r.evacuaciones;
    const pct = e.verificadas_pct;
    out.push({
      id: "evacuaciones",
      etiqueta: "Evacuaciones verificadas",
      icono: <IconoCamion />,
      valor: pct === null || pct === undefined ? "sin dato" : `${fmtNum(pct, 0)} %`,
      detalle: `${fmtNum(e.personas_trasladadas ?? 0)} personas trasladadas`,
      categoria: e.categoria,
      chip: (e.discrepancias_abiertas ?? 0) > 0 ? { tono: "aviso", icono: <IconoTriangulo tam="1em" />, texto: `${fmtNum(e.discrepancias_abiertas)} por revisar` } : undefined,
    });
  }
  return out;
}

/**
 * Franja de situación: una sola superficie con celdas separadas por líneas finas, no una fila de tarjetas.
 * Cada celda trae su cifra grande (numerales tabulares), una frase de contexto y la categoría del dato.
 */
export function ResumenSituacion({ resumen }: { resumen: ResumenPanel }) {
  const celdas = indicadoresDe(resumen);
  return (
    <Box
      as="ul"
      role="region"
      aria-label="Resumen de la situación"
      data-testid="resumen-situacion"
      listStyleType="none"
      m={0}
      p={0}
      mb={5}
      display="grid"
      gap="1px"
      bg="borde"
      border="1px solid"
      borderColor="borde"
      borderRadius="xl"
      overflow="hidden"
      gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", xl: `repeat(${celdas.length}, minmax(0, 1fr))` }}
      sx={{
        "& > li:last-child:nth-of-type(odd)": { gridColumn: "1 / -1" },
        "@media (min-width: 48em)": {
          "& > li:last-child:nth-of-type(odd)": { gridColumn: "auto" },
          "& > li:last-child:nth-of-type(3n+2)": { gridColumn: "span 2" },
          "& > li:last-child:nth-of-type(3n+1)": { gridColumn: "1 / -1" },
        },
        "@media (min-width: 80em)": { "& > li:last-child": { gridColumn: "auto !important" } },
      }}
    >
      {celdas.map((c) => (
        <Flex as="li" key={c.id} direction="column" gap={1.5} bg="superficie" p={{ base: 3.5, md: 4 }} minW={0} data-testid={`kpi-${c.id}`}>
          <Flex align="flex-start" gap={2} color="textoSuave">
            {c.icono}
            <Text textStyle="rotulo">
              {c.etiqueta}
            </Text>
          </Flex>
          <Text textStyle="cifraMedia" fontSize={{ base: "1.5rem", md: "1.875rem" }} lineHeight={1.05}>
            {c.valor}
          </Text>
          <Text textStyle="microdato">{c.detalle}</Text>
          <Flex gap={1.5} wrap="wrap" align="center" mt="auto" pt={1}>
            {c.chip && (
              <Chip tono={c.chip.tono} icono={c.chip.icono}>
                {c.chip.texto}
              </Chip>
            )}
            <Insignia categoria={c.categoria} />
          </Flex>
        </Flex>
      ))}
    </Box>
  );
}
