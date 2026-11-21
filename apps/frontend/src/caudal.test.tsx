import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaudalGlofas } from "./caudal/CaudalGlofas";
import { maximosAnuales, type RespuestaCaudal } from "./caudal/caudal";
import { simularFetch } from "./test/utils";
import { theme } from "./theme";

function fechas(desde: string, n: number): string[] {
  const t0 = Date.parse(`${desde}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t0 + i * 86_400_000).toISOString().slice(0, 10));
}

const FECHAS = fechas("2015-12-25", 400); // hasta enero de 2017
const CAUDAL = FECHAS.map((f) => (f === "2016-03-26" ? 15738.83 : 2000));

function respuesta(conPosterior: boolean): RespuestaCaudal {
  const corte = FECHAS.slice(0, 340);
  return {
    estacion: { clave: "formosa", nombre: "Puerto Formosa (K3, siteCode 57)" },
    unidad: "m³/s",
    fechas: corte,
    caudal_m3s: CAUDAL.slice(0, 340),
    n: 340,
    picos: [{ anio: 2016, caudal_m3s: 15738.83, fecha: "2016-03-26" }],
    ultima: { fecha: corte[corte.length - 1], caudal_m3s: 2000 },
    posterior_al_corte: conPosterior
      ? {
          rotulo: "POSTERIOR AL CORTE · ejecución vigente al 2026-11-20T00:00:00+00:00 (UTC)",
          categoria: "DOCUMENTO DE REFERENCIA",
          horizonte_dias: 3,
          supuesto: "Dispersión entre miembros.",
          fechas: FECHAS.slice(340, 343),
          caudal_m3s: [2100, 2200, 2300],
          p25: [2000, 2100, 2200],
          p75: [2200, 2300, 2400],
          minimo: [1900, 2000, 2100],
          maximo: [2300, 2400, 2500],
          mediana: [2100, 2200, 2300],
          fecha_descarga_utc: "2026-11-20T00:00:00+00:00",
        }
      : null,
    notas: [],
    celda_usada: { lat: -26.175, lon: -58.174995, elevacion_m: 61 },
    fuente: "GloFAS v4 vía Open-Meteo",
    licencia: "CC BY 4.0",
    atribucion: "GloFAS / Copernicus EMS y Open-Meteo",
    fecha_dato: corte[corte.length - 1],
    fecha_descarga: "2026-11-20T00:00:00+00:00",
  };
}

function montar(conPosterior = false) {
  simularFetch({ "GET /serie/caudal-glofas": () => ({ estado: 200, json: respuesta(conPosterior) }) });
  return render(
    <ChakraProvider theme={theme}>
      <CaudalGlofas k1={{ desde: "2015-12-25", hasta: "2016-01-04", valores: [5, 6, null, 9.81, 9.5, 9, 8, 7, 6, 5, 4] }} />
    </ChakraProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("caudal modelado GloFAS", () => {
  it("muestra categoría, la nota honesta, el pico y la tabla alternativa, sin banda antes del corte", async () => {
    montar();
    expect(await screen.findByTestId("caudal-grafico")).toBeInTheDocument();
    expect(screen.getByTestId("caudal-nota")).toHaveTextContent("no se convierte a metros");
    expect(screen.getByTestId("caudal-nota")).toHaveTextContent("más de 15 días");
    expect(screen.getByTestId("caudal-nota")).toHaveTextContent("tal como se emitió el 31/10/2026");
    expect(screen.getByTestId("caudal-pico-2016")).toHaveTextContent("15.739 m³/s");
    expect(document.querySelectorAll('[data-categoria="DOCUMENTO DE REFERENCIA"]').length).toBeGreaterThan(0);
    expect(screen.queryByTestId("caudal-posterior")).toBeNull();
    expect(screen.queryByTestId("caudal-banda-p25p75")).toBeNull();
    const tabla = screen.getByTestId("caudal-tabla");
    expect(within(tabla).getByRole("table", { name: /máximo anual/i })).toBeInTheDocument();
  });

  it("superpone la altura K1 solo si se pide, con su propia categoría", async () => {
    montar();
    await screen.findByTestId("caudal-grafico");
    expect(screen.queryByTestId("caudal-trazo-altura")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Superponer la altura observada/ }));
    await waitFor(() => expect(screen.getByTestId("caudal-trazo-altura")).toBeInTheDocument());
    expect(document.querySelector('[data-categoria="DATO OBSERVADO"]')).not.toBeNull();
  });

  it("con datos posteriores al corte rotula y dibuja las bandas del ensamble", async () => {
    montar(true);
    expect(await screen.findByTestId("caudal-posterior")).toHaveTextContent("POSTERIOR AL CORTE");
    expect(screen.getByTestId("caudal-posterior")).toHaveTextContent("Horizonte: 3 días");
    expect(screen.getByTestId("caudal-banda-p25p75")).toBeInTheDocument();
    expect(screen.getByTestId("caudal-banda-minmax")).toBeInTheDocument();
  });

  it("si la API falla avisa y ofrece reintentar", async () => {
    simularFetch();
    render(
      <ChakraProvider theme={theme}>
        <CaudalGlofas />
      </ChakraProvider>,
    );
    expect(await screen.findByTestId("caudal-error")).toHaveTextContent("No se pudo cargar");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("maximosAnuales mantiene separadas las fechas del caudal y de la altura", () => {
    const filas = maximosAnuales(respuesta(false), { desde: "2015-12-25", hasta: "2016-01-04", valores: [5, 6, null, 9.81, 9.5, 9, 8, 7, 6, 5, 4] });
    const f2016 = filas.find((f) => f.anio === 2016);
    expect(f2016?.caudal).toEqual({ valor: 15738.83, fecha: "2016-03-26" });
    expect(f2016?.altura).toEqual({ valor: 7, fecha: "2016-01-01" });
    expect(filas.find((f) => f.anio === 2015)?.altura).toEqual({ valor: 9.81, fecha: "2015-12-28" });
  });
});
