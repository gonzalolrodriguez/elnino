import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

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

const mockEnviar = jest.fn();
let mockSinRed = false;
jest.mock("@/lib/ColaContext", () => ({
  useCola: () => ({ enviar: mockEnviar, sinRed: mockSinRed, pendientes: 1, items: [], otroServidor: [], reintentar: jest.fn(), descartar: jest.fn() }),
}));

jest.mock("@/lib/AlertasContext", () => ({
  ...jest.requireActual("@/lib/AlertasContext"),
  useAlertas: () => ({ estado: { tipo: "ok" }, notificaciones: [], canal: "desconectado", recargar: jest.fn(), marcarLeida: jest.fn() }),
}));

jest.mock("@/lib/dispositivo", () => ({
  obtenerUbicacion: jest.fn(),
  tomarFotoComprimida: jest.fn(async () => null),
}));
jest.mock("@/lib/cacheLocal", () => ({ leerCache: jest.fn(async () => null), guardarCache: jest.fn(), borrarCache: jest.fn() }));

const mockGrupo = jest.fn();
jest.mock("@/lib/servicios", () => ({
  api: { grupo: (...a: unknown[]) => mockGrupo(...a), miSector: jest.fn(async () => { throw new Error("sin red"); }), consultas: jest.fn(async () => ({ consultas: [] })) },
}));

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;
const gps = () => require("@/lib/dispositivo").obtenerUbicacion as jest.Mock;
const GPS_OK = { ok: true, coordenadas: { lat: -26.18, lon: -58.17 }, precisionM: 5 };

beforeEach(() => {
  jest.clearAllMocks();
  mockSinRed = false;
  mockEstado = {
    tipo: "autenticado",
    usuario: { id: 1, email: "x", nombre_visible: "x", rol: "ciudadano", rol_operativo: null, estado: "activo" },
  };
  mockGrupo.mockResolvedValue({ integrantes: 4 });
  gps().mockResolvedValue(GPS_OK);
  mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false, rechazada: null, resultado: null, servidorId: 77 });
});

const abrir = async () => {
  const Asistencia = require("@/app/(app)/asistencia").default;
  await render(conSafe(<Asistencia />));
};

describe("«Necesito ayuda ahora»", () => {
  it("pide confirmación: un toque no envía y se puede cancelar", async () => {
    await abrir();
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    expect(screen.getByText(/Se enviará tu pedido de ayuda en 5 s/)).toBeTruthy();
    expect(mockEnviar).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Cancelar"));
    expect(mockEnviar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Necesito ayuda ahora")).toBeTruthy();
  });

  it("al confirmar toma el GPS y envía un pedido mínimo por la cola, con las personas del grupo", async () => {
    await abrir();
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    await fireEvent.press(screen.getByText("Enviar ahora"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    const [datos, foto] = mockEnviar.mock.calls[0];
    expect(datos).toMatchObject({ tipo: "asistencia", personas: 4, animales: 0, lat: -26.18, lon: -58.17, origen: "app" });
    expect("referencia_ubicacion" in datos).toBe(false);
    expect(foto).toBeNull();
    await screen.findByText(/Pedido enviado · n\.º 77/);
    await fireEvent.press(screen.getByText("Ver Mis pedidos"));
    expect(mockPush).toHaveBeenCalledWith("/solicitudes");
  });

  it("sin grupo familiar cargado el pedido va con 1 persona", async () => {
    mockGrupo.mockRejectedValue(new Error("404"));
    await abrir();
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    await fireEvent.press(screen.getByText("Enviar ahora"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    expect(mockEnviar.mock.calls[0][0].personas).toBe(1);
  });

  it("si nadie cancela, la cuenta regresiva envía sola", async () => {
    await abrir();
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1), { timeout: 9000 });
  }, 20000);

  it("sin GPS ni referencia no envía: explica qué hacer y abre «Detallar pedido»", async () => {
    gps().mockResolvedValue({ ok: false, motivo: "error" });
    await abrir();
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    await fireEvent.press(screen.getByText("Enviar ahora"));
    await screen.findByText(/No pudimos tomar tu ubicación/);
    expect(mockEnviar).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Personas a asistir")).toBeNull();
    await fireEvent.press(screen.getByText("Escribir una referencia"));
    expect(screen.getByLabelText("Personas a asistir")).toBeTruthy();
  });

  it("sin GPS pero con una referencia escrita en el formulario, envía con la referencia y sin coordenadas", async () => {
    gps().mockResolvedValue({ ok: false, motivo: "permiso" });
    await abrir();
    await fireEvent.press(screen.getByText("Detallar pedido"));
    await fireEvent.changeText(screen.getByLabelText("Referencia de ubicación (paraje, camino, escuela cercana)"), "Paraje El Colorado");
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    await fireEvent.press(screen.getByText("Enviar ahora"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    const datos = mockEnviar.mock.calls[0][0];
    expect(datos.referencia_ubicacion).toBe("Paraje El Colorado");
    expect("lat" in datos || "lon" in datos).toBe(false);
  });

  it("sin red queda en la cola y ofrece el SMS, que solo abre la app de mensajes", async () => {
    mockSinRed = true;
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: null, resultado: null, servidorId: null });
    const abrirUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    await abrir();
    await fireEvent.press(screen.getByLabelText("Necesito ayuda ahora"));
    await fireEvent.press(screen.getByText("Enviar ahora"));
    await screen.findByText("Pedido guardado en el teléfono");
    expect(abrirUrl).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Avisar también por SMS"));
    await waitFor(() => expect(abrirUrl).toHaveBeenCalledTimes(1));
    expect(decodeURIComponent(abrirUrl.mock.calls[0][0] as string)).toContain("SOS-FSA|-26.18");
  });

  it("el formulario detallado sigue ahí, plegado, y editarlo borra el aviso de envío anterior", async () => {
    await abrir();
    expect(screen.queryByLabelText("Personas a asistir")).toBeNull();
    await fireEvent.press(screen.getByText("Detallar pedido"));
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: null, resultado: null });
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "2");
    await fireEvent.press(screen.getByText("Tomar mi ubicación"));
    await screen.findByText("Actualizar ubicación");
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    await screen.findByText("Guardada en el teléfono");
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "3");
    expect(screen.queryByText("Guardada en el teléfono")).toBeNull();
  });
});
