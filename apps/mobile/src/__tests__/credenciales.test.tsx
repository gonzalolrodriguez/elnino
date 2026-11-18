import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarcoApp } from "@/components/MarcoApp";
import { guardarServidor, reiniciarServidorParaPruebas } from "@/lib/servidor";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush }),
}));

const mockEntrar = jest.fn();
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({ estado: { tipo: "anonimo" }, entrar: mockEntrar, salir: jest.fn() }),
}));

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const enMarco = (hijo: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={metricas}>
    <MarcoApp>{hijo}</MarcoApp>
  </SafeAreaProvider>
);

const ADVERTENCIA = /Conexión sin cifrar \(http\)\. Tu contraseña viaja sin protección/;
const SIN_SERVIDOR = "Configurá el servidor antes de ingresar";

beforeEach(() => {
  reiniciarServidorParaPruebas();
  delete process.env.EXPO_PUBLIC_API_URL;
  const almacen = (jest.requireMock("expo-secure-store") as { __almacen: Map<string, string> }).__almacen;
  almacen.clear();
  mockPush.mockClear();
  mockEntrar.mockReset();
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as unknown as typeof fetch;
});

describe.each([
  ["login", () => require("@/app/login").default],
  ["registro", () => require("@/app/registro").default],
])("%s", (_nombre, cargar) => {
  it("muestra el servidor y advierte con http", async () => {
    await guardarServidor("http://10.254.197.232:8000");
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />));
    expect(await screen.findByText("Servidor: 10.254.197.232:8000")).toBeTruthy();
    expect(screen.getByText(ADVERTENCIA)).toBeTruthy();
    expect(screen.queryByText(SIN_SERVIDOR)).toBeNull();
  });

  it("no advierte con https", async () => {
    await guardarServidor("https://api.ejemplo.com");
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />));
    expect(await screen.findByText("Servidor: api.ejemplo.com")).toBeTruthy();
    expect(screen.queryByText(ADVERTENCIA)).toBeNull();
  });

  it("«Cambiar servidor» lleva a la pantalla donde se configura", async () => {
    await guardarServidor("http://10.254.197.232:8000");
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />));
    await fireEvent.press(await screen.findByLabelText("Cambiar servidor"));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("sin servidor bloquea el envío y lo dice", async () => {
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />));
    expect(await screen.findByText(SIN_SERVIDOR)).toBeTruthy();
    expect(screen.queryByText(ADVERTENCIA)).toBeNull();
    expect(screen.getByLabelText("Cambiar servidor")).toBeTruthy();
  });
});

describe("login: envío según servidor", () => {
  const botonIngresar = () => screen.getAllByLabelText("Ingresar").at(-1)!;

  it("sin servidor, Ingresar queda deshabilitado aunque haya correo y contraseña", async () => {
    const Login = require("@/app/login").default;
    await render(enMarco(<Login />));
    await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "a@b.com");
    await fireEvent.changeText(screen.getByLabelText("Contraseña"), "secreta");
    await fireEvent.press(botonIngresar());
    expect(mockEntrar).not.toHaveBeenCalled();
    expect(botonIngresar().props.accessibilityState.disabled).toBe(true);
  });

  it("con servidor configurado habilita el envío", async () => {
    await guardarServidor("http://192.168.1.50:8000");
    const Login = require("@/app/login").default;
    await render(enMarco(<Login />));
    await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "a@b.com");
    await fireEvent.changeText(screen.getByLabelText("Contraseña"), "secreta");
    await waitFor(() => expect(botonIngresar().props.accessibilityState.disabled).toBe(false));
    mockEntrar.mockResolvedValue(undefined);
    await fireEvent.press(botonIngresar());
    await waitFor(() => expect(mockEntrar).toHaveBeenCalledWith("a@b.com", "secreta"));
  });
});
