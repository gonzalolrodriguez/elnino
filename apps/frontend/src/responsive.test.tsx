import { ChakraProvider, Table, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TablaDesplazable } from "./components/TablaDesplazable";
import { fijarToken } from "./lib/api";
import { soportaGapFlex } from "./lib/compat";
import { esDispositivoLimitado, puedeUsar3D } from "./lib/entorno";
import { renderRuta, simularFetch } from "./test/utils";
import { theme } from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  simularFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Texto de todas las reglas CSS que Emotion inyectó (jsdom no evalúa media queries: se lee el CSS emitido). */
function cssEmitido(): string {
  return [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
}

/** Declaraciones base (sin media query) de la clase de Emotion de un elemento. */
function reglaBase(el: HTMLElement): string {
  const clase = [...el.classList].find((c) => c.startsWith("css-")) ?? "";
  const m = new RegExp(String.raw`\.` + clase + String.raw`\{([^}]*)\}`).exec(cssEmitido());
  return m ? m[1] : "";
}

describe("menú de navegación adaptable", () => {
  it("está plegado por defecto (pantallas angostas) y se abre con el botón", async () => {
    renderRuta("/login");
    const boton = await screen.findByTestId("boton-menu");
    expect(boton.tagName).toBe("BUTTON");
    expect(boton).toHaveAttribute("aria-controls", "menu-principal");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveAttribute("aria-label", "Abrir el menú");
    const menu = document.getElementById("menu-principal") as HTMLElement;
    // Plegado: la regla base de la lista es display:none (la de md en adelante la muestra).
    expect(reglaBase(menu)).toMatch(/display:none/);

    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(boton).toHaveAttribute("aria-label", "Cerrar el menú");
    expect(reglaBase(menu)).toMatch(/display:flex/);
    expect(within(menu).getByRole("link", { name: "Información" })).toBeInTheDocument();
  });

  it("Escape lo cierra y devuelve el foco al botón", async () => {
    renderRuta("/login");
    const boton = await screen.findByTestId("boton-menu");
    const foco = vi.spyOn(boton, "focus");
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(foco).toHaveBeenCalled();
  });

  it("al navegar a otra página el menú se pliega", async () => {
    renderRuta("/login");
    const boton = await screen.findByTestId("boton-menu");
    fireEvent.click(boton);
    const menu = document.getElementById("menu-principal") as HTMLElement;
    fireEvent.click(within(menu).getByRole("link", { name: "Información" }));
    await screen.findByRole("heading", { level: 1, name: /Información para entender la crecida/ });
    expect(screen.getByTestId("boton-menu")).toHaveAttribute("aria-expanded", "false");
  });

  it("desde md (48em) el botón se oculta y la lista se muestra en fila", async () => {
    renderRuta("/login");
    await screen.findByTestId("boton-menu");
    const css = cssEmitido();
    expect(css).toMatch(/@media screen and \(min-width: ?48em\)\{[^}]*display:none/);
    expect(css).toMatch(/@media screen and \(min-width: ?48em\)\{[^}]*flex-direction:row/);
  });

  it("la leyenda fija sigue visible con el menú plegado", async () => {
    renderRuta("/login");
    expect(await screen.findByRole("note", { name: "Aviso de prototipo" })).toBeVisible();
  });
});

describe("páginas de formulario: formulario más panel de apoyo", () => {
  it.each(["/registro/ciudadania", "/login", "/app"])("%s tiene el panel de apoyo después del formulario (se apila en pantallas angostas)", async (ruta) => {
    renderRuta(ruta);
    const apoyo = await screen.findByTestId("panel-apoyo");
    const pagina = screen.getByTestId("pagina-formulario");
    expect(pagina).toContainElement(apoyo);
    const hijos = [...(apoyo.parentElement as HTMLElement).children];
    expect(hijos.indexOf(apoyo)).toBe(1); // segundo: debajo del formulario cuando hay una sola columna
    expect(apoyo.tagName).toBe("ASIDE");
    expect(apoyo).toHaveAccessibleName("Información de apoyo");
  });

  it("el registro de ciudadanía usa una columna por defecto y dos desde lg (62em)", async () => {
    renderRuta("/registro/ciudadania");
    await screen.findByTestId("panel-apoyo");
    const css = cssEmitido();
    expect(css).toMatch(/grid-template-columns:minmax\(0, ?1fr\);/);
    expect(css).toMatch(/@media screen and \(min-width: ?62em\)\{[^}]*grid-template-columns:minmax\(0, ?40rem\) minmax\(0, ?24rem\)/);
  });

  it("el panel de apoyo no inventa cifras: lista los sectores K10 rotulados SIMULADO", async () => {
    renderRuta("/registro/ciudadania");
    const apoyo = await screen.findByTestId("panel-apoyo");
    expect(within(apoyo).getByText("SIMULADO")).toBeInTheDocument();
    expect(within(apoyo).getByText(/8,10 m/)).toBeInTheDocument();
    expect(within(apoyo).getByText(/Ley 25.326/)).toBeInTheDocument();
  });
});

describe("tablas con desplazamiento propio", () => {
  it("la tabla ancha va en una región con nombre, enfocable y con indicio de desplazamiento", () => {
    render(
      <ChakraProvider theme={theme}>
        <TablaDesplazable etiqueta="Comparación de alternativas">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>A</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>1</Td>
              </Tr>
            </Tbody>
          </Table>
        </TablaDesplazable>
      </ChakraProvider>,
    );
    const region = screen.getByRole("region", { name: /Comparación de alternativas: tabla con desplazamiento horizontal/ });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("desplazable");
    expect(getComputedStyle(region).overflowX).toBe("auto");
  });
});

describe("equipos de pocos recursos", () => {
  it("detecta 2 núcleos o menos, o 2 GB o menos de memoria", () => {
    expect(esDispositivoLimitado({ hardwareConcurrency: 2 })).toBe(true);
    expect(esDispositivoLimitado({ hardwareConcurrency: 1 })).toBe(true);
    expect(esDispositivoLimitado({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
    expect(esDispositivoLimitado({ hardwareConcurrency: 8, deviceMemory: 0.5 })).toBe(true);
  });

  it("no marca como limitado un equipo con recursos ni uno que no informa memoria", () => {
    expect(esDispositivoLimitado({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
    expect(esDispositivoLimitado({ hardwareConcurrency: 4 })).toBe(false);
  });

  function simularWebGL2() {
    vi.stubGlobal("WebGL2RenderingContext", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
  }
  const conNucleos = (n: number) => vi.stubGlobal("navigator", { hardwareConcurrency: n });

  it("el 3D se elige solo con WebGL 2 y un equipo con recursos", () => {
    simularWebGL2();
    conNucleos(8);
    expect(puedeUsar3D()).toBe(true);
  });

  it("un equipo limitado con WebGL 2 usa el respaldo 2D", () => {
    simularWebGL2();
    conNucleos(2);
    expect(puedeUsar3D()).toBe(false);
  });

  it("sin WebGL 2 (solo WebGL 1) usa el respaldo 2D", () => {
    vi.stubGlobal("WebGL2RenderingContext", undefined);
    conNucleos(8);
    expect(puedeUsar3D()).toBe(false);
  });
});

describe("respaldos de compatibilidad", () => {
  it("la detección de gap en flexbox responde sin lanzar", () => {
    act(() => {
      expect(typeof soportaGapFlex()).toBe("boolean");
    });
  });
});
