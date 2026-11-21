import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LluviaVisual } from "./components/LluviaVisual";
import { CLIMAS, climaDeEntrada, climaPorId, intensidadLluvia } from "./panel/clima";
import { EscenarioProvider } from "./panel/EscenarioContext";
import { SelectorClima } from "./panel/SelectorClima";
import { Simulador } from "./panel/Simulador";
import { llamadas, simularFetch } from "./test/utils";
import { theme } from "./theme";

afterEach(() => vi.unstubAllGlobals());

const RESPUESTA = { rio: { estado: "normal", altura_m: 7.6, distancia_a_alerta_m: 0.2, distancia_a_evacuacion_m: 0.7 }, sectores: [], resumen: { comprometidos: [], en_riesgo: [], normales: [], aislados: [] }, lluvia: { mm: 40, origen: "simulado", categoria: "SIMULADO" }, categoria: "SIMULADO", fuente: "x", fecha_dato: "2026-10-31" };

describe("presets de clima", () => {
  it("tres climas con las cifras del plan", () => {
    expect(CLIMAS.map((c) => [c.id, c.altura_m, c.lluvia_mm])).toEqual([
      ["seco", 4.96, 0],
      ["nino", 7.6, 40],
      ["tormenta", 8.3, 90],
    ]);
    expect(climaPorId("seco").ambiente.niebla).toBeNull(); // seco no altera la escena 3D
  });

  it("reconoce el preset activo y vuelve a null al mover un deslizador", () => {
    expect(climaDeEntrada(7.6, 40)?.id).toBe("nino");
    expect(climaDeEntrada(7.65, 40)).toBeNull();
    expect(climaDeEntrada(8.3, 90)?.id).toBe("tormenta");
  });

  it("intensidad de lluvia dibujada: 0 sin lluvia, crece con los mm y satura en 1", () => {
    expect(intensidadLluvia(0)).toBe(0);
    expect(intensidadLluvia(-5)).toBe(0);
    expect(intensidadLluvia(40)).toBeLessThan(intensidadLluvia(90));
    expect(intensidadLluvia(500)).toBe(1);
  });
});

describe("LluviaVisual", () => {
  it("no dibuja nada sin lluvia; con lluvia, una capa decorativa que no captura clics", () => {
    const { rerender } = render(<ChakraProvider theme={theme}><LluviaVisual intensidad={0} /></ChakraProvider>);
    expect(screen.queryByTestId("lluvia-visual")).toBeNull();
    rerender(<ChakraProvider theme={theme}><LluviaVisual intensidad={0.5} /></ChakraProvider>);
    const capa = screen.getByTestId("lluvia-visual");
    expect(capa).toHaveAttribute("aria-hidden", "true");
    expect(capa).toHaveStyle({ pointerEvents: "none" });
  });
});

describe("SelectorClima", () => {
  it("El Niño fija 7,60 m y 40 mm y recalcula el escenario una vez; es reversible con otro preset", async () => {
    const f = simularFetch({ "POST /simulacion/escenario": () => ({ estado: 200, json: RESPUESTA }) });
    render(
      <ChakraProvider theme={theme}>
        <EscenarioProvider>
          <SelectorClima />
          <Simulador accesos={[]} />
        </EscenarioProvider>
      </ChakraProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /El Niño/ }));
    expect(screen.getByTestId("sim-altura-valor")).toHaveTextContent("7,60 m");
    expect(screen.getByTestId("sim-lluvia-valor")).toHaveTextContent("40 mm");
    await waitFor(() => expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(1));
    const cuerpo = JSON.parse(String((llamadas(f, "POST /simulacion/escenario")[0][1] as RequestInit).body)) as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ altura_formosa_m: 7.6, lluvia_mm: 40, lluvia_origen: "simulado" });
    expect(screen.getByRole("button", { name: /El Niño/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Seco/ }));
    expect(screen.getByTestId("sim-altura-valor")).toHaveTextContent("4,96 m");
    expect(screen.getByTestId("sim-lluvia-valor")).toHaveTextContent("0 mm");
    await waitFor(() => expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(2));
    expect(screen.getByTestId("selector-clima-detalle")).toHaveTextContent("K1");
  });
});
