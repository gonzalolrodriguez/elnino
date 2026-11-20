import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Insignia } from "./components/Insignia";
import { NotaCategorias } from "./panel/NotaCategorias";
import { categoriaComun } from "./panel/ui";
import { theme } from "./theme";

const envolver = (ui: React.ReactElement) => render(<ChakraProvider theme={theme}>{ui}</ChakraProvider>);

describe("insignias de categoría", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("conservan el texto completo y un nombre accesible", () => {
    envolver(
      <>
        <Insignia categoria="DATO OBSERVADO" />
        <Insignia categoria="DOCUMENTO DE REFERENCIA" />
        <Insignia categoria="SIMULADO" variante="compacta" />
      </>,
    );
    expect(screen.getByText("DATO OBSERVADO").closest("[data-categoria]")).toHaveTextContent("Categoría: DATO OBSERVADO");
    expect(screen.getByText("DOCUMENTO DE REFERENCIA")).toBeInTheDocument();
    expect(screen.getByText("SIMULADO").closest("[data-categoria]")).toHaveAttribute("data-categoria", "SIMULADO");
  });

  it("categoriaComun devuelve la categoría solo cuando todo el bloque la comparte", () => {
    expect(categoriaComun(["SIMULADO", "SIMULADO"])).toBe("SIMULADO");
    expect(categoriaComun(["SIMULADO", "DATO OBSERVADO"])).toBeUndefined();
    expect(categoriaComun([])).toBeUndefined();
  });

  it("la nota del panel se pliega durante la sesión y se puede volver a abrir", () => {
    const { unmount } = envolver(<NotaCategorias />);
    expect(screen.getByTestId("nota-categorias")).toHaveTextContent("salvo lo marcado como");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(screen.getByTestId("nota-categorias")).not.toHaveTextContent("salvo lo marcado como");
    unmount();
    envolver(<NotaCategorias />);
    expect(screen.getByRole("button", { name: "Ver cómo se marcan los datos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver cómo se marcan los datos" }));
    expect(screen.getByTestId("nota-categorias")).toHaveTextContent("salvo lo marcado como");
  });
});
