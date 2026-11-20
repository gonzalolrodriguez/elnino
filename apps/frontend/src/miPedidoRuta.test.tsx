import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Pedido, RutaPedido } from "./lib/pedidos";
import { MiPedido } from "./pages/micuenta/MiPedido";
import { theme } from "./theme";

const mocks = vi.hoisted(() => ({ webgl: { activo: true } }));

// MapLibre no corre en jsdom: se reemplaza el mapa y se fuerza WebGL para ejercitar la tarjeta del recorrido.
vi.mock("./pages/micuenta/MapaPedidoGL", () => ({ default: () => <div data-testid="gl" /> }));
vi.mock("./lib/entorno", async (original) => ({ ...(await original<typeof import("./lib/entorno")>()), hayWebGL: () => mocks.webgl.activo }));

// ~6,67 km hacia el norte; a 30 km/h y con la mitad hecha faltan ~3,3 km = 7 min.
const RUTA: RutaPedido = {
  coordenadas: [
    [-58.2, -26.2],
    [-58.2, -26.14],
  ],
  distancia_km: 6.7,
  llegada_estimada_min: 7,
  metodo: "red_vial",
  simulada: true,
  progreso: 0.5,
  velocidad_kmh: 30,
  calculada_en: "2026-11-20T18:00:00Z",
};

const pedido = (ruta: RutaPedido | null): Pedido => ({
  id: 41,
  tipo: "asistencia",
  personas: 3,
  estado: "en_curso",
  origen: "web",
  creada_en: "2026-11-20T17:00:00Z",
  lat: -26.14,
  lon: -58.2,
  sector_id: "S4",
  linea_tiempo: [{ estado: "recibida", en: "2026-11-20T17:00:00Z" }],
  tarea: { id: 7, estado: "en_curso", cuadrilla: { id: 2, tipo_incidente: "humana", rol_encargado: "encargado_cuadrilla", vehiculo: "camion_jaula" }, iniciada_en: "2026-11-20T17:20:00Z", cerrada_en: null },
  seguimiento: {
    solicitud_id: 41,
    tarea_id: 7,
    tipo_cuadrilla: "humana",
    roles: ["encargado_cuadrilla"],
    estado: "en_camino",
    posicion: { lat: -26.17, lon: -58.2, precision_m: 10 },
    actualizada_en: "2026-11-20T18:00:00Z",
    posicion_vieja: false,
    distancia_m: 3350,
    llegada_estimada_min: 7,
    categoria: "SIMULADO",
    supuestos: { factor_desvio: 1.3, velocidad_cuadrilla_kmh: 30, posicion_vieja_minutos: 5 },
    nota: "estimación",
    ...(ruta ? { ruta } : {}),
  } as Pedido["seguimiento"],
  confirmacion: null,
  centro: null,
});

const mostrar = (p: Pedido) =>
  render(
    <ChakraProvider theme={theme}>
      <MiPedido pedido={p} alResponder={() => {}} />
    </ChakraProvider>,
  );

describe("MiPedido · recorrido animado", () => {
  it("con ruta simulada muestra el rótulo SIMULADO, el método y la llegada estimada", async () => {
    mocks.webgl.activo = true;
    mostrar(pedido(RUTA));
    expect(await screen.findByTestId("gl")).toBeInTheDocument();
    const tarjeta = screen.getByTestId("tarjeta-recorrido");
    expect(within(tarjeta).getByTestId("recorrido-simulado")).toHaveTextContent("SIMULADO · recorrido de demostración");
    expect(within(tarjeta).getByTestId("recorrido-metodo")).toHaveTextContent("Recorrido por la red vial (OpenStreetMap)");
    expect(within(tarjeta).getByTestId("recorrido-eta")).toHaveTextContent("Llega en ~7 min");
    expect(within(tarjeta).getByTestId("recorrido-distancia")).toHaveTextContent("Faltan 3,3 km");
    expect(screen.getByRole("group", { name: /recorrido de la cuadrilla/i })).toBeInTheDocument();
  });

  it("método aproximado y ruta real: sin rótulo de demostración", async () => {
    mostrar(pedido({ ...RUTA, metodo: "aproximado", simulada: false }));
    await screen.findByTestId("gl");
    expect(screen.getByTestId("recorrido-metodo")).toHaveTextContent("Recorrido aproximado (línea recta × 1,3)");
    expect(screen.queryByTestId("recorrido-simulado")).not.toBeInTheDocument();
  });

  it("llegada: avisa que la cuadrilla llegó y no muestra cuenta regresiva", async () => {
    mostrar(pedido({ ...RUTA, progreso: 1 }));
    await screen.findByTestId("gl");
    expect(screen.getByTestId("recorrido-llegada")).toHaveTextContent("La cuadrilla llegó a tu ubicación");
    expect(screen.queryByTestId("recorrido-eta")).not.toBeInTheDocument();
  });

  it("sin ruta mantiene el comportamiento anterior: mapa de puntos sin tarjeta", async () => {
    mostrar(pedido(null));
    await screen.findByTestId("gl");
    expect(screen.queryByTestId("tarjeta-recorrido")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Mapa de tu pedido" })).toBeInTheDocument();
  });

  it("sin WebGL queda la tarjeta de texto con la llegada y el método", () => {
    mocks.webgl.activo = false;
    mostrar(pedido(RUTA));
    expect(screen.queryByTestId("gl")).not.toBeInTheDocument();
    expect(screen.getByTestId("recorrido-eta")).toHaveTextContent("Llega en ~7 min");
    expect(screen.getByTestId("recorrido-metodo")).toBeInTheDocument();
    mocks.webgl.activo = true;
  });
});
