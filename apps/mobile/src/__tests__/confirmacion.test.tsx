import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("expo-router", () => ({ Redirect: () => null, useRouter: () => ({ push: jest.fn() }), Tabs: () => null, Stack: () => null }));

jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useUsuario: () => ({ id: 1, email: "x", nombre_visible: "x", rol: "ciudadano", rol_operativo: null, estado: "activo" }),
}));

const mockEnviar = jest.fn();
jest.mock("@/lib/ColaContext", () => ({ useCola: () => ({ enviar: mockEnviar }) }));

let mockNotificaciones: unknown[] = [];
jest.mock("@/lib/AlertasContext", () => ({
  ...jest.requireActual("@/lib/AlertasContext"),
  useAlertas: () => ({
    estado: { tipo: "ok" },
    notificaciones: mockNotificaciones,
    canal: "desconectado",
    recargar: jest.fn(),
    marcarLeida: jest.fn(),
  }),
}));

const mockConfirmaciones = jest.fn();
jest.mock("@/lib/servicios", () => ({ api: { confirmaciones: (...a: unknown[]) => mockConfirmaciones(...a) } }));
jest.mock("@/lib/cacheLocal", () => ({ leerCache: jest.fn(async () => null), guardarCache: jest.fn() }));

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;

const notif = (id: number, codigo: string, solicitud = 12) => ({
  id,
  orden_id: null,
  tipo: "confirmacion_evacuacion",
  leida: false,
  creada_en: "2026-11-19T10:00:00Z",
  mensaje: "¿Llegaste?",
  datos: { tarea_id: 7, solicitud_id: solicitud, codigo, centro_nombre: "Escuela de prueba", respuestas: ["completa", "parcial", "no_encontraron", "no_vinieron", "otro_problema"] },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockNotificaciones = [notif(9, "K7M2QX4P")];
  mockConfirmaciones.mockResolvedValue({ confirmaciones: [], pendientes: 1 });
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
});

describe("confirmación del evacuado en Alertas", () => {
  it("muestra la consulta con el centro y copy neutral", async () => {
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await screen.findByText("¿Llegaste a Escuela de prueba?");
    expect(screen.getByText(/no es una evaluación sobre vos/)).toBeTruthy();
    for (const t of ["Me asistieron por completo", "Me asistieron en parte", "Vinieron pero no me encontraron", "No vinieron", "Otro problema"]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  it.each([
    ["Me asistieron por completo", "completa"],
    ["Me asistieron en parte", "parcial"],
    ["Vinieron pero no me encontraron", "no_encontraron"],
    ["No vinieron", "no_vinieron"],
    ["Otro problema", "otro_problema"],
  ])("«%s» envía el valor canónico %s", async (etiqueta, valor) => {
    mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false, rechazada: null });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await fireEvent.press(await screen.findByText(etiqueta));
    await fireEvent.press(screen.getByText("Enviar mi respuesta"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    expect(mockEnviar.mock.calls[0][0]).toEqual({ clase: "confirmacion", solicitud_id: 12, respuesta: valor });
  });

  it("«Me asistieron por completo» encola la confirmación del pedido y agradece", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false, rechazada: null });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await fireEvent.press(await screen.findByText("Me asistieron por completo"));
    await fireEvent.press(screen.getByText("Enviar mi respuesta"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    expect(mockEnviar.mock.calls[0][0]).toEqual({ clase: "confirmacion", solicitud_id: 12, respuesta: "completa" });
    await screen.findByText("Gracias por avisar que te asistieron.");
  });

  it("«Otro problema» manda el comentario", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false, rechazada: null });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await fireEvent.press(await screen.findByText("Otro problema"));
    await fireEvent.changeText(screen.getByLabelText("Comentario (opcional)"), "No había lugar");
    await fireEvent.press(screen.getByText("Enviar mi respuesta"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalled());
    expect(mockEnviar.mock.calls[0][0]).toMatchObject({ respuesta: "otro_problema", comentario: "No había lugar" });
  });

  it("sin conexión la respuesta queda guardada en el teléfono", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: null });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await fireEvent.press(await screen.findByText("No vinieron"));
    await fireEvent.press(screen.getByText("Enviar mi respuesta"));
    await screen.findByText(/Guardamos tu respuesta en el teléfono/);
  });

  it("si el servidor la rechaza (409) explica que la respuesta es una sola", async () => {
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false, rechazada: "Ya respondiste esta consulta." });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await fireEvent.press(await screen.findByText("No vinieron"));
    await fireEvent.press(screen.getByText("Enviar mi respuesta"));
    await screen.findByText(/la respuesta es una sola y no se puede cambiar/);
  });

  it("«Responder por SMS» abre la app de mensajes con SI/NO/PROBLEMA y el código, y avisa del teléfono registrado", async () => {
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await fireEvent.press(await screen.findByText("Otro problema"));
    await fireEvent.changeText(screen.getByLabelText("Comentario (opcional)"), "faltó agua");
    expect(screen.getByText(/teléfono que registraste/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/Responder por SMS/));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));
    const url = decodeURIComponent((Linking.openURL as jest.Mock).mock.calls[0][0] as string);
    expect(url).toContain("PROBLEMA K7M2QX4P faltó agua");
    // Responder por SMS no marca nada como enviado.
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it("si ya respondió muestra su respuesta y no los botones", async () => {
    mockConfirmaciones.mockResolvedValue({
      confirmaciones: [{ id: 1, tarea_id: 7, solicitud_id: 12, codigo: "K7M2QX4P", centro_nombre: "Escuela de prueba", respondida: true, respuesta: "parcial", comentario: null, solicitada_en: "", respondida_en: "" }],
      pendientes: 0,
    });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await screen.findByText(/Tu respuesta: Me asistieron en parte/);
    expect(screen.queryByText("Enviar mi respuesta")).toBeNull();
  });

  it("una respuesta vieja guardada en el servidor (si) se muestra con la etiqueta nueva", async () => {
    mockConfirmaciones.mockResolvedValue({
      confirmaciones: [{ id: 1, tarea_id: 7, solicitud_id: 12, codigo: "K7M2QX4P", centro_nombre: "Escuela de prueba", respondida: true, respuesta: "si", comentario: null, solicitada_en: "", respondida_en: "" }],
      pendientes: 0,
    });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await screen.findByText(/Tu respuesta: Me asistieron por completo/);
  });

  it("si un operador reabre la consulta, la notificación nueva reemplaza a la vieja", async () => {
    mockNotificaciones = [notif(12, "NUEVO8CD"), notif(9, "K7M2QX4P")];
    mockConfirmaciones.mockResolvedValue({
      confirmaciones: [
        { id: 2, tarea_id: 7, solicitud_id: 12, codigo: "NUEVO8CD", centro_nombre: "Escuela de prueba", respondida: false, respuesta: null, comentario: null, solicitada_en: "", respondida_en: null },
      ],
      pendientes: 1,
    });
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    await screen.findByText("¿Llegaste a Escuela de prueba?");
    expect(screen.getAllByText("¿Llegaste a Escuela de prueba?")).toHaveLength(1);
    await fireEvent.press(screen.getByText("No vinieron"));
    await fireEvent.press(screen.getByText(/Responder por SMS/));
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
    expect(decodeURIComponent((Linking.openURL as jest.Mock).mock.calls[0][0] as string)).toContain("NO NUEVO8CD");
  });
});
