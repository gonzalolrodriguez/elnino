import { ChakraProvider } from "@chakra-ui/react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { RecorridoRio } from "./landing/RecorridoRio";
import { avanceDeHito, hitoMasCercano, textoValor, type ControlCuenca, type EstadoRecorrido, type HitoRecorrido, type IdHito } from "./landing/recorrido";
import { theme } from "./theme";

const HITOS: HitoRecorrido[] = [
  { id: "matogrosso", nombre: "Mato Grosso", p: 0 },
  { id: "pantanal", nombre: "Pantanal", p: 0.1 },
  { id: "asuncion", nombre: "Asunción", p: 0.5 },
  { id: "pilcomayo", nombre: "Puerto Pilcomayo", p: 0.55 },
  { id: "formosa", nombre: "Puerto Formosa", p: 0.8 },
  { id: "confluencia", nombre: "Confluencia con el Paraná", p: 1 },
];

/** Control simulado: guarda las llamadas y permite emitir estados como lo hace la escena 3D. */
function controlSimulado() {
  let estado: EstadoRecorrido = { modo: "recorrido", reproduciendo: false, p: 0 };
  const oyentes = new Set<(e: EstadoRecorrido) => void>();
  const emitir = (parcial: Partial<EstadoRecorrido>) => {
    estado = { ...estado, ...parcial };
    oyentes.forEach((f) => f(estado));
  };
  const c: ControlCuenca = {
    hitos: HITOS,
    irA: vi.fn((p: number) => emitir({ p, reproduciendo: false })),
    irAHito: vi.fn((id: string) => emitir({ p: HITOS.find((h) => h.id === id)?.p ?? 0 })),
    jugar: vi.fn(() => emitir({ reproduciendo: true })),
    pausar: vi.fn(() => emitir({ reproduciendo: false })),
    volverInicio: vi.fn(() => emitir({ p: 1, modo: "recorrido" })),
    explorar: vi.fn((activo: boolean) => emitir({ modo: activo ? "libre" : "recorrido" })),
    estado: () => estado,
    suscribir: (f) => {
      oyentes.add(f);
      return () => void oyentes.delete(f);
    },
  };
  return { c, emitir };
}

function Montar({ control, disponible3D = true, reducido = false }: { control: React.MutableRefObject<ControlCuenca | null>; disponible3D?: boolean; reducido?: boolean }) {
  const [resaltado, setResaltado] = useState<IdHito | null>(null);
  return (
    <ChakraProvider theme={theme}>
      <RecorridoRio control={control} disponible3D={disponible3D} reducido={reducido} resaltado={resaltado} alResaltar={setResaltado} pista={false} />
      <output data-testid="resaltado">{resaltado ?? ""}</output>
    </ChakraProvider>
  );
}

function montar(opciones: { disponible3D?: boolean; reducido?: boolean } = {}) {
  const { c, emitir } = controlSimulado();
  const ref = createRef<ControlCuenca | null>() as React.MutableRefObject<ControlCuenca | null>;
  ref.current = c;
  render(<Montar control={ref} {...opciones} />);
  // Los controles arrancan plegados: se abren con «Recorrer el río».
  fireEvent.click(screen.getByRole("button", { name: /Recorrer el río/ }));
  return { c, emitir };
}

describe("funciones del recorrido", () => {
  it("el valor de texto nombra el hito más cercano", () => {
    expect(hitoMasCercano(0.52, HITOS)?.nombre).toBe("Asunción");
    expect(textoValor(0.52, HITOS)).toBe("52 %, cerca de Asunción");
    expect(textoValor(1, HITOS)).toBe("100 %, cerca de Confluencia con el Paraná");
  });

  it("el avance de un hito invierte la función del frente del agua (monótona)", () => {
    const frente = (a: number) => (a <= 0.6 ? 0.8 * (a / 0.6) : 0.8 + 0.22 * ((a - 0.6) / 0.4));
    expect(avanceDeHito(0, frente)).toBe(0);
    expect(avanceDeHito(0.4, frente)).toBeCloseTo(0.3, 3);
    expect(avanceDeHito(0.9, frente)).toBeCloseTo(0.6 + 0.4 * (0.1 / 0.22), 3);
  });
});

describe("panel «Recorrer el río»", () => {
  it("mover la barra pide ese avance y actualiza el texto accesible con el hito cercano", () => {
    const { c } = montar();
    const barra = screen.getByRole("slider", { name: /Avance del recorrido/ });
    fireEvent.change(barra, { target: { value: "52" } });
    expect(c.irA).toHaveBeenCalledWith(0.52, { instantaneo: false });
    expect(barra).toHaveAttribute("aria-valuetext", "52 %, cerca de Asunción");
    expect(barra).toHaveValue("52");
  });

  it("«+» y «-» mueven la barra de a 5 puntos", () => {
    const { c } = montar();
    const barra = screen.getByRole("slider");
    fireEvent.change(barra, { target: { value: "50" } });
    fireEvent.keyDown(barra, { key: "+" });
    expect(c.irA).toHaveBeenLastCalledWith(0.55, { instantaneo: false });
    fireEvent.keyDown(barra, { key: "-" });
    fireEvent.keyDown(barra, { key: "-" });
    expect(c.irA).toHaveBeenLastCalledWith(0.45, { instantaneo: false });
  });

  it("cada atajo vuela al hito correspondiente", () => {
    const { c } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Puerto Pilcomayo" }));
    expect(c.irAHito).toHaveBeenCalledWith("pilcomayo", { instantaneo: false });
    expect(screen.getByRole("button", { name: "Puerto Pilcomayo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "55 %, cerca de Puerto Pilcomayo");
    for (const n of ["Pantanal", "Asunción", "Puerto Formosa", "Confluencia con el Paraná"]) {
      expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    }
  });

  it("con menos movimiento los saltos de cámara son instantáneos", () => {
    const { c } = montar({ reducido: true });
    fireEvent.click(screen.getByRole("button", { name: "Puerto Formosa" }));
    expect(c.irAHito).toHaveBeenCalledWith("formosa", { instantaneo: true });
    fireEvent.change(screen.getByRole("slider"), { target: { value: "20" } });
    expect(c.irA).toHaveBeenCalledWith(0.2, { instantaneo: true });
  });

  it("reproducir y pausar alternan el botón", () => {
    const { c } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir el recorrido" }));
    expect(c.jugar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pausar el recorrido" }));
    expect(c.pausar).toHaveBeenCalled();
  });

  it("explorar activa el modo libre; el botón Salir y la tecla Esc lo desactivan", () => {
    const { c } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Explorar el mapa" }));
    expect(c.explorar).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: /Salir del mapa/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(c.explorar).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Explorar el mapa" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Explorar el mapa" }));
    fireEvent.click(screen.getByRole("button", { name: /Salir del mapa/ }));
    expect(c.explorar).toHaveBeenLastCalledWith(false);
  });

  it("«Volver a la vista inicial» llama a la escena", () => {
    const { c } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la vista inicial" }));
    expect(c.volverInicio).toHaveBeenCalled();
  });

  it("los avances que emite la escena actualizan la barra sin re-render del panel", () => {
    const { emitir } = montar();
    act(() => emitir({ p: 0.8 }));
    expect(screen.getByRole("slider")).toHaveValue("80");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "80 %, cerca de Puerto Formosa");
  });

  it("en el respaldo 2D quedan los atajos (resaltan el hito) y no la barra ni explorar", () => {
    montar({ disponible3D: false });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explorar el mapa" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Asunción" }));
    expect(screen.getByTestId("resaltado")).toHaveTextContent("asuncion");
    expect(screen.getByRole("button", { name: "Asunción" })).toHaveAttribute("aria-pressed", "true");
  });
});
