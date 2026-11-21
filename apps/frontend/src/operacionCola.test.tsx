import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

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

type Rutas = Parameters<typeof simularFetch>[0];
function conSesion(rol: string, rutas: Rutas = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({ "POST /auth/refresh": () => sesion(rol), ...rutas });
}
const ok = (json: unknown, estado = 200) => () => ({ estado, json });

const hace = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const sol = (id: number, estado: string, min: number, extra: Record<string, unknown> = {}) => ({
  id,
  origen: "app",
  tipo: "evacuacion",
  personas: 3,
  animales: 0,
  texto: null,
  estado,
  sector_id: "S4",
  creado_en: hace(min),
  ...extra,
});
const SOLICITUDES = [
  sol(1, "resuelta", 3000),
  sol(2, "en_curso", 500),
  sol(3, "recibida", 20, { origen: "sms_sim", personas: 1 }),
  sol(4, "verificada", 200, { sector_id: "S1" }),
  sol(5, "recibida", 90, { texto: "Camino cortado en el paraje." }),
];
const CUADRILLAS = [
  { id: 1, nombre: "Cuadrilla humana 1", tipo_incidente: "humana", integrantes: [], roles_faltantes: [] },
  { id: 2, nombre: "Cuadrilla ganadera 1", tipo_incidente: "ganadera", integrantes: [], roles_faltantes: [] },
];
const base = (extra: Rutas = {}) => ({
  "GET /cuadrillas": ok({ cuadrillas: CUADRILLAS }),
  "GET /solicitudes": ok({ solicitudes: SOLICITUDES, total: SOLICITUDES.length }),
  "GET /tareas": ok({ tareas: [] }),
  ...extra,
});
const lista = () => within(screen.getByRole("list", { name: "Solicitudes sin resolver" }));

describe("Operación: cola de solicitudes", () => {
  it("ordena por estado y, dentro de cada uno, la más vieja primero; las resueltas quedan plegadas", async () => {
    conSesion("operador", base());
    renderRuta("/comando/operacion");
    await screen.findByTestId("solicitud-3", undefined, { timeout: 8000 });
    const filas = lista().getAllByRole("listitem").map((f) => f.getAttribute("data-testid"));
    expect(filas).toEqual(["solicitud-5", "solicitud-3", "solicitud-4", "solicitud-2"]);
    expect(screen.queryByTestId("solicitud-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mostrar las resueltas \(1\)/ }));
    expect(screen.getByTestId("solicitud-1")).toBeInTheDocument();
  });

  it("los chips de estado muestran cuántas hay y filtran la lista", async () => {
    conSesion("operador", base());
    renderRuta("/comando/operacion");
    await screen.findByTestId("solicitud-3");
    const estado = within(screen.getByRole("group", { name: "Estado" }));
    expect(estado.getByRole("button", { name: /Todas/ })).toHaveTextContent("5");
    expect(estado.getByRole("button", { name: /Recibida/ })).toHaveTextContent("2");
    fireEvent.click(estado.getByRole("button", { name: /Recibida/ }));
    expect(estado.getByRole("button", { name: /Recibida/ })).toHaveAttribute("aria-pressed", "true");
    expect(lista().getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByTestId("solicitud-2")).not.toBeInTheDocument();
  });

  it("el chip de sector pide al servidor solo ese sector y 'Quitar los filtros' vuelve al estado inicial", async () => {
    const f = conSesion("operador", base());
    renderRuta("/comando/operacion?estado=asignada");
    expect(await screen.findByText("No hay solicitudes con esos filtros.")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Sector" })).getByRole("button", { name: "S1" }));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("sector_id=S1"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Quitar los filtros" }));
    expect(await screen.findByTestId("solicitud-3")).toBeInTheDocument();
  });

  it("Verificar pasa la solicitud recibida a verificada", async () => {
    const f = conSesion("operador", base({ "PATCH /solicitudes/5": ok({ ...SOLICITUDES[4], estado: "verificada" }) }));
    renderRuta("/comando/operacion");
    const fila = await screen.findByTestId("solicitud-5");
    fireEvent.click(within(fila).getByRole("button", { name: "Verificar la solicitud 5" }));
    await waitFor(() => expect(llamadas(f, "PATCH /solicitudes/5")).toHaveLength(1));
    expect(JSON.parse((llamadas(f, "PATCH /solicitudes/5")[0][1] as RequestInit).body as string)).toEqual({ estado: "verificada" });
  });

  it("Asignar cuadrilla abre el selector en la misma fila y envía la cuadrilla elegida", async () => {
    const f = conSesion("operador", base({ "PATCH /solicitudes/4": ok({ ...SOLICITUDES[3], estado: "asignada" }) }));
    renderRuta("/comando/operacion");
    const fila = await screen.findByTestId("solicitud-4");
    fireEvent.click(within(fila).getByRole("button", { name: "Asignar cuadrilla a la solicitud 4" }));
    fireEvent.change(within(fila).getByLabelText("Cuadrilla para la solicitud 4"), { target: { value: "2" } });
    fireEvent.click(within(fila).getByRole("button", { name: "Confirmar la asignación de la solicitud 4" }));
    await waitFor(() => expect(llamadas(f, "PATCH /solicitudes/4")).toHaveLength(1));
    expect(JSON.parse((llamadas(f, "PATCH /solicitudes/4")[0][1] as RequestInit).body as string)).toEqual({ estado: "asignada", cuadrilla_id: 2 });
  });

  it("muestra el error del servidor si no se puede pasar de estado", async () => {
    conSesion("operador", base({ "PATCH /solicitudes/2": ok({ error: { codigo: "conflicto", mensaje: "No se puede resolver todavía.", detalle: [] } }, 409) }));
    renderRuta("/comando/operacion");
    const fila = await screen.findByTestId("solicitud-2");
    fireEvent.click(within(fila).getByRole("button", { name: "Marcar resuelta la solicitud 2" }));
    expect(await screen.findByText("No se puede resolver todavía.")).toBeInTheDocument();
  });

  it("estado vacío sin solicitudes", async () => {
    conSesion("operador", base({ "GET /solicitudes": ok({ solicitudes: [], total: 0 }) }));
    renderRuta("/comando/operacion");
    expect(await screen.findByText("No hay solicitudes en la cola.")).toBeInTheDocument();
  });
});

describe("Operación: lista de tareas", () => {
  const TAREA = (id: number, extra: Record<string, unknown> = {}) => ({ id, cuadrilla_id: 1, solicitud_id: null, orden_id: null, sector_id: "S4", titulo: `Tarea ${id}`, descripcion: null, estado: "pendiente", creado_en: hace(60), ...extra });

  it("pone primero lo que requiere atención, enlaza a la cuadrilla y cambia el estado", async () => {
    const f = conSesion("operador", base({
      "GET /tareas": ok({ tareas: [TAREA(1, { estado: "completada" }), TAREA(2), TAREA(3, { requiere_atencion: true })] }),
      "PATCH /tareas/2": ok(TAREA(2, { estado: "en_curso" })),
    }));
    renderRuta("/comando/operacion");
    await screen.findByText("Tarea 3");
    const filas = within(screen.getByRole("list", { name: "Tareas" })).getAllByRole("listitem").map((x) => x.getAttribute("data-testid"));
    expect(filas).toEqual(["tarea-3", "tarea-2", "tarea-1"]);
    expect(within(screen.getByTestId("tarea-2")).getByRole("link", { name: "Cuadrilla humana 1" })).toHaveAttribute("href", "/comando/cuadrillas/1");
    fireEvent.click(within(screen.getByTestId("tarea-2")).getByRole("button", { name: "Iniciar la tarea 2" }));
    await waitFor(() => expect(llamadas(f, "PATCH /tareas/2")).toHaveLength(1));
    expect(JSON.parse((llamadas(f, "PATCH /tareas/2")[0][1] as RequestInit).body as string)).toEqual({ estado: "en_curso" });
  });
});
