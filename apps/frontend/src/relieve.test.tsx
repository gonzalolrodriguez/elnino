import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapaSectores } from "./informacion/MapaSectores";
import { CuencaSVG } from "./landing/CuencaSVG";
import { fijarToken } from "./lib/api";
import {
  colorRampa,
  decodificarMalla,
  elevEn,
  EXAGERACION_VERTICAL,
  marcasLeyenda,
  type ColeccionGeo,
  type DatosRelieve,
  type MetaRelieve,
} from "./relieve/datos";
import { LeyendaRelieve } from "./relieve/LeyendaRelieve";
import { renderRuta, simularFetch } from "./test/utils";
import { theme } from "./theme";

const leer = (a: string) => JSON.parse(readFileSync(resolve(process.cwd(), "public", "relieve", a), "utf-8"));
const datos = (): DatosRelieve => ({
  meta: leer("meta.json") as MetaRelieve,
  curvas: leer("curvas_cuenca.geojson") as ColeccionGeo,
  rio: leer("rio_paraguay.geojson") as ColeccionGeo,
  departamentos: leer("departamentos.geojson") as ColeccionGeo,
  provincia: leer("provincia.geojson") as ColeccionGeo,
});

/** fetch que sirve los archivos reales de public/relieve y delega lo demás al simulador de la API. */
function simularConRelieve() {
  const api = simularFetch();
  const f = vi.fn((url: string, init?: RequestInit) => {
    const m = /\/relieve\/([^?]+)$/.exec(url);
    if (m && /\.(json|geojson)$/.test(m[1])) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(leer(m[1])) });
    return api(url, init);
  });
  vi.stubGlobal("fetch", f);
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("datos de relieve generados", () => {
  it.each(["curvas_cuenca.geojson", "curvas_local.geojson"])("%s: cada curva de nivel trae elev_m y la marca de maestra", (archivo) => {
    const fc = leer(archivo) as ColeccionGeo;
    expect(fc.features.length).toBeGreaterThan(5);
    const niveles = fc.features.map((f) => f.properties.elev_m as number);
    for (const f of fc.features) {
      expect(typeof f.properties.elev_m).toBe("number");
      expect(typeof f.properties.maestra).toBe("boolean");
      expect(["LineString", "MultiLineString"]).toContain(f.geometry.type);
    }
    expect([...niveles].sort((a, b) => a - b)).toEqual(niveles);
  });

  it("las curvas locales respetan el intervalo declarado en el metadato", () => {
    const meta = leer("meta.json") as MetaRelieve;
    for (const f of (leer("curvas_local.geojson") as ColeccionGeo).features) {
      expect(Number(f.properties.elev_m) % meta.local.intervalo_m).toBe(0);
    }
  });

  it("la malla decodifica dentro del rango declarado y Puerto Formosa queda en la llanura", () => {
    const malla = decodificarMalla(leer("dem_cuenca_malla.json"));
    expect(malla.z.length).toBe(malla.nx * malla.ny);
    expect(Math.min(...malla.z)).toBeGreaterThanOrEqual(malla.min - 0.2);
    expect(Math.max(...malla.z)).toBeLessThanOrEqual(malla.max + 0.2);
    const formosa = elevEn(malla, -58.183, -26.183);
    expect(formosa).toBeGreaterThan(40);
    expect(formosa).toBeLessThan(120);
    expect(elevEn(malla, -55.1, -14.5)).toBeGreaterThan(formosa);
  });

  it("la rampa interpola entre paradas y la leyenda usa los extremos reales", () => {
    const { cuenca } = leer("meta.json") as MetaRelieve;
    expect(colorRampa(cuenca.rampa, 0)).toBe(cuenca.rampa[0][1]);
    expect(colorRampa(cuenca.rampa, 100)).toBe(cuenca.rampa.find((p) => p[0] === 100)?.[1]);
    const marcas = marcasLeyenda(cuenca.rampa, cuenca.min_m, cuenca.max_m, [100]);
    expect(marcas[0].valor).toBe(cuenca.min_m);
    expect(marcas[marcas.length - 1].valor).toBe(cuenca.max_m);
    expect(marcas[marcas.length - 1].pos).toBe(1);
  });
});

describe("respaldo 2D del relieve", () => {
  it("dibuja los nueve departamentos de Formosa desde los datos, con su nombre", () => {
    const d = datos();
    const { container } = render(<CuencaSVG datos={d} />);
    expect(container.querySelectorAll("path[data-departamento]")).toHaveLength(9);
    const nombres = d.departamentos.features.map((f) => String(f.properties.nombre));
    expect(nombres).toContain("Pilcomayo");
    for (const n of nombres) expect(container.querySelector(`text[data-rotulo-departamento="${n}"]`)).not.toBeNull();
    expect(container.querySelector('path[data-capa="provincia"]')).not.toBeNull();
    expect(container.querySelector('path[data-capa="rio"]')).not.toBeNull();
  });

  it("dibuja las curvas de nivel (menores y maestras) y el tinte hipsométrico", () => {
    const { container } = render(<CuencaSVG datos={datos()} />);
    expect(container.querySelector('svg[data-relieve="real"]')).not.toBeNull();
    expect(container.querySelector('path[data-capa="curvas-menores"]')?.getAttribute("d")?.length).toBeGreaterThan(1000);
    expect(container.querySelector('path[data-capa="curvas-mayores"]')?.getAttribute("d")?.length).toBeGreaterThan(1000);
    expect(container.querySelector("image")?.getAttribute("href")).toMatch(/relieve\/tinte_cuenca\.png$/);
    expect(screen.queryByText(/Esquema ilustrativo/)).toBeNull();
  });

  it("la leyenda muestra rango, intervalo, exageración, fuentes y categoría", () => {
    const d = datos();
    render(
      <ChakraProvider theme={theme}>
        <LeyendaRelieve meta={d.meta} vista="3d" />
      </ChakraProvider>,
    );
    const ley = screen.getByTestId("leyenda-relieve");
    expect(ley).toHaveTextContent(`×${EXAGERACION_VERTICAL}`);
    expect(ley).toHaveTextContent(/Exageración vertical/);
    expect(ley).toHaveTextContent(/Curvas de nivel cada 25 m/);
    expect(ley).toHaveTextContent(/AWS Terrain Tiles/);
    expect(ley).toHaveTextContent(/Natural Earth/);
    expect(ley).toHaveTextContent(/IGN/);
    expect(within(ley).getByText("DOCUMENTO DE REFERENCIA")).toBeInTheDocument();
    expect(ley).toHaveTextContent(`${Math.round(d.meta.cuenca.min_m)} a ${Math.round(d.meta.cuenca.max_m)} m`);
  });

  it("la landing sin WebGL muestra el mapa de relieve con su leyenda cuando hay datos", async () => {
    simularConRelieve();
    renderRuta("/");
    const ley = await screen.findByTestId("leyenda-relieve");
    expect(ley).toHaveTextContent(/Exageración vertical/);
    expect(ley).toHaveTextContent(new RegExp(`ninguna en esta vista en planta \\(la escena 3D usa ×${EXAGERACION_VERTICAL}\\)`));
    expect(ley).toHaveTextContent(/AWS Terrain Tiles/);
    expect(within(ley).getByText("DOCUMENTO DE REFERENCIA")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Mapa de relieve de la cuenca/ })).toBeInTheDocument();
    expect(document.querySelectorAll("path[data-departamento]")).toHaveLength(9);
  });
});

describe("mapa SVG de sectores con relieve local", () => {
  it("agrega curvas de nivel del corredor y el límite departamental como fondo", async () => {
    simularConRelieve();
    const { container } = render(<MapaSectores altura={5.6} />);
    await waitFor(() => expect(container.querySelector('g[data-capa="relieve-local"]')).not.toBeNull());
    expect(container.querySelector('g[data-capa="relieve-local"] path')?.getAttribute("d")?.length).toBeGreaterThan(100);
    expect(container.querySelector("[data-leyenda-relieve]")).toHaveTextContent(/Curvas de nivel cada 2 m/);
    expect(container.querySelector("[data-leyenda-relieve]")).toHaveTextContent(/DOCUMENTO DE REFERENCIA/);
    // Los sectores K10 siguen ahí.
    expect(container.querySelectorAll("polygon").length).toBeGreaterThanOrEqual(4);
  });

  it("sin datos de relieve muestra solo los sectores", async () => {
    simularFetch();
    const { container } = render(<MapaSectores altura={5.6} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('g[data-capa="relieve-local"]')).toBeNull();
  });
});
