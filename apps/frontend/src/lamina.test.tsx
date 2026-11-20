import { ChakraProvider } from "@chakra-ui/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeyendaLamina } from "./panel/LeyendaLamina";
import { accesoCortado, crearCapaAccesosCortados, crearCapasLamina } from "./panel/capasLamina";
import { EscenarioProvider } from "./panel/EscenarioContext";
import { Simulador } from "./panel/Simulador";
import {
  alturaEnProgreso,
  colorBordeRiesgo,
  colorLamina,
  colorProfundidad,
  discontinuar,
  elevacionVisualM,
  estadoLamina,
  EXAGERACION_VERTICAL,
  excedenteM,
  hitosEnRecorrido,
  nivelVisual,
  ultimoHito,
} from "./panel/lamina";
import type { Geo } from "./panel/tipos";
import { llamadas, simularFetch } from "./test/utils";
import { theme } from "./theme";

afterEach(() => vi.unstubAllGlobals());

describe("lógica de la lámina", () => {
  it("el excedente es la altura menos el compromiso, nunca negativo", () => {
    expect(excedenteM(8.1, 7.5)).toBeCloseTo(0.6);
    expect(excedenteM(7, 7.5)).toBe(0);
  });

  it("distingue seco, en riesgo (0,50 m) e inundado con los compromisos de K10", () => {
    expect(estadoLamina(6.99, 7.5)).toBe("seco");
    expect(estadoLamina(7.0, 7.5)).toBe("en_riesgo");
    expect(estadoLamina(7.49, 7.5)).toBe("en_riesgo");
    expect(estadoLamina(7.5, 7.5)).toBe("inundado");
    // S2 (8,60): a 8,3 m (evacuación) todavía no está comprometido.
    expect(estadoLamina(8.3, 8.6)).toBe("en_riesgo");
  });

  it("el nivel visual satura a 3 m de excedente y la elevación está exagerada", () => {
    expect(nivelVisual(0)).toBe(0);
    expect(nivelVisual(1.5)).toBeCloseTo(0.5);
    expect(nivelVisual(10)).toBe(1);
    expect(elevacionVisualM(2)).toBe(2 * EXAGERACION_VERTICAL);
    expect(elevacionVisualM(-1)).toBe(0);
  });

  it("el color va del cielo al río y la lámina seca o en riesgo es transparente", () => {
    expect(colorProfundidad(0)).toEqual([230, 240, 250, 110]);
    expect(colorProfundidad(1)).toEqual([30, 90, 160, 225]);
    expect(colorLamina(7, 7.5)[3]).toBe(0);
    expect(colorLamina(7.3, 7.5)[3]).toBe(0);
    const poco = colorLamina(7.51, 7.5);
    const mucho = colorLamina(11, 7.5);
    expect(poco[3]).toBeGreaterThan(0);
    expect(mucho[3]).toBeGreaterThan(poco[3]);
    expect(mucho[2]).toBeLessThan(poco[2] + 1);
  });

  it("el borde ámbar de advertencia solo aparece en riesgo", () => {
    expect(colorBordeRiesgo(7.2, 7.5)).toEqual([183, 121, 31, 255]);
    expect(colorBordeRiesgo(6, 7.5)[3]).toBe(0);
    expect(colorBordeRiesgo(8, 7.5)[3]).toBe(0);
  });

  it("interpola la subida y recorre los hitos 7,50, 7,80 y 8,30", () => {
    expect(alturaEnProgreso(5.6, 9.6, 0)).toBe(5.6);
    expect(alturaEnProgreso(5.6, 9.6, 0.5)).toBeCloseTo(7.6);
    expect(alturaEnProgreso(5.6, 9.6, 2)).toBe(9.6);
    expect(hitosEnRecorrido(5.6, 8.0).map((h) => h.valor)).toEqual([7.5, 7.8]);
    expect(hitosEnRecorrido(5.6, 9.6).map((h) => h.valor)).toEqual([7.5, 7.8, 8.3]);
    expect(ultimoHito(5.6)).toBeNull();
    expect(ultimoHito(7.9)?.valor).toBe(7.8);
  });

  it("parte una línea en trazos separados por huecos del mismo largo", () => {
    const trazos = discontinuar([[0, 0], [10, 0]], 2);
    expect(trazos).toEqual([
      [[0, 0], [2, 0]],
      [[4, 0], [6, 0]],
      [[8, 0], [10, 0]],
    ]);
    expect(discontinuar([[0, 0]], 2)).toEqual([]);
    // Con una quebradura, el trazo sigue la línea.
    const quebrada = discontinuar([[0, 0], [3, 0], [3, 3]], 2);
    expect(quebrada).toEqual([
      [[0, 0], [2, 0]],
      [[3, 1], [3, 3]],
    ]);
  });
});

const sectores: Geo = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-58.15, -26.19], [-58.13, -26.19], [-58.13, -26.17], [-58.15, -26.19]]] }, properties: { id: "S4", altura_escala_compromiso_m: 7.5 } },
    { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-58.19, -26.19], [-58.17, -26.19], [-58.17, -26.18], [-58.19, -26.19]]] }, properties: { id: "S2", altura_escala_compromiso_m: 8.6 } },
  ],
};

describe("capas de la lámina", () => {
  const base = { sectores, altura: 8.0, visible: true, pulso: false, quieto: false, reproduciendo: false };

  it("no dibuja nada si está oculta o no hay sectores", () => {
    expect(crearCapasLamina({ ...base, visible: false })).toEqual([]);
    expect(crearCapasLamina({ ...base, sectores: null })).toEqual([]);
  });

  it("extruye el excedente de cada sector y deja seco al que no llegó", () => {
    const [agua] = crearCapasLamina(base);
    const p = agua.props as unknown as {
      id: string;
      extruded: boolean;
      pickable: boolean;
      getElevation: (f: unknown) => number;
      getFillColor: (f: unknown) => number[];
      transitions?: Record<string, { duration: number }>;
    };
    expect(p.id).toBe("lamina-agua");
    expect(p.extruded).toBe(true);
    expect(p.pickable).toBe(false);
    const [s4, s2] = sectores.features;
    expect(p.getElevation(s4)).toBeCloseTo(0.5 * EXAGERACION_VERTICAL);
    expect(p.getElevation(s2)).toBe(0);
    expect(p.getFillColor(s4)[3]).toBeGreaterThan(0);
    expect(p.getFillColor(s2)[3]).toBe(0);
    expect(p.transitions?.getElevation.duration).toBe(350);
  });

  it("marca con borde ámbar al sector en riesgo", () => {
    const [, riesgo] = crearCapasLamina({ ...base, altura: 8.3 });
    const p = riesgo.props as unknown as { getLineColor: (f: unknown) => number[] };
    expect(p.getLineColor(sectores.features[1])[3]).toBe(255); // S2 a 8,30 m: compromiso 8,60
    expect(p.getLineColor(sectores.features[0])[3]).toBe(0); // S4 ya inundado
  });

  it("sin transición con prefers-reduced-motion y mientras se reproduce", () => {
    for (const extra of [{ quieto: true }, { reproduciendo: true }]) {
      const [agua, riesgo] = crearCapasLamina({ ...base, ...extra });
      expect((agua.props as { transitions?: unknown }).transitions).toBeUndefined();
      if ("quieto" in extra) expect((riesgo.props as { transitions?: unknown }).transitions).toBeUndefined();
    }
    const [, riesgo] = crearCapasLamina({ ...base, pulso: true });
    expect((riesgo.props as unknown as { getLineWidth: number }).getLineWidth).toBe(6);
    const [, quieta] = crearCapasLamina({ ...base, pulso: true, quieto: true });
    expect((quieta.props as unknown as { getLineWidth: number }).getLineWidth).toBe(3);
  });

  it("dibuja discontinuos solo los accesos cortados según el estado del escenario", () => {
    const acc = (id: number, transitable = true) => ({
      type: "Feature" as const,
      geometry: { type: "LineString", coordinates: [[-58.14, -26.18], [-58.13, -26.18]] },
      properties: { id, sector_id: "S4", nombre: `A${id}`, superficie: "tierra", transitable, motivo: null, actualizado_en: "", actualizado_por_rol: null },
    });
    const geo: Geo = { type: "FeatureCollection", features: [acc(1), acc(2), acc(3, false)] };
    expect(accesoCortado(1, { 1: "intransitable_lluvia" }, [])).toBe(true);
    expect(accesoCortado(2, { 2: "transitable" }, [])).toBe(false);
    expect(accesoCortado(2, {}, [2])).toBe(true);
    const capa = crearCapaAccesosCortados(geo, { 1: "intransitable_lluvia" }, [])!;
    const datos = (capa.props as unknown as { data: { id: number }[] }).data;
    expect(new Set(datos.map((t) => t.id))).toEqual(new Set([1, 3]));
    expect(crearCapaAccesosCortados(geo, {}, [])).not.toBeNull(); // el 3 no es transitable
    expect(crearCapaAccesosCortados({ ...geo, features: [acc(2)] }, {}, [])).toBeNull();
  });
});

const envolver = (ui: React.ReactNode) => (
  <ChakraProvider theme={theme}>
    <EscenarioProvider>{ui}</EscenarioProvider>
  </ChakraProvider>
);

describe("leyenda y controles", () => {
  it("la leyenda aclara que no es un modelo hidráulico, el origen del dato y la exageración", () => {
    render(<ChakraProvider theme={theme}><LeyendaLamina /></ChakraProvider>);
    const l = screen.getByTestId("leyenda-lamina");
    expect(l).toHaveTextContent("no es un modelo hidráulico");
    expect(l).toHaveTextContent("altura de compromiso de cada sector (K10, SIMULADO)");
    expect(l).toHaveTextContent("Altura exagerada ×150");
    expect(l).toHaveTextContent("SIMULADO");
  });

  it("el interruptor de la lámina está activo por defecto y se puede apagar", () => {
    render(envolver(<Simulador accesos={[]} />));
    const casilla = screen.getByRole("checkbox", { name: "Lámina de agua ilustrativa" });
    expect(casilla).toBeChecked();
    fireEvent.click(casilla);
    expect(casilla).not.toBeChecked();
  });

  it("reproducir la subida anima en local y consulta el backend una sola vez, al final", async () => {
    const f = simularFetch({
      "POST /simulacion/escenario": () => ({ estado: 200, json: { rio: { estado: "evacuacion", altura_m: 8.4, distancia_a_alerta_m: -0.6, distancia_a_evacuacion_m: -0.1 }, sectores: [], resumen: { comprometidos: [], en_riesgo: [], normales: [], aislados: [] }, lluvia: { mm: 0, origen: "simulado", categoria: "SIMULADO" }, categoria: "SIMULADO", fuente: "x", fecha_dato: "2026-10-31" } }),
    });
    const colas: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => colas.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    let reloj = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => reloj);

    render(envolver(<Simulador accesos={[]} />));
    const boton = screen.getByRole("button", { name: "Reproducir subida" });
    expect(boton).toBeDisabled(); // 5,60 m = dato del corte: no hay subida que mostrar
    fireEvent.change(document.getElementById("sim-altura")!, { target: { value: "8.4" } });
    expect(boton).toBeEnabled();
    colas.length = 0;
    fireEvent.click(boton);

    expect(screen.getByTestId("sim-reproduccion")).toHaveTextContent("Reproduciendo: 5,60 m");
    // Un cuadro a la mitad: pasó el compromiso de S4 (7,5 m) y no hay consultas.
    reloj += 5000;
    await act(async () => colas.pop()!(reloj));
    expect(screen.getByTestId("sim-reproduccion")).toHaveTextContent("superó el compromiso de S4 (K10)");
    expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(0);
    // Último cuadro: termina y consulta una vez.
    reloj += 5000;
    await act(async () => colas.pop()!(reloj));
    expect(screen.queryByTestId("sim-reproduccion")).toBeNull();
    expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(1);
    expect(screen.getByTestId("sim-altura-valor")).toHaveTextContent("8,40 m");
  });
});
