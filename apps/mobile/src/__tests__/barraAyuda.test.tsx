import NetInfo from "@react-native-community/netinfo";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LEYENDA } from "@evacuaciones/shared";
import { BarraAyuda, textoPendientes } from "@/components/BarraAyuda";
import { MarcoApp } from "@/components/MarcoApp";
import { PendientesContext } from "@/lib/EstadoCola";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  Tabs: () => null,
  Stack: () => null,
}));

let mockEstado: { tipo: string; usuario?: unknown } = { tipo: "anonimo" };
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({ estado: mockEstado, entrar: jest.fn(), salir: jest.fn(), salirLocal: jest.fn() }),
  useUsuario: () => (mockEstado as { usuario: unknown }).usuario,
}));

jest.mock("@/lib/ColaContext", () => ({
  useCola: () => ({ enviar: jest.fn(), sinRed: false, pendientes: 0, items: [], otroServidor: [], reintentar: jest.fn(), descartar: jest.fn() }),
}));
jest.mock("@/lib/compartirPosicion", () => ({ useCompartirPosicion: () => ({ fase: "sin_tarea", pendiente: false }) }));
jest.mock("@/lib/servicios", () => ({ api: { tareas: jest.fn(async () => ({ tareas: [] })) } }));

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado = { tipo: "anonimo" };
});

describe("barra de ayuda (103, conexión y pendientes)", () => {
  it("textoPendientes distingue singular, plural y cero", () => {
    expect(textoPendientes(0)).toBeNull();
    expect(textoPendientes(1)).toBe("1 pedido por enviar");
    expect(textoPendientes(2)).toBe("2 pedidos por enviar");
  });

  it("aparece bajo la leyenda en el marco y llama al 103", async () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    await render(conSafe(<MarcoApp><></></MarcoApp>));
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Llamar al 103"));
    expect(abrir).toHaveBeenCalledWith("tel:103");
  });

  it("el botón del 103 respeta el toque mínimo de 48 dp", async () => {
    await render(conSafe(<BarraAyuda />));
    const estilo = screen.getByLabelText("Llamar al 103").props.style;
    const plano = typeof estilo === "function" ? estilo({ pressed: false }) : estilo;
    expect(plano.minHeight).toBeGreaterThanOrEqual(48);
    expect(plano.minWidth).toBeGreaterThanOrEqual(48);
  });

  it("muestra «Sin conexión» cuando no hay red", async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false });
    await render(conSafe(<BarraAyuda />));
    await screen.findByText("Sin conexión");
  });

  it("muestra la cantidad de pedidos por enviar, junto con el estado sin red", async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false });
    await render(
      conSafe(
        <PendientesContext.Provider value={2}>
          <BarraAyuda />
        </PendientesContext.Provider>,
      ),
    );
    await screen.findByText("Sin conexión · 2 pedidos por enviar");
  });

  it("con red y sin pendientes no muestra avisos de cola", async () => {
    await render(conSafe(<BarraAyuda />));
    await waitFor(() => expect(NetInfo.fetch).toHaveBeenCalled());
    expect(screen.queryByText(/por enviar/)).toBeNull();
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });
});

describe("acceso a la brújula", () => {
  it("la pantalla de la cuadrilla tiene «¿Hacia dónde voy?» arriba y abre la brújula", async () => {
    mockEstado = {
      tipo: "autenticado",
      usuario: { id: 1, email: "x", nombre_visible: "x", rol: "cuadrilla", rol_operativo: null, estado: "activo" },
    };
    const Cuadrilla = require("@/app/(app)/cuadrilla").default;
    await render(conSafe(<Cuadrilla />));
    await fireEvent.press(screen.getByText("¿Hacia dónde voy?"));
    expect(mockPush).toHaveBeenCalledWith("/brujula");
  }, 120000);
});
