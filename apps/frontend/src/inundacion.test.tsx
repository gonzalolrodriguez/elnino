import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calcularAgua,
  celdasAnegadas,
  coloresTerrazas,
  estadoSector,
  EXAGERACION_INUNDACION,
  fraccionLlenado,
  lineasEnCaja,
  mascaraCauce,
  ordenarCeldas,
  terraza,
  TRAMO_VISUAL_M,
} from "./informacion/inundacion";
import { SectoresInundacion } from "./informacion/SectoresInundacion";
import { theme } from "./theme";
import type { Malla } from "./relieve/datos";

/** Malla sintética de 20 x 20: la elevación sube hacia el este (columna) y un poco hacia el sur (fila). */
function mallaSintetica(): Malla {
  const nx = 20;
  const ny = 20;
  const z = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = 50 + i * 0.5 + j * 0.01;
  return { bbox: [0, 0, 19, 19], nx, ny, z, min: 50, max: 60 };
}
const anillo = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

describe("regla K10 de estado de sector", () => {
  const s4 = { compromiso_m: 7.5 };
  it("comprometido desde el compromiso, en riesgo 0,50 m antes, normal por debajo", () => {
    expect(estadoSector(s4, 6.99)).toBe("normal");
    expect(estadoSector(s4, 7.0)).toBe("en_riesgo");
    expect(estadoSector(s4, 7.49)).toBe("en_riesgo");
    expect(estadoSector(s4, 7.5)).toBe("comprometido");
    expect(estadoSector(s4, 11)).toBe("comprometido");
  });
});

describe("fracción de llenado", () => {
  it("0 en compromiso - margen, 1/3 en el compromiso, 1 en compromiso + tramo, acotada", () => {
    expect(fraccionLlenado(7.0, 7.5)).toBe(0);
    expect(fraccionLlenado(7.5, 7.5)).toBeCloseTo(0.5 / (0.5 + TRAMO_VISUAL_M), 10);
    expect(fraccionLlenado(8.5, 7.5)).toBe(1);
    expect(fraccionLlenado(0, 7.5)).toBe(0);
    expect(fraccionLlenado(12, 7.5)).toBe(1);
  });
  it("crece de forma monótona con la altura", () => {
    let previo = -1;
    for (let h = 6; h <= 10; h += 0.05) {
      const f = fraccionLlenado(h, 7.9);
      expect(f).toBeGreaterThanOrEqual(previo);
      previo = f;
    }
  });
});

describe("orden de celdas por elevación real", () => {
  const m = mallaSintetica();
  const sector = { id: "T", compromiso_m: 8, anillo: anillo(1.5, 2.5, 8.5, 9.5) };

  it("incluye solo celdas dentro del sector, de la más baja a la más alta", () => {
    const [o] = ordenarCeldas(m, [sector]);
    expect(o.celdas.length).toBe(7 * 7); // columnas 2..8 y filas 3..9 (nodos enteros)
    for (let q = 1; q < o.celdas.length; q++) expect(m.z[o.celdas[q]]).toBeGreaterThanOrEqual(m.z[o.celdas[q - 1]]);
    const col = (k: number) => k % m.nx;
    for (const k of o.celdas) expect(col(k)).toBeGreaterThanOrEqual(2);
  });

  it("excluye las celdas del cauce", () => {
    const cauce = new Uint8Array(m.nx * m.ny);
    cauce[10 * m.nx + 2] = 1;
    const [o] = ordenarCeldas(m, [sector], cauce);
    expect(o.celdas.length).toBe(48);
    expect(Array.from(o.celdas)).not.toContain(10 * m.nx + 2);
  });

  it("las celdas anegadas son siempre las más bajas y su número sigue la fracción", () => {
    const [o] = ordenarCeldas(m, [sector]);
    const { prof } = calcularAgua(m, [o], 8.0, undefined);
    const n = celdasAnegadas(o, 8.0);
    expect(n).toBe(Math.round(fraccionLlenado(8.0, 8) * o.celdas.length));
    const mojadas = new Set(Array.from(o.celdas.slice(0, n)));
    for (const k of o.celdas) expect(prof[k] > 0).toBe(mojadas.has(k));
    const mayorMojada = Math.max(...Array.from(mojadas, (k) => m.z[k]));
    for (const k of o.celdas.slice(n)) expect(m.z[k]).toBeGreaterThanOrEqual(mayorMojada);
  });

  it("sin agua por debajo de compromiso - margen; todo el sector con compromiso + tramo", () => {
    const [o] = ordenarCeldas(m, [sector]);
    const seco = calcularAgua(m, [o], 7.49, undefined);
    expect(seco.niveles.T).toBeNull();
    expect(seco.prof.every((v) => v === 0)).toBe(true);
    const lleno = calcularAgua(m, [o], 8 + TRAMO_VISUAL_M, undefined);
    expect(Array.from(o.celdas).every((k) => lleno.prof[k] > 0)).toBe(true);
  });

  it("fuera de los sectores no se inventa inundación, salvo el cauce", () => {
    const [o] = ordenarCeldas(m, [sector]);
    const cauce = mascaraCauce(m, [[[15, 15], [15, 18]]], 1);
    const { prof } = calcularAgua(m, [o], 12, cauce);
    const dentro = new Set(Array.from(o.celdas));
    for (let k = 0; k < prof.length; k++) if (prof[k] > 0) expect(dentro.has(k) || cauce[k] === 1).toBe(true);
    expect(cauce.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe("terrazas y cauces", () => {
  it("una terraza cada 1 m de elevación", () => {
    expect(terraza(54.99)).toBe(54);
    expect(terraza(55)).toBe(55);
    expect(terraza(48.6)).toBe(48);
    const { base, colores } = coloresTerrazas(48.6, 68.3);
    expect(base).toBe(48);
    expect(colores).toHaveLength(21);
    expect(new Set(colores).size).toBe(21);
  });

  it("recorta los cursos de agua a la caja", () => {
    const lineas = lineasEnCaja(
      [
        { geometry: { type: "LineString", coordinates: [[1, 1], [2, 2], [3, 3]] } },
        { geometry: { type: "LineString", coordinates: [[50, 50], [51, 51]] } },
      ],
      [0, 0, 10, 10],
    );
    expect(lineas).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------ componente

function demSintetico() {
  const nx = 40;
  const ny = 40;
  const bbox = [-58.214, -26.231, -58.119, -26.141];
  const buf = Buffer.alloc(nx * ny * 2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) buf.writeInt16LE(Math.round((50 + i * 0.4 + j * 0.1) * 10), (j * nx + i) * 2);
  return { bbox, nx, ny, min_m: 50, max_m: 66, datos_b64: buf.toString("base64"), fuente: "sintético", fecha_descarga: "2026-11-20", zoom: 14, paso_grados: 0.0025, ruido_dem_m: 1.1 };
}

function simular(opciones: { dem: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("dem_sectores.json")) return Promise.resolve(opciones.dem ? { ok: true, status: 200, json: () => Promise.resolve(demSintetico()) } : { ok: false, status: 404, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ type: "FeatureCollection", features: [] }) });
    }),
  );
}

const montar = () =>
  render(
    <ChakraProvider theme={theme}>
      <SectoresInundacion />
    </ChakraProvider>,
  );

const fila = (id: string) => screen.getByText(id, { selector: "strong" }).closest("tr") as HTMLElement;

describe("bloque Sectores de evaluación", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("arranca en 5,60 m (dato observado) y la tabla sigue al deslizador", async () => {
    simular({ dem: true });
    montar();
    const deslizador = (await screen.findByLabelText(/Altura simulada de Puerto Formosa/)) as HTMLInputElement;
    expect(deslizador.value).toBe("5.6");
    expect(deslizador).toHaveAttribute("step", "0.05");
    expect(screen.getByText("DATO OBSERVADO")).toBeInTheDocument();
    for (const id of ["S1", "S2", "S3", "S4"]) expect(within(fila(id)).getByText("normal")).toBeInTheDocument();

    fireEvent.change(deslizador, { target: { value: "8" } });
    expect(within(fila("S4")).getByText("comprometido")).toBeInTheDocument();
    expect(within(fila("S3")).getByText("comprometido")).toBeInTheDocument();
    expect(within(fila("S1")).getByText("en riesgo")).toBeInTheDocument();
    expect(within(fila("S2")).getByText("normal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a 5,60 m" }));
    expect(deslizador.value).toBe("5.6");
    expect(within(fila("S4")).getByText("normal")).toBeInTheDocument();
  });

  it("la entrada numérica mueve el escenario y el aviso para lectores de pantalla se actualiza", async () => {
    simular({ dem: true });
    montar();
    const num = await screen.findByLabelText("Altura en metros");
    fireEvent.change(num, { target: { value: "7.6" } });
    expect(within(fila("S4")).getByText("comprometido")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Altura simulada 7,60 m\. S1 en riesgo, S2 normal, S3 en riesgo, S4 comprometido/)).toBeInTheDocument(), { timeout: 2500 });
  });

  it("sin WebGL dibuja el respaldo 2D con la leyenda de relieve y exageración", async () => {
    simular({ dem: true });
    const { container } = montar();
    await waitFor(() => expect(container.querySelector('[data-capa="inundacion-2d"]')).not.toBeNull());
    expect(container.querySelector("[data-vista]")).toHaveAttribute("data-vista", "2d");
    expect(container.querySelector("[data-leyenda-inundacion]")?.textContent).toContain(
      `Relieve: SRTM (NASA/USGS) vía Mapzen Terrain Tiles · DOCUMENTO DE REFERENCIA. Agua: ilustrativa · SIMULADO; el momento de compromiso de cada sector es el de K10 v1.0. Exageración vertical ×${EXAGERACION_INUNDACION}. No es un modelo hidráulico.`,
    );
    expect(screen.getByRole("button", { name: "Reproducir crecida" })).toBeInTheDocument();
  });

  it("con menos movimiento no ofrece la reproducción animada y la tabla igual funciona", async () => {
    simular({ dem: true });
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    montar();
    const deslizador = await screen.findByLabelText(/Altura simulada de Puerto Formosa/);
    expect(screen.queryByRole("button", { name: /crecida/ })).toBeNull();
    fireEvent.change(deslizador, { target: { value: "8.7" } });
    expect(within(fila("S2")).getByText("comprometido")).toBeInTheDocument();
  });

  it("si el relieve no carga, muestra el esquema plano y avisa", async () => {
    simular({ dem: false });
    const { container } = montar();
    await waitFor(() => expect(screen.getByText(/No se pudo cargar el relieve fino/)).toBeInTheDocument());
    expect(container.querySelector("svg[role='img']")).not.toBeNull();
    expect(within(fila("S4")).getByText("normal")).toBeInTheDocument();
  });
});
