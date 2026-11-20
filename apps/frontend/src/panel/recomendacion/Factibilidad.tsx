import { Box, Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { IconoAlerta, IconoInfo, IconoReloj, IconoTilde, IconoTriangulo } from "../../components/iconos/Iconos";
import type { FactibilidadDetalle, Veredicto } from "../tipos";
import { Chip, type TonoChip } from "../ui";
import { fmtH, NOMBRE_VEREDICTO } from "./formato";

const ASPECTO: Record<Veredicto, { tono: TonoChip; icono: ReactNode; color: string }> = {
  alcanza: { tono: "ok", icono: <IconoTilde tam="1em" strokeWidth={2.25} />, color: "verde.800" },
  justo: { tono: "aviso", icono: <IconoReloj tam="1em" />, color: "alerta.800" },
  no_alcanza: { tono: "alerta", icono: <IconoAlerta tam="1em" />, color: "evacuacion.800" },
  ya_comprometido: { tono: "alerta", icono: <IconoTriangulo tam="1em" />, color: "evacuacion.800" },
  sin_estimacion: { tono: "neutro", icono: <IconoInfo tam="1em" />, color: "textoSuave" },
};

/** Veredicto con ícono y texto: el color solo refuerza. */
export function ChipVeredicto({ v }: { v: Veredicto }) {
  const a = ASPECTO[v];
  return (
    <Chip tono={a.tono} icono={a.icono}>
      {NOMBRE_VEREDICTO[v]}
    </Chip>
  );
}

/** ¿Alcanza el tiempo? Veredicto, margen como cifra grande y el detalle del plazo en una línea. */
export function LineaFactibilidad({ titulo, f }: { titulo: string; f: FactibilidadDetalle }) {
  const plazo =
    f.plazo_minimo_h === null ? "sin plazo estimado" : f.plazo_minimo_h === f.plazo_maximo_h ? fmtH(f.plazo_minimo_h) : `${fmtH(f.plazo_minimo_h)} a ${fmtH(f.plazo_maximo_h)}`;
  const margen = f.veredicto === "ya_comprometido" || f.holgura_h === null ? null : f.holgura_h;
  const a = ASPECTO[f.veredicto];
  return (
    <Box data-testid={`factibilidad-${titulo}`}>
      <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
        <Box minW={0}>
          <Text textStyle="rotulo" mb={1}>
            ¿Alcanza el tiempo? · {titulo}
          </Text>
          <ChipVeredicto v={f.veredicto} />
        </Box>
        {margen !== null && (
          <Box textAlign="right" aria-label={`Margen de tiempo: ${margen >= 0 ? "sobran" : "faltan"} ${fmtH(Math.abs(margen))}`}>
            <Text textStyle="rotulo">{margen >= 0 ? "Margen" : "Déficit"}</Text>
            <Text as="span" fontFamily="heading" fontWeight={700} fontSize="1.75rem" lineHeight={1.1} letterSpacing="-0.025em" color={a.color} sx={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
              {margen >= 0 ? "+" : "−"}
              {fmtH(Math.abs(margen))}
            </Text>
          </Box>
        )}
      </Flex>
      {f.veredicto !== "ya_comprometido" && (
        <Text textStyle="microdato" mt={2}>
          Plazo: {plazo}
          {f.limitante === "ventana_seca" ? " (lo fija la lluvia prevista: ventana seca)" : " (río, proyección lineal)"} · termina en {fmtH(f.tiempo_para_completar_h)}
          {f.iniciar_antes_de_h !== null && f.veredicto !== "sin_estimacion" ? ` · iniciar antes de ${fmtH(Math.max(f.iniciar_antes_de_h, 0))}` : ""}.
        </Text>
      )}
      <Text textStyle="microdato" mt={1}>
        {f.explicacion}
      </Text>
    </Box>
  );
}
