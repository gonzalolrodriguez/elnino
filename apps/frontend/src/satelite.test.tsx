import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import type { CatalogoSatelite, EscenaSatelite } from "./panel/satelite";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

// El mapa real necesita WebGL: la prueba lo reemplaza por un componente que solo guarda las propiedades que recibe.
const mapa = vi.hoisted(() => ({ ultimo: null as null | { satelite?: { archivo: string | null; zona: number[] | null } } }));
vi.mock("./panel/MapaGL", () => ({
  default: (p: { satelite?: { archivo: string | null; zona: number[] | null } }) => {
    mapa.ultimo = p;
    return null;
  },
}));

const e = (fecha: string, sensor: "Sentinel-1" | "Sentinel-2", area: number, k1: number, nube: number | null, cobertura: number): EscenaSatelite => ({
  id: `${sensor === "Sentinel-1" ? "s1" : "s2"}_${fecha}`,
  fecha,
  sensor,
  tipo: sensor === "Sentinel-1" ? "radar" : "óptico",
  area_agua_km2: area,
  altura_k1_m: k1,
  fecha_k1: fecha,
  nube_pct: nube,
  cobertura_aoi_pct: cobertura,
  evento: "Evento de prueba",
  archivo: `capas/satelite/agua_${sensor === "Sentinel-1" ? "s1" : "s2"}_${fecha}.geojson`,
});

// Desordenadas a propósito: la lista del selector sale ordenada por fecha.
const CATALOGO: CatalogoSatelite = {
  categoria: "DOCUMENTO DE REFERENCIA",
  fuente: "https://planetarycomputer.microsoft.com/api/stac/v1",
  licencia: "Copernicus Sentinel",
  fecha_descarga: "2026-11-20",
  fecha_corte: "2026-10-31",
  zona: [-58.4, -26.4, -57.95, -25.95],
  escenas: [
    e("2026-10-26", "Sentinel-2", 42.63, 5.44, 24.7, 47.1),
    e("2016-01-09", "Sentinel-1", 243.07, 9.8, null, 80.2),
    e("2016-01-23", "Sentinel-2", 208.22, 9.4, 0.1, 99.4),
    e("2019-05-28", "Sentinel-1", 277.6, 9.64, null, 100),
    e("2019-06-03", "Sentinel-2", 141.75, 9.72, 28.2, 46.4),
    e("2019-10-07", "Sentinel-1", 71.96, 2.07, null, 100),
    e("2019-10-09", "Sentinel-2", 67.13, 2.07, 0, 99.9),
    e("2026-10-25", "Sentinel-1", 79.84, 5.4, null, 100),
  ],
};

const ok = (json: unknown) => () => ({ estado: 200, json });
const RUTAS = {
  "POST /auth/refresh": () => sesion("operador"),
  "GET /sectores": ok({ type: "FeatureCollection", features: [] }),
  "GET /accesos": ok({ type: "FeatureCollection", features: [] }),
  "GET /centros": ok({ centros: [] }),
  "GET /estaciones": ok({ estaciones: [] }),
  "GET /capas/capas.json": ok({ capas: [] }),
  "GET /capas/satelite/escenas.json": ok(CATALOGO),
};

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
  mapa.ultimo = null;
});
afterEach(() => vi.unstubAllGlobals());

describe("capa de agua observada por satélite", () => {
  it("no pide nada hasta encenderla; al encenderla ofrece las 8 fechas y le pasa al mapa la escena elegida", async () => {
    const f = simularFetch(RUTAS);
    renderRuta("/comando/mapa");

    const casilla = await screen.findByRole("checkbox", { name: "Agua observada por satélite" });
    expect(casilla).not.toBeChecked();
    expect(llamadas(f, "GET /capas/satelite/escenas.json")).toHaveLength(0);
    expect(screen.queryByTestId("leyenda-satelite")).not.toBeInTheDocument();
    expect(mapa.ultimo?.satelite?.archivo ?? null).toBeNull();

    fireEvent.click(casilla);

    const selector = await screen.findByRole("combobox", { name: "Fecha de la imagen" });
    await waitFor(() => expect(llamadas(f, "GET /capas/satelite/escenas.json")).toHaveLength(1));
    const opciones = within(selector).getAllByRole("option");
    expect(opciones).toHaveLength(8);
    expect(opciones[0]).toHaveTextContent("09/01/2016 · Sentinel-1 radar");
    expect(opciones[7]).toHaveTextContent("26/10/2026 · Sentinel-2 óptico");

    // Por defecto, la última escena: Sentinel-2 del 26/10/2026 (nube 24,7 %, cobertura parcial).
    await waitFor(() => expect(mapa.ultimo?.satelite?.archivo).toBe("capas/satelite/agua_s2_2026-10-26.geojson"));
    const ficha = screen.getByTestId("satelite-escena");
    expect(ficha).toHaveTextContent("42,63 km²");
    expect(ficha).toHaveTextContent("24,7 %");
    expect(ficha).toHaveTextContent("47,1 % (área de agua parcial)");
    expect(screen.getByTestId("satelite-k1")).toHaveTextContent("5,44 m");
    expect(screen.getByTestId("satelite-k1")).toHaveTextContent("DATO OBSERVADO");

    // Otra fecha: el mapa recibe su GeoJSON y la ficha muestra el K1 de ese día; el radar no tiene nubes.
    fireEvent.change(selector, { target: { value: "s1_2016-01-09" } });
    await waitFor(() => expect(mapa.ultimo?.satelite?.archivo).toBe("capas/satelite/agua_s1_2016-01-09.geojson"));
    expect(screen.getByTestId("satelite-escena")).toHaveTextContent("no aplica (radar)");
    expect(screen.getByTestId("satelite-k1")).toHaveTextContent("9,80 m");

    const leyenda = screen.getByTestId("leyenda-satelite");
    expect(leyenda).toHaveTextContent("Imagen: Copernicus Sentinel-1/2 (Planetary Computer) · DOCUMENTO DE REFERENCIA");
    expect(leyenda).toHaveTextContent("puede confundir suelo húmedo, bañados o vegetación inundada");
    expect(leyenda).toHaveTextContent("áreas S1 y S2 no comparables entre sí");

    // Al apagarla, el mapa deja de recibir el archivo y la leyenda desaparece.
    fireEvent.click(screen.getByRole("checkbox", { name: "Agua observada por satélite" }));
    await waitFor(() => expect(mapa.ultimo?.satelite?.archivo ?? null).toBeNull());
    expect(screen.queryByTestId("leyenda-satelite")).not.toBeInTheDocument();
  });

  it("si la lista no carga, lo dice y permite reintentar", async () => {
    const f = simularFetch({ ...RUTAS, "GET /capas/satelite/escenas.json": () => ({ estado: 500, json: {} }) });
    renderRuta("/comando/mapa");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Agua observada por satélite" }));
    expect(await screen.findByText(/No se pudo cargar la lista de imágenes de satélite/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(llamadas(f, "GET /capas/satelite/escenas.json")).toHaveLength(2));
  });
});
