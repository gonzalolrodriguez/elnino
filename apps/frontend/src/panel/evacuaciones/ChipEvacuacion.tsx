import { Badge } from "@chakra-ui/react";

import { etiquetaEstadoEvacuacion } from "../../lib/etiquetas";
import type { EstadoEvacuacion } from "../tipos";

const ESTILO: Record<EstadoEvacuacion, { esquema: string; marca: string }> = {
  pendiente: { esquema: "gray", marca: "○" },
  en_curso: { esquema: "blue", marca: "◐" },
  cerrada_cuadrilla: { esquema: "yellow", marca: "●" },
  verificada: { esquema: "green", marca: "✓" },
  con_discrepancia: { esquema: "red", marca: "!" },
};

/** Estado de una evacuación: texto legible más una marca de forma, para no depender solo del color. */
export function ChipEvacuacion({ estado }: { estado: EstadoEvacuacion }) {
  const e = ESTILO[estado] ?? ESTILO.pendiente;
  return (
    <Badge colorScheme={e.esquema} textTransform="none" fontSize="0.75rem" whiteSpace="normal" data-estado={estado}>
      <span aria-hidden="true">{e.marca} </span>
      {etiquetaEstadoEvacuacion(estado)}
    </Badge>
  );
}
