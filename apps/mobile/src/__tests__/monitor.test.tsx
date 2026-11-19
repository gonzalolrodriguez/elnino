import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { pestanasPorRol } from "@/lib/SesionContext";
import { metros, numeroAR, posicionesBarra, textoTiempoAUmbral } from "@/lib/panel";
import type { PanelResumen } from "@/lib/servicios";

jest.mock("expo-router", () => ({ Redirect: () => null, useRouter: () => ({ push: jest.fn() }), Tabs: () => null, Stack: () => null }));

let mockEstado: { tipo: string; usuario?: unknown } = { tipo: "anonimo" };
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({ estado: mockEstado, entrar: jest.fn(), salir: jest.fn() }),
  useUsuario: () => (mockEstado as { usuario: unknown }).usuario,
}));

const mockResumen = jest.fn();
jest.mock("@/lib/servicios", () => ({ api: { panelResumen: (...a: unknown[]) => mockResumen(...a) } }));

const mockLeerCache = jest.fn();
const mockGuardarCache = jest.fn();
jest.mock("@/lib/cacheLocal", () => ({
  leerCache: (...a: unknown[]) => mockLeerCache(...a),
  guardarCache: (...a: unknown[]) => mockGuardarCache(...a),
}));

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const conSafe = (h: React.JSX.Element) => <SafeAreaProvider initialMetrics={metricas}>{h}</SafeAreaProvider>;
const usuario = (rol: string) => ({
  tipo: "autenticado",
  usuario: { id: 4, email: "x", nombre_visible: "x", rol, rol_operativo: null, estado: "activo" },
});

const resumen: PanelResumen = {
  rio: {
    categoria: "DATO OBSERVADO",
    fuente: "K1 · serie limpia de Puerto Formosa; umbrales K3",
    fecha_dato: "2026-10-31",
    disponible: true,
    altura_m: 5.6,
    fecha_lectura: "2026-10-31",
    umbral_alerta_m: 7.8,
    umbral_evacuacion_m: 8.3,
    distancia_a_alerta_m: 2.2,
    distancia_a_evacuacion_m: 2.7,
    tendencia_7d_m: 0.75,
    tendencia_7d_m_por_dia: 0.107,
    tiempo_a_umbrales: [
      { objetivo: "Alerta", valor_m: 7.8, ya_alcanzado: false, dias_minimo: 6.1, dias_maximo: 20.5 },
      { objetivo: "Evacuación", valor_m: 8.3, ya_alcanzado: false, dias_minimo: null, dias_maximo: null },
    ],
    supuesto_proyeccion: "Ascenso lineal con la tasa histórica",
    categoria_proyeccion: "SIMULADO",
  },
  sectores: {
    categoria: "SIMULADO",
    fuente: "K10",
    fecha_dato: "2026-11-19",
    items: [
      {
        id: "S4",
        nombre: "Sector Rural Este",
        estado: "en_riesgo",
        aislado: true,
        margen_a_compromiso_m: 1.9,
        personas_k10: 1200,
        personas_registradas: 3,
        animales_expuestos: 40,
        accesos: [{ nombre: "Camino de tierra", superficie: "tierra", estado: "intransitable_lluvia" }],
      },
    ],
  },
  solicitudes: {
    categoria: "SIMULADO",
    fuente: "Plataforma",
    fecha_dato: "2026-11-19",
    total: 5,
    por_estado: { recibida: 3, en_curso: 2 },
    a_verificar: 1,
    recibidas_mas_antigua_min: 42,
  },
  centros: {
    categoria: "SIMULADO",
    fuente: "Centros",
    fecha_dato: null,
    items: [{ nombre: "Escuela de prueba", capacidad_personas: 1500, ocupacion: 300, ocupacion_pct: 20 }],
  },
  frescura: { rio_ultima_lectura: "2026-10-31", k10_sectores: "2026-11-12", lluvia_ultima_lectura: null, fecha_corte: "2026-10-31" },
  categoria: "SIMULADO",
  fuente: "Resumen",
  fecha_dato: "2026-11-19",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLeerCache.mockResolvedValue(null);
  mockEstado = usuario("decisor");
});

describe("panel: formato", () => {
  it("formatea en es-AR", () => {
    expect(numeroAR(1234.5, 1)).toBe("1.234,5");
    expect(metros(5.6)).toBe("5,60 m");
    expect(numeroAR(-0.004, 2)).toBe("0,00");
  });
  it("describe el tiempo a un umbral como rango", () => {
    expect(textoTiempoAUmbral(resumen.rio.tiempo_a_umbrales![0])).toBe("Alerta (7,80 m): entre 6,1 y 20,5 días");
    expect(textoTiempoAUmbral({ objetivo: "Alerta", valor_m: 7.8, ya_alcanzado: true, dias_minimo: null, dias_maximo: null })).toContain("ya alcanzado");
  });
  it("la barra queda acotada entre 0 y 1", () => {
    const p = posicionesBarra(resumen.rio)!;
    expect(p.nivel).toBeGreaterThan(0);
    expect(p.evacuacion).toBeLessThanOrEqual(1);
    expect(posicionesBarra({ ...resumen.rio, disponible: false })).toBeNull();
  });
});

describe("pestaña Monitor", () => {
  it("existe solo para operador y decisor", () => {
    expect(pestanasPorRol("operador")).toContain("monitor");
    expect(pestanasPorRol("decisor")).toContain("monitor");
    for (const r of ["ciudadano", "productor", "cuadrilla"] as const) expect(pestanasPorRol(r)).not.toContain("monitor");
  });

  it("un ciudadano no ve el contenido", async () => {
    mockEstado = usuario("ciudadano");
    const Monitor = require("@/app/(app)/monitor").default;
    await render(conSafe(<Monitor />));
    expect(screen.getByText("Esta sección no está disponible para tu rol.")).toBeTruthy();
    expect(mockResumen).not.toHaveBeenCalled();
  });

  it("muestra el resumen con categorías, aviso web y supuesto", async () => {
    mockResumen.mockResolvedValue(resumen);
    const Monitor = require("@/app/(app)/monitor").default;
    await render(conSafe(<Monitor />));
    await screen.findByText("5,60 m");
    expect(screen.getByText("Tu panel completo está en la web")).toBeTruthy();
    expect(screen.getAllByText("DATO OBSERVADO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(1);
    expect(screen.getByText(/Alerta \(7,80 m\): entre 6,1 y 20,5 días/)).toBeTruthy();
    expect(screen.getByText(/Evacuación \(8,30 m\): sin estimación/)).toBeTruthy();
    expect(screen.getByText(/Supuesto: Ascenso lineal/)).toBeTruthy();
    expect(screen.getByText(/Sector Rural Este: En riesgo · aislado/)).toBeTruthy();
    expect(screen.getByText("Total: 5")).toBeTruthy();
    expect(screen.getByText("Recibida: 3")).toBeTruthy();
    expect(screen.getByText(/Ocupación: 300 de 1\.500 \(20 %\)/)).toBeTruthy();
    expect(screen.getByText("Última lectura de lluvia: sin dato de lluvia")).toBeTruthy();
    expect(mockGuardarCache).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Evacuaciones")).toBeNull();
  });

  it("sin conexión muestra lo guardado con su fecha", async () => {
    mockResumen.mockRejectedValue(new Error("sin red"));
    mockLeerCache.mockResolvedValue({ valor: resumen, guardadoEn: new Date(2026, 10, 19, 9, 30).getTime() });
    const Monitor = require("@/app/(app)/monitor").default;
    await render(conSafe(<Monitor />));
    await screen.findByText("5,60 m");
    expect(screen.getByText(/Sin conexión: se muestra lo último guardado, actualizado el 19\/11\/2026 09:30/)).toBeTruthy();
  });

  it("sin red y sin caché muestra el error con reintento", async () => {
    mockResumen.mockRejectedValue(new Error("sin red"));
    const Monitor = require("@/app/(app)/monitor").default;
    await render(conSafe(<Monitor />));
    await screen.findByText("Reintentar");
    mockResumen.mockResolvedValue(resumen);
    await fireEvent.press(screen.getByText("Reintentar"));
    await waitFor(() => expect(screen.getByText("5,60 m")).toBeTruthy());
  });

  it("muestra el bloque de evacuaciones solo si llega", async () => {
    mockResumen.mockResolvedValue({
      ...resumen,
      evacuaciones: { categoria: "SIMULADO", fuente: "x", fecha_dato: null, evacuadas: 12, pendientes: 3 },
    });
    const Monitor = require("@/app/(app)/monitor").default;
    await render(conSafe(<Monitor />));
    await screen.findByText("Evacuaciones");
    expect(screen.getByText("Evacuadas: 12")).toBeTruthy();
  });

  it("río sin lectura: lo dice sin inventar cifras", async () => {
    mockResumen.mockResolvedValue({ ...resumen, rio: { categoria: "DATO OBSERVADO", fuente: "K1", fecha_dato: null, disponible: false } });
    const Monitor = require("@/app/(app)/monitor").default;
    await render(conSafe(<Monitor />));
    await screen.findByText("No hay una lectura del río disponible.");
  });
});
