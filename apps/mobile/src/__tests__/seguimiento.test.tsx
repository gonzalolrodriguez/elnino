import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ItemCuadrillaEnCamino } from "@/components/TarjetaCuadrillaEnCamino";
import { ErrorApi } from "@/lib/api";
import { cicloEnvio, EDAD_MAXIMA_REENVIO_MS } from "@/lib/compartirPosicion";
import type { ResultadoUbicacion } from "@/lib/dispositivo";
import {
  esPosicionVieja,
  formatearDistancia,
  formatearLlegada,
  horaLocal,
  progresoRecorrido,
  UltimaPosicion,
} from "@/lib/seguimiento";
import type { SeguimientoCuadrilla } from "@/lib/servicios";

jest.mock("@/lib/dispositivo", () => ({ obtenerUbicacion: jest.fn(), tomarFotoComprimida: jest.fn() }));

describe("formato de la llegada estimada", () => {
  it("usa lenguaje común y redondea hacia arriba como el servidor", () => {
    expect(formatearLlegada(0)).toBe("ya está llegando");
    expect(formatearLlegada(1)).toBe("alrededor de 1 min");
    expect(formatearLlegada(12)).toBe("unos 12 min");
    expect(formatearLlegada(80)).toBe("unos 1 h 20 min");
    expect(formatearLlegada(120)).toBe("unos 2 h");
    expect(formatearLlegada(null)).toBeNull();
    expect(formatearLlegada(-1)).toBeNull();
    expect(formatearLlegada(Number.NaN)).toBeNull();
  });

  it("distancia en metros de a 10 o en kilómetros con coma", () => {
    expect(formatearDistancia(248)).toBe("250 m");
    expect(formatearDistancia(999)).toBe("1000 m");
    expect(formatearDistancia(3450)).toBe("3,5 km");
    expect(formatearDistancia(undefined)).toBeNull();
  });

  it("hora de Formosa (UTC-3)", () => {
    expect(horaLocal("2026-11-20T18:02:11Z")).toBe("15:02");
    expect(horaLocal("2026-11-20T01:05:00Z")).toBe("22:05");
    expect(horaLocal("basura")).toBeNull();
    expect(horaLocal(null)).toBeNull();
  });

  it("progreso del recorrido acotado entre 0 y 1", () => {
    expect(progresoRecorrido(500, 2000)).toBeCloseTo(0.75);
    expect(progresoRecorrido(2500, 2000)).toBe(0);
    expect(progresoRecorrido(0, 2000)).toBe(1);
    expect(progresoRecorrido(null, 2000)).toBeNull();
    expect(progresoRecorrido(100, 0)).toBeNull();
  });
});

describe("posición vieja", () => {
  const ahora = Date.parse("2026-11-20T18:10:00Z");
  it("más de N minutos es vieja; una marca ilegible también", () => {
    expect(esPosicionVieja("2026-11-20T18:04:00Z", ahora, 5)).toBe(true);
    expect(esPosicionVieja("2026-11-20T18:06:00Z", ahora, 5)).toBe(false);
    expect(esPosicionVieja("2026-11-20T18:05:00Z", ahora, 5)).toBe(false); // justo 5 min: todavía no
    expect(esPosicionVieja(null, ahora, 5)).toBe(true);
    expect(esPosicionVieja("x", ahora, 5)).toBe(true);
  });
});

describe("cola de la última posición", () => {
  it("guarda una sola: la más nueva pisa a la anterior y no se acumulan", () => {
    const b = new UltimaPosicion();
    expect(b.pendiente()).toBeNull();
    b.guardar({ lat: -26.1, lon: -58.1 }, 10, 1000);
    b.guardar({ lat: -26.2, lon: -58.2 }, 8, 2000);
    expect(b.pendiente()).toEqual({ coordenadas: { lat: -26.2, lon: -58.2 }, precisionM: 8, tomadaEn: 2000 });
  });

  it("marcar enviada una posición vieja no borra la más nueva", () => {
    const b = new UltimaPosicion();
    b.guardar({ lat: -26.1, lon: -58.1 }, null, 1000);
    b.guardar({ lat: -26.2, lon: -58.2 }, null, 2000);
    b.enviada(1000);
    expect(b.pendiente()?.tomadaEn).toBe(2000);
    b.enviada(2000);
    expect(b.pendiente()).toBeNull();
  });
});

describe("ciclo de envío de la posición", () => {
  const gps = (lat: number, lon: number): ResultadoUbicacion => ({ ok: true, coordenadas: { lat, lon }, precisionM: 12.4 });
  const sinGps: ResultadoUbicacion = { ok: false, motivo: "error" };

  it("envía la posición con las coordenadas redondeadas y vacía el buffer", async () => {
    const b = new UltimaPosicion();
    const enviar = jest.fn().mockResolvedValue({ cuadrillas: [1] });
    const r = await cicloEnvio(b, async () => gps(-26.1812345, -58.1398765), enviar, 1000);
    expect(r).toBe("enviada");
    expect(enviar).toHaveBeenCalledWith({ lat: -26.18123, lon: -58.13988, precision_m: 12 });
    expect(b.pendiente()).toBeNull();
  });

  it("sin red conserva solo la última y la reenvía en el ciclo siguiente", async () => {
    const b = new UltimaPosicion();
    const sinRed = new ErrorApi(0, "sin_conexion", "Sin conexión");
    const enviar = jest.fn().mockRejectedValueOnce(sinRed).mockRejectedValueOnce(sinRed).mockResolvedValueOnce({ cuadrillas: [1] });
    expect(await cicloEnvio(b, async () => gps(-26.1, -58.1), enviar, 1000)).toBe("pendiente");
    expect(await cicloEnvio(b, async () => gps(-26.2, -58.2), enviar, 31_000)).toBe("pendiente");
    expect(b.pendiente()?.coordenadas).toEqual({ lat: -26.2, lon: -58.2 }); // la primera se descartó
    // Se recupera la red pero el GPS falla: se reenvía la última guardada (tiene 30 s).
    expect(await cicloEnvio(b, async () => sinGps, enviar, 61_000)).toBe("enviada");
    expect(enviar).toHaveBeenLastCalledWith(expect.objectContaining({ lat: -26.2, lon: -58.2 }));
    expect(b.pendiente()).toBeNull();
  });

  it("no reenvía como actual una posición guardada hace mucho", async () => {
    const b = new UltimaPosicion();
    b.guardar({ lat: -26.1, lon: -58.1 }, null, 1000);
    const enviar = jest.fn();
    const r = await cicloEnvio(b, async () => sinGps, enviar, 1000 + EDAD_MAXIMA_REENVIO_MS + 1);
    expect(r).toBe("pendiente");
    expect(enviar).not.toHaveBeenCalled();
    expect(b.pendiente()).toBeNull();
  });

  it("429 cuenta como enviada y 409 corta el envío", async () => {
    const b = new UltimaPosicion();
    const demasiado = new ErrorApi(429, "limite", "Esperá");
    expect(await cicloEnvio(b, async () => gps(-26.1, -58.1), jest.fn().mockRejectedValue(demasiado), 1000)).toBe("enviada");
    expect(b.pendiente()).toBeNull();
    const sinTarea = new ErrorApi(409, "conflicto", "No tenés ninguna tarea en curso");
    expect(await cicloEnvio(b, async () => gps(-26.1, -58.1), jest.fn().mockRejectedValue(sinTarea), 2000)).toBe("sin_tarea");
    expect(b.pendiente()).toBeNull();
  });

  it("sin permiso de ubicación no envía nada", async () => {
    const b = new UltimaPosicion();
    const enviar = jest.fn();
    expect(await cicloEnvio(b, async () => ({ ok: false, motivo: "permiso" }), enviar, 1000)).toBe("sin_permiso");
    expect(enviar).not.toHaveBeenCalled();
  });
});

const metricas = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const seg = (extra: Partial<SeguimientoCuadrilla> = {}): SeguimientoCuadrilla => ({
  solicitud_id: 12,
  tarea_id: 7,
  tipo_cuadrilla: "humana",
  roles: ["encargado_cuadrilla"],
  estado: "en_camino",
  actualizada_en: "2026-11-20T18:02:11Z",
  posicion_vieja: false,
  distancia_m: 3450,
  llegada_estimada_min: 8,
  categoria: "SIMULADO",
  supuestos: { factor_desvio: 1.3, velocidad_cuadrilla_kmh: 40, posicion_vieja_minutos: 5 },
  ...extra,
});
const ahoraMs = Date.parse("2026-11-20T18:04:00Z");
const ver = (s: SeguimientoCuadrilla, inicial?: number) =>
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <ItemCuadrillaEnCamino s={s} ahoraMs={ahoraMs} distanciaInicialM={inicial} />
    </SafeAreaProvider>,
  );

describe("tarjeta «Cuadrilla en camino»", () => {
  it("con posición: distancia, llegada estimada, hora, estimación y categoría", async () => {
    await ver(seg(), 6900);
    expect(screen.getByText("Cuadrilla en camino")).toBeTruthy();
    expect(screen.getByLabelText("Distancia a tu pedido: 3,5 km")).toBeTruthy();
    expect(screen.getByLabelText("Llegada estimada: unos 8 min")).toBeTruthy();
    expect(screen.getByText("Última posición recibida a las 15:02.")).toBeTruthy();
    expect(screen.getByText(/Es una estimación \(SUPUESTO/)).toBeTruthy();
    expect(screen.getByText("SIMULADO")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.queryByText(/pueden no ser confiables/)).toBeNull();
  });

  it("sin posición todavía", async () => {
    await ver(seg({ estado: "asignada_sin_posicion", actualizada_en: null, posicion_vieja: null, distancia_m: null, llegada_estimada_min: null }));
    expect(screen.getByText(/Todavía no recibimos su posición/)).toBeTruthy();
    expect(screen.queryByText(/Llegada estimada/)).toBeNull();
  });

  it("posición vieja: avisa y deja un camino de emergencia", async () => {
    await ver(seg({ posicion_vieja: true }));
    expect(screen.getByText(/más de 5 minutos.*pueden no ser confiables.*103/)).toBeTruthy();
  });

  it("calcula si es vieja con la hora cuando el servidor no lo informa", async () => {
    await ver(seg({ posicion_vieja: null, actualizada_en: "2026-11-20T17:50:00Z" }));
    expect(screen.getByText(/pueden no ser confiables/)).toBeTruthy();
  });

  it("pedido sin coordenadas: no inventa la llegada", async () => {
    await ver(seg({ distancia_m: null, llegada_estimada_min: null }));
    expect(screen.getByText("La cuadrilla está en camino")).toBeTruthy();
    expect(screen.getByText(/no tiene una ubicación exacta/)).toBeTruthy();
    expect(screen.queryByText(/Llegada estimada/)).toBeNull();
  });
});
