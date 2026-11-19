import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SERIE_K1, fechaDeIndice, indiceDeFecha, sectorDe } from "./datos/kit";
import { construirTrazo } from "./informacion/SerieK1";
import { ordenAguasAbajo, CURSOS_APROXIMADOS, HITOS } from "./landing/geometria";
import { fijarToken } from "./lib/api";
import { LEYENDA, renderRuta, simularFetch } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  simularFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe("leyenda fija", () => {
  it.each(["/", "/informacion", "/el-nino", "/registro/ciudadania", "/registro/productor", "/login", "/app", "/mi-cuenta", "/comando", "/cuadrilla", "/admin"])(
    "aparece en %s",
    async (ruta) => {
      renderRuta(ruta);
      // Cinta fija arriba (nota "Aviso de prototipo") y repetida en el pie.
      expect(await screen.findByRole("note", { name: "Aviso de prototipo" })).toHaveTextContent(LEYENDA);
      expect(screen.getByRole("contentinfo")).toHaveTextContent(LEYENDA);
    },
  );
});

describe("landing", () => {
  it("usa el respaldo 2D sin WebGL y muestra 5,60 m con su categoría", () => {
    renderRuta("/");
    expect(screen.getByTestId("escena-cuenca")).toHaveAttribute("data-modo", "2d");
    expect(screen.getByRole("img", { name: /Esquema ilustrativo de la cuenca/ })).toBeInTheDocument();
    const corte = screen.getByTestId("cifra-corte");
    expect(corte).toHaveTextContent("5,60 m");
    const item = corte.closest("li") as HTMLElement;
    expect(within(item).getByText("DATO OBSERVADO")).toBeInTheDocument();
    expect(within(item).getByText(/31\/10\/2026/)).toBeInTheDocument();
  });

  it("muestra umbrales, picos y la ausencia de lluvia observada", () => {
    renderRuta("/");
    expect(screen.getByTestId("cifra-alerta")).toHaveTextContent("7,80 m");
    expect(screen.getByTestId("cifra-evacuacion")).toHaveTextContent("8,30 m");
    expect(screen.getByTestId("cifra-pico2016")).toHaveTextContent("9,81 m");
    expect(screen.getByTestId("cifra-pico2019")).toHaveTextContent("9,72 m");
    expect(screen.getByText(/sin dato observado en el kit/i)).toBeInTheDocument();
  });

  it("no muestra el estado del backend ni de la conexión en la landing", async () => {
    renderRuta("/");
    expect(screen.queryByText(/Estado del backend/)).toBeNull();
    expect(screen.queryByText(/backend/i)).toBeNull();
    expect(screen.queryByText(/servidor/i)).toBeNull();
    // Los límites siguen presentes (plegados) y usan la copia guardada si no hay servicio.
    expect(await screen.findByText(/Se muestran los valores guardados/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Límites de esta plataforma" })).toBeInTheDocument();
  });

  it("ofrece registro para ciudadanía y productores y solo ingreso para mandos", () => {
    renderRuta("/");
    expect(screen.getByRole("link", { name: "Registrarme" })).toHaveAttribute("href", "/registro/ciudadania");
    expect(screen.getByRole("link", { name: "Registrar mi establecimiento" })).toHaveAttribute("href", "/registro/productor");
    expect(screen.getByRole("link", { name: "Ingresar con cuenta institucional" })).toHaveAttribute("href", "/login");
  });
});

describe("Información", () => {
  it("muestra la serie con umbrales y el mapa de sectores SIMULADO", async () => {
    renderRuta("/informacion");
    expect(await screen.findByRole("heading", { name: "Puerto Formosa: umbrales y picos" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Altura diaria de la escala de Puerto Formosa/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /cuatro sectores simulados K10/ })).toBeInTheDocument();
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
  });
});

describe("sección Información", () => {
  it("/el-nino redirige a /informacion", async () => {
    renderRuta("/el-nino");
    expect(await screen.findByRole("heading", { level: 1, name: "Información para entender la crecida" })).toBeInTheDocument();
    expect(document.title).toBe("Información · Operación Agua");
  });

  it("la navegación principal dice Información y apunta a /informacion", () => {
    renderRuta("/");
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(nav).getByRole("link", { name: "Información" })).toHaveAttribute("href", "/informacion");
    expect(within(nav).queryByRole("link", { name: /El Niño/ })).not.toBeInTheDocument();
  });

  it("el índice de la página enlaza a cada tema, incluidas las fuentes", async () => {
    renderRuta("/informacion");
    const indice = await screen.findByRole("navigation", { name: "En esta página" });
    expect(within(indice).getByRole("link", { name: "Fuentes" })).toHaveAttribute("href", "#fuentes");
    expect(within(indice).getByRole("link", { name: "Qué es El Niño" })).toHaveAttribute("href", "#que-es");
  });

  it("muestra el gráfico comparativo del pronóstico CFS v2 (1.623 mm y pico de 308 mm en marzo de 2027)", async () => {
    renderRuta("/informacion");
    expect(await screen.findByRole("img", { name: /Precipitación mensual proyectada por el modelo NOAA CFS v2/ })).toBeInTheDocument();
    expect(screen.getAllByText(/1\.623 mm/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/308/).length).toBeGreaterThan(0);
  });
});

describe("resiliencia y acceso de demostración", () => {
  it("/app muestra el simulador de trama SMS SOS-FSA dentro del límite de 160 caracteres", async () => {
    renderRuta("/app");
    const preview = await screen.findByTestId("trama-sos-preview");
    expect(preview.textContent).toMatch(/^SOS-FSA\|/);
    expect((preview.textContent ?? "").length).toBeLessThanOrEqual(160);
  });

  it("/login ofrece el selector de perfiles de demostración para el guion de 3 minutos", async () => {
    renderRuta("/login");
    expect(await screen.findByRole("heading", { name: /Perfiles de demostración/ })).toBeInTheDocument();
    expect(screen.getByText("decisor@demo.evacuaciones.invalid")).toBeInTheDocument();
  });
});

describe("datos del kit", () => {
  it("la serie K1 reproduce los valores de control", () => {
    const en = (iso: string) => SERIE_K1.valores[indiceDeFecha(SERIE_K1.desde, iso)];
    expect(en("2016-01-05")).toBe(9.81);
    expect(en("2019-06-02")).toBe(9.72);
    expect(en("2026-10-31")).toBe(5.6);
    expect(en("2026-10-01")).toBe(2.37);
    expect(fechaDeIndice(SERIE_K1.desde, SERIE_K1.valores.length - 1)).toBe("2026-10-31");
    expect(Math.max(...SERIE_K1.valores.filter((v): v is number => v !== null))).toBe(9.81);
    expect(SERIE_K1.valores.filter((v) => v === null)).toHaveLength(131);
  });

  it("el trazo no une los días sin dato", () => {
    const d = construirTrazo({ desde: "2020-01-01", hasta: "2020-01-05", valores: [1, 2, null, 3, 4] }, 0, 4, (i) => i, (v) => v, 100);
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it("sectorDe ubica el ejemplo de S4", () => {
    expect(sectorDe(-58.139, -26.18)?.id).toBe("S4");
    expect(sectorDe(-57, -25)).toBeNull();
  });
});

describe("geometría del esquema (K7)", () => {
  it("las estaciones van aguas abajo: Asunción, Puerto Pilcomayo, Puerto Formosa", () => {
    expect(ordenAguasAbajo(["formosa", "asuncion", "pilcomayo"])).toEqual(["asuncion", "pilcomayo", "formosa"]);
  });

  it("el Pilcomayo termina en el Paraguay y no pasa por el Bermejo", () => {
    const pil = CURSOS_APROXIMADOS.find((c) => c.id === "pilcomayo");
    expect(CURSOS_APROXIMADOS.some((c) => /bermejo/i.test(c.nombre))).toBe(false);
    expect(pil).toBeDefined();
    const [lon, lat] = pil!.puntos[pil!.puntos.length - 1];
    expect(Math.abs(lon + 57.68)).toBeLessThan(0.1);
    expect(lat).toBeGreaterThan(-25.5);
  });

  it("usa las coordenadas de K3 para las dos estaciones", () => {
    const f = HITOS.find((h) => h.id === "formosa");
    const p = HITOS.find((h) => h.id === "pilcomayo");
    expect([f?.lon, f?.lat]).toEqual([-58.183, -26.183]);
    expect([p?.lon, p?.lat]).toEqual([-57.65, -25.367]);
  });
});

describe("rutas privadas sin sesión", () => {
  it("/mi-cuenta redirige al ingreso", async () => {
    renderRuta("/mi-cuenta");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ingresar" })).toBeInTheDocument());
  });
});
