import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

function montar() {
  return render(
    <ChakraProvider>
      <App />
    </ChakraProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("muestra la leyenda obligatoria", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    montar();
    expect(
      screen.getByText("PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Consultando el backend/)).toBeInTheDocument();
  });

  it("muestra 'backend OK' cuando el backend responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              estado: "ok",
              servicio: "backend",
              version: "0.1.0",
              base_de_datos: "no_disponible",
            }),
        }),
      ),
    );
    montar();
    expect(await screen.findByText("backend OK")).toBeInTheDocument();
  });

  it("muestra el estado de error cuando falla la consulta", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fallo de red"))));
    montar();
    expect(await screen.findByText(/No se pudo conectar con el backend/)).toBeInTheDocument();
  });
});
