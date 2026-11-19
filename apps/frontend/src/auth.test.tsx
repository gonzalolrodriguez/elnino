import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken, obtenerToken } from "./lib/api";
import { llamadas, renderRuta, sesion, simularFetch, USUARIO } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

async function ingresar(rol: string, ruta = "/login") {
  const f = simularFetch({
    "POST /auth/login": () => sesion(rol),
    "GET /auth/yo": () => ({ estado: 200, json: { ...USUARIO, rol } }),
  });
  renderRuta(ruta);
  fireEvent.change(screen.getByLabelText(/^Correo electrónico/), { target: { value: "ana@ejemplo.invalid" } });
  fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: "UnaClaveLarga-2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  return f;
}

describe("ingreso", () => {
  it("guarda el token solo en memoria y envía las credenciales con cookie", async () => {
    const f = await ingresar("ciudadano");
    expect(await screen.findByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(obtenerToken()).toBe("tok-en-memoria");
    const guardado = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
    expect(guardado).not.toContain("tok-en-memoria");
    const [url, init] = llamadas(f, "POST /auth/login")[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(init.credentials).toBe("include");
    // Las consultas privadas llevan el token en la cabecera Authorization.
    await waitFor(() => expect(llamadas(f, "GET /auth/yo").length).toBeGreaterThan(0));
    expect((llamadas(f, "GET /auth/yo")[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-en-memoria" });
  });

  it("muestra el error de credenciales incorrectas", async () => {
    simularFetch({
      "POST /auth/login": () => ({ estado: 401, json: { error: { codigo: "no_autenticado", mensaje: "Credenciales incorrectas", detalle: [] } } }),
    });
    renderRuta("/login");
    fireEvent.change(screen.getByLabelText(/^Correo electrónico/), { target: { value: "ana@ejemplo.invalid" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: "mal" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales incorrectas");
    expect(obtenerToken()).toBeNull();
  });

  it("pide los dos campos antes de llamar al backend", async () => {
    const f = simularFetch();
    renderRuta("/login");
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Ingresá tu correo electrónico.")).toBeInTheDocument();
    expect(llamadas(f, "POST /auth/login")).toHaveLength(0);
  });
});

describe("guardas por rol", () => {
  it("un operador ingresa y llega al panel operativo", async () => {
    await ingresar("operador");
    expect(await screen.findByRole("heading", { name: "Tablero" })).toBeInTheDocument();
  });

  it("un ciudadano con sesión que pide /comando es redirigido a su cuenta", async () => {
    simularFetch({ "POST /auth/refresh": () => sesion("ciudadano"), "GET /auth/yo": () => ({ estado: 200, json: USUARIO }) });
    window.localStorage.setItem("e3_sesion", "1");
    renderRuta("/comando");
    expect(await screen.findByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
  });

  it("sin marca de sesión no intenta renovar el token", async () => {
    const f = simularFetch();
    renderRuta("/");
    await screen.findByRole("heading", { name: /Información para|Del Pantanal/ });
    expect(llamadas(f, "POST /auth/refresh")).toHaveLength(0);
  });
});
