import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarcoApp } from "@/components/MarcoApp";
import { ErrorApi } from "@/lib/api";
import { guardarServidor, reiniciarServidorParaPruebas } from "@/lib/servidor";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockEntrar = jest.fn();
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({ estado: { tipo: "anonimo" }, entrar: mockEntrar, salir: jest.fn() }),
}));

jest.mock("@/lib/dispositivo", () => ({ obtenerUbicacion: jest.fn(), tomarFotoComprimida: jest.fn() }));

const mockRegistro = jest.fn();
jest.mock("@/lib/servicios", () => ({
  ...jest.requireActual("@/lib/servicios"),
  api: { registroCiudadano: (...a: unknown[]) => mockRegistro(...a), registroProductor: jest.fn() },
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

beforeEach(() => {
  reiniciarServidorParaPruebas();
  delete process.env.EXPO_PUBLIC_API_URL;
  const almacen = (jest.requireMock("expo-secure-store") as { __almacen: Map<string, string> }).__almacen;
  almacen.clear();
  mockPush.mockClear();
  mockBack.mockClear();
  mockEntrar.mockReset();
  mockRegistro.mockReset();
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as unknown as typeof fetch;
});

describe("bienvenida", () => {
  it("no muestra la configuración del servidor ni el estado del backend", async () => {
    await guardarServidor("http://10.254.197.232:8000");
    const Bienvenida = require("@/app/index").default;
    await render(enMarco(<Bienvenida />));
    expect(screen.getByText("Ingresar")).toBeTruthy();
    expect(screen.getByText("Registrarme")).toBeTruthy();
    expect(screen.queryByText("Estado del backend")).toBeNull();
    expect(screen.queryByLabelText("Dirección del servidor")).toBeNull();
    expect(screen.queryByText(ADVERTENCIA)).toBeNull();
    expect(screen.getByText(/no reemplaza al 103 ni a Defensa Civil/)).toBeTruthy();
  });

  it("ofrece un enlace discreto «Configurar conexión» hacia /conexion", async () => {
    const Bienvenida = require("@/app/index").default;
    await render(enMarco(<Bienvenida />));
    await fireEvent.press(screen.getByLabelText("Configurar conexión"));
    expect(mockPush).toHaveBeenCalledWith("/conexion");
  });
});

describe("conexion", () => {
  it("muestra la configuración del servidor, el estado del backend y la advertencia http", async () => {
    const Conexion = require("@/app/conexion").default;
    await render(enMarco(<Conexion />));
    expect(screen.getByText("Estado del backend")).toBeTruthy();
    const campo = screen.getByLabelText("Dirección del servidor");
    await fireEvent.changeText(campo, "http://192.168.1.50:8000");
    expect(screen.getByText(ADVERTENCIA)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Volver"));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe.each([
  ["login", () => require("@/app/login").default],
  ["registro", () => require("@/app/registro").default],
])("%s", (_nombre, cargar) => {
  it("no muestra el servidor en uso, la advertencia http ni «Cambiar servidor»", async () => {
    await guardarServidor("http://10.254.197.232:8000");
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />));
    expect(screen.queryByText(/^Servidor:/)).toBeNull();
    expect(screen.queryByText(ADVERTENCIA)).toBeNull();
    expect(screen.queryByLabelText("Cambiar servidor")).toBeNull();
    expect(screen.queryByLabelText("Configurar conexión")).toBeNull();
  });

  it("sin servidor configurado tampoco muestra avisos de servidor", async () => {
    const Pantalla = cargar();
    await render(enMarco(<Pantalla />));
    expect(screen.queryByText("Configurá el servidor antes de ingresar")).toBeNull();
    expect(screen.queryByLabelText("Cambiar servidor")).toBeNull();
  });
});

describe("login: errores de conexión", () => {
  const botonIngresar = () => screen.getAllByLabelText("Ingresar").at(-1)!;

  const completar = async () => {
    await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "a@b.com");
    await fireEvent.changeText(screen.getByLabelText("Contraseña"), "secreta");
  };

  it("con correo y contraseña habilita el envío sin depender del servidor", async () => {
    const Login = require("@/app/login").default;
    await render(enMarco(<Login />));
    expect(botonIngresar().props.accessibilityState.disabled).toBe(true);
    await completar();
    await waitFor(() => expect(botonIngresar().props.accessibilityState.disabled).toBe(false));
    mockEntrar.mockResolvedValue(undefined);
    await fireEvent.press(botonIngresar());
    await waitFor(() => expect(mockEntrar).toHaveBeenCalledWith("a@b.com", "secreta"));
  });

  it.each([
    ["sin_servidor", /todavía no está configurada la conexión/i],
    ["sin_conexion", /No hay conexión con el servidor/],
  ])("ante «%s» muestra el error y «Configurar conexión»", async (codigo, mensaje) => {
    mockEntrar.mockRejectedValue(new ErrorApi(0, codigo, "x"));
    const Login = require("@/app/login").default;
    await render(enMarco(<Login />));
    await completar();
    await fireEvent.press(botonIngresar());
    expect(await screen.findByText(mensaje)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Configurar conexión"));
    expect(mockPush).toHaveBeenCalledWith("/conexion");
  });

  it("una contraseña incorrecta no ofrece configurar la conexión", async () => {
    mockEntrar.mockRejectedValue(new ErrorApi(401, "credenciales_invalidas", "x"));
    const Login = require("@/app/login").default;
    await render(enMarco(<Login />));
    await completar();
    await fireEvent.press(botonIngresar());
    expect(await screen.findByText("Correo o contraseña incorrectos.")).toBeTruthy();
    expect(screen.queryByLabelText("Configurar conexión")).toBeNull();
  });
});

describe("registro: errores de conexión", () => {
  it("ante «sin_servidor» ofrece «Configurar conexión»", async () => {
    mockRegistro.mockRejectedValue(new ErrorApi(0, "sin_servidor", "x"));
    const Registro = require("@/app/registro").default;
    await render(enMarco(<Registro />));
    await fireEvent.changeText(screen.getByLabelText("Nombre"), "Persona Demo");
    await fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "demo@ejemplo.test");
    await fireEvent.changeText(screen.getByLabelText("Contraseña (mínimo 10 caracteres)"), "clave-de-prueba-1");
    await fireEvent(screen.getByLabelText("Consentimiento informado"), "valueChange", true);
    await fireEvent.press(screen.getAllByLabelText("Crear cuenta").at(-1)!);
    expect(await screen.findByText(/todavía no está configurada la conexión/i)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Configurar conexión"));
    expect(mockPush).toHaveBeenCalledWith("/conexion");
  });
});
