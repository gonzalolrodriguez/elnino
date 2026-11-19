import { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { esperaReintento, useTiempoReal } from "./lib/ws";
import { validarBitacora } from "./panel/paginas/Bitacora";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

// El mapa real necesita WebGL: en las pruebas se reemplaza por un componente vacío.
vi.mock("./panel/MapaGL", () => ({ default: () => null }));

class FakeWS {
  static instancias: FakeWS[] = [];
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeWS.instancias.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  FakeWS.instancias = [];
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

type Rutas = Parameters<typeof simularFetch>[0];
function conSesion(rol: string, rutas: Rutas = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({ "POST /auth/refresh": () => sesion(rol), ...rutas });
}
const ok = (json: unknown) => () => ({ estado: 200, json });

const anillo = (x: number) => [[[x, -26.2], [x + 0.01, -26.2], [x + 0.01, -26.19], [x, -26.2]]];
const SECTORES = {
  type: "FeatureCollection",
  features: ["S1", "S2", "S3", "S4"].map((id, i) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: anillo(-58.2 + i * 0.02) },
    properties: { id, nombre: `Sector ${id}`, altura_escala_compromiso_m: 8, poblacion_simulada: 100 },
  })),
};
const prop = (id: number, nombre: string, sector: string, superficie: string) => ({
  id,
  sector_id: sector,
  nombre,
  superficie,
  transitable: true,
  motivo: null,
  actualizado_en: "2026-11-17T00:00:00Z",
  actualizado_por_rol: null,
});
const ACCESOS = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "LineString", coordinates: [[-58.14, -26.18], [-58.13, -26.18]] }, properties: prop(1, "Camino de tierra a S4", "S4", "tierra") },
    { type: "Feature", geometry: { type: "LineString", coordinates: [[-58.19, -26.16], [-58.18, -26.16]] }, properties: prop(2, "Acceso de ripio a S1", "S1", "ripio") },
  ],
};

const sector = (id: string, estado: string, aislado: boolean, margen: number, accesos: object[]) => ({
  id,
  nombre: `Sector ${id}`,
  estado,
  aislado,
  altura_compromiso_m: 8,
  margen_a_compromiso_m: margen,
  poblacion_simulada: 100,
  accesos,
  isad: { valor: 0.7, categoria: "SIMULADO" },
  categoria: "SIMULADO",
});
// Respuesta de CLAUDE.md §8.1 para { altura 7,6 m, lluvia 40 mm }.
const ESCENARIO_8_1 = {
  rio: { estado: "normal", altura_m: 7.6, distancia_a_alerta_m: 0.2, distancia_a_evacuacion_m: 0.7 },
  sectores: [
    sector("S1", "en_riesgo", false, 0.5, []),
    sector("S2", "normal", false, 1.0, []),
    sector("S3", "en_riesgo", false, 0.3, []),
    sector("S4", "comprometido", true, -0.1, [{ id: 1, nombre: "Camino de tierra a S4", superficie: "tierra", estado: "intransitable_lluvia", motivo: null }]),
  ],
  resumen: { comprometidos: ["S4"], en_riesgo: ["S1", "S3"], normales: ["S2"], aislados: ["S4"] },
  lluvia: { mm: 40, origen: "simulado", categoria: "SIMULADO" },
  categoria: "SIMULADO",
  fuente: "K10",
  fecha_dato: "2026-11-18",
};

const RUTAS_MAPA: Rutas = {
  "GET /sectores": ok(SECTORES),
  "GET /accesos": ok(ACCESOS),
  "GET /centros": ok({ centros: [] }),
  "GET /estaciones": ok({ estaciones: [] }),
};

describe("acceso por rol", () => {
  it("un ciudadano que pide una página del panel vuelve a su cuenta", async () => {
    conSesion("ciudadano", { "GET /mi/grupo-familiar": ok({}) });
    renderRuta("/comando/mapa");
    expect(await screen.findByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.queryByText("Panel operativo")).not.toBeInTheDocument();
  });

  it("solo el admin entra a /admin: un operador es redirigido al panel", async () => {
    conSesion("operador", { "GET /serie/formosa": ok({ umbrales: {}, picos: [], puntos: [], notas: [], n: 0 }) });
    renderRuta("/admin");
    expect(await screen.findByRole("heading", { name: /Monitor hidrométrico/ })).toBeInTheDocument();
  });
});

describe("órdenes", () => {
  const rutasOrdenes: Rutas = { "GET /ordenes": ok({ ordenes: [] }) };

  it("el operador ve el formulario deshabilitado con su explicación", async () => {
    conSesion("operador", rutasOrdenes);
    renderRuta("/comando/ordenes");
    expect(await screen.findByTestId("aviso-solo-decisor")).toHaveTextContent("Solo el decisor puede emitir órdenes");
    expect(screen.getByLabelText("Tipo de orden")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revisar y emitir orden" })).toBeDisabled();
  });

  it("el decisor confirma y emite; luego puede abrir el borrador de bitácora", async () => {
    const f = conSesion("decisor", {
      ...rutasOrdenes,
      "POST /ordenes": () => ({
        estado: 201,
        json: { id: 7, tipo: "evacuacion_preventiva", sectores: ["S4"], emitida_por_rol: "defensa_civil", fundamento: "x", creada_en: "2026-11-18T10:00:00Z", notificaciones_creadas: 3, tareas_creadas: 2, bitacora_borrador_id: 12 },
      }),
    });
    renderRuta("/comando/ordenes");
    const emitir = await screen.findByRole("button", { name: "Revisar y emitir orden" });
    expect(screen.queryByTestId("aviso-solo-decisor")).not.toBeInTheDocument();
    expect(emitir).toBeEnabled();

    // Sin sector ni fundamento no se llama al backend.
    fireEvent.click(emitir);
    expect(await screen.findByText("Elegí al menos un sector.")).toBeInTheDocument();
    expect(llamadas(f, "POST /ordenes")).toHaveLength(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "S4" }));
    fireEvent.change(screen.getByLabelText(/^Fundamento/), { target: { value: "Compromiso previsto de S4 antes de la alerta." } });
    fireEvent.click(emitir);
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent("evacuación preventiva");
    expect(llamadas(f, "POST /ordenes")).toHaveLength(0); // todavía no: falta confirmar
    fireEvent.click(within(dialogo).getByRole("button", { name: "Emitir orden" }));

    const resultado = await screen.findByTestId("orden-emitida");
    expect(resultado).toHaveTextContent("3 notificaciones y 2 tareas");
    const [, init] = llamadas(f, "POST /ordenes")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ tipo: "evacuacion_preventiva", sectores: ["S4"] });
    expect(within(resultado).getByRole("link", { name: "Completar el borrador de bitácora" })).toHaveAttribute("href", "/comando/bitacora?borrador=12");
  });
});

describe("mapa y simulador", () => {
  it("el escenario de §8.1 muestra S4 comprometido y aislado, y envía los valores elegidos", async () => {
    const f = conSesion("operador", { ...RUTAS_MAPA, "POST /simulacion/escenario": ok(ESCENARIO_8_1) });
    renderRuta("/comando/mapa");
    const altura = await screen.findByLabelText(/Altura de Puerto Formosa/);
    fireEvent.change(altura, { target: { value: "7.6" } });
    fireEvent.change(screen.getByLabelText(/^Lluvia:/), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular escenario" }));

    const s4 = await screen.findByTestId("sector-S4");
    expect(s4).toHaveTextContent("comprometido");
    expect(s4).toHaveTextContent("aislado");
    expect(s4).toHaveTextContent("0,70 (SIMULADO)");
    expect(screen.getByTestId("sector-S2")).toHaveTextContent("normal");
    expect(screen.getByTestId("sector-S2")).not.toHaveTextContent("aislado");
    expect(screen.getByTestId("sector-S1")).toHaveTextContent("en riesgo");
    expect(screen.getByTestId("resultado-rio")).toHaveTextContent("0,20 m de la alerta");
    const [, init] = llamadas(f, "POST /simulacion/escenario")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ altura_formosa_m: 7.6, lluvia_mm: 40, lluvia_origen: "simulado", caminos_cerrados: [] });
  });

  it("si se mueven los controles después de calcular, el resultado queda marcado como desactualizado", async () => {
    const f = conSesion("operador", { ...RUTAS_MAPA, "POST /simulacion/escenario": ok(ESCENARIO_8_1) });
    renderRuta("/comando/mapa");
    fireEvent.change(await screen.findByLabelText(/Altura de Puerto Formosa/), { target: { value: "7.6" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular escenario" }));
    await screen.findByTestId("sector-S4");
    expect(screen.queryByTestId("resultado-desactualizado")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Altura de Puerto Formosa/), { target: { value: "8.2" } });
    const aviso = await screen.findByTestId("resultado-desactualizado");
    expect(aviso).toHaveTextContent("Resultado desactualizado");
    fireEvent.click(within(aviso).getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByTestId("resultado-desactualizado")).not.toBeInTheDocument());
  });

  it("marcar un acceso como no transitable llama a PATCH con el motivo", async () => {
    const f = conSesion("operador", { ...RUTAS_MAPA, "PATCH /accesos/1": ok({}) });
    renderRuta("/comando/mapa");
    fireEvent.click(await screen.findByRole("button", { name: /Camino de tierra a S4 · tierra · transitable/ }));
    const panel = await screen.findByTestId("panel-acceso");

    // Sin motivo no se llama al backend.
    fireEvent.click(within(panel).getByRole("button", { name: "Marcar no transitable" }));
    expect(await within(panel).findByText("Indicá el motivo (al menos 3 caracteres).")).toBeInTheDocument();
    expect(llamadas(f, "PATCH /accesos/1")).toHaveLength(0);

    fireEvent.change(within(panel).getByLabelText(/^Motivo/), { target: { value: "Anegado por la lluvia" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Marcar no transitable" }));
    await waitFor(() => expect(llamadas(f, "PATCH /accesos/1")).toHaveLength(1));
    const [, init] = llamadas(f, "PATCH /accesos/1")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ transitable: false, motivo: "Anegado por la lluvia" });
  });
});

describe("bitácora K8", () => {
  const vacia: Parameters<typeof validarBitacora>[0] = { decision: "", evidencia: "", limites: "", riesgos: "", gatillos: "", responsable_rol: "", fecha_simulada: "" };

  it("exige los seis campos (campos vacíos o solo espacios)", () => {
    expect(Object.keys(validarBitacora(vacia)).sort()).toEqual(["decision", "evidencia", "fecha_simulada", "gatillos", "limites", "responsable_rol", "riesgos"]);
    const completa = { decision: "Evacuar S4", evidencia: "K1 y K3", limites: "Sin lluvia observada", riesgos: "Falsa alarma", gatillos: "7,80 m (K3)", responsable_rol: "defensa_civil", fecha_simulada: "2026-11-17" };
    expect(validarBitacora(completa)).toEqual({});
    expect(validarBitacora({ ...completa, riesgos: "   " })).toHaveProperty("riesgos");
  });

  it("el formulario vacío muestra los errores y no llama al backend", async () => {
    const f = conSesion("decisor", { "GET /bitacora": ok({ entradas: [] }) });
    renderRuta("/comando/bitacora");
    fireEvent.click(await screen.findByRole("button", { name: "Registrar decisión" }));
    expect(await screen.findByText("Decisión: es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("Evidencia: es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("Gatillos de cambio: es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("Fecha (día simulado): es obligatoria.")).toBeInTheDocument();
    expect(llamadas(f, "POST /bitacora")).toHaveLength(0);
  });

  it("completa un borrador con PATCH cuando los seis campos están cargados", async () => {
    const borrador = { id: 12, estado: "borrador", decision: "Evacuación preventiva de S4", evidencia: "", limites: "", riesgos: "", gatillos: "", responsable_rol: null, fecha_simulada: "2026-11-18", orden_id: 7, creada_en: "2026-11-18T10:00:00Z" };
    const f = conSesion("decisor", { "GET /bitacora": ok({ entradas: [borrador] }), "PATCH /bitacora/12": ok({ ...borrador, estado: "completa" }) });
    renderRuta("/comando/bitacora?borrador=12");
    expect(await screen.findByText(/Completar el borrador 12/)).toBeInTheDocument();
    const campos: Record<string, string> = { Evidencia: "K1 y K3 al 31/10", Límites: "Sin lluvia observada", Riesgos: "Falsa alarma frente a demora", "Gatillos de cambio": "7,80 m (K3)", "Responsable (rol)": "defensa_civil" };
    for (const [etiqueta, valor] of Object.entries(campos)) fireEvent.change(screen.getByLabelText(new RegExp(`^${etiqueta.replace(/[()]/g, "\\$&")}`)), { target: { value: valor } });
    fireEvent.click(screen.getByRole("button", { name: "Completar borrador" }));
    await waitFor(() => expect(llamadas(f, "PATCH /bitacora/12")).toHaveLength(1));
    const [, init] = llamadas(f, "PATCH /bitacora/12")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ decision: "Evacuación preventiva de S4", responsable_rol: "defensa_civil", fecha_simulada: "2026-11-18" });
  });
});

describe("tiempo real", () => {
  it("envía el token solo como primer mensaje y muestra los eventos como avisos", async () => {
    conSesion("operador", { "GET /meta": ok({ leyenda: "x", categorias: [], limites: ["Sin lluvia observada"], fecha_corte: "2026-10-31", flags: { permitir_datos_post_corte: false } }) });
    renderRuta("/comando/limites");
    await waitFor(() => expect(FakeWS.instancias).toHaveLength(1));
    const ws = FakeWS.instancias[0];
    expect(ws.url).toMatch(/^ws:\/\/localhost:8000\/api\/v1\/ws$/);
    expect(ws.url).not.toContain("tok-en-memoria");
    act(() => ws.onopen?.());
    expect(ws.sent).toEqual([JSON.stringify({ token: "tok-en-memoria" })]);
    act(() => ws.onmessage?.({ data: JSON.stringify({ tipo: "conectado" }) }));
    expect(await screen.findByText("Tiempo real conectado")).toBeInTheDocument();
    act(() => ws.onmessage?.({ data: JSON.stringify({ tipo: "orden", datos: { id: 7, tipo: "evacuacion_preventiva", sectores: ["S4"] } }) }));
    expect(await screen.findByText("Orden emitida")).toBeInTheDocument();
  });

  it("al renovarse el token cierra la conexión vieja y abre otra con el token nuevo; un cierre 1008 no reintenta", async () => {
    const alEvento = vi.fn();
    const { rerender } = renderHook(({ t }: { t: string | null }) => useTiempoReal(t, alEvento), { initialProps: { t: "token-a" as string | null } });
    act(() => FakeWS.instancias[0].onopen?.());
    expect(FakeWS.instancias[0].sent).toEqual([JSON.stringify({ token: "token-a" })]);

    rerender({ t: "token-b" });
    expect(FakeWS.instancias[0].closed).toBe(true);
    expect(FakeWS.instancias).toHaveLength(2);
    act(() => FakeWS.instancias[1].onopen?.());
    expect(FakeWS.instancias[1].sent).toEqual([JSON.stringify({ token: "token-b" })]);

    // Un cierre 1008 (token vencido) no reintenta enseguida: renueva el token y reconecta con espera creciente.
    vi.useFakeTimers();
    act(() => FakeWS.instancias[1].onclose?.({ code: 1008 }));
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWS.instancias).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    expect(FakeWS.instancias).toHaveLength(3);
  });

  it("la espera de reconexión crece de forma exponencial y tiene tope", () => {
    expect(esperaReintento(0, 0.5)).toBe(1000);
    expect(esperaReintento(1, 0.5)).toBe(2000);
    expect(esperaReintento(3, 0.5)).toBe(8000);
    expect(esperaReintento(20, 0.5)).toBe(30_000);
  });

  it("sin token no abre conexión", () => {
    renderHook(() => useTiempoReal(null, vi.fn()));
    expect(FakeWS.instancias).toHaveLength(0);
  });
});

describe("monitor y Centinela", () => {
  it("el monitor muestra la última lectura y los umbrales con su categoría, y el supuesto lineal", async () => {
    conSesion("operador", {
      "GET /serie/formosa": ok({
        umbrales: { aguas_bajas_m: 1.6, alerta_m: 7.8, evacuacion_m: 8.3, categoria: "DATO OBSERVADO", fuente: "K3" },
        picos: [{ anio: 2016, altura_m: 9.81, fecha: "2016-01-05" }],
        maximo: { altura_m: 9.81, fecha: "2016-01-05" },
        ultima: { fecha: "2026-10-31", altura_m: 5.6 },
        n: 2,
        puntos: [{ fecha: "2026-10-30", altura_max_m: 5.5 }, { fecha: "2026-10-31", altura_max_m: 5.6 }],
        notas: ["Los días sin dato no se interpolan."],
        categoria: "DATO OBSERVADO",
        fuente: "K1",
        fecha_dato: "2026-10-31",
      }),
      "GET /serie/ascenso": ok({
        altura_actual_m: 5.6,
        fecha_altura: "2026-10-31",
        periodos: [],
        tasas_m_dia: {},
        tiempo_restante: [{ objetivo: "Alerta (K3)", valor_m: 7.8, categoria_del_umbral: "DATO OBSERVADO", ya_alcanzado: false, dias_minimo: 6.1, dias_maximo: 20.4 }],
        supuesto: "Proyección lineal a tasa constante: es un SUPUESTO, no un pronóstico.",
        horizonte_pronostico_oficial_dias: 15,
        categoria_proyeccion: "SIMULADO",
        categoria: "DATO OBSERVADO",
        fuente: "K1",
        fecha_dato: "2026-10-31",
      }),
      "GET /lluvia": ok({ lecturas: [], n: 0, sin_dato_observado: true, nota: "" }),
    });
    renderRuta("/comando");
    const ultima = await screen.findByTestId("monitor-ultima");
    expect(ultima).toHaveTextContent("5,60 m");
    expect(within(ultima.parentElement as HTMLElement).getByText("DATO OBSERVADO")).toBeInTheDocument();
    expect(screen.getByTestId("monitor-alerta")).toHaveTextContent("7,80 m");
    expect(await screen.findByText("6 a 20 días")).toBeInTheDocument();
    expect(screen.getByTestId("supuesto-lineal")).toHaveTextContent("es un SUPUESTO, no un pronóstico");
    expect(await screen.findByText(/Sin dato observado en el kit y todavía no se cargó/)).toBeInTheDocument();
  });

  it("Centinela muestra los veredictos de K6 y K7, incluidos los no verificables con la capa", async () => {
    conSesion("operador", {
      "GET /verificador/k6": ok({
        informe: "K6",
        nota: "n",
        afirmaciones: [{ id: "K6-3", afirmacion: "En 2016 llegó a 10,7 m", veredicto: "REFUTADA", evidencia: "El máximo de 2016 en K1 es 9,81 m", fuente: "K1", categoria: "DATO OBSERVADO" }],
      }),
      "GET /verificador/k7": ok({
        esquema: "K7",
        nota: "n",
        relaciones: [
          { id: "K7-4", relacion: "El Paraná recibe al Paraguay", veredicto: "NO VERIFICABLE CON LA CAPA DISPONIBLE", correccion: "La capa de Formosa no incluye el río Paraná.", fuente: "x", verificado_con: "no verificable con la capa disponible", categoria: "DOCUMENTO DE REFERENCIA", evidencia_cartografica: null },
          { id: "K7-2", relacion: "El Pilcomayo desemboca en el Bermejo", veredicto: "FALSA", correccion: "Desemboca en el Paraguay.", fuente: "IGN", verificado_con: "IGN cursos de agua (calculado)", categoria: "DOCUMENTO DE REFERENCIA", evidencia_cartografica: "Están a 142,1 km." },
        ],
      }),
    });
    renderRuta("/comando/centinela");
    expect(await screen.findByTestId("k6-K6-3")).toHaveTextContent("REFUTADA");
    expect(await screen.findByTestId("k7-K7-4")).toHaveTextContent("NO VERIFICABLE CON LA CAPA DISPONIBLE");
    expect(screen.getByTestId("k7-K7-2")).toHaveTextContent("Están a 142,1 km.");
  });
});
