import type { ComponentType } from "react";

import { IconoAlerta, IconoCamion, IconoHistorial, IconoReloj, IconoTilde, IconoTriangulo, type PropsIcono } from "../../components/iconos/Iconos";
import { etiquetaEstadoTarea } from "../../lib/etiquetas";
import type { ParteTarea } from "../tipos";
import { Chip, type TonoChip } from "../ui";

/** Altura mínima de 44 px en el celular para los botones chicos del panel (objetivo táctil, WCAG 2.5.5). */
export const TACTIL = { minH: { base: "2.75rem", md: "2rem" } } as const;

/** Clave visual de un parte: los resultados se distinguen por su resultado; el resto, por su tipo. */
export type ClaveParte = "avance" | "dificultad" | "completa" | "parcial" | "no_realizada" | "reprogramada";

export function claveParte(p: Pick<ParteTarea, "tipo" | "resultado">): ClaveParte {
  return p.tipo === "resultado" ? (p.resultado ?? "completa") : p.tipo;
}

export const CONFIG_PARTE: Record<ClaveParte, { texto: string; Icono: ComponentType<PropsIcono>; tono: TonoChip }> = {
  avance: { texto: "Avance", Icono: IconoHistorial, tono: "info" },
  dificultad: { texto: "Dificultad", Icono: IconoTriangulo, tono: "aviso" },
  completa: { texto: "Tarea completa", Icono: IconoTilde, tono: "ok" },
  parcial: { texto: "Resultado parcial", Icono: IconoAlerta, tono: "aviso" },
  no_realizada: { texto: "No realizada", Icono: IconoAlerta, tono: "alerta" },
  reprogramada: { texto: "Reprogramada", Icono: IconoReloj, tono: "aviso" },
};

/** Etiqueta con ícono y texto (el estado nunca depende solo del color). */
export function ChipParte({ parte }: { parte: Pick<ParteTarea, "tipo" | "resultado"> }) {
  const c = CONFIG_PARTE[claveParte(parte)];
  return (
    <Chip tono={c.tono} icono={<c.Icono tam="1rem" />} data-testid="chip-parte">
      {c.texto}
    </Chip>
  );
}

const TONO_TAREA: Record<string, { tono: TonoChip; Icono: ComponentType<PropsIcono> }> = {
  pendiente: { tono: "neutro", Icono: IconoReloj },
  en_curso: { tono: "info", Icono: IconoCamion },
  completada: { tono: "ok", Icono: IconoTilde },
  cancelada: { tono: "neutro", Icono: IconoAlerta },
};

/** Estado de una tarea: ícono y texto, el color solo refuerza. */
export function ChipEstadoTarea({ estado, testId }: { estado: string; testId?: string }) {
  const c = TONO_TAREA[estado] ?? TONO_TAREA.pendiente;
  return (
    <Chip tono={c.tono} icono={<c.Icono tam="0.9rem" />} data-testid={testId}>
      {etiquetaEstadoTarea(estado)}
    </Chip>
  );
}

/** Aviso para lo que requiere atención del operador: ícono, texto y color. */
export function AvisoAtencion({ children = "Requiere atención" }: { children?: string }) {
  return (
    <Chip tono="aviso" icono={<IconoTriangulo tam="1rem" />} fontWeight={700} data-testid="requiere-atencion">
      {children}
    </Chip>
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
