import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import type { Pedido } from "./lib/pedidos";
import { validarParte, type Parte } from "./lib/partes";
import { LineaTiempoPedido } from "./pages/micuenta/LineaTiempoPedido";
import { theme } from "./theme";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

class FakeWS {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  send() {}
  close() {}
}

const BASE = {
  cuadrilla_id: 1,
  orden_id: null,
  sector_id: "S4",
  descripcion: null,
  estado: "en_curso",
  checklist: [],
  creado_en: "2026-11-17T10:00:00Z",
  actualizado_en: "2026-11-17T10:00:00Z",
};
const EVACUACION = { ...BASE, id: 7, solicitud_id: 3, titulo: "Traslado de hacienda en S4" };
const GENERAL = { ...BASE, id: 8, solicitud_id: null, titulo: "Revisar el acceso norte" };

const ok = (json: unknown) => () => ({ estado: 200, json });
const parte = (extra: Partial<Parte>): Parte => ({ id: 1, tarea_id: 7, cuadrilla_id: 1, tipo: "avance", resultado: null, observacion: null, autor_rol: "coordinador_sector", creado_en: "2026-11-17T12:00:00Z", resuelta: null, ...extra });

function conCuadrilla(tareas: unknown[], extra: Parameters<typeof simularFetch>[0] = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({
    "POST /auth/refresh": () => sesion("cuadrilla"),
    "GET /tareas": ok({ tareas }),
    "GET /mi/notificaciones": ok({ notificaciones: [], no_leidas: 0 }),
    "GET /tareas/7/partes": ok({ items: [] }),
    "GET /tareas/8/partes": ok({ items: [] }),
    ...extra,
  });
}

const cuerpoDe = (f: ReturnType<typeof simularFetch>, clave: string, n = 0) => JSON.parse(String((llamadas(f, clave)[n][1] as RequestInit).body)) as unknown;
const escribir = (etiqueta: string | RegExp, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

describe("validación de partes", () => {
  it("la observación es obligatoria en una dificultad y en un resultado que no es completa", () => {
    expect(validarParte("dificultad", null, "  ")).toHaveProperty("error");
    expect(validarParte("dificultad", null, "ab")).toHaveProperty("error");
    expect(validarParte("resultado", "parcial", "")).toHaveProperty("error");
    expect(validarParte("resultado", "no_realizada", "x".repeat(1001))).toHaveProperty("error");
    expect(validarParte("resultado", null, "algo")).toHaveProperty("error");
    expect(validarParte("resultado", "completa", "")).toEqual({ cuerpo: { tipo: "resultado", resultado: "completa", observacion: null } });
    expect(validarParte("avance", null, "")).toEqual({ cuerpo: { tipo: "avance", resultado: null, observacion: null } });
  });
});

describe("partes de la cuadrilla", () => {
  it("informar avance envía el tipo y la observación opcional", async () => {
    const f = conCuadrilla([EVACUACION], { "POST /tareas/7/partes": () => ({ estado: 201, json: parte({ observacion: "Llegamos al paraje" }) }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Informar avance" }));
    escribir("Novedad (opcional)", "Llegamos al paraje");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/7/partes")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /tareas/7/partes")).toEqual({ tipo: "avance", resultado: null, observacion: "Llegamos al paraje" });
    expect(await screen.findByText("Avance informado.")).toBeInTheDocument();
  });

  it("informar dificultad sin observación no envía nada y con observación sí", async () => {
    const f = conCuadrilla([EVACUACION], { "POST /tareas/7/partes": () => ({ estado: 201, json: parte({ tipo: "dificultad", observacion: "Camino cortado", resuelta: false }) }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Informar dificultad" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(/la observación es obligatoria/)).toBeInTheDocument();
    expect(llamadas(f, "POST /tareas/7/partes")).toHaveLength(0);
    escribir(/Observación/, "Camino cortado");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/7/partes")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /tareas/7/partes")).toEqual({ tipo: "dificultad", resultado: null, observacion: "Camino cortado" });
  });

  it("terminar «a medias» exige observación y envía el resultado parcial", async () => {
    const f = conCuadrilla([GENERAL], { "POST /tareas/8/partes": () => ({ estado: 201, json: parte({ tarea_id: 8, tipo: "resultado", resultado: "parcial", observacion: "Faltó un vehículo" }) }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/A medias/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(/la observación es obligatoria/)).toBeInTheDocument();
    expect(llamadas(f, "POST /tareas/8/partes")).toHaveLength(0);
    escribir(/Observación/, "Faltó un vehículo");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/8/partes")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /tareas/8/partes")).toEqual({ tipo: "resultado", resultado: "parcial", observacion: "Faltó un vehículo" });
  });

  it("«No se pudo» y «Reprogramar» envían su resultado", async () => {
    const f = conCuadrilla([GENERAL], { "POST /tareas/8/partes": () => ({ estado: 201, json: parte({ tarea_id: 8, tipo: "resultado" }) }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/No se pudo/));
    escribir(/Observación/, "No responden en el domicilio");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/8/partes")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /tareas/8/partes")).toMatchObject({ resultado: "no_realizada" });

    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/Reprogramar/));
    escribir(/Observación/, "Volvemos mañana");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/8/partes")).toHaveLength(2));
    expect(cuerpoDe(f, "POST /tareas/8/partes", 1)).toMatchObject({ resultado: "reprogramada", observacion: "Volvemos mañana" });
  });

  it("terminar «completa» una tarea común no pide observación", async () => {
    const f = conCuadrilla([GENERAL], { "POST /tareas/8/partes": () => ({ estado: 201, json: parte({ tarea_id: 8, tipo: "resultado", resultado: "completa" }) }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/Completa/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/8/partes")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /tareas/8/partes")).toEqual({ tipo: "resultado", resultado: "completa", observacion: null });
  });

  it("en una evacuación, «Completa» lleva al cierre con constancia sin enviar el parte", async () => {
    const f = conCuadrilla([EVACUACION], { "GET /centros": ok({ centros: [] }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/Completa/));
    fireEvent.click(screen.getByRole("button", { name: "Continuar con la constancia" }));
    expect(await screen.findByLabelText("Constancia de la tarea 7")).toBeInTheDocument();
    expect(llamadas(f, "POST /tareas/7/partes")).toHaveLength(0);
  });

  it("si el servidor responde 409 por la constancia, abre ese formulario", async () => {
    const f = conCuadrilla([GENERAL], {
      "POST /tareas/8/partes": () => ({ estado: 409, json: { error: { codigo: "conflicto", mensaje: "Cerrá la tarea con constancia", detalle: [] } } }),
      "GET /centros": ok({ centros: [] }),
    });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/Completa/));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByLabelText("Constancia de la tarea 8")).toBeInTheDocument();
    expect(llamadas(f, "POST /tareas/8/partes")).toHaveLength(1);
    expect(screen.queryByText("Cerrá la tarea con constancia")).not.toBeInTheDocument();
  });

  it("muestra el mensaje del servidor ante un 403 o un 422", async () => {
    conCuadrilla([GENERAL], { "POST /tareas/8/partes": () => ({ estado: 403, json: { error: { codigo: "prohibido", mensaje: "No integrás la cuadrilla de esta tarea", detalle: [] } } }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Informar avance" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("No integrás la cuadrilla de esta tarea")).toBeInTheDocument();
  });

  it("el historial muestra tipo, observación y rol, resalta la dificultad abierta y marca la resuelta", async () => {
    conCuadrilla([EVACUACION], {
      "GET /tareas/7/partes": ok({
        items: [
          parte({ id: 3, tipo: "dificultad", observacion: "Camino cortado en el km 12", resuelta: false }),
          parte({ id: 2, tipo: "dificultad", observacion: "Falta vehículo", resuelta: true, autor_rol: "veterinario" }),
          parte({ id: 1, tipo: "resultado", resultado: "parcial", observacion: "Quedó la mitad" }),
        ],
      }),
    });
    renderRuta("/cuadrilla");
    const h = await screen.findByTestId("historial-7");
    expect(await within(h).findByText("Camino cortado en el km 12")).toBeInTheDocument();
    expect(within(await screen.findByTestId("parte-3")).getByText("Dificultad abierta")).toBeInTheDocument();
    expect(screen.getByTestId("parte-3")).toHaveAttribute("data-abierta", "true");
    expect(within(screen.getByTestId("parte-2")).getByText("Dificultad resuelta")).toBeInTheDocument();
    expect(screen.getByTestId("parte-2")).toHaveAttribute("data-abierta", "false");
    expect(within(screen.getByTestId("parte-1")).getByText("Resultado: a medias")).toBeInTheDocument();
    expect(within(screen.getByTestId("parte-2")).getByText(/Veterinario/)).toBeInTheDocument();
  });

  it("historial vacío y banner «Requiere atención» tras un resultado no completo", async () => {
    conCuadrilla([{ ...EVACUACION, estado: "pendiente", requiere_atencion: true }, { ...GENERAL, estado: "pendiente" }]);
    renderRuta("/cuadrilla");
    expect(await screen.findByTestId("atencion-7")).toHaveTextContent("Requiere atención");
    expect(screen.queryByTestId("atencion-8")).not.toBeInTheDocument();
    expect((await screen.findAllByText("Todavía no informaste nada sobre esta tarea.")).length).toBe(2);
  });
});

const PEDIDO: Pedido = {
  id: 5,
  tipo: "evacuacion",
  personas: 4,
  estado: "en_curso",
  origen: "app",
  creada_en: "2026-11-19T12:00:00Z",
  lat: null,
  lon: null,
  sector_id: "S4",
  linea_tiempo: [],
  tarea: null,
  seguimiento: null,
  confirmacion: null,
  centro: null,
};

describe("novedad en la línea de tiempo del pedido", () => {
  const pintar = (p: Pedido) => render(<ChakraProvider theme={theme}><LineaTiempoPedido pedido={p} /></ChakraProvider>);

  it.each([
    ["dificultad", "La cuadrilla informó una dificultad y el operador ya lo sabe."],
    ["demora", "La cuadrilla informó una demora."],
    ["parcial", "La tarea quedó a medias: el operador va a reprogramarla."],
    ["no_realizada", "La cuadrilla no pudo completar la tarea: el operador va a reprogramarla."],
    ["reprogramada", "La cuadrilla no pudo completar la tarea: el operador va a reprogramarla."],
  ] as const)("novedad %s", (tipo, texto) => {
    // La observación nunca llega al ciudadano; aunque el servidor mandara un campo extra, no se pinta.
    pintar({ ...PEDIDO, novedad: { tipo, en: "2026-11-19T13:00:00Z", observacion: "Detalle interno del operativo" } as Pedido["novedad"] });
    expect(screen.getByTestId("novedad-5")).toHaveTextContent(texto);
    expect(screen.queryByText(/Detalle interno/)).not.toBeInTheDocument();
  });

  it("sin novedad no muestra la línea", () => {
    pintar({ ...PEDIDO, novedad: null });
    expect(screen.queryByTestId("novedad-5")).not.toBeInTheDocument();
    pintar({ ...PEDIDO });
    expect(screen.queryByTestId("novedad-5")).not.toBeInTheDocument();
  });
});
