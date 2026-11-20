import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ElegirEnMapa } from "./components/ElegirEnMapa";
import { fijarToken } from "./lib/api";
import { textoPuntoEnSector } from "./lib/puntoEnSector";
import { PedirAyuda } from "./pages/micuenta/PedirAyuda";
import { simularFetch } from "./test/utils";
import { theme } from "./theme";

const mocks = vi.hoisted(() => {
  type Manejador = (e: unknown) => void;
  const mapas: { handlers: Record<string, Manejador>; easeTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[] = [];
  const marcadores: { lngLat: [number, number]; setLngLat: ReturnType<typeof vi.fn> }[] = [];
  return { mapas, marcadores, webgl: { activo: true } };
});

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("maplibre-gl", () => {
  class Map {
    handlers: Record<string, (e: unknown) => void> = {};
    easeTo = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    addSource = vi.fn();
    addLayer = vi.fn();
    constructor() {
      mocks.mapas.push(this);
    }
    on(ev: string, fn: (e: unknown) => void) {
      this.handlers[ev] = fn;
    }
  }
  class Marker {
    lngLat: [number, number] = [0, 0];
    setLngLat = vi.fn((p: [number, number]) => {
      this.lngLat = p;
      return this;
    });
    constructor() {
      mocks.marcadores.push(this);
    }
    addTo() {
      return this;
    }
    on() {
      return this;
    }
    getLngLat() {
      return { lng: this.lngLat[0], lat: this.lngLat[1] };
    }
  }
  class NavigationControl {}
  return { Map, Marker, NavigationControl };
});
vi.mock("./lib/entorno", async (orig) => ({ ...(await orig<typeof import("./lib/entorno")>()), hayWebGL: () => mocks.webgl.activo }));

function Arnes() {
  const [lon, setLon] = useState("");
  const [lat, setLat] = useState("");
  return (
    <ChakraProvider theme={theme}>
      <input aria-label="lon" value={lon} onChange={(e) => setLon(e.target.value)} />
      <input aria-label="lat" value={lat} onChange={(e) => setLat(e.target.value)} />
      <ElegirEnMapa
        lon={lon}
        lat={lat}
        onChange={(p) => {
          setLon(String(p.lon).replace(".", ","));
          setLat(String(p.lat).replace(".", ","));
        }}
      />
    </ChakraProvider>
  );
}

beforeEach(() => {
  mocks.mapas.length = 0;
  mocks.marcadores.length = 0;
  mocks.webgl.activo = true;
  fijarToken(null);
});

describe("textoPuntoEnSector", () => {
  it("ubica un punto en S4, fuera de los sectores y sin punto", () => {
    expect(textoPuntoEnSector(-58.139, -26.18)).toBe("Marcaste un punto dentro del Sector S4 · Rural Este (SIMULADO).");
    expect(textoPuntoEnSector(-57, -25)).toBe("Marcaste un punto fuera de los sectores simulados.");
    expect(textoPuntoEnSector(null, null)).toBe("Todavía no marcaste ningún punto.");
    expect(textoPuntoEnSector(Number.NaN, -26)).toBe("Todavía no marcaste ningún punto.");
  });
});

describe("ElegirEnMapa", () => {
  it("no crea el mapa hasta abrirlo; al marcar un punto completa los campos y lo ubica en el sector", async () => {
    render(<Arnes />);
    expect(mocks.mapas).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Marcar en el mapa" }));
    await waitFor(() => expect(mocks.mapas).toHaveLength(1));
    expect(screen.getByLabelText(/^Mapa para marcar tu ubicación/)).toBeInTheDocument();
    expect(screen.getByText(/Mapa base: OpenStreetMap \(ODbL\)/)).toBeInTheDocument();

    mocks.mapas[0].handlers.click({ lngLat: { lng: -58.139004, lat: -26.18 } });
    await waitFor(() => expect(screen.getByLabelText("lon")).toHaveValue("-58,139"));
    expect(screen.getByLabelText("lat")).toHaveValue("-26,18");
    expect(screen.getByText("Marcaste un punto dentro del Sector S4 · Rural Este (SIMULADO).")).toBeInTheDocument();
  });

  it("los campos manuales mueven el marcador y el texto del sector", async () => {
    render(<Arnes />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar en el mapa" }));
    await waitFor(() => expect(mocks.mapas).toHaveLength(1));
    fireEvent.change(screen.getByLabelText("lon"), { target: { value: "-58,19" } });
    fireEvent.change(screen.getByLabelText("lat"), { target: { value: "-26,155" } });
    await waitFor(() => expect(mocks.marcadores[mocks.marcadores.length - 1]?.lngLat).toEqual([-58.19, -26.155]));
    expect(screen.getByText("Marcaste un punto dentro del Sector S1 · Norte (SIMULADO).")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("lon"), { target: { value: "-57" } });
    expect(screen.getByText("Marcaste un punto fuera de los sectores simulados.")).toBeInTheDocument();
  });

  it("sin WebGL avisa y deja los campos manuales", () => {
    mocks.webgl.activo = false;
    render(<Arnes />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar en el mapa" }));
    expect(screen.getByText(/El mapa no está disponible en este dispositivo/)).toBeInTheDocument();
    expect(mocks.mapas).toHaveLength(0);
    expect(screen.getByLabelText("lat")).toBeInTheDocument();
  });
});

describe("PedirAyuda: Personas", () => {
  const montar = () =>
    render(
      <ChakraProvider theme={theme}>
        <MemoryRouter>
          <PedirAyuda esProductor={false} />
        </MemoryRouter>
      </ChakraProvider>,
    );

  it("arranca en el tamaño del grupo familiar", async () => {
    simularFetch({ "GET /mi/grupo-familiar": () => ({ estado: 200, json: { integrantes: 4 } }) });
    montar();
    await waitFor(() => expect(screen.getByLabelText(/^Personas/)).toHaveValue("4"));
  });

  it("sin grupo cargado arranca en 1 y rechaza 0", async () => {
    const f = simularFetch();
    montar();
    await waitFor(() => expect(f).toHaveBeenCalled());
    const campo = screen.getByLabelText(/^Personas/);
    expect(campo).toHaveValue("1");
    fireEvent.change(campo, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(await screen.findByText("Entre 1 y 500 personas.")).toBeInTheDocument();
  });

  it("no pisa lo que la persona ya escribió", async () => {
    simularFetch({ "GET /mi/grupo-familiar": () => ({ estado: 200, json: { integrantes: 6 } }) });
    montar();
    fireEvent.change(screen.getByLabelText(/^Personas/), { target: { value: "2" } });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByLabelText(/^Personas/)).toHaveValue("2");
  });
});
