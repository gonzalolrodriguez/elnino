import { useCallback, useEffect, useRef, useState } from "react";

import { useMenosMovimiento } from "../lib/entorno";
import { useEscenario } from "./EscenarioContext";
import { alturaEnProgreso, DURACION_REPRODUCCION_MS } from "./lamina";

/**
 * "Reproducir subida": anima la altura que dibuja la lámina desde el dato del corte hasta la altura elegida.
 * Cada cuadro actualiza solo el estado local de la capa; el backend se consulta una única vez, al terminar.
 */
export function useReproducirSubida() {
  const { entrada, alturaObservada, fijarAlturaVisual, simular } = useEscenario();
  const quieto = useMenosMovimiento();
  const [reproduciendo, setReproduciendo] = useState(false);
  const cuadro = useRef<number | null>(null);
  const ultimaSimular = useRef(simular);
  ultimaSimular.current = simular;
  const destino = entrada.altura_formosa_m;

  const detener = useCallback(() => {
    if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    cuadro.current = null;
    fijarAlturaVisual(null);
    setReproduciendo(false);
  }, [fijarAlturaVisual]);

  useEffect(() => () => {
    if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
  }, []);

  const reproducir = useCallback(() => {
    if (cuadro.current !== null) return;
    const hasta = destino;
    if (hasta <= alturaObservada + 0.005) return;
    const terminar = () => {
      cuadro.current = null;
      fijarAlturaVisual(null);
      setReproduciendo(false);
      void ultimaSimular.current();
    };
    // Sin animación (prefers-reduced-motion): se salta directo a la altura elegida.
    if (quieto) {
      terminar();
      return;
    }
    setReproduciendo(true);
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = (ahora - inicio) / DURACION_REPRODUCCION_MS;
      if (t >= 1) {
        terminar();
        return;
      }
      fijarAlturaVisual(alturaEnProgreso(alturaObservada, hasta, t));
      cuadro.current = requestAnimationFrame(paso);
    };
    fijarAlturaVisual(alturaObservada);
    cuadro.current = requestAnimationFrame(paso);
  }, [destino, alturaObservada, quieto, fijarAlturaVisual]);

  // Si el usuario mueve el deslizador a mitad de la reproducción, se corta.
  useEffect(() => {
    if (cuadro.current !== null) detener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino]);

  return { reproduciendo, reproducir, detener, puedeReproducir: destino > alturaObservada + 0.005 };
}
