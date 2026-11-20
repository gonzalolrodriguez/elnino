import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { normalizarRespuesta } from "./panel/evacuaciones/RespuestaConfirmacion";
import { renderRuta, sesion, simularFetch } from "./test/utils";

vi.mock("./panel/MapaGL", async () => {
  const React = await import("react");
  return { default: () => React.createElement("div", { "data-testid": "mapa" }) };
});

class FakeWS {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  send() {}
  close() {}
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

describe("portada según la sesión", () => {
  it.each([
    ["ciudadano", "Ir a mi cuenta", "/mi-cuenta"],
    ["productor", "Ir a mi cuenta", "/mi-cuenta"],
    ["operador", "Ir al panel operativo", "/comando"],
    ["decisor", "Ir al panel operativo", "/comando"],
    ["cuadrilla", "Ver mis tareas", "/cuadrilla"],
    ["admin", "Ir a administración", "/admin"],
  ])("con sesión de %s muestra «%s», sin el selector de perfil", { timeout: 20000 }, async (rol, texto, destino) => {
    window.localStorage.setItem("e3_sesion", "1");
    simularFetch({ "POST /auth/refresh": () => sesion(rol) });
    renderRuta("/");
    const bloque = await screen.findByTestId("portada-sesion");
    expect(bloque).toHaveTextContent("Hola, Ana Prueba");
    const boton = within(bloque).getByRole("link", { name: texto });
    expect(boton).toHaveAttribute("href", destino);
    expect(within(bloque).getByRole("link", { name: "Descargar la app" })).toBeInTheDocument();
    expect(screen.queryByText("¿Cómo querés ingresar?")).toBeNull();
    // El botón principal del hero hace lo mismo.
    expect(screen.queryByRole("link", { name: "Elegir mi perfil" })).toBeNull();
    expect(screen.getAllByRole("link", { name: texto }).length).toBeGreaterThanOrEqual(2);
  });

  it("sin sesión conserva el selector de perfil y el botón «Elegir mi perfil»", async () => {
    simularFetch({});
    renderRuta("/");
    expect(await screen.findByText("¿Cómo querés ingresar?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir mi perfil" })).toHaveAttribute("href", "#ingreso");
    expect(screen.queryByTestId("portada-sesion")).toBeNull();
    // La franja de estado y los tres relojes siguen para todos.
    expect(screen.getByText("Entender la situación")).toBeInTheDocument();
  });

  it("«Recorrer el río» arranca plegado y se abre con el botón", async () => {
    simularFetch({});
    renderRuta("/");
    const alternar = await screen.findByTestId("recorrido-alternar");
    expect(alternar).toHaveTextContent("Recorrer el río");
    expect(alternar).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("recorrido-contenido")).toHaveStyle({ display: "none" });
    fireEvent.click(alternar);
    expect(alternar).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("recorrido-contenido")).not.toHaveStyle({ display: "none" });
  });
});

const evac = (tarea_id: number, respuesta: string | null) => ({
  tarea_id,
  tarea_estado: "completada",
  estado: respuesta === null ? "cerrada_cuadrilla" : respuesta === "completa" || respuesta === "si" ? "verificada" : "con_discrepancia",
  titulo: `Traslado ${tarea_id}`,
  sector_id: "S4",
  cuadrilla_id: 1,
  cuadrilla_nombre: "Cuadrilla humana 1",
  solicitud_id: 10 + tarea_id,
  orden_id: null,
  origen: null,
  constancia: null,
  confirmacion: respuesta ? { respuesta, canal: "app", comentario: null, solicitada_en: "2026-11-19T15:00:00Z", respondida_en: "2026-11-19T16:00:00Z" } : null,
  discrepancia: null,
  actualizado_en: "2026-11-19T15:00:00Z",
  categoria: "SIMULADO",
  fuente: "Plataforma",
});

describe("Evacuaciones: respuestas de la confirmación", () => {
  it("muestra las cinco respuestas y mapea las históricas", { timeout: 20000 }, async () => {
    window.localStorage.setItem("e3_sesion", "1");
    const respuestas = ["completa", "parcial", "no_encontraron", "no_vinieron", "otro_problema", "si", "no", "problema"];
    simularFetch({
      "POST /auth/refresh": () => sesion("operador"),
      "GET /evacuaciones": () => ({ estado: 200, json: { evacuaciones: respuestas.map((r, i) => evac(i + 1, r)), total: 8, limite: 200, offset: 0, categoria: "SIMULADO", fuente: "Plataforma", fecha_dato: "2026-11-19" } }),
      "GET /centros": () => ({ estado: 200, json: { centros: [] } }),
    });
    renderRuta("/comando/evacuaciones");
    await screen.findByTestId("evac-1", {}, { timeout: 10000 });
    const texto = (n: number) => screen.getByTestId(`evac-${n}`);
    expect(texto(1)).toHaveTextContent("Asistido por completo");
    expect(texto(2)).toHaveTextContent("Asistido en parte");
    expect(texto(3)).toHaveTextContent("No lo encontraron");
    expect(texto(4)).toHaveTextContent("No vinieron");
    expect(texto(5)).toHaveTextContent("Otro problema");
    expect(texto(6)).toHaveTextContent("Asistido por completo");
    expect(texto(7)).toHaveTextContent("No vinieron");
    expect(texto(8)).toHaveTextContent("Otro problema");
    // completa = verificada; el resto lleva marca de texto e ícono, no solo color.
    expect(texto(1).querySelector('[data-discrepancia="no"]')).not.toBeNull();
    expect(texto(2).querySelector('[data-discrepancia="si"]')).toHaveTextContent("! Asistido en parte (discrepancia a revisar)");
    expect(texto(7).querySelector('[data-discrepancia="si"]')).not.toBeNull();
  });

  it("normaliza los valores históricos", () => {
    expect(normalizarRespuesta("si")).toBe("completa");
    expect(normalizarRespuesta("no")).toBe("no_vinieron");
    expect(normalizarRespuesta("problema")).toBe("otro_problema");
    expect(normalizarRespuesta("parcial")).toBe("parcial");
    expect(normalizarRespuesta(null)).toBeNull();
  });
});
