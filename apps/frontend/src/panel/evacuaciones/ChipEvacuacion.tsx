import type { ComponentType } from "react";

import { IconoCamion, IconoHistorial, IconoReloj, IconoTilde, IconoTriangulo, type PropsIcono } from "../../components/iconos/Iconos";
import { etiquetaEstadoEvacuacion } from "../../lib/etiquetas";
import type { EstadoEvacuacion } from "../tipos";
import { Chip, type TonoChip } from "../ui";

const ESTILO: Record<EstadoEvacuacion, { tono: TonoChip; Icono: ComponentType<PropsIcono> }> = {
  pendiente: { tono: "neutro", Icono: IconoReloj },
  en_curso: { tono: "info", Icono: IconoCamion },
  cerrada_cuadrilla: { tono: "aviso", Icono: IconoHistorial },
  verificada: { tono: "ok", Icono: IconoTilde },
  con_discrepancia: { tono: "alerta", Icono: IconoTriangulo },
};

/** Estado de una evacuación: ícono y texto, el color solo refuerza (mismo chip que el resto del panel). */
export function ChipEvacuacion({ estado }: { estado: EstadoEvacuacion }) {
  const e = ESTILO[estado] ?? ESTILO.pendiente;
  return (
    <Chip tono={e.tono} icono={<e.Icono tam="0.9rem" />} whiteSpace="normal" textAlign="left" data-estado={estado}>
      {etiquetaEstadoEvacuacion(estado)}
    </Chip>
  );
}
