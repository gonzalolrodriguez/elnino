import { Flex } from "@chakra-ui/react";
import type { ComponentType } from "react";

import { IconoAlerta, IconoHistorial, IconoReloj, IconoTilde, IconoTriangulo, type PropsIcono } from "../../components/iconos/Iconos";
import type { ParteTarea } from "../tipos";

/** Clave visual de un parte: los resultados se distinguen por su resultado; el resto, por su tipo. */
export type ClaveParte = "avance" | "dificultad" | "completa" | "parcial" | "no_realizada" | "reprogramada";

export function claveParte(p: Pick<ParteTarea, "tipo" | "resultado">): ClaveParte {
  return p.tipo === "resultado" ? (p.resultado ?? "completa") : p.tipo;
}

type Tono = "agua" | "verde" | "alerta" | "rojo";
export const CONFIG_PARTE: Record<ClaveParte, { texto: string; Icono: ComponentType<PropsIcono>; tono: Tono }> = {
  avance: { texto: "Avance", Icono: IconoHistorial, tono: "agua" },
  dificultad: { texto: "Dificultad", Icono: IconoTriangulo, tono: "alerta" },
  completa: { texto: "Tarea completa", Icono: IconoTilde, tono: "verde" },
  parcial: { texto: "Resultado parcial", Icono: IconoAlerta, tono: "alerta" },
  no_realizada: { texto: "No realizada", Icono: IconoAlerta, tono: "rojo" },
  reprogramada: { texto: "Reprogramada", Icono: IconoReloj, tono: "alerta" },
};

const COLORES: Record<Tono, { bg: string; color: string }> = {
  agua: { bg: "agua.100", color: "agua.800" },
  verde: { bg: "verde.100", color: "verde.800" },
  alerta: { bg: "alerta.100", color: "alerta.800" },
  rojo: { bg: "evacuacion.100", color: "evacuacion.800" },
};

/** Etiqueta con ícono y texto (el estado nunca depende solo del color). */
export function ChipParte({ parte }: { parte: Pick<ParteTarea, "tipo" | "resultado"> }) {
  const c = CONFIG_PARTE[claveParte(parte)];
  return (
    <Flex as="span" display="inline-flex" align="center" gap={1.5} px={2.5} py="1px" borderRadius="full" fontSize="sm" fontWeight={600} whiteSpace="nowrap" {...COLORES[c.tono]} data-testid="chip-parte">
      <c.Icono tam="1rem" />
      {c.texto}
    </Flex>
  );
}

/** Orden de las novedades: dificultades sin resolver, después resultados no completos, después el resto; dentro de cada grupo, lo más nuevo primero. */
export function prioridadParte(p: Pick<ParteTarea, "tipo" | "resultado" | "resuelta">): 0 | 1 | 2 {
  if (p.tipo === "dificultad" && !p.resuelta) return 0;
  if (p.tipo === "resultado" && p.resultado !== "completa") return 1;
  return 2;
}

export function ordenarNovedades<T extends ParteTarea>(partes: T[]): T[] {
  return [...partes].sort((a, b) => prioridadParte(a) - prioridadParte(b) || b.creado_en.localeCompare(a.creado_en));
}

export function truncar(texto: string, max = 120): string {
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}
