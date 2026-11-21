import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EscenarioProvider } from "./panel/EscenarioContext";
import { RelojDual } from "./panel/RelojDual";
import { Simulador } from "./panel/Simulador";
import type { AccesoProps } from "./panel/tipos";
import { theme } from "./theme";

const acceso = (id: number, sector_id: string, superficie: string): AccesoProps => ({
  id,
  sector_id,
  nombre: `Acceso SIMULADO ${sector_id}-${id}`,
  superficie,
  transitable: true,
  motivo: null,
  actualizado_en: "2026-11-17T00:00:00Z",
  actualizado_por_rol: null,
});
const ACCESOS = [acceso(1, "S1", "ripio"), acceso(2, "S2", "pavimento"), acceso(3, "S2", "pavimento"), acceso(4, "S3", "pavimento"), acceso(5, "S3", "ripio"), acceso(6, "S4", "tierra")];

function montar() {
  return render(
    <ChakraProvider theme={theme}>
      <EscenarioProvider>
        <Simulador accesos={ACCESOS} />
        <RelojDual accesos={ACCESOS} />
      </EscenarioProvider>
    </ChakraProvider>,
  );
}

describe("RelojDual", () => {
  it("al corte sin lluvia: S4 queda aislado en ~6 h; rotulado SIMULADO y SUPUESTO", () => {
    montar();
    expect(screen.getByTestId("reloj-dual-mensaje")).toHaveTextContent("S4 queda aislado en ~6 h");
    const reloj = screen.getByTestId("reloj-dual");
    expect(within(reloj).getByText("SIMULADO")).toBeInTheDocument();
    expect(screen.getByTestId("reloj-dual-supuestos")).toHaveTextContent("SUPUESTO");
  });

  it("7,60 m + 40 mm: S4 ya está aislado; con 0 mm el barro se relaja", () => {
    montar();
    fireEvent.change(screen.getByLabelText(/Altura de Puerto Formosa/), { target: { value: "7.6" } });
    fireEvent.change(screen.getByLabelText(/Lluvia:/), { target: { value: "40" } });
    expect(screen.getByTestId("reloj-dual-mensaje")).toHaveTextContent("S4 ya está aislado");
    expect(screen.getByTestId("reloj-dual-barro-texto")).toHaveTextContent("Tierra: cortada");
    fireEvent.change(screen.getByLabelText(/Lluvia:/), { target: { value: "0" } });
    expect(screen.getByTestId("reloj-dual-barro-texto")).toHaveTextContent("Tierra: se corta en 6 h");
    expect(within(screen.getByTestId("reloj-dual-S1")).getAllByRole("cell")[2]).toHaveTextContent("~16 h");
  });

  it("el ritmo de lluvia supuesto cambia la cuenta regresiva", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "10 mm/h" }));
    expect(screen.getByTestId("reloj-dual-mensaje")).toHaveTextContent("S4 queda aislado en ~3 h");
  });
});
