import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Insignia } from "./components/Insignia";
import { MuestraEstado } from "./components/MuestraEstado";
import { contraste, oklchAHex } from "./estilo/oklch";
import { hexDe, PAL } from "./estilo/paleta";
import { theme } from "./theme";

const montar = (ui: React.ReactElement) => render(<ChakraProvider theme={theme}>{ui}</ChakraProvider>);

describe("insignias de categoría", () => {
  it.each(["DATO OBSERVADO", "DOCUMENTO DE REFERENCIA", "SIMULADO"] as const)("%s tiene etiqueta de texto accesible", (categoria) => {
    montar(<Insignia categoria={categoria} />);
    const insignia = screen.getByText(categoria);
    // El texto visible es la categoría y un prefijo solo para lectores de pantalla.
    expect(insignia).toHaveAttribute("data-categoria", categoria);
    expect(insignia).toHaveTextContent(`Categoría: ${categoria}`);
    expect(within(insignia).getByText("Categoría:", { exact: false })).toBeInTheDocument();
  });

  it("SIMULADO se distingue por borde punteado y no solo por color", () => {
    montar(<Insignia categoria="SIMULADO" />);
    expect(getComputedStyle(screen.getByText("SIMULADO")).borderStyle).toBe("dashed");
  });
});

describe("estado de sector", () => {
  it.each([
    ["normal", "normal"],
    ["en_riesgo", "en riesgo"],
    ["comprometido", "comprometido"],
  ] as const)("%s se muestra con texto", (estado, texto) => {
    montar(<MuestraEstado estado={estado} />);
    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});

describe("sistema de color (OKLCH)", () => {
  it("convierte OKLCH conocidos a sRGB", () => {
    expect(oklchAHex([1, 0, 0])).toBe("#FFFFFF");
    expect(oklchAHex([0, 0, 0])).toBe("#000000");
    // Los colores fuera de gamut bajan el croma y siguen siendo hex válidos.
    expect(oklchAHex([0.7, 0.4, 145])).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("las rampas tienen todos los pasos y crecen en oscuridad", () => {
    expect(Object.keys(PAL.agua)).toHaveLength(10);
    expect(contraste(PAL.agua[100], "#FFFFFF")).toBeLessThan(contraste(PAL.agua[800], "#FFFFFF"));
  });

  // Pares de texto: contraste AA 4.5:1. Pares de interfaz (foco, bordes de control): 3:1.
  it.each([
    ["texto", "fondo", 7],
    ["texto", "superficie", 7],
    ["textoSuave", "fondo", 4.5],
    ["textoSuave", "superficie", 4.5],
    ["textoSuave", "pizarra.100", 4.5],
    ["leyenda.fg", "leyenda.bg", 4.5],
    ["nav.fg", "nav.bg", 4.5],
    ["cat.observado.fg", "cat.observado.bg", 4.5],
    ["cat.referencia.fg", "cat.referencia.bg", 4.5],
    ["cat.simulado.fg", "cat.simulado.bg", 4.5],
    ["cat.referenciaOscuro.fg", "cat.referenciaOscuro.bg", 4.5],
    ["umbral.textoAlerta", "superficie", 4.5],
    ["umbral.textoEvacuacion", "superficie", 4.5],
    ["foco", "fondo", 3],
    ["focoClaro", "nav.bg", 3],
    ["bordeFuerte", "superficie", 3],
    ["umbral.evacuacion", "nav.bg", 3],
    ["umbral.alerta", "nav.bg", 3],
  ])("%s sobre %s cumple %s:1", (a, b, minimo) => {
    expect(contraste(hexDe(a as string), hexDe(b as string))).toBeGreaterThanOrEqual(minimo as number);
  });

  it("el botón primario (papel sobre agua) cumple AA", () => {
    expect(contraste(hexDe("superficie"), hexDe("primario"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(hexDe("superficie"), hexDe("primarioHover"))).toBeGreaterThanOrEqual(4.5);
  });
});
