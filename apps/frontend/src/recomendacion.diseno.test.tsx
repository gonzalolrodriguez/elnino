import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { renderRuta, sesion, simularFetch } from "./test/utils";

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

const fact = (veredicto: string, holgura: number) => ({
  veredicto,
  plazo_minimo_h: 6,
  plazo_maximo_h: 6,
  limitante: "rio",
  tiempo_para_completar_h: 6 - holgura,
  holgura_h: holgura,
  iniciar_antes_de_h: holgura,
  explicacion: "Explicación de prueba.",
});

const sector = (id: string, prioridad: number, veredicto: string, holgura: number) => ({
  id,
  nombre: `Sector ${id}`,
  prioridad,
  estado: "en_riesgo",
  aislado: false,
  poblacion: { familias_registradas: 0, personas_registradas: 0, total_estimada: 100 },
  produccion: { establecimientos: [], bovinos: 0, colmenas: 0 },
  ventana: { ya_comprometido: false, dias_hasta_compromiso_minimo: 2, dias_hasta_compromiso_maximo: 4, supuesto: "lineal" },
  factibilidad: { personas: fact(veredicto, holgura), margen_seguridad_fraccion: 0.25, supuestos: [], categoria: "SIMULADO" },
  traslado_personas: { vehiculo: "colectivo", superficie_acceso: "ripio", viajes: 3 },
  asignacion_personas: [{ centro_id: 1, centro: "Centro 1", cantidad: 100 }],
  personas_sin_lugar: 0,
  asignacion_animales: [],
  animales_sin_cupo: 0,
  camiones_jaula: 0,
  cuadrillas_sugeridas: [{ tipo: "humana", roles: [] }],
  advertencias: [],
});

const metricas = {
  personas_a_evacuar: 200,
  personas_evacuadas: 200,
  personas_sin_lugar: 0,
  animales_a_trasladar: 0,
  animales_con_cupo: 0,
  animales_sin_cupo: 0,
  viajes_por_vehiculo: {},
  camiones_jaula_necesarios: 0,
  tiempo_primer_sector_min: 60,
  tiempo_total_min: 60,
  accesos_vulnerables_usados: 0,
  faltantes: {},
};

const plan = (sectores: unknown[]) => ({ orden_sectores: [], centros_excluidos: [], metricas, sectores });

describe("recomendador: lectura clara por sector y comparador", () => {
  it("cada sector muestra su veredicto con texto y el margen de tiempo como cifra", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    simularFetch({
      "POST /auth/refresh": () => sesion("decisor"),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
      "POST /simulacion/recomendacion": () => ({
        estado: 200,
        json: {
          etiqueta: "RECOMENDACIÓN, no es una orden",
          entrada: {},
          escenario: { rio: {}, resumen: {} },
          recomendacion: plan([sector("S1", 1, "no_alcanza", -2), sector("S3", 2, "alcanza", 3)]),
          limites: ["Un límite de prueba."],
          categoria: "SIMULADO",
          fuente: "prueba",
          fecha_dato: "2026-11-19",
        },
      }),
    });
    renderRuta("/comando/recomendacion");
    fireEvent.click(await screen.findByRole("button", { name: "Generar recomendación" }));

    const t1 = await screen.findByTestId("plan-S1");
    const f1 = within(t1).getByTestId("factibilidad-personas");
    expect(within(f1).getByText("no alcanza")).toBeInTheDocument();
    expect(f1).toHaveTextContent("Déficit");
    expect(f1).toHaveTextContent("−2,0 h");

    const f3 = within(screen.getByTestId("plan-S3")).getByTestId("factibilidad-personas");
    expect(within(f3).getByText("alcanza a tiempo")).toBeInTheDocument();
    expect(f3).toHaveTextContent("Margen");
    expect(f3).toHaveTextContent("+3,0 h");

    // Supuestos y método quedan plegados en cada tarjeta.
    expect(within(t1).getByText(/Supuestos y método/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preparar orden con estos sectores" })).toHaveAttribute("href", "/comando/ordenes?sectores=S1,S3");
  });

  it("el comparador destaca el mejor valor de cada fila con ícono y texto, y no destaca los empates", async () => {
    window.localStorage.setItem("e3_sesion", "1");
    const alt = (id: number, nombre: string) => ({ ...plan([]), id, tipo: "riesgo", nombre, parametros: {} });
    simularFetch({
      "POST /auth/refresh": () => sesion("operador"),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
      "POST /simulacion/alternativas": () => ({
        estado: 200,
        json: {
          etiqueta: "COMPARACIÓN",
          alternativas: [alt(1, "Alternativa A · por riesgo"), alt(2, "Alternativa B · por población")],
          comparacion: [
            { metrica: "personas_evacuadas", etiqueta: "Personas con lugar en centros", valores: [100, 90] },
            { metrica: "personas_sin_lugar", etiqueta: "Personas sin lugar", valores: [50, 10] },
            { metrica: "tiempo_total_min", etiqueta: "Minutos totales", valores: [60, 60] },
            { metrica: "viajes_por_vehiculo", etiqueta: "Viajes por tipo de vehículo", valores: [{ colectivo: 5 }, { colectivo: 9 }] },
          ],
          categoria: "SIMULADO",
          fuente: "prueba",
          fecha_dato: "2026-11-19",
        },
      }),
    });
    renderRuta("/comando/recomendacion");
    fireEvent.click(await screen.findByRole("button", { name: "Comparar alternativas" }));

    const tabla = await screen.findByRole("table", { name: "Comparación de alternativas lado a lado" });
    const mejores = (metrica: string) => {
      const fila = within(tabla).getByText(metrica).closest("tr") as HTMLElement;
      return Array.from(fila.querySelectorAll("td[data-mejor]")).map((c) => c.textContent);
    };
    expect(mejores("Personas con lugar en centros")).toEqual(["Mejor valor de la fila: 100"]);
    expect(mejores("Personas sin lugar")).toEqual(["Mejor valor de la fila: 10"]);
    expect(mejores("Minutos totales")).toEqual([]);
    expect(mejores("Viajes por tipo de vehículo")).toEqual([]);
    expect(within(tabla).getAllByText(/Mejor en 1 de 2/)).toHaveLength(2);
  });
});
