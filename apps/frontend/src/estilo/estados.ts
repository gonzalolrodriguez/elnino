import { hexDe } from "./paleta";

/**
 * Estados de un sector y sus colores en RGB (para SVG, MapLibre y Deck.gl).
 * El estado nunca se comunica solo con color: siempre va acompañado del texto, y en los mapas
 * del trazo (punteado = en riesgo, rayado = comprometido, borde grueso = aislado).
 */
export const ESTADOS = {
  normal: { fill: hexDe("estado.normal.fill"), stroke: hexDe("estado.normal.borde"), texto: "normal" },
  en_riesgo: { fill: hexDe("estado.en_riesgo.fill"), stroke: hexDe("estado.en_riesgo.borde"), texto: "en riesgo" },
  comprometido: { fill: hexDe("estado.comprometido.fill"), stroke: hexDe("estado.comprometido.borde"), texto: "comprometido" },
} as const;

export const BORDE_AISLADO = hexDe("estado.aislado.borde");
