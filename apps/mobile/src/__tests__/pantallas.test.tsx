import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarcoApp } from "@/components/MarcoApp";
import { SoloRol } from "@/components/SoloRol";
import { LEYENDA } from "@evacuaciones/shared";
import { nuevasNoLeidas } from "@/lib/AlertasContext";
import { pestanasPorRol } from "@/lib/SesionContext";

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn() }),
  Tabs: () => null,
  Stack: () => null,
}));

let mockSesion: { estado: unknown } = { estado: { tipo: "cargando" } };
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({ ...mockSesion, entrar: jest.fn(), salir: jest.fn() }),
}));

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function enMarco(hijo: React.ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={metricas}>
      <MarcoApp>{hijo}</MarcoApp>
    </SafeAreaProvider>
  );
}

describe("leyenda fija", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ estado: "ok", servicio: "x", version: "1", base_de_datos: "ok" }),
    }) as unknown as typeof fetch;
  });

  it("está en la pantalla de bienvenida (cargando y anónimo)", async () => {
    const Bienvenida = require("@/app/index").default;
    mockSesion = { estado: { tipo: "cargando" } };
    const { unmount } = await render(enMarco(<Bienvenida />));
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    expect(screen.getByLabelText("Abriendo la aplicación…")).toBeTruthy();
    await unmount();

    mockSesion = { estado: { tipo: "anonimo" } };
    await render(enMarco(<Bienvenida />));
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    expect(screen.getByText("Ingresar")).toBeTruthy();
  });

  it("está en el login y en el registro", async () => {
    mockSesion = { estado: { tipo: "anonimo" } };
    const Login = require("@/app/login").default;
    const { unmount } = await render(enMarco(<Login />));
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    await unmount();

    const Registro = require("@/app/registro").default;
    await render(enMarco(<Registro />));
    expect(screen.getByText(LEYENDA)).toBeTruthy();
    expect(screen.getAllByText("Crear cuenta").length).toBeGreaterThan(0);
  });
});

describe("modo cuadrilla por rol", () => {
  it("la pestaña de cuadrilla solo existe para el rol cuadrilla", () => {
    expect(pestanasPorRol("ciudadano")).not.toContain("cuadrilla");
    expect(pestanasPorRol("productor")).not.toContain("cuadrilla");
    expect(pestanasPorRol("decisor")).not.toContain("cuadrilla");
    expect(pestanasPorRol("cuadrilla")).toContain("cuadrilla");
    expect(pestanasPorRol("cuadrilla")).not.toContain("asistencia");
  });

  const usuario = (rol: string) => ({
    tipo: "autenticado",
    usuario: { id: 1, email: "x", nombre_visible: "x", rol, rol_operativo: null, estado: "activo" },
  });

  it("la pantalla de cuadrilla está oculta para un ciudadano", async () => {
    mockSesion = { estado: usuario("ciudadano") };
    await render(
      <SoloRol roles={["cuadrilla"]}>
        <Text>CONTENIDO DE CUADRILLA</Text>
      </SoloRol>,
    );
    expect(screen.queryByText("CONTENIDO DE CUADRILLA")).toBeNull();
    expect(screen.getByText("Esta sección no está disponible para tu rol.")).toBeTruthy();
  });

  it("la pantalla de cuadrilla se muestra a una cuadrilla", async () => {
    mockSesion = { estado: usuario("cuadrilla") };
    await render(
      <SoloRol roles={["cuadrilla"]}>
        <Text>CONTENIDO DE CUADRILLA</Text>
      </SoloRol>,
    );
    expect(screen.getByText("CONTENIDO DE CUADRILLA")).toBeTruthy();
  });
});

describe("alertas nuevas", () => {
  it("solo señala no leídas que no se habían visto", () => {
    const n = (id: number, leida: boolean) => ({ id, orden_id: 1, mensaje: `m${id}`, leida, creada_en: "" });
    const nuevas = nuevasNoLeidas(new Set([1]), [n(1, false), n(2, false), n(3, true)]);
    expect(nuevas.map((x) => x.id)).toEqual([2]);
  });
});
