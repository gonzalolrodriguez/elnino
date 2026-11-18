import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

class FakeWS {
  static instancias: FakeWS[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) {
    FakeWS.instancias.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {}
}

const TAREA = {
  id: 7,
  cuadrilla_id: 1,
  solicitud_id: 3,
  orden_id: null,
  sector_id: "S4",
  titulo: "Traslado de hacienda en S4",
  descripcion: null,
  estado: "pendiente",
  checklist: [
    { item: "Verificar acceso", hecho: false },
    { item: "Confirmar destino", hecho: false },
  ],
  creado_en: "2026-11-17T10:00:00Z",
  actualizado_en: "2026-11-17T10:00:00Z",
};
const ok = (json: unknown) => () => ({ estado: 200, json });

function conSesion(rol: string, extra: Parameters<typeof simularFetch>[0] = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({
    "POST /auth/refresh": () => sesion(rol),
    "GET /tareas": ok({ tareas: [TAREA] }),
    "GET /mi/notificaciones": ok({ notificaciones: [{ id: 1, orden_id: 2, mensaje: "Orden de evacuación preventiva", leida: false, creada_en: "2026-11-17T10:00:00Z" }], no_leidas: 1 }),
    ...extra,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  FakeWS.instancias = [];
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

describe("pantalla de cuadrilla", () => {
  it("tras el login, la cuadrilla llega a /cuadrilla", async () => {
    simularFetch({
      "POST /auth/login": () => sesion("cuadrilla"),
      "GET /tareas": ok({ tareas: [TAREA] }),
      "GET /mi/notificaciones": ok({ notificaciones: [], no_leidas: 0 }),
    });
    renderRuta("/login");
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "cuadrilla@demo.evacuaciones.invalid" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "clave-de-demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("heading", { name: "Mis tareas" })).toBeInTheDocument();
    expect(await screen.findByText("Traslado de hacienda en S4")).toBeInTheDocument();
  });

  it("un ciudadano no puede abrir /cuadrilla", async () => {
    conSesion("ciudadano", { "GET /mi/grupo-familiar": ok(null) });
    renderRuta("/cuadrilla");
    expect(await screen.findByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mis tareas" })).not.toBeInTheDocument();
  });

  it("mostrar tareas, alertas y enviar el token solo en el primer mensaje del WS", async () => {
    conSesion("cuadrilla");
    renderRuta("/cuadrilla");
    expect(await screen.findByText("Solicitud n.º 3", { exact: false })).toBeInTheDocument();
    expect(await screen.findByText("Orden de evacuación preventiva")).toBeInTheDocument();
    await waitFor(() => expect(FakeWS.instancias.length).toBeGreaterThan(0));
    const ws = FakeWS.instancias[0];
    expect(ws.url).not.toContain("tok-en-memoria");
    ws.onopen?.();
    expect(JSON.parse(ws.sent[0])).toEqual({ token: "tok-en-memoria" });
  });

  it("al marcar un ítem del checklist envía PATCH con la lista completa", async () => {
    const f = conSesion("cuadrilla", {
      "PATCH /tareas/7": (cuerpo) => ({ estado: 200, json: { ...TAREA, checklist: (cuerpo as { checklist: unknown }).checklist } }),
    });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByLabelText("Verificar acceso"));
    await waitFor(() => expect(llamadas(f, "PATCH /tareas/7")).toHaveLength(1));
    const init = llamadas(f, "PATCH /tareas/7")[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      checklist: [
        { item: "Verificar acceso", hecho: true },
        { item: "Confirmar destino", hecho: false },
      ],
    });
    await waitFor(() => expect(screen.getByLabelText("Verificar acceso")).toBeChecked());
  });

  it("al iniciar la tarea el estado cambia en la lista", async () => {
    const f = conSesion("cuadrilla", {
      "PATCH /tareas/7": () => ({ estado: 200, json: { ...TAREA, estado: "en_curso" } }),
    });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar" }));
    await waitFor(() => expect(screen.getByTestId("estado-7")).toHaveTextContent("En curso"));
    expect(JSON.parse(String((llamadas(f, "PATCH /tareas/7")[0][1] as RequestInit).body))).toEqual({ estado: "en_curso" });
    expect(screen.getByRole("button", { name: "Completar" })).toBeInTheDocument();
  });

  it("muestra el estado vacío y el error de carga", async () => {
    conSesion("cuadrilla", { "GET /tareas": ok({ tareas: [] }) });
    renderRuta("/cuadrilla");
    expect(await screen.findByText("No tenés tareas asignadas.")).toBeInTheDocument();
  });

  it("un evento de tarea en tiempo real recarga la lista", async () => {
    let n = 0;
    conSesion("cuadrilla", { "GET /tareas": () => ({ estado: 200, json: { tareas: [{ ...TAREA, estado: n++ === 0 ? "pendiente" : "en_curso" }] } }) });
    renderRuta("/cuadrilla");
    await screen.findByText("Traslado de hacienda en S4");
    await waitFor(() => expect(FakeWS.instancias.length).toBeGreaterThan(0));
    FakeWS.instancias[0].onmessage?.({ data: JSON.stringify({ tipo: "tarea", datos: { id: 7, estado: "en_curso" } }) });
    await waitFor(() => expect(screen.getByTestId("estado-7")).toHaveTextContent("En curso"));
  });
});
