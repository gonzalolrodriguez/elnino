import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorApi } from "@/lib/api";
import { esPedidoActivo, estadoFinal, lineaDeTiempo } from "@/lib/pedidos";
import type { PedidoCiudadano } from "@/lib/servicios";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush }),
  Tabs: () => null,
  Stack: () => null,
}));

jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useUsuario: () => ({ id: 1, email: "x", nombre_visible: "x", rol: "ciudadano", rol_operativo: null, estado: "activo" }),
}));

jest.mock("@/lib/ColaContext", () => ({
  useCola: () => ({ items: [], otroServidor: [], reintentar: jest.fn(), descartar: jest.fn(), sinRed: false }),
}));

// Caché en memoria: lo que se guarda con conexión es lo que se lee después sin ella.
const mockAlmacen = new Map<string, { valor: unknown; guardadoEn: number }>();
jest.mock("@/lib/cacheLocal", () => ({
  guardarCache: jest.fn(async (k: string, valor: unknown, ahora = Date.now()) => void mockAlmacen.set(k, { valor, guardadoEn: ahora })),
  leerCache: jest.fn(async (k: string) => mockAlmacen.get(k) ?? null),
}));

const mockMisPedidos = jest.fn();
const mockSolicitudes = jest.fn();
jest.mock("@/lib/servicios", () => ({
  api: { misPedidos: (...a: unknown[]) => mockMisPedidos(...a), solicitudes: (...a: unknown[]) => mockSolicitudes(...a) },
}));

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;

const activo: PedidoCiudadano = {
  id: 12,
  tipo: "evacuacion",
  personas: 4,
  estado: "en_curso",
  origen: "app",
  creada_en: "2026-11-20T15:00:00Z",
  lat: -26.18,
  lon: -58.15,
  sector_id: "S4",
  linea_tiempo: [
    { estado: "recibida", en: "2026-11-20T15:00:00Z" },
    { estado: "verificada", en: "2026-11-20T15:10:00Z" },
    { estado: "asignada", en: "2026-11-20T15:20:00Z" },
    { estado: "en_curso", en: "2026-11-20T15:30:00Z" },
    { estado: "resuelta", en: null },
  ],
  tarea: {
    id: 7,
    estado: "en_curso",
    cuadrilla: { id: 2, tipo_incidente: "humana", rol_encargado: "defensa_civil", vehiculo: "camion_jaula" },
    iniciada_en: "2026-11-20T15:30:00Z",
    cerrada_en: null,
  },
  seguimiento: {
    solicitud_id: 12,
    tarea_id: 7,
    tipo_cuadrilla: "humana",
    roles: ["defensa_civil"],
    estado: "en_camino",
    actualizada_en: new Date().toISOString(),
    posicion_vieja: false,
    distancia_m: 3450,
    llegada_estimada_min: 8,
    categoria: "SIMULADO",
    supuestos: { factor_desvio: 1.3, velocidad_cuadrilla_kmh: 40, posicion_vieja_minutos: 5 },
  },
  confirmacion: null,
  centro: { id: 3, nombre: "Escuela de prueba", lat: -26.19, lon: -58.17 },
};

const viejo: PedidoCiudadano = {
  ...activo,
  id: 5,
  estado: "resuelta",
  tarea: null,
  seguimiento: null,
  centro: null,
  linea_tiempo: activo.linea_tiempo.map((p) => ({ ...p, en: "2026-11-10T10:00:00Z" })),
  confirmacion: { solicitud_id: 5, respondida: true, respuesta: "parcial", comentario: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAlmacen.clear();
});

describe("lógica de la línea de tiempo", () => {
  it("cinco pasos del contrato más «Confirmado por vos»", () => {
    const pasos = lineaDeTiempo(activo);
    expect(pasos.map((p) => p.etiqueta)).toEqual(["Recibido", "Verificado", "Cuadrilla asignada", "En camino", "Asistido", "Confirmado por vos"]);
    expect(pasos.map((p) => p.alcanzado)).toEqual([true, true, true, true, false, false]);
    expect(lineaDeTiempo(viejo).at(-1)?.alcanzado).toBe(true);
  });

  it("separa activos de historial y da el estado final con ícono", () => {
    expect(esPedidoActivo(activo)).toBe(true);
    expect(esPedidoActivo(viejo)).toBe(false);
    // Resuelto pero sin confirmar todavía: sigue activo para poder confirmarlo.
    expect(esPedidoActivo({ ...viejo, confirmacion: { solicitud_id: 5, respondida: false, respuesta: null, comentario: null } })).toBe(true);
    expect(estadoFinal(viejo)).toEqual({ icono: "✓", texto: "Asistido · Me asistieron en parte" });
    expect(estadoFinal(activo).icono).toBe("…");
  });
});

describe("Mis solicitudes con GET /mi/pedidos", () => {
  it("muestra la línea de tiempo, la cuadrilla por rol, el vehículo SIMULADO, la llegada y el centro", async () => {
    mockMisPedidos.mockResolvedValue({ categoria: "SIMULADO", items: [activo, viejo] });
    const Solicitudes = require("@/app/(app)/solicitudes").default;
    await render(conSafe(<Solicitudes />));
    await screen.findByText("Pedido n.º 12 · Evacuación");
    for (const paso of ["Recibido", "Verificado", "Cuadrilla asignada", "Asistido", "Confirmado por vos"]) {
      expect(screen.getAllByText(new RegExp(`^${paso}`)).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText(/En camino: paso actual/)).toBeTruthy();
    expect(screen.getByText("Asistencia a personas")).toBeTruthy();
    expect(screen.getByText("A cargo: Defensa civil")).toBeTruthy();
    expect(screen.getByText("Camión jaula")).toBeTruthy();
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Distancia a tu pedido: 3,5 km")).toBeTruthy();
    expect(screen.getByLabelText("Llegada estimada: unos 8 min")).toBeTruthy();
    expect(screen.getByText("Escuela de prueba")).toBeTruthy();
    await fireEvent.press(screen.getByText("¿Hacia dónde voy?"));
    expect(mockPush).toHaveBeenCalledWith("/brujula");
    // Historial compacto con el estado final.
    expect(screen.getByText("Anteriores")).toBeTruthy();
    expect(screen.getByText("Asistido · Me asistieron en parte")).toBeTruthy();
  });

  it("sin conexión muestra la última copia guardada con su fecha", async () => {
    mockMisPedidos.mockResolvedValueOnce({ categoria: "SIMULADO", items: [activo] });
    const Solicitudes = require("@/app/(app)/solicitudes").default;
    const { unmount } = await render(conSafe(<Solicitudes />));
    await screen.findByText("Pedido n.º 12 · Evacuación");
    await unmount();

    mockMisPedidos.mockRejectedValue(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    await render(conSafe(<Solicitudes />));
    await screen.findByText("Pedido n.º 12 · Evacuación");
    expect(screen.getByText(/Sin conexión: se muestra lo último guardado, actualizado el/)).toBeTruthy();
    expect(screen.getByText("Camión jaula")).toBeTruthy();
    expect(mockSolicitudes).not.toHaveBeenCalled();
  });

  it("si el servidor no ofrece la vista y no hay copia, usa la lista simple", async () => {
    mockMisPedidos.mockRejectedValue(new ErrorApi(404, "no_encontrado", "No existe"));
    mockSolicitudes.mockResolvedValue({ solicitudes: [] });
    const Solicitudes = require("@/app/(app)/solicitudes").default;
    await render(conSafe(<Solicitudes />));
    await screen.findByText("Todavía no enviaste solicitudes.");
    expect(mockSolicitudes).toHaveBeenCalled();
  });
});
