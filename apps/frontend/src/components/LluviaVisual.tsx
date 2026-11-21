import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

import { useMenosMovimiento } from "../lib/entorno";

const caer = keyframes`
  from { background-position: 0 0, 0 0; }
  to { background-position: 0 240px, 0 160px; }
`;

/**
 * Lluvia dibujada sobre un mapa o escena (solo ambiente visual, SIMULADO): trazos diagonales con CSS, sin WebGL.
 * No captura clics ni lo lee el lector de pantalla. Con `prefers-reduced-motion` los trazos quedan quietos y más tenues.
 * `intensidad` de 0 a 1; con 0 no dibuja nada.
 */
export function LluviaVisual({ intensidad, sobreOscuro = false }: { intensidad: number; sobreOscuro?: boolean }) {
  const quieto = useMenosMovimiento();
  if (!(intensidad > 0)) return null;
  const i = Math.min(1, intensidad);
  const trazo = sobreOscuro ? "rgba(200, 220, 240, 0.55)" : "rgba(40, 70, 110, 0.35)";
  const duracion = 0.9 - i * 0.45; // más intensa, más rápida
  return (
    <Box
      aria-hidden="true"
      data-testid="lluvia-visual"
      position="absolute"
      inset={0}
      pointerEvents="none"
      zIndex={1}
      opacity={quieto ? 0.25 + i * 0.25 : 0.35 + i * 0.55}
      bgImage={`repeating-linear-gradient(105deg, transparent 0 22px, ${trazo} 22px 23px, transparent 23px 48px), repeating-linear-gradient(100deg, transparent 0 37px, ${trazo} 37px 38px, transparent 38px 71px)`}
      bgSize={`${Math.round(120 - i * 50)}px 240px, ${Math.round(90 - i * 30)}px 160px`}
      animation={quieto ? undefined : `${caer} ${duracion.toFixed(2)}s linear infinite`}
      transition="opacity 600ms ease"
    />
  );
}
