import { render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  descripcionDireccion,
  diferenciaAngular,
  distanciaM,
  elegirMasCercano,
  formatearDistanciaBrujula,
  formatearDistanciaHablada,
  normalizar360,
  rumboCardinal,
  rumboDelTelefono,
  rumboEnTexto,
  rumboInicial,
  type Destino,
} from "@/lib/brujula";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

let mockEstado: { tipo: string; usuario?: unknown } = { tipo: "autenticado", usuario: { id: 7 } };
jest.mock("@/lib/SesionContext", () => ({
  ...jest.requireActual("@/lib/SesionContext"),
  useSesion: () => ({ estado: mockEstado }),
}));

const mockMiSector = jest.fn();
const mockCentros = jest.fn();
jest.mock("@/lib/servicios", () => ({
  api: { miSector: (...a: unknown[]) => mockMiSector(...a), centros: (...a: unknown[]) => mockCentros(...a) },
}));

const mockLeerCache = jest.fn();
const mockGuardarCache = jest.fn();
jest.mock("@/lib/cacheLocal", () => ({
  leerCache: (...a: unknown[]) => mockLeerCache(...a),
  guardarCache: (...a: unknown[]) => mockGuardarCache(...a),
}));

const mockHeading = jest.fn();
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  watchPositionAsync: jest.fn(async (_o: unknown, cb: (p: unknown) => void) => {
    cb({ coords: { latitude: -26.18, longitude: -58.17, accuracy: 8 } });
    return { remove: jest.fn() };
  }),
  watchHeadingAsync: jest.fn(async (cb: (h: unknown) => void) => {
    const h = mockHeading();
    if (h) cb(h);
    return { remove: jest.fn() };
  }),
}));

const NE = { lat: -26.17, lon: -58.16 };
const centro = (id: number, nombre: string, p: { lat: number; lon: number }): Destino => ({ id, nombre, ...p, categoria: "SIMULADO" });

describe("brujula: geometría y formatos", () => {
  it("rumbo inicial hacia los puntos cardinales", () => {
    const o = { lat: -26.18, lon: -58.17 };
    expect(rumboInicial(o, { lat: -26.0, lon: -58.17 })).toBeCloseTo(0, 5);
    expect(rumboInicial(o, { lat: -26.18, lon: -58.0 })).toBeCloseTo(90, 0);
    expect(rumboInicial(o, { lat: -26.4, lon: -58.17 })).toBeCloseTo(180, 5);
    expect(rumboInicial(o, { lat: -26.18, lon: -58.4 })).toBeCloseTo(270, 0);
    expect(rumboInicial(o, NE)).toBeGreaterThan(40);
    expect(rumboInicial(o, NE)).toBeLessThan(45);
  });

  it("distancia haversine: 0,01° de latitud son ~1,11 km y el mismo punto da 0", () => {
    const o = { lat: -26.18, lon: -58.17 };
    expect(distanciaM(o, o)).toBe(0);
    expect(distanciaM(o, { lat: -26.17, lon: -58.17 })).toBeCloseTo(1112, -1);
    expect(distanciaM(o, NE)).toBeGreaterThan(1450);
    expect(distanciaM(o, NE)).toBeLessThan(1550);
  });

  it("normaliza y calcula la diferencia angular más corta", () => {
    expect(normalizar360(-10)).toBe(350);
    expect(normalizar360(370)).toBe(10);
    expect(normalizar360(360)).toBe(0);
    expect(diferenciaAngular(350, 10)).toBe(20);
    expect(diferenciaAngular(10, 350)).toBe(-20);
    expect(diferenciaAngular(0, 180)).toBe(180);
  });

  it("rumbo cardinal de 8 puntos en español", () => {
    expect(rumboCardinal(0)).toBe("norte");
    expect(rumboCardinal(44)).toBe("noreste");
    expect(rumboCardinal(90)).toBe("este");
    expect(rumboCardinal(135)).toBe("sureste");
    expect(rumboCardinal(180)).toBe("sur");
    expect(rumboCardinal(225)).toBe("suroeste");
    expect(rumboCardinal(270)).toBe("oeste");
    expect(rumboCardinal(315)).toBe("noroeste");
    expect(rumboCardinal(359)).toBe("norte");
    expect(rumboCardinal(-45)).toBe("noroeste");
  });

  it("elige el centro más cercano e ignora coordenadas inválidas", () => {
    const o = { lat: -26.18, lon: -58.17 };
    const lejos = centro(1, "Lejos", { lat: -26.3, lon: -58.3 });
    const cerca = centro(2, "Cerca", { lat: -26.181, lon: -58.171 });
    const roto = centro(3, "Roto", { lat: Number.NaN, lon: 0 });
    expect(elegirMasCercano(o, [lejos, roto, cerca])?.id).toBe(2);
    expect(elegirMasCercano(o, [])).toBeNull();
  });

  it("formatos de distancia, normal y hablada", () => {
    expect(formatearDistanciaBrujula(248)).toBe("250 m");
    expect(formatearDistanciaBrujula(2340)).toBe("2,3 km");
    expect(formatearDistanciaHablada(2340)).toBe("2,3 kilómetros");
    expect(formatearDistanciaHablada(250)).toBe("250 metros");
    expect(formatearDistanciaHablada(1000)).toBe("1 kilómetro");
    expect(rumboEnTexto(44, 2340)).toBe("al noreste, a 2,3 km");
    expect(descripcionDireccion(44, 2340, "Centro X")).toBe("Dirigite hacia el noreste, a 2,3 kilómetros de Centro X");
  });

  it("rumbo del teléfono: usa trueHeading si existe, si no magHeading; sin calibrar no es confiable", () => {
    expect(rumboDelTelefono({ trueHeading: 90, magHeading: 95, accuracy: 3 })).toEqual({ grados: 90, confiable: true });
    expect(rumboDelTelefono({ trueHeading: -1, magHeading: 95, accuracy: 2 })).toEqual({ grados: 95, confiable: true });
    expect(rumboDelTelefono({ trueHeading: 90, accuracy: 0 })).toEqual({ grados: 90, confiable: false });
    expect(rumboDelTelefono({ trueHeading: -1, magHeading: -1 })).toBeNull();
    expect(rumboDelTelefono(null)).toBeNull();
  });
});

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const ver = () => {
  const Brujula = require("@/app/brujula").default;
  return render(
    <SafeAreaProvider initialMetrics={metricas}>
      <Brujula />
    </SafeAreaProvider>,
  );
};
const guardado = {
  asignado: { id: 1, nombre: "Escuela de prueba", lat: NE.lat, lon: NE.lon, categoria: "SIMULADO" },
  centros: [centro(1, "Escuela de prueba", NE)],
};

describe("pantalla «¿Hacia dónde voy?»", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEstado = { tipo: "autenticado", usuario: { id: 7 } };
    mockMiSector.mockRejectedValue(new Error("sin red"));
    mockCentros.mockRejectedValue(new Error("sin red"));
    mockHeading.mockReturnValue({ trueHeading: 90, magHeading: 92, accuracy: 3 });
    mockLeerCache.mockResolvedValue({ valor: guardado, guardadoEn: new Date(2026, 10, 18, 9, 30).getTime() });
  });

  it("sin red usa el centro guardado: flecha rotada (rumbo - heading), distancia, fecha y avisos", async () => {
    await ver();
    const flecha = await screen.findByLabelText(/^Dirigite hacia el noreste, a 1,5 kilómetros de Escuela de prueba$/);
    expect(flecha).toBeTruthy();
    expect(screen.getByText("Escuela de prueba")).toBeTruthy();
    expect(screen.getByText("Distancia en línea recta: 1,5 km")).toBeTruthy();
    expect(screen.getByText(/Sin conexión: datos guardados el 18\/11 09:30/)).toBeTruthy();
    expect(screen.getByText(/La flecha apunta en línea recta: no es un camino\. Seguí las indicaciones de Defensa Civil y evitá cruzar agua\./)).toBeTruthy();
    expect(screen.getByText("SIMULADO")).toBeTruthy();
    const estilo = StyleSheet.flatten(screen.getByTestId("flecha-giro").props.style) as { transform: { rotate: string }[] };
    const grados = parseFloat(estilo.transform[0].rotate);
    expect(grados).toBeGreaterThan(310);
    expect(grados).toBeLessThan(320);
    expect(mockGuardarCache).not.toHaveBeenCalled();
  });

  it("sin brújula del sensor muestra el rumbo como texto y pide calibrar", async () => {
    mockHeading.mockReturnValue(null);
    await ver();
    await screen.findByText(/^Está al noreste, a 1,5 km$/);
    expect(screen.queryByLabelText(/^Dirigite hacia/)).toBeNull();
    expect(screen.getByText(/calibrá el sensor/)).toBeTruthy();
  });

  it("sensor sin calibrar: oculta la flecha y avisa", async () => {
    mockHeading.mockReturnValue({ trueHeading: 90, magHeading: 90, accuracy: 0 });
    await ver();
    await screen.findByText(/no es preciso ahora/);
    expect(screen.queryByLabelText(/^Dirigite hacia/)).toBeNull();
  });

  it("con conexión guarda el destino asignado y la lista de centros", async () => {
    mockLeerCache.mockResolvedValue(null);
    mockMiSector.mockResolvedValue({
      sectores: [],
      altura_referencia: {},
      centro_asignado: { personas: { id: 1, nombre: "Escuela de prueba", tipo: "escuela", distancia_linea_recta_m: 1500, lat: NE.lat, lon: NE.lon, categoria: "DOCUMENTO DE REFERENCIA" }, animales: null, nota: "" },
      nota: "",
    });
    mockCentros.mockResolvedValue({ centros: [{ id: 1, nombre: "Escuela de prueba", tipo: "escuela", lat: NE.lat, lon: NE.lon, sector_id: null, capacidad_personas: 100, cupo_libre_personas: 90, categoria: "SIMULADO" }] });
    await ver();
    await screen.findByLabelText(/Dirigite hacia el noreste/);
    expect(screen.getByText("DOCUMENTO DE REFERENCIA")).toBeTruthy();
    await waitFor(() => expect(mockGuardarCache).toHaveBeenCalledTimes(1));
    const [clave, valor] = mockGuardarCache.mock.calls[0];
    expect(clave).toMatch(/^brujula:7:/);
    expect(valor.asignado.nombre).toBe("Escuela de prueba");
    expect(valor.centros).toHaveLength(1);
    expect(screen.getByText(/^Datos guardados el /)).toBeTruthy();
  });

  it("sin centro asignado ofrece el más cercano de la lista guardada", async () => {
    mockLeerCache.mockResolvedValue({
      valor: { asignado: null, centros: [centro(1, "Lejos", { lat: -26.3, lon: -58.3 }), centro(2, "Cerca", NE)] },
      guardadoEn: Date.now(),
    });
    await ver();
    await screen.findByText("Cerca");
    expect(screen.getByText(/El centro más cercano entre los guardados/)).toBeTruthy();
  });

  it("sin datos guardados ni red lo explica y deja llamar al 103", async () => {
    mockLeerCache.mockResolvedValue(null);
    await ver();
    await screen.findByText("Todavía no hay un destino guardado");
    expect(screen.getByText(/llamá al 103/)).toBeTruthy();
  });
});
