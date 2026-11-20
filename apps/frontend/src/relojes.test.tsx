import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TresRelojes } from "./components/TresRelojes";
import { distanciaAUmbral, estadoCamino, fraccion, margenAntesDeAlerta, rangoDias, textoRango } from "./lib/relojes";
import { theme } from "./theme";
import { renderRuta } from "./test/utils";

afterEach(() => vi.unstubAllGlobals());

describe("lógica de los relojes", () => {
  it("distancia al umbral: 2,20 m del corte a la alerta, y cero si ya se superó", () => {
    expect(distanciaAUmbral(5.6, 7.8)).toEqual({ faltaM: 2.2, alcanzado: false });
    expect(distanciaAUmbral(7.8, 7.8)).toEqual({ faltaM: 0, alcanzado: true });
    expect(distanciaAUmbral(8.1, 7.8)).toEqual({ faltaM: 0, alcanzado: true });
  });

  it("rango de días hasta la alerta: de 6,1 a 20,4 como en la ficha de fuentes", () => {
    const r = rangoDias(5.6, 7.8);
    expect(r).toEqual({ minimo: 6.1, maximo: 20.4 });
    expect(textoRango(r!)).toBe("entre 6,1 y 20,4 días");
  });

  it("el rango es null si el umbral ya se alcanzó o si una tasa no es positiva", () => {
    expect(rangoDias(7.9, 7.8)).toBeNull();
    expect(rangoDias(5.6, 7.8, 0, 0.1)).toBeNull();
    expect(rangoDias(5.6, 7.8, 0.3, -1)).toBeNull();
  });

  it("estado del camino: tierra con 30 mm, ripio con 80 mm", () => {
    expect(estadoCamino(29.9, "tierra")).toBe("transitable");
    expect(estadoCamino(30, "tierra")).toBe("intransitable");
    expect(estadoCamino(40, "ripio")).toBe("transitable");
    expect(estadoCamino(80, "ripio")).toBe("intransitable");
    expect(estadoCamino(-5, "tierra")).toBe("transitable");
    expect(estadoCamino(Number.NaN, "tierra")).toBe("transitable");
  });

  it("fracción acotada y margen de S4 con la alerta", () => {
    expect(fraccion(5.6, 8.3)).toBeCloseTo(0.675, 3);
    expect(fraccion(20, 10)).toBe(1);
    expect(fraccion(-1, 10)).toBe(0);
    expect(fraccion(1, 0)).toBe(0);
    expect(margenAntesDeAlerta(7.5, 7.8)).toBe(0.3);
  });
});

function montar(props: Parameters<typeof TresRelojes>[0] = {}) {
  return render(
    <ChakraProvider theme={theme}>
      <TresRelojes {...props} />
    </ChakraProvider>,
  );
}

describe("TresRelojes", () => {
  it("variante amplia: tres relojes, cada uno con su categoría", () => {
    montar();
    expect(screen.getByRole("heading", { level: 2, name: "Tres relojes corren a la vez" })).toBeInTheDocument();
    const rio = screen.getByTestId("reloj-rio");
    const barro = screen.getByTestId("reloj-barro");
    const nino = screen.getByTestId("reloj-nino");
    expect(within(rio).getByText("DATO OBSERVADO")).toBeInTheDocument();
    expect(within(rio).getByText("SIMULADO")).toBeInTheDocument();
    expect(within(barro).getByText("SIMULADO")).toBeInTheDocument();
    expect(within(nino).getByText("DOCUMENTO DE REFERENCIA")).toBeInTheDocument();
  });

  it("río: 2,20 m a la alerta y rango de 6,1 a 20,4 días con el supuesto lineal", () => {
    montar();
    expect(screen.getByTestId("reloj-rio-falta")).toHaveTextContent("2,20 m");
    expect(screen.getByTestId("reloj-rio-rango")).toHaveTextContent("entre 6,1 y 20,4 días");
    expect(screen.getByTestId("reloj-rio-detalle")).toHaveTextContent("5,60 m al corte (31/10/2026)");
    expect(screen.getByText(/Supuesto: ascenso lineal/)).toBeInTheDocument();
  });

  it("barro: dice que el kit no tiene lluvia observada y no muestra 0 mm medidos", () => {
    montar();
    expect(screen.getByTestId("reloj-barro-cifra")).toHaveTextContent("30 mm");
    expect(screen.getByText(/El kit no tiene lluvia observada/)).toBeInTheDocument();
    expect(screen.getByText("El barro puede cortar el camino antes de que el río llegue a la alerta.")).toBeInTheDocument();
    expect(screen.getByTestId("reloj-barro-s4")).toHaveTextContent("se compromete en 7,50 m, 0,30 m antes de la alerta");
  });

  it("El Niño: 83 %, SMN y CFS v2 con las cifras de la ficha", () => {
    montar();
    expect(screen.getByTestId("reloj-nino-cifra")).toHaveTextContent("83 %");
    expect(screen.getByTestId("reloj-nino-cfs")).toHaveTextContent("1.623 mm frente a 1.229 mm");
    expect(screen.getByTestId("reloj-nino-cfs")).toHaveTextContent("308 mm");
    expect(screen.getByText(/SMN confirmó la fase El Niño el 4\/9\/2026/)).toBeInTheDocument();
  });

  it("variante compacta con altura y lluvia del escenario", () => {
    montar({ variante: "compacta", alturaM: 7.6, alturaCategoria: "SIMULADO", lluviaMm: 40 });
    expect(screen.getByTestId("tres-relojes-compacta")).toBeInTheDocument();
    expect(screen.getByTestId("reloj-rio-falta")).toHaveTextContent("0,20 m");
    expect(screen.getByTestId("reloj-barro-cifra")).toHaveTextContent("40 mm");
    expect(screen.getByText("Con esa lluvia el camino de tierra queda cortado.")).toBeInTheDocument();
    expect(screen.queryByTestId("reloj-barro-detalle")).toBeNull();
  });

  it("si el río ya superó la alerta no muestra rango de días", () => {
    montar({ variante: "compacta", alturaM: 8, alturaCategoria: "SIMULADO" });
    expect(screen.getByTestId("reloj-rio-falta")).toHaveTextContent("Superada");
    expect(screen.queryByTestId("reloj-rio-rango")).toBeNull();
  });
});

describe("landing", () => {
  it("muestra el selector de perfiles antes de los tres relojes (Entender la situación)", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderRuta("/");
    const relojes = screen.getByTestId("tres-relojes-amplia");
    const perfiles = document.getElementById("ingreso");
    expect(perfiles).not.toBeNull();
    expect((perfiles as Node).compareDocumentPosition(relojes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Entender la situación")).toBeInTheDocument();
  });
});
