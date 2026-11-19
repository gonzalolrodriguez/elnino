import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorApi } from "@/lib/api";

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
jest.mock("@/lib/ColaContext", () => ({
  useCola: () => ({ enviar: mockEnviar, sinRed: false, pendientes: 0, items: [], otroServidor: [], reintentar: jest.fn(), descartar: jest.fn() }),
}));

jest.mock("@/lib/AlertasContext", () => ({
  ...jest.requireActual("@/lib/AlertasContext"),
  useAlertas: () => ({
    estado: { tipo: "ok" },
    notificaciones: [],
    canal: "desconectado",
    recargar: jest.fn(),
    marcarLeida: jest.fn(),
  }),
}));

jest.mock("@/lib/dispositivo", () => ({
  obtenerUbicacion: jest.fn(async () => ({ ok: true, coordenadas: { lat: -26.18, lon: -58.17 }, precisionM: 5 })),
  tomarFotoComprimida: jest.fn(async () => null),
}));

jest.mock("@/lib/cacheLocal", () => ({ leerCache: jest.fn(async () => null), guardarCache: jest.fn(), borrarCache: jest.fn() }));

const mockGrupo = jest.fn();
const mockSolicitudes = jest.fn();
jest.mock("@/lib/servicios", () => ({
  api: { grupo: (...a: unknown[]) => mockGrupo(...a), guardarGrupo: jest.fn(), solicitudes: (...a: unknown[]) => mockSolicitudes(...a) },
}));

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;
const usuario = (rol: string) => ({
  tipo: "autenticado",
  usuario: { id: 1, email: "x", nombre_visible: "x", rol, rol_operativo: null, estado: "activo" },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado = { tipo: "anonimo" };
});

describe("bienvenida sin sesión", () => {
  it("ofrece llamar al 103 y pedir ayuda por SMS sin cuenta", async () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    const Bienvenida = require("@/app/index").default;
    await render(conSafe(<Bienvenida />));
    await fireEvent.press(screen.getByText("Llamar al 103"));
    expect(abrir).toHaveBeenCalledWith("tel:103");
    await fireEvent.press(screen.getByText("Pedir ayuda por SMS"));
    expect(mockPush).toHaveBeenCalledWith("/ayuda-sms");
    expect(screen.getByText("Qué hacer y a quién llamar")).toBeTruthy();
    expect(screen.getByText("Configurar conexión")).toBeTruthy();
  });
});

describe("guía «Qué hacer»", () => {
  it("lista los teléfonos con su categoría y fuente, sin conexión", async () => {
    const Guia = require("@/app/que-hacer").default;
    await render(conSafe(<Guia />));
    for (const t of ["103 · Defensa Civil", "106 · Prefectura Naval", "911 · Policía y emergencias", "105 · Emergencias ambientales"]) {
      expect(screen.getByText(`Llamar al ${t}`)).toBeTruthy();
    }
    expect(screen.getAllByText("DOCUMENTO DE REFERENCIA").length).toBeGreaterThan(0);
    expect(screen.getByText(/argentina\.gob\.ar\/tema\/emergencias/)).toBeTruthy();
    expect(screen.getByText(/19\/11\/2026/)).toBeTruthy();
  });
});

describe("aviso a los mandos operativos", () => {
  it("un decisor ve que su panel está en la web", async () => {
    mockEstado = usuario("decisor");
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    expect(screen.getByText("Tu panel completo está en la web")).toBeTruthy();
  });

  it("un ciudadano no ve el aviso", async () => {
    mockEstado = usuario("ciudadano");
    const Alertas = require("@/app/(app)/alertas").default;
    await render(conSafe(<Alertas />));
    expect(screen.queryByText("Tu panel completo está en la web")).toBeNull();
  });
});

describe("asistencia", () => {
  it("al quedar encolada se limpia el formulario (evita duplicados)", async () => {
    mockEstado = usuario("ciudadano");
    mockEnviar.mockResolvedValue({ enviadaYa: false, fotoPendiente: false });
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "3");
    await fireEvent.press(screen.getByText("Tomar mi ubicación"));
    await screen.findByText("Actualizar ubicación");
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    await screen.findByText("Guardada en el teléfono");
    expect(screen.getByLabelText("Personas a asistir").props.value).toBe("");
  });

  it("la referencia de ubicación viaja como campo propio, no dentro del texto", async () => {
    mockEstado = usuario("ciudadano");
    mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false });
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "2");
    await fireEvent.changeText(screen.getByLabelText("Referencia de ubicación (paraje, camino, escuela cercana)"), "Paraje El Colorado");
    await fireEvent.press(screen.getByText("Tomar mi ubicación"));
    await screen.findByText("Actualizar ubicación");
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    const enviado = mockEnviar.mock.calls[0][0];
    expect(enviado.referencia_ubicacion).toBe("Paraje El Colorado");
    expect(enviado.texto).toBeNull();
  });

  it("sin GPS se puede enviar con una referencia: va sin coordenadas y queda como ubicación aproximada", async () => {
    mockEstado = usuario("ciudadano");
    mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false });
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "2");
    expect(screen.getByText("Enviar solicitud").props).toBeDefined();
    await fireEvent.changeText(screen.getByLabelText("Referencia de ubicación (paraje, camino, escuela cercana)"), "Paraje El Colorado");
    expect(screen.getByText("Ubicación aproximada: un operador la va a verificar")).toBeTruthy();
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    const enviado = mockEnviar.mock.calls[0][0];
    expect(enviado.referencia_ubicacion).toBe("Paraje El Colorado");
    expect("lat" in enviado || "lon" in enviado).toBe(false);
  });

  it("sin GPS ni referencia no se puede enviar", async () => {
    mockEstado = usuario("ciudadano");
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "2");
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it("sin referencia no manda el campo", async () => {
    mockEstado = usuario("ciudadano");
    mockEnviar.mockResolvedValue({ enviadaYa: true, fotoPendiente: false });
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "2");
    await fireEvent.press(screen.getByText("Tomar mi ubicación"));
    await screen.findByText("Actualizar ubicación");
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    await waitFor(() => expect(mockEnviar).toHaveBeenCalledTimes(1));
    expect("referencia_ubicacion" in mockEnviar.mock.calls[0][0]).toBe(false);
  });

  it("Mis solicitudes muestra la referencia y la ubicación aproximada", async () => {
    mockEstado = usuario("ciudadano");
    mockSolicitudes.mockResolvedValue({
      solicitudes: [
        {
          id: 9, origen: "sms_sim", tipo: "otro", personas: 3, animales: 0, texto: null, estado: "recibida",
          sector_id: null, creado_en: "2026-11-19T10:00:00Z", actualizado_en: "2026-11-19T10:00:00Z", categoria: "SIMULADO",
          ubicacion_aproximada: true, referencia_ubicacion: "Paraje El Colorado", requiere_verificacion: true,
        },
      ],
    });
    const Solicitudes = require("@/app/(app)/solicitudes").default;
    await render(conSafe(<Solicitudes />));
    await screen.findByText("Ubicación aproximada: un operador la va a verificar");
    expect(screen.getByText("Referencia: Paraje El Colorado")).toBeTruthy();
  });

  it("rechaza más de 500 personas antes de encolar", async () => {
    mockEstado = usuario("ciudadano");
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    await fireEvent.changeText(screen.getByLabelText("Personas a asistir"), "501");
    await fireEvent.press(screen.getByText("Tomar mi ubicación"));
    await screen.findByText("Actualizar ubicación");
    await fireEvent.press(screen.getByText("Enviar solicitud"));
    await screen.findByText(/máximo por pedido es 500/);
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it("muestra siempre «¿Sin datos? Enviar por SMS» y explica a quién va", async () => {
    mockEstado = usuario("ciudadano");
    const Asistencia = require("@/app/(app)/asistencia").default;
    await render(conSafe(<Asistencia />));
    expect(screen.getByText("¿Sin datos? Enviar por SMS")).toBeTruthy();
    expect(screen.getAllByText(/SIMULADO/).length).toBeGreaterThan(0);
  });
});

describe("ayuda por SMS", () => {
  it("explica que también se puede mandar AYUDA o INFO (canal SIMULADO)", async () => {
    const AyudaSms = require("@/app/ayuda-sms").default;
    await render(conSafe(<AyudaSms />));
    expect(screen.getByText(/AYUDA o INFO/)).toBeTruthy();
  });
});

describe("FormGrupoFamiliar", () => {
  it("ante un error de carga (no 404) muestra el error y NO el formulario editable", async () => {
    mockGrupo.mockRejectedValue(new ErrorApi(0, "sin_conexion", "Sin conexión"));
    const { FormGrupoFamiliar } = require("@/components/FormGrupoFamiliar");
    await render(<FormGrupoFamiliar />);
    await screen.findByText(/No pudimos cargar tus datos/);
    expect(screen.queryByText("Guardar")).toBeNull();
    expect(screen.queryByLabelText("Integrantes")).toBeNull();
    expect(screen.getByText("Reintentar")).toBeTruthy();
  });

  it("con 404 (todavía sin grupo) muestra el formulario vacío", async () => {
    mockGrupo.mockRejectedValue(new ErrorApi(404, "no_encontrado", "No existe"));
    const { FormGrupoFamiliar } = require("@/components/FormGrupoFamiliar");
    await render(<FormGrupoFamiliar />);
    await screen.findByText("Guardar");
    expect(screen.getByLabelText("Integrantes")).toBeTruthy();
  });
});
