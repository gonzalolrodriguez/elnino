import { ChakraProvider } from "@chakra-ui/react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Establecimientos } from "./pages/micuenta/Establecimientos";
import { theme } from "./theme";

const LISTA = [
  {
    id: 1,
    nombre: "Estancia La Loma",
    renspa: "12.345.0.00123/00",
    acceso_habitual: "Camino de tierra",
    sector_id: "S4",
    stock: [
      { especie: "bovino", categoria_animal: "vaca con cría", cantidad: 18 },
      { especie: "bovino", categoria_animal: "ternero", cantidad: 18 },
      { especie: "apicultura", categoria_animal: "colmenas", cantidad: 12 },
    ],
  },
  { id: 2, nombre: "Puesto El Algarrobo", sector_id: "S4", stock: [] },
];

describe("Mis establecimientos", () => {
  it("resume cifras, rotula el sector una sola vez y lista el stock sin códigos internos", () => {
    render(
      <ChakraProvider theme={theme}>
        <Establecimientos lista={LISTA} />
      </ChakraProvider>,
    );
    const bloque = screen.getByTestId("establecimientos");
    expect(bloque).toHaveTextContent("2Establecimientos");
    expect(bloque).toHaveTextContent("36Bovinos");
    expect(bloque).toHaveTextContent("12Colmenas");
    expect(bloque.querySelectorAll('[data-categoria="SIMULADO"]')).toHaveLength(1);
    expect(bloque).not.toHaveTextContent("K10");
    const tarjeta = within(screen.getAllByRole("listitem")[0]);
    expect(tarjeta.getByRole("heading", { name: "Estancia La Loma" })).toBeInTheDocument();
    expect(tarjeta.getByText("Vaca con cría")).toBeInTheDocument();
    expect(tarjeta.getByText("Sector S4")).toBeInTheDocument();
    expect(screen.getByText(/Todavía no cargaste los animales/)).toBeInTheDocument();
  });
});
