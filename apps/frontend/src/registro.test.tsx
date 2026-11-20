import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { llamadas, renderRuta, simularFetch } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

async function abrir(ruta: string) {
  renderRuta(ruta);
  await screen.findByRole("heading", { level: 1, name: /^Registro de/ });
}

const escribir = (etiqueta: RegExp, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

function llenarAcceso(password = "UnaClaveLarga-2026") {
  escribir(/^Nombre para mostrar/, "Ana Prueba");
  escribir(/^Correo electrónico/, "ana@ejemplo.invalid");
  escribir(/^Contraseña/, password);
}

describe("registro de ciudadanía", () => {
  it("exige el consentimiento y no llama al backend", async () => {
    const f = simularFetch();
    await abrir("/registro/ciudadania");
    llenarAcceso();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText(/Necesitamos tu consentimiento informado/)).toBeInTheDocument();
    expect(llamadas(f, "POST /auth/registro/ciudadano")).toHaveLength(0);
  });

  it("rechaza una contraseña de menos de 10 caracteres", async () => {
    const f = simularFetch();
    await abrir("/registro/ciudadania");
    llenarAcceso("corta123");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText(/al menos 10 caracteres\./, { selector: "div" })).toBeInTheDocument();
    expect(llamadas(f, "POST /auth/registro/ciudadano")).toHaveLength(0);
  });

  it("registra y confirma cuando el backend responde 201", async () => {
    const f = simularFetch({
      "POST /auth/registro/ciudadano": () => ({
        estado: 201,
        json: { id: 9, email: "ana@ejemplo.invalid", nombre_visible: "Ana Prueba", rol: "ciudadano" },
      }),
    });
    await abrir("/registro/ciudadania");
    llenarAcceso();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Registro creado")).toBeInTheDocument();
    const [llamada] = llamadas(f, "POST /auth/registro/ciudadano");
    const cuerpo = JSON.parse((llamada[1] as RequestInit).body as string);
    expect(cuerpo).toMatchObject({ email: "ana@ejemplo.invalid", consentimiento: true, integrantes: 1 });
    expect(cuerpo).not.toHaveProperty("lon");
  });

  it("muestra el sobre de error del backend con su detalle", async () => {
    simularFetch({
      "POST /auth/registro/ciudadano": () => ({
        estado: 409,
        json: { error: { codigo: "conflicto", mensaje: "El correo ya está registrado", detalle: [{ campo: "body.email", mensaje: "Ya existe una cuenta" }] } },
      }),
    });
    await abrir("/registro/ciudadania");
    llenarAcceso();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("El correo ya está registrado");
    expect(alerta).toHaveTextContent("email: Ya existe una cuenta");
    expect(alerta).toHaveTextContent("conflicto");
  });

  it("informa si no hay conexión", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("red"))));
    await abrir("/registro/ciudadania");
    llenarAcceso();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No hay conexión con el servicio/);
  });
});

describe("registro de productores", () => {
  it("envía el establecimiento con la ubicación del ejemplo en S4", async () => {
    const f = simularFetch({
      "POST /auth/registro/productor": () => ({ estado: 201, json: { id: 10, email: "ana@ejemplo.invalid" } }),
    });
    await abrir("/registro/productor");
    llenarAcceso();
    escribir(/^Nombre del establecimiento/, "Establecimiento de prueba");
    fireEvent.click(screen.getByRole("button", { name: "Usar el ejemplo del sector S4" }));
    expect(screen.getByText(/dentro del Sector S4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar hacienda" }));
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "vaca con cría" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Crear cuenta y registrar establecimiento/ }));
    expect(await screen.findByText("Registro creado")).toBeInTheDocument();
    const cuerpo = JSON.parse((llamadas(f, "POST /auth/registro/productor")[0][1] as RequestInit).body as string);
    expect(cuerpo.establecimiento).toMatchObject({
      nombre: "Establecimiento de prueba",
      lon: -58.139,
      lat: -26.18,
      stock: [{ especie: "bovino", categoria_animal: "vaca con cría", cantidad: 5 }],
    });
  });

  it("valida la ubicación y el nombre antes de enviar", async () => {
    const f = simularFetch();
    await abrir("/registro/productor");
    llenarAcceso();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Crear cuenta y registrar establecimiento/ }));
    expect(await screen.findByText(/La longitud debe estar entre -180 y 180/)).toBeInTheDocument();
    expect(screen.getByText(/nombre del establecimiento debe tener/)).toBeInTheDocument();
    await waitFor(() => expect(llamadas(f, "POST /auth/registro/productor")).toHaveLength(0));
  });
});
