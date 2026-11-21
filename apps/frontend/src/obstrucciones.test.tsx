import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { puntosCorte } from "./panel/capasLamina";
import type { Geo } from "./panel/tipos";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

// El mapa real necesita WebGL: se reemplaza por un componente vacío.
vi.mock("./panel/MapaGL", () => ({ default: () => null }));

const ACCESOS: Geo = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "LineString", coordinates: [[-58.15, -26.18], [-58.14, -26.18], [-58.13, -26.18]] }, properties: { id: 6, sector_id: "S4", nombre: "Acceso SIMULADO S4-A", superficie: "tierra", transitable: true, motivo: null, actualizado_en: "2026-11-17T00:00:00Z", actualizado_por_rol: null } },
    { type: "Feature", geometry: { type: "LineString", coordinates: [[-58.19, -26.16], [-58.18, -26.15]] }, properties: { id: 1, sector_id: "S1", nombre: "Acceso SIMULADO S1-A", superficie: "ripio", transitable: true, motivo: null, actualizado_en: "2026-11-17T00:00:00Z", actualizado_por_rol: null } },
  ],
};
const SECTORES: Geo = {
  type: "FeatureCollection",
  features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-58.15, -26.192], [-58.128, -26.192], [-58.128, -26.168], [-58.15, -26.168], [-58.15, -26.192]]] }, properties: { id: "S4", nombre: "Sector Rural Este" } }],
};
const CENTRO = { id: 3, nombre: "Centro SIMULADO", tipo: "escuela", lon: -58.17, lat: -26.19, sector_id: null, capacidad_personas: 400, capacidad_animales: 0, ocupacion: 0, cupo_libre_personas: 400, servicios: null, nota: null, categoria: "SIMULADO" };

const escenario = (aislados: string[]) => ({
  rio: { estado: "normal", altura_m: 7.6, distancia_a_alerta_m: 0.2, distancia_a_evacuacion_m: 0.7 },
  sectores: [],
  resumen: { comprometidos: ["S4"], en_riesgo: [], normales: [], aislados },
  lluvia: { mm: 0, origen: "simulado", categoria: "SIMULADO" },
  categoria: "SIMULADO",
  fuente: "x",
  fecha_dato: "2026-10-31",
});
const ruta = (encontrada: boolean) => ({
  perfil: "vehicular",
  encontrada,
  metodo: "aproximado",
  limitacion: null,
  motivo: encontrada ? undefined : "Sin accesos transitables",
  distancia_m: encontrada ? 10100 : undefined,
  tiempo_min: encontrada ? 20 : undefined,
  geometria: null,
  advertencias: [],
  origen: { lon: -58.139, lat: -26.18, sector_id: "S4" },
  destino: { lon: -58.17, lat: -26.19 },
  categoria: "SIMULADO",
});

class FakeWS {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  send() {}
  close() {}
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeWS);
  window.localStorage.clear();
  window.localStorage.setItem("e3_sesion", "1");
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("realce de accesos cortados", () => {
  it("marca el punto medio solo de los accesos cortados (simulación, escenario u operador)", () => {
    expect(puntosCorte(ACCESOS, {}, [])).toEqual([]);
    expect(puntosCorte(ACCESOS, {}, [6])).toEqual([{ id: 6, posicion: [-58.14, -26.18] }]);
    expect(puntosCorte(ACCESOS, { 1: "intransitable_lluvia" }, []).map((m) => m.id)).toEqual([1]);
  });
});

describe("obstrucciones en vivo", () => {
  it("cerrar un acceso en la simulación recalcula el escenario y la ruta trazada, y avisa qué cambió", async () => {
    let nEscenario = 0;
    let nRuta = 0;
    const f = simularFetch({
      "POST /auth/refresh": () => sesion("operador"),
      "GET /sectores": () => ({ estado: 200, json: SECTORES }),
      "GET /accesos": () => ({ estado: 200, json: ACCESOS }),
      "GET /centros": () => ({ estado: 200, json: { centros: [CENTRO] } }),
      "GET /estaciones": () => ({ estado: 200, json: { estaciones: [] } }),
      "GET /capas/capas.json": () => ({ estado: 200, json: { capas: [] } }),
      "POST /simulacion/escenario": () => ({ estado: 200, json: escenario(nEscenario++ === 0 ? [] : ["S4"]) }),
      "POST /ruteo": () => ({ estado: 200, json: ruta(nRuta++ === 0) }),
    });
    renderRuta("/comando/mapa");

    // 1) Escenario calculado y ruta trazada desde S4.
    fireEvent.click(await screen.findByRole("button", { name: "Calcular escenario" }));
    await waitFor(() => expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(1));
    fireEvent.change(await screen.findByLabelText("Destino"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Trazar ruta" }));
    await screen.findByText(/10,1 km · 20 min/);

    // 2) Cerrar el acceso de S4 solo en la simulación (desde la lista de caminos del simulador).
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Acceso SIMULADO S4-A/ })[0]);

    const aviso = await screen.findByText(/Quedan aislados: S4/);
    expect(aviso).toBeInTheDocument();
    expect(await screen.findByText(/Ruta recalculada: sin ruta disponible \(Sin accesos transitables\) \(antes: 10,1 km · 20 min\)/)).toBeInTheDocument();
    const [, cuerpoEsc] = llamadas(f, "POST /simulacion/escenario")[1] as [string, RequestInit];
    expect(JSON.parse(cuerpoEsc.body as string)).toMatchObject({ caminos_cerrados: [6] });
    const [, cuerpoRuta] = llamadas(f, "POST /ruteo")[1] as [string, RequestInit];
    expect(JSON.parse(cuerpoRuta.body as string)).toMatchObject({ centro_id: 3, caminos_cerrados: [6] });
    }, 20_000);

  it("sin escenario calculado ni ruta, cerrar un acceso no consulta al backend", async () => {
    const f = simularFetch({
      "POST /auth/refresh": () => sesion("operador"),
      "GET /sectores": () => ({ estado: 200, json: SECTORES }),
      "GET /accesos": () => ({ estado: 200, json: ACCESOS }),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
      "GET /estaciones": () => ({ estado: 200, json: { estaciones: [] } }),
      "GET /capas/capas.json": () => ({ estado: 200, json: { capas: [] } }),
    });
    renderRuta("/comando/mapa");
    fireEvent.click((await screen.findAllByRole("checkbox", { name: /Acceso SIMULADO S4-A/ }))[0]);
    await new Promise((r) => setTimeout(r, 50));
    expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(0);
    expect(screen.queryByTestId("aviso-recalculo")).not.toBeInTheDocument();
  });
});
