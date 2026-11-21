import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { theme } from "./theme";
import { LEYENDA, simularFetch } from "./test/utils";

function Roto(): JSX.Element {
  throw new Error("dato malformado");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("límite de error global", () => {
  it("un hijo que falla muestra la tarjeta de error con Recargar y la leyenda, no una pantalla en blanco", () => {
    simularFetch();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ChakraProvider theme={theme}>
        <MemoryRouter>
          <AuthProvider>
            <ErrorBoundary>
              <Roto />
            </ErrorBoundary>
          </AuthProvider>
        </MemoryRouter>
      </ChakraProvider>,
    );
    expect(screen.getByTestId("pantalla-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recargar" })).toBeInTheDocument();
    expect(screen.getAllByText(LEYENDA).length).toBeGreaterThan(0);
  });
});
