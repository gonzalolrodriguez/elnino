import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { formatearDistancia, formatearLlegada, horaCorta } from "./lib/seguimiento";
import { CompartirUbicacion } from "./pages/cuadrilla/CompartirUbicacion";
import { theme } from "./theme";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

type Rutas = Parameters<typeof simularFetch>[0];
const ok = (json: unknown) => () => ({ estado: 200, json });
function conSesion(rutas: Rutas = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({ "POST /auth/refresh": () => sesion("ciudadano"), ...rutas });
}

const item = (extra: Record<string, unknown> = {}) => ({
  solicitud_id: 12,
  tarea_id: 7,
  tipo_cuadrilla: "humana",
  roles: ["encargado_cuadrilla"],
  estado: "en_camino",
  posicion: { lat: -26.18, lon: -58.14, precision_m: 12 },
  actualizada_en: "2026-11-20T18:02:11Z",
  posicion_vieja: false,
  distancia_m: 3450,
  llegada_estimada_min: 8,
  categoria: "SIMULADO",
  supuestos: { factor_desvio: 1.3, velocidad_cuadrilla_kmh: 40, posicion_vieja_minutos: 5 },
  nota: "Es una estimación",
  ...extra,
});
const respuesta = (...items: unknown[]) => ok({ seguimientos: items, categoria: "SIMULADO", fuente: "x", fecha_dato: "2026-11-20" });

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

describe("tarjeta «Cuadrilla en camino» en /mi-cuenta", () => {
  it("con posición: distancia, llegada estimada, hora, categoría y aviso de estimación", async () => {
    conSesion({ "GET /mi/seguimiento": respuesta(item()) });
    renderRuta("/mi-cuenta");
    const tarjeta = await screen.findByTestId("seguimiento-12");
    expect(screen.getByRole("heading", { name: "Cuadrilla en camino" })).toBeInTheDocument();
    expect(screen.getByTestId("seguimiento-estado")).toHaveTextContent("A 3,5 km de tu pedido · llegada estimada: unos 8 min");
    expect(tarjeta).toHaveTextContent("Última posición recibida a las 15:02");
    expect(tarjeta).toHaveTextContent("estimación");
    expect(tarjeta).toHaveTextContent("SUPUESTO");
    expect(tarjeta.querySelector('[data-categoria="SIMULADO"]')).not.toBeNull();
    expect(screen.queryByTestId("seguimiento-vieja")).not.toBeInTheDocument();
  });

  it("asignada sin posición todavía", async () => {
    conSesion({ "GET /mi/seguimiento": respuesta(item({ estado: "asignada_sin_posicion", posicion: null, actualizada_en: null, posicion_vieja: null, distancia_m: null, llegada_estimada_min: null })) });
    renderRuta("/mi-cuenta");
    expect(await screen.findByTestId("seguimiento-sin-posicion")).toHaveTextContent("Todavía no recibimos su posición");
    expect(screen.queryByTestId("seguimiento-estado")).not.toBeInTheDocument();
  });

  it("posición vieja: avisa que la llegada puede no ser confiable", async () => {
    conSesion({ "GET /mi/seguimiento": respuesta(item({ posicion_vieja: true })) });
    renderRuta("/mi-cuenta");
    const aviso = await screen.findByTestId("seguimiento-vieja");
    expect(aviso).toHaveTextContent("más de 5 minutos");
    expect(aviso).toHaveTextContent("pueden no ser confiables");
  });

  it("pedido sin coordenadas: no inventa la llegada", async () => {
    conSesion({ "GET /mi/seguimiento": respuesta(item({ distancia_m: null, llegada_estimada_min: null })) });
    renderRuta("/mi-cuenta");
    const estado = await screen.findByTestId("seguimiento-estado");
    expect(estado).toHaveTextContent("La cuadrilla está en camino");
    expect(estado).not.toHaveTextContent("llegada estimada");
    expect(screen.getByText(/no tiene una ubicación exacta/)).toBeInTheDocument();
  });

  it("error de carga: mensaje con salida de emergencia", async () => {
    conSesion({ "GET /mi/seguimiento": () => ({ estado: 500, json: { error: { codigo: "interno", mensaje: "Error", detalle: [] } } }) });
    renderRuta("/mi-cuenta");
    expect(await screen.findByTestId("seguimiento-error")).toHaveTextContent("llamá al 103");
  });

  it("sin pedidos en curso no muestra la tarjeta", async () => {
    const f = conSesion({ "GET /mi/seguimiento": respuesta() });
    renderRuta("/mi-cuenta");
    await waitFor(() => expect(llamadas(f, "GET /mi/seguimiento").length).toBeGreaterThan(0));
    await screen.findByRole("heading", { name: "Mi cuenta" });
    expect(screen.queryByTestId("cuadrilla-en-camino")).not.toBeInTheDocument();
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
