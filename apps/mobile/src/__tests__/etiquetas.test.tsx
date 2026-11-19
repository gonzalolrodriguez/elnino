import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  etiquetaEstadoSolicitud,
  etiquetaOrigen,
  etiquetaRol,
  etiquetaRolOperativo,
  etiquetaTipoOrden,
  formatearFechaHora,
} from "@/lib/etiquetas";
import type { MiSector } from "@/lib/servicios";

jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useUsuario: () => ({ id: 7, email: "x", nombre_visible: "x", rol: "ciudadano", rol_operativo: null, estado: "activo" }),
}));

jest.mock("@/lib/ColaContext", () => ({ useCola: () => ({ enviar: jest.fn() }) }));

const mockMiSector = jest.fn();
jest.mock("@/lib/servicios", () => ({ api: { miSector: (...a: unknown[]) => mockMiSector(...a) } }));

const mockLeerCache = jest.fn();
const mockGuardarCache = jest.fn();
jest.mock("@/lib/cacheLocal", () => ({
  leerCache: (...a: unknown[]) => mockLeerCache(...a),
  guardarCache: (...a: unknown[]) => mockGuardarCache(...a),
}));

const metricas = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const sector: MiSector = {
  sectores: [
    {
      id: "S4",
      nombre: "Sector Rural Este",
      estado: "en_riesgo",
      aislado: true,
      altura_compromiso_m: 7.5,
      margen_a_compromiso_m: 0.4,
      accesos: [],
      alertas: [{ orden_id: 3, tipo: "evacuacion_preventiva", fundamento: "Río en ascenso", creada_en: "2026-11-19T10:00:00Z" }],
      categoria: "SIMULADO",
      fuente: "K10",
    },
  ],
  altura_referencia: { altura_m: 5.6, fecha: "2026-10-31", categoria: "DATO OBSERVADO", fuente: "INA" },
  centro_asignado: {
    personas: { id: 1, nombre: "Escuela de prueba", tipo: "escuela", distancia_linea_recta_m: 900, categoria: "SIMULADO" },
    animales: null,
    nota: "",
  },
  nota: "",
};

describe("etiquetas legibles", () => {
  it("traduce códigos de estado, origen, tipo y rol", () => {
    expect(etiquetaEstadoSolicitud("en_curso")).toBe("En curso");
    expect(etiquetaOrigen("whatsapp_sim")).toBe("WhatsApp (simulado)");
    expect(etiquetaOrigen("sms_sim")).toBe("SMS (simulado)");
    expect(etiquetaTipoOrden("evacuacion_preventiva")).toBe("Evacuación preventiva");
    expect(etiquetaRol("decisor")).toBe("Decisor");
    expect(etiquetaRolOperativo("coordinador_de_sector")).toBe("Coordinador de sector");
    expect(etiquetaOrigen("algo_nuevo")).toBe("Algo nuevo");
  });

  it("formatea fechas en es-AR y tolera valores inválidos", () => {
    expect(formatearFechaHora(new Date(2026, 10, 19, 14, 5))).toBe("19/11/2026 14:05");
    expect(formatearFechaHora("no es fecha")).toBe("—");
    expect(formatearFechaHora(null)).toBe("—");
  });
});

describe("EstadoSector", () => {
  beforeEach(() => jest.clearAllMocks());

  it("con conexión muestra el estado, el centro, la última orden y guarda en caché", async () => {
    mockMiSector.mockResolvedValue(sector);
    const { EstadoSector } = require("@/components/EstadoSector");
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <EstadoSector />
      </SafeAreaProvider>,
    );
    await screen.findByText(/Sector Rural Este: En riesgo/);
    expect(screen.getByText(/Escuela de prueba/)).toBeTruthy();
    expect(screen.getByText(/Evacuación preventiva\. Río en ascenso/)).toBeTruthy();
    expect(screen.getByText("SIMULADO")).toBeTruthy();
    expect(mockGuardarCache).toHaveBeenCalled();
  });

  it("sin conexión muestra lo guardado con «actualizado el …»", async () => {
    mockMiSector.mockRejectedValue(new Error("sin red"));
    mockLeerCache.mockResolvedValue({ valor: sector, guardadoEn: new Date(2026, 10, 18, 9, 30).getTime() });
    const { EstadoSector } = require("@/components/EstadoSector");
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <EstadoSector />
      </SafeAreaProvider>,
    );
    await screen.findByText(/Sin conexión: se muestra lo último guardado, actualizado el 18\/11\/2026 09:30/);
  });
});
