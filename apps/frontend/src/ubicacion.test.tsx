import { fireEvent, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { reiniciarContorno } from "./lib/provincia";
import { renderRuta, simularFetch } from "./test/utils";

const CONTORNO = JSON.parse(readFileSync(resolve(process.cwd(), "public", "capas", "provincia_contorno.json"), "utf-8"));
const BOTON = { name: "Usar mi ubicación actual" };

function definir(objeto: object, clave: string, valor: unknown) {
  Object.defineProperty(objeto, clave, { configurable: true, writable: true, value: valor });
}

type Posicion = { lat: number; lon: number; precision: number };
const posicion = ({ lat, lon, precision }: Posicion) => ({ coords: { latitude: lat, longitude: lon, accuracy: precision } });

function geolocalizacion(respuesta: (ok: (p: unknown) => void, error: (e: { code: number }) => void) => void) {
  const getCurrentPosition = vi.fn((ok: (p: unknown) => void, error: (e: { code: number }) => void, opciones?: PositionOptions) => {
    void opciones;
    respuesta(ok, error);
  });
  definir(navigator, "geolocation", { getCurrentPosition });
  return getCurrentPosition;
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  reiniciarContorno();
  definir(window, "isSecureContext", true);
  simularFetch({ "GET /capas/provincia_contorno.json": () => ({ estado: 200, json: CONTORNO }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  definir(navigator, "geolocation", undefined);
});

async function abrir(ruta: string) {
  renderRuta(ruta);
  await screen.findByRole("heading", { level: 1, name: /^Registro de/ });
}

const valor = (etiqueta: RegExp) => (screen.getByLabelText(etiqueta) as HTMLInputElement).value;

describe("ubicación del dispositivo", () => {
  it("no consulta la ubicación hasta que se hace clic", async () => {
    const g = geolocalizacion((ok) => ok(posicion({ lat: -26.18, lon: -58.18, precision: 10 })));
    await abrir("/registro/ciudadania");
    expect(g).not.toHaveBeenCalled();
    expect(screen.getByText(/No se guarda hasta que envíes el formulario/)).toBeInTheDocument();
  });

  it("completa latitud y longitud con la precisión y deja Latitud antes que Longitud", async () => {
    const g = geolocalizacion((ok) => ok(posicion({ lat: -26.1830049, lon: -58.1829951, precision: 24.6 })));
    await abrir("/registro/ciudadania");
    const lat = screen.getByLabelText(/^Latitud/);
    const lon = screen.getByLabelText(/^Longitud/);
    expect(lat.compareDocumentPosition(lon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", BOTON));
    expect(g).toHaveBeenCalledTimes(1);
    expect(g.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    expect(await screen.findByText(/Precisión aproximada: ± 25 m/)).toBeInTheDocument();
    expect(valor(/^Latitud/)).toBe("-26,183");
    expect(valor(/^Longitud/)).toBe("-58,183");
    expect(screen.queryByText(/fuera de la provincia/)).not.toBeInTheDocument();
  });

  it("en el registro de productores completa la tranquera y ubica el sector", async () => {
    geolocalizacion((ok) => ok(posicion({ lat: -26.18, lon: -58.139, precision: 8 })));
    await abrir("/registro/productor");
    fireEvent.click(screen.getByRole("button", BOTON));
    expect(await screen.findByText(/dentro del Sector S4/)).toBeInTheDocument();
    expect(valor(/^Longitud/)).toBe("-58,139");
  });

  it("explica cómo habilitar el permiso si fue denegado", async () => {
    geolocalizacion((_ok, error) => error({ code: 1 }));
    await abrir("/registro/ciudadania");
    fireEvent.click(screen.getByRole("button", BOTON));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Habilitalo en el navegador/);
    expect(valor(/^Latitud/)).toBe("");
  });

  it("distingue ubicación no disponible y tiempo agotado", async () => {
    let codigo = 2;
    geolocalizacion((_ok, error) => error({ code: codigo }));
    await abrir("/registro/ciudadania");
    fireEvent.click(screen.getByRole("button", BOTON));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo determinar tu ubicación/);
    codigo = 3;
    fireEvent.click(screen.getByRole("button", BOTON));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/más de 10 segundos/));
  });

  it("en un contexto inseguro explica la alternativa y no llama al navegador", async () => {
    definir(window, "isSecureContext", false);
    const g = geolocalizacion((ok) => ok(posicion({ lat: -26.18, lon: -58.18, precision: 10 })));
    await abrir("/registro/ciudadania");
    fireEvent.click(screen.getByRole("button", BOTON));
    expect(await screen.findByRole("alert")).toHaveTextContent(/dirección segura \(https\)/);
    expect(g).not.toHaveBeenCalled();
  });

  it("avisa si el navegador no admite geolocalización", async () => {
    await abrir("/registro/ciudadania");
    fireEvent.click(screen.getByRole("button", BOTON));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no permite obtener la ubicación/);
  });
});

describe("aviso de ubicación fuera de Formosa", () => {
  it("aparece para un punto fuera de la provincia, sin bloquear el formulario", async () => {
    await abrir("/registro/ciudadania");
    fireEvent.change(screen.getByLabelText(/^Latitud/), { target: { value: "-31" } });
    fireEvent.change(screen.getByLabelText(/^Longitud/), { target: { value: "-60" } });
    expect(await screen.findByText("La ubicación queda fuera de la provincia de Formosa. Revisala.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
  });

  it("no aparece para un punto dentro de la provincia", async () => {
    const f = simularFetch({ "GET /capas/provincia_contorno.json": () => ({ estado: 200, json: CONTORNO }) });
    await abrir("/registro/ciudadania");
    fireEvent.change(screen.getByLabelText(/^Latitud/), { target: { value: "-26,18" } });
    fireEvent.change(screen.getByLabelText(/^Longitud/), { target: { value: "-58,18" } });
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("provincia_contorno"))).toBe(true));
    await waitFor(() => expect(screen.getByText(/dentro del Sector/)).toBeInTheDocument());
    expect(screen.queryByText(/fuera de la provincia/)).not.toBeInTheDocument();
  });
});
