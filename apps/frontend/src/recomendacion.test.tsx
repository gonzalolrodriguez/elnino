import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

vi.mock("./panel/MapaGL", () => ({ default: () => null }));

class FakeWS {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  send() {}
  close() {}
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

function cuerpoEnviado(f: ReturnType<typeof simularFetch>): Record<string, unknown> | undefined {
  const [llamada] = llamadas(f, "POST /simulacion/recomendacion");
  const init = llamada?.[1] as RequestInit | undefined;
  return typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
}

const factibilidad = (veredicto: string, limitante: string, explicacion: string) => ({
  veredicto,
  plazo_minimo_h: 6,
  plazo_maximo_h: 6,
  limitante,
  tiempo_para_completar_h: 8,
  holgura_h: -2,
  iniciar_antes_de_h: -2,
  explicacion,
});

const RECOMENDACION = {
  etiqueta: "RECOMENDACIÓN, no es una orden",
  entrada: {},
  escenario: { rio: {}, resumen: {} },
  recomendacion: {
    orden_sectores: ["S1"],
    centros_excluidos: [],
    centros_descartados: [{ id: 9, nombre: "Escuela de prueba", motivo: "Dentro del sector S2, comprometido en este escenario." }],
    metricas: {
      personas_a_evacuar: 1200,
      personas_evacuadas: 1200,
      personas_sin_lugar: 0,
      animales_a_trasladar: 0,
      animales_con_cupo: 0,
      animales_sin_cupo: 0,
      viajes_por_vehiculo: { colectivo: 30 },
      camiones_jaula_necesarios: 0,
      tiempo_primer_sector_min: 480,
      tiempo_total_min: 480,
      accesos_vulnerables_usados: 1,
      sectores_no_alcanzan: 1,
      sectores_justos: 0,
      faltantes: {},
    },
    sectores: [
      {
        id: "S1",
        nombre: "Sector Norte",
        prioridad: 1,
        estado: "en_riesgo",
        aislado: false,
        poblacion: { familias_registradas: 0, personas_registradas: 0, total_estimada: 1200 },
        produccion: { establecimientos: [], bovinos: 0, colmenas: 0 },
        ventana: { ya_comprometido: false, dias_hasta_compromiso_minimo: 1.4, dias_hasta_compromiso_maximo: 4.6, supuesto: "lineal" },
        factibilidad: {
          personas: factibilidad("no_alcanza", "ventana_seca", "Termina en 8.0 h y el plazo es de 6.0 h a 6.0 h: no alcanza."),
          margen_seguridad_fraccion: 0.25,
          supuestos: [],
          categoria: "SIMULADO",
        },
        traslado_personas: { vehiculo: "colectivo", superficie_acceso: "ripio", viajes: 30, tiempo_inicio_min: 0, tiempo_acumulado_min: 480, metodo_tiempo: ["red_vial"] },
        asignacion_personas: [{ centro_id: 1, centro: "Centro 1", cantidad: 1200 }],
        personas_sin_lugar: 0,
        asignacion_animales: [],
        animales_sin_cupo: 0,
        camiones_jaula: 0,
        cuadrillas_sugeridas: [{ tipo: "humana", roles: [] }],
        familias: {
          registradas: 2,
          hogares_simulados: 340,
          personas_en_familias: 1207,
          juntas: 330,
          sin_lugar_entero: 12,
          personas_en_familias_sin_lugar: 40,
          tamanos_sin_lugar: [5, 4],
          nota: "",
        },
        advertencias: [],
      },
    ],
  },
  limites: ["El veredicto de factibilidad no es un pronóstico."],
  categoria: "SIMULADO",
  fuente: "prueba",
  fecha_dato: "2026-11-19",
};

describe("recomendador: factibilidad y ventana seca", () => {
  it("envía la lluvia prevista y muestra el veredicto con texto, el método y los centros descartados", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    const f = simularFetch({
      "POST /auth/refresh": () => sesion("decisor"),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
      "POST /simulacion/recomendacion": () => ({ estado: 200, json: RECOMENDACION }),
    });
    renderRuta("/comando/recomendacion");

    fireEvent.click(await screen.findByLabelText("Simular lluvia prevista"));
    fireEvent.click(screen.getByLabelText("Usar hogares simulados en los sectores de evaluación (K10)"));
    fireEvent.change(screen.getByLabelText("Milímetros"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Dentro de (horas)"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Generar recomendación" }));

    const tarjeta = await screen.findByTestId("plan-S1");
    const linea = within(tarjeta).getByTestId("factibilidad-personas");
    expect(within(linea).getByText("no alcanza")).toBeInTheDocument();
    expect(linea).toHaveTextContent("ventana seca");
    expect(tarjeta).toHaveTextContent("por la red vial (OSM)");
    expect(screen.getByTestId("centros-descartados")).toHaveTextContent("Escuela de prueba");
    expect(screen.getByText(/Sectores que no alcanzan/)).toBeInTheDocument();
    expect(screen.getByTestId("familias-S1")).toHaveTextContent("330 viajan y se alojan juntas");
    expect(screen.getByTestId("familias-S1")).toHaveTextContent("no se las separa");

    await waitFor(() => expect(cuerpoEnviado(f)?.pronostico_lluvia).toEqual({ mm: 100, horas: 6 }));
    expect(cuerpoEnviado(f)?.poblacion_k10_en_hogares).toBe(true);
  });

  it("«Preparar orden con estos sectores» lleva a Órdenes con los sectores de la recomendación precargados", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    simularFetch({
      "POST /auth/refresh": () => sesion("decisor"),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
      "GET /ordenes": () => ({ estado: 200, json: { ordenes: [] } }),
      "POST /simulacion/recomendacion": () => ({ estado: 200, json: RECOMENDACION }),
    });
    renderRuta("/comando/recomendacion");
    fireEvent.click(await screen.findByRole("button", { name: "Generar recomendación" }));
    const boton = await screen.findByRole("link", { name: "Preparar orden con estos sectores" });
    expect(boton).toHaveAttribute("href", "/comando/ordenes?sectores=S1");
    fireEvent.click(boton);
    const s1 = await screen.findByRole("checkbox", { name: "S1" });
    expect(s1).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "S4" })).not.toBeChecked();
  });

  it("no manda la lluvia prevista si está desactivada o es inválida", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    const f = simularFetch({
      "POST /auth/refresh": () => sesion("operador"),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
      "POST /simulacion/recomendacion": () => ({ estado: 200, json: RECOMENDACION }),
    });
    renderRuta("/comando/recomendacion");

    fireEvent.click(await screen.findByLabelText("Simular lluvia prevista"));
    fireEvent.change(screen.getByLabelText("Dentro de (horas)"), { target: { value: "0" } });
    expect(screen.getByText(/mayores que cero/)).toHaveAttribute("role", "alert");
    fireEvent.click(screen.getByRole("button", { name: "Generar recomendación" }));
    await screen.findByTestId("plan-S1");
    expect(cuerpoEnviado(f)).not.toHaveProperty("pronostico_lluvia");
    expect(cuerpoEnviado(f)).not.toHaveProperty("poblacion_k10_en_hogares");
  });
});
