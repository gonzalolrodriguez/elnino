import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { formatearDistancia, formatearLlegada, horaCorta } from "./lib/seguimiento";
import { CompartirUbicacion } from "./pages/cuadrilla/CompartirUbicacion";
import { theme } from "./theme";
import { llamadas, simularFetch } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (json: unknown) => () => ({ estado: 200, json });

describe("formato del seguimiento", () => {
  it("llegada estimada en lenguaje común", () => {
    expect(formatearLlegada(0)).toBe("ya está llegando");
    expect(formatearLlegada(1)).toBe("alrededor de 1 min");
    expect(formatearLlegada(12)).toBe("unos 12 min");
    expect(formatearLlegada(80)).toBe("unos 1 h 20 min");
    expect(formatearLlegada(120)).toBe("unos 2 h");
    expect(formatearLlegada(null)).toBeNull();
    expect(formatearLlegada(-3)).toBeNull();
  });
  it("distancia en metros o kilómetros con coma", () => {
    expect(formatearDistancia(248)).toBe("250 m");
    expect(formatearDistancia(3450)).toBe("3,5 km");
    expect(formatearDistancia(null)).toBeNull();
  });
  it("hora local de Formosa", () => {
    expect(horaCorta("2026-11-20T18:02:11Z")).toBe("15:02");
    expect(horaCorta("no-es-fecha")).toBeNull();
    expect(horaCorta(null)).toBeNull();
  });
});

describe("CompartirUbicacion (/cuadrilla)", () => {
  function conGeolocalizacion() {
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: -26.18, longitude: -58.14, accuracy: 15.4 } }));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    return getCurrentPosition;
  }
  const montar = (hay: boolean) =>
    render(
      <ChakraProvider theme={theme}>
        <CompartirUbicacion hayTareaEnCurso={hay} />
      </ChakraProvider>,
    );

  it("sin tarea en curso solo explica cuándo se comparte", () => {
    montar(false);
    expect(screen.getByTestId("ubicacion-sin-tarea")).toHaveTextContent("Solo se comparte mientras la tarea está en curso");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("al activar envía la posición y muestra el estado; se puede pausar", async () => {
    fijarToken("tok");
    conGeolocalizacion();
    const f = simularFetch({ "POST /cuadrillas/mi-posicion": ok({ cuadrillas: [1], categoria: "SIMULADO" }) });
    montar(true);
    expect(screen.getByRole("status")).toHaveTextContent("No estás compartiendo tu ubicación");
    fireEvent.click(screen.getByRole("button", { name: "Compartir mi ubicación" }));
    await waitFor(() => expect(llamadas(f, "POST /cuadrillas/mi-posicion")).toHaveLength(1));
    const cuerpo = JSON.parse(String((llamadas(f, "POST /cuadrillas/mi-posicion")[0][1] as RequestInit).body));
    expect(cuerpo).toEqual({ lat: -26.18, lon: -58.14, precision_m: 15 });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Compartiendo tu ubicación con el solicitante · último envío a las/));
    fireEvent.click(screen.getByRole("button", { name: "Pausar el envío de mi ubicación" }));
    expect(screen.getByRole("status")).toHaveTextContent("No estás compartiendo tu ubicación");
  });

  it("si el servidor responde 409 (ya no hay tarea en curso) se pausa solo", async () => {
    fijarToken("tok");
    conGeolocalizacion();
    simularFetch({ "POST /cuadrillas/mi-posicion": () => ({ estado: 409, json: { error: { codigo: "conflicto", mensaje: "No tenés ninguna tarea en curso", detalle: [] } } }) });
    montar(true);
    fireEvent.click(screen.getByRole("button", { name: "Compartir mi ubicación" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Compartir mi ubicación" })).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("No estás compartiendo tu ubicación");
  });

  it("sin permiso de ubicación muestra el motivo", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) } });
    montar(true);
    fireEvent.click(screen.getByRole("button", { name: "Compartir mi ubicación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No diste permiso");
  });
});
