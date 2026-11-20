import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { describirEvento } from "./lib/ws";
import { validarCierre } from "./pages/cuadrilla/CerrarConConstancia";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

vi.mock("./panel/MapaGL", async () => {
  const React = await import("react");
  return { default: (p: { traslados?: unknown[] }) => React.createElement("div", { "data-testid": "mapa", "data-traslados": String(p.traslados?.length ?? 0) }) };
});

class FakeWS {
  static instancias: FakeWS[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeWS.instancias.push(this);
  }
  send() {}
  close() {}
}

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
  FakeWS.instancias = [];
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

type Rutas = Parameters<typeof simularFetch>[0];
const ok = (json: unknown) => () => ({ estado: 200, json });
function conSesion(rol: string, rutas: Rutas = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({ "POST /auth/refresh": () => sesion(rol), ...rutas });
}

const constancia = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  rol_operativo: "encargado_cuadrilla",
  destino: { lat: -26.18, lon: -58.139, centro_id: 1, centro_nombre: "Escuela de referencia", distancia_a_centro_m: 80 },
  personas_trasladadas: 3,
  animales_trasladados: { bovinos: 12 },
  nota: "Llegaron por la ruta de ripio.",
  adjuntos: [{ n: 1, mime: "image/jpeg", bytes: 1234 }],
  creada_en: "2026-11-19T15:00:00Z",
  ...extra,
});
const evac = (tarea_id: number, estado: string, extra: Record<string, unknown> = {}) => ({
  tarea_id,
  tarea_estado: estado === "pendiente" ? "pendiente" : estado === "en_curso" ? "en_curso" : "completada",
  estado,
  titulo: `Traslado ${tarea_id}`,
  sector_id: "S4",
  cuadrilla_id: tarea_id % 2 === 0 ? 2 : 1,
  cuadrilla_nombre: tarea_id % 2 === 0 ? "Cuadrilla humana 1" : "Cuadrilla ganadera 1",
  solicitud_id: 10 + tarea_id,
  orden_id: null,
  origen: { lat: -26.17, lon: -58.14, tipo: "solicitud" },
  constancia: null,
  confirmacion: null,
  discrepancia: null,
  actualizado_en: "2026-11-19T15:00:00Z",
  categoria: "SIMULADO",
  fuente: "Plataforma",
  ...extra,
});
const LISTA = {
  evacuaciones: [
    evac(1, "verificada", { constancia: constancia(), confirmacion: { respuesta: "si", canal: "app", comentario: null, solicitada_en: "2026-11-19T15:00:00Z", respondida_en: "2026-11-19T16:00:00Z" } }),
    evac(2, "cerrada_cuadrilla", { constancia: constancia({ id: 2, adjuntos: [] }), confirmacion: { respuesta: null, canal: "app", comentario: null, solicitada_en: "2026-11-19T15:00:00Z", respondida_en: null } }),
    evac(3, "con_discrepancia", {
      constancia: constancia({ id: 3, destino: { lat: -26.2, lon: -58.1, centro_id: 1, centro_nombre: "Escuela de referencia", distancia_a_centro_m: 5600 }, adjuntos: [] }),
      confirmacion: { respuesta: "no", canal: "sms_sim", comentario: "Nos dejaron en otro lado", solicitada_en: "2026-11-19T15:00:00Z", respondida_en: "2026-11-19T16:30:00Z" },
      discrepancia: { motivos: ["evacuado_dice_no", "destino_lejos_del_centro"] },
    }),
    evac(4, "pendiente"),
  ],
  total: 4,
  limite: 200,
  offset: 0,
  categoria: "SIMULADO",
  fuente: "Plataforma",
  fecha_dato: "2026-11-19",
};
const CENTROS = { centros: [{ id: 1, nombre: "Escuela de referencia", tipo: "escuela", lon: -58.1395, lat: -26.1802, sector_id: "S4", capacidad_personas: 200, capacidad_animales: 0, ocupacion: 0, cupo_libre_personas: 200, servicios: null, nota: null, categoria: "SIMULADO" }] };

describe("página Evacuaciones", () => {
  it("lista con estados legibles, resalta las discrepancias y filtra en el servidor", async () => {
    const f = conSesion("decisor", { "GET /evacuaciones": ok(LISTA), "GET /centros": ok(CENTROS) });
    renderRuta("/comando/evacuaciones");
    const fila3 = await screen.findByTestId("evac-3");
    expect(fila3).toHaveTextContent("Con discrepancia a revisar");
    expect(screen.getByTestId("evac-1")).toHaveTextContent("Verificada por el evacuado");
    expect(screen.getByTestId("evac-2")).toHaveTextContent("Cerrada por la cuadrilla, sin confirmar");
    expect(screen.getByTestId("evac-4")).toHaveTextContent("Pendiente");
    expect(screen.getByRole("navigation", { name: "Secciones del panel operativo" })).toHaveTextContent("Evacuaciones");

    // Filtro por cuadrilla (en el cliente) y solo discrepancias.
    fireEvent.change(screen.getByLabelText("Cuadrilla"), { target: { value: "2" } });
    expect(screen.queryByTestId("evac-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("evac-2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cuadrilla"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Solo las que hay que revisar/ }));
    expect(screen.getAllByTestId(/^evac-\d/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox", { name: /Solo las que hay que revisar/ }));

    // Filtros por estado y sector van al servidor.
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "verificada" } });
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("estado=verificada"))).toBe(true));
    fireEvent.change(screen.getByLabelText("Sector"), { target: { value: "S4" } });
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("sector_id=S4"))).toBe(true));
  });

  it("el detalle muestra la constancia, la distancia al centro, la confirmación y los motivos con un enlace a la tarea", async () => {
    conSesion("operador", { "GET /evacuaciones": ok(LISTA), "GET /centros": ok(CENTROS) });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:foto"), revokeObjectURL: vi.fn() }));
    const base = globalThis.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
    vi.stubGlobal("fetch", (u: string, i?: RequestInit) => (String(u).includes("/cierre/adjuntos/") ? Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new Blob(["x"])) }) : base(u, i)));
    renderRuta("/comando/evacuaciones");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de la tarea 3" }));
    const detalle = await screen.findByTestId("detalle-evacuacion");
    const aviso = within(detalle).getByTestId("discrepancia");
    expect(aviso).toHaveTextContent("respondió que no llegó");
    expect(aviso).toHaveTextContent("queda lejos del centro de recepción");
    expect(aviso).toHaveTextContent("no una acusación");
    expect(within(aviso).getByRole("link", { name: "Ver la tarea 3" })).toHaveAttribute("href", "/comando/operacion#sec-tareas");
    expect(within(detalle).getByTestId("distancia-a-centro")).toHaveTextContent("5,6 km");
    expect(within(detalle).getByRole("img", { name: /Esquema sin escala/ })).toBeInTheDocument();
    expect(within(detalle).getByText("Encargado de cuadrilla", { exact: false })).toBeInTheDocument();
    const conf = within(detalle).getByTestId("confirmacion");
    expect(conf).toHaveTextContent("No vinieron");
    expect(conf).toHaveTextContent("SMS (simulado)");
    expect(conf).toHaveTextContent("Nos dejaron en otro lado");
  });

  it("muestra las fotos de la constancia con la sesión", async () => {
    conSesion("operador", { "GET /evacuaciones": ok(LISTA), "GET /centros": ok(CENTROS) });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:foto"), revokeObjectURL: vi.fn() }));
    const base = globalThis.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
    const pedidos: string[] = [];
    vi.stubGlobal("fetch", (u: string, i?: RequestInit) => {
      if (String(u).includes("/cierre/adjuntos/")) {
        pedidos.push(`${String(u)}|${JSON.stringify((i as RequestInit).headers)}`);
        return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new Blob(["x"])) });
      }
      return base(u, i);
    });
    renderRuta("/comando/evacuaciones");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de la tarea 1" }));
    expect(await screen.findByAltText("Foto 1 de la constancia")).toBeInTheDocument();
    expect(pedidos[0]).toContain("/tareas/1/cierre/adjuntos/1");
    expect(pedidos[0]).toContain("Bearer tok-en-memoria");
  });

  it("reabrir la confirmación pide confirmar, envía el motivo y recarga", async () => {
    const f = conSesion("decisor", {
      "GET /evacuaciones": ok(LISTA),
      "GET /centros": ok(CENTROS),
      "POST /evacuaciones/3/confirmacion/reabrir": () => ({ estado: 200, json: { tarea_id: 3, estado: "cerrada_cuadrilla", respuesta_previa: "no", reabierta: true, nota: "ok" } }),
    });
    renderRuta("/comando/evacuaciones");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de la tarea 3" }));
    const detalle = await screen.findByTestId("detalle-evacuacion");
    fireEvent.click(within(detalle).getByRole("button", { name: "Reabrir confirmación" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(llamadas(f, "POST /evacuaciones/3/confirmacion/reabrir")).toHaveLength(0);
    fireEvent.change(within(dialogo).getByLabelText(/Motivo/), { target: { value: "Se equivocó de botón" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Reabrir confirmación" }));
    await waitFor(() => expect(llamadas(f, "POST /evacuaciones/3/confirmacion/reabrir")).toHaveLength(1));
    const [, init] = llamadas(f, "POST /evacuaciones/3/confirmacion/reabrir")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ motivo: "Se equivocó de botón" });
    await waitFor(() => expect(llamadas(f, "GET /evacuaciones").length).toBeGreaterThanOrEqual(2));
  });

  it("la confirmación sin responder no ofrece reabrir", async () => {
    conSesion("decisor", { "GET /evacuaciones": ok(LISTA), "GET /centros": ok(CENTROS) });
    renderRuta("/comando/evacuaciones");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de la tarea 2" }));
    const detalle = await screen.findByTestId("detalle-evacuacion");
    expect(within(detalle).getByTestId("confirmacion")).toHaveTextContent("todavía no respondió");
    expect(within(detalle).queryByRole("button", { name: "Reabrir confirmación" })).not.toBeInTheDocument();
  });
});

describe("aviso en tiempo real de discrepancias", () => {
  it("un evento discrepancia muestra un aviso con los motivos en palabras comunes", async () => {
    conSesion("operador", { "GET /evacuaciones": ok(LISTA), "GET /centros": ok(CENTROS) });
    renderRuta("/comando/evacuaciones");
    await screen.findByTestId("evac-1");
    await waitFor(() => expect(FakeWS.instancias).toHaveLength(1));
    act(() => FakeWS.instancias[0].onmessage?.({ data: JSON.stringify({ tipo: "discrepancia", datos: { tarea_id: 3, sector_id: "S4", motivos: ["evacuado_reporta_problema"] } }) }));
    expect(await screen.findByText("Evacuación para revisar")).toBeInTheDocument();
    expect(screen.getByText(/avisó que hubo un problema/)).toBeInTheDocument();
  });

  it("describe los eventos de constancia y de discrepancia", () => {
    expect(describirEvento({ tipo: "constancia", datos: { tarea_id: 7, sector_id: "S4", estado: "verificada" } }).detalle).toContain("verificada por el evacuado");
    expect(describirEvento({ tipo: "discrepancia", datos: { tarea_id: 7, motivos: ["destino_lejos_del_centro"] } }).detalle).toContain("lejos del centro");
  });
});

describe("mapa: capa Traslados", () => {
  it("al activarla pide las evacuaciones y pasa al mapa solo las cerradas con origen y destino", async () => {
    const f = conSesion("operador", {
      "GET /sectores": ok({ type: "FeatureCollection", features: [] }),
      "GET /accesos": ok({ type: "FeatureCollection", features: [] }),
      "GET /centros": ok({ centros: [] }),
      "GET /estaciones": ok({ estaciones: [] }),
      "GET /evacuaciones": ok(LISTA),
    });
    renderRuta("/comando/mapa");
    const casilla = await screen.findByRole("checkbox", { name: /Mostrar traslados cerrados/ });
    expect(llamadas(f, "GET /evacuaciones")).toHaveLength(0);
    fireEvent.click(casilla);
    await waitFor(() => expect(screen.getByTestId("leyenda-traslados")).toHaveTextContent("3 traslados"));
    await waitFor(() => expect(screen.getByTestId("mapa")).toHaveAttribute("data-traslados", "3"));
    fireEvent.click(casilla);
    await waitFor(() => expect(screen.getByTestId("mapa")).toHaveAttribute("data-traslados", "0"));
  });
});

describe("cierre con constancia (cuadrilla)", () => {
  const TAREA = { id: 7, cuadrilla_id: 1, solicitud_id: 3, orden_id: null, sector_id: "S4", titulo: "Traslado de hacienda en S4", descripcion: null, estado: "en_curso", checklist: [], creado_en: "2026-11-17T10:00:00Z" };
  const base: Rutas = { "GET /tareas": ok({ tareas: [TAREA] }), "GET /mi/notificaciones": ok({ notificaciones: [], no_leidas: 0 }), "GET /centros": ok(CENTROS) };

  it("validarCierre exige destino, rangos y nota si no se trasladó a nadie", () => {
    const vacio = { lat: "", lon: "", centro: "", personas: "", animales: {}, nota: "", fotos: 0 };
    const e = validarCierre(vacio);
    expect("errores" in e && Object.keys(e.errores).sort()).toEqual(["lat", "lon", "nota"]);
    expect("errores" in validarCierre({ ...vacio, lat: "95", lon: "-58", personas: "2" })).toBe(true);
    const r = validarCierre({ ...vacio, lat: "-26,18", lon: "-58.139", centro: "1", personas: "3", animales: { bovinos: "12", ovinos: "" }, nota: " listo " });
    expect(r).toEqual({ cuerpo: { lat: -26.18, lon: -58.139, centro_id: 1, personas_trasladadas: 3, animales_trasladados: { bovinos: 12 }, nota: "listo" } });
    expect("errores" in validarCierre({ ...vacio, lat: "-26", lon: "-58", fotos: 6, personas: "1" })).toBe(true);
  });

  it("una tarea de evacuación en curso se cierra con constancia; reintenta con la misma clave y sube las fotos", async () => {
    let intento = 0;
    const f = conSesion("cuadrilla", {
      ...base,
      "POST /tareas/7/cierre": () => (intento++ === 0 ? { estado: 500, json: { error: { codigo: "error", mensaje: "Falla temporal", detalle: [] } } } : { estado: 201, json: { repetida: false, evacuacion: { estado: "cerrada_cuadrilla" } } }),
      "POST /tareas/7/cierre/adjuntos": () => ({ estado: 201, json: { n: 1 } }),
    });
    renderRuta("/cuadrilla");
    // «Terminar tarea» → «Completa» en una evacuación lleva al cierre con constancia.
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/Completa/));
    fireEvent.click(screen.getByRole("button", { name: "Continuar con la constancia" }));
    const form = await screen.findByRole("form", { name: /Constancia de la tarea 7/ });

    // Sin datos no se llama al backend.
    fireEvent.click(within(form).getByRole("button", { name: "Cerrar con constancia" }));
    expect(await within(form).findByText(/Indicá la latitud/)).toBeInTheDocument();
    expect(llamadas(f, "POST /tareas/7/cierre")).toHaveLength(0);

    fireEvent.change(within(form).getByLabelText(/Latitud/), { target: { value: "-26.18" } });
    fireEvent.change(within(form).getByLabelText(/Longitud/), { target: { value: "-58.139" } });
    await waitFor(() => expect(within(form).getByRole("option", { name: "Escuela de referencia" })).toBeInTheDocument());
    fireEvent.change(within(form).getByLabelText("Centro de recepción"), { target: { value: "1" } });
    fireEvent.change(within(form).getByLabelText("Personas trasladadas"), { target: { value: "3" } });
    fireEvent.change(within(form).getByLabelText("Bovinos"), { target: { value: "12" } });
    fireEvent.change(within(form).getByLabelText("Nota"), { target: { value: "Llegaron por el ripio." } });
    const foto = new File(["x"], "lugar.jpg", { type: "image/jpeg" });
    fireEvent.change(within(form).getByLabelText(/Fotos/), { target: { files: [foto] } });

    fireEvent.click(within(form).getByRole("button", { name: "Cerrar con constancia" }));
    expect(await within(form).findByText("Falla temporal")).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Cerrar con constancia" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/7/cierre")).toHaveLength(2));
    const claves = llamadas(f, "POST /tareas/7/cierre").map(([, i]) => ((i as RequestInit).headers as Record<string, string>)["Idempotency-Key"]);
    expect(claves[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(claves[1]).toBe(claves[0]);
    const [, init] = llamadas(f, "POST /tareas/7/cierre")[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ lat: -26.18, lon: -58.139, centro_id: 1, personas_trasladadas: 3, animales_trasladados: { bovinos: 12 }, nota: "Llegaron por el ripio." });
    await waitFor(() => expect(llamadas(f, "POST /tareas/7/cierre/adjuntos")).toHaveLength(1));
  });

  it("una tarea que no es evacuación se termina con un parte, sin constancia", async () => {
    conSesion("cuadrilla", { ...base, "GET /tareas": ok({ tareas: [{ ...TAREA, solicitud_id: null, orden_id: null }] }) });
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Terminar tarea" }));
    fireEvent.click(screen.getByLabelText(/Completa/));
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar con la constancia" })).not.toBeInTheDocument();
  });
});

describe("motivos de discrepancia nuevos", () => {
  it("tienen texto legible (parcial y no_encontraron)", async () => {
    const { etiquetaMotivoDiscrepancia } = await import("./lib/etiquetas");
    expect(etiquetaMotivoDiscrepancia("evacuado_parcial")).toContain("solo en parte");
    expect(etiquetaMotivoDiscrepancia("evacuado_no_encontraron")).toContain("no la encontró");
  });
});
