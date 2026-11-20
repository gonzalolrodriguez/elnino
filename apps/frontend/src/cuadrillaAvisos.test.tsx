import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contarNoLeidos, coordenadasDesvio, ordenarAvisos, type Aviso } from "./lib/avisos";
import { fijarToken } from "./lib/api";
import { sumarAdjuntos, validarAdjunto } from "./lib/partes";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

const mocks = vi.hoisted(() => ({
  mapas: [] as { opciones: unknown; fuentes: string[]; fitBounds: ReturnType<typeof vi.fn> }[],
  marcadores: [] as unknown[],
}));

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("maplibre-gl", () => {
  class Map {
    fuentes: string[] = [];
    fitBounds = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    addLayer = vi.fn();
    constructor(public opciones: unknown) {
      mocks.mapas.push(this);
    }
    addSource(id: string) {
      this.fuentes.push(id);
    }
    getSource(id: string) {
      return this.fuentes.includes(id) ? {} : undefined;
    }
    on() {
      return this;
    }
  }
  class Marker {
    setLngLat() {
      return this;
    }
    addTo() {
      mocks.marcadores.push(this);
      return this;
    }
    remove() {}
  }
  class LngLatBounds {
    extend() {
      return this;
    }
  }
  class NavigationControl {}
  return { Map, Marker, NavigationControl, LngLatBounds };
});
vi.mock("./lib/entorno", async (orig) => ({ ...(await orig<typeof import("./lib/entorno")>()), hayWebGL: () => true }));

class FakeWS {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((c: { code: number }) => void) | null = null;
  static instancias: FakeWS[] = [];
  constructor(public url: string) {
    FakeWS.instancias.push(this);
  }
  send() {}
  close() {}
}

const TAREA = {
  id: 7,
  cuadrilla_id: 1,
  solicitud_id: null,
  orden_id: null,
  sector_id: "S4",
  titulo: "Traslado de hacienda en S4",
  descripcion: null,
  estado: "en_curso",
  checklist: [],
  creado_en: "2026-11-17T10:00:00Z",
  actualizado_en: "2026-11-17T10:00:00Z",
};
const AVISOS: Aviso[] = [
  { id: 1, cuadrilla_id: 1, tipo: "instruccion", texto: "Reportar al llegar al paraje.", creado_en: "2026-11-20T09:00:00Z", leido_en: "2026-11-20T09:05:00Z", leido_por_rol: "encargado" },
  {
    id: 2,
    cuadrilla_id: 1,
    tipo: "desvio",
    texto: "Camino cortado en el km 12: tomar el desvío por la banquina.",
    geometria: { type: "LineString", coordinates: [[-58.17, -26.19], [-58.16, -26.185], [-58.15, -26.18]] },
    creado_en: "2026-11-20T10:00:00Z",
    leido_en: null,
  },
  { id: 3, cuadrilla_id: 1, tipo: "equipamiento", texto: "Llevar para el camino anegado.", items: ["Ruedas de auxilio", "Palas", "Sogas"], creado_en: "2026-11-20T11:00:00Z", leido_en: null },
];
const ok = (json: unknown) => () => ({ estado: 200, json });

type Rutas = Parameters<typeof simularFetch>[0];
function conSesion(extra: Rutas = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({
    "POST /auth/refresh": () => sesion("cuadrilla"),
    "GET /tareas": ok({ tareas: [TAREA] }),
    "GET /tareas/7/partes": ok({ items: [] }),
    "GET /mi/notificaciones": ok({ notificaciones: [], no_leidas: 0 }),
    "GET /cuadrillas/1/avisos": ok({ items: AVISOS }),
    "GET /mi/cuadrilla": ok({
      id: 1,
      avisos_sin_leer: 2,
      nombre: "Cuadrilla ganadera 1",
      tipo_operativo: "productores_ganado",
      vehiculo: "camion_jaula",
      equipamiento: ["Mangas portátiles", "Linternas"],
      integrantes: [
        { id: 10, usuario_id: 5, rol_operativo: "zootecnista", profesion: "zootecnia", es_encargado: true, nombre_visible: null },
        { id: 11, usuario_id: null, rol_operativo: "policia", profesion: "policia", es_encargado: false, nombre_visible: null },
      ],
    }),
    ...extra,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fijarToken(null);
  mocks.mapas.length = 0;
  mocks.marcadores.length = 0;
  FakeWS.instancias.length = 0;
  vi.stubGlobal("WebSocket", FakeWS);
});
afterEach(() => vi.unstubAllGlobals());

describe("avisos del operativo (lógica)", () => {
  it("ordena los sin leer primero y cuenta los pendientes", () => {
    expect(ordenarAvisos(AVISOS).map((x) => x.id)).toEqual([3, 2, 1]);
    expect(contarNoLeidos(AVISOS)).toBe(2);
  });
  it("coordenadasDesvio acepta punto, línea y nada", () => {
    expect(coordenadasDesvio({ type: "Point", coordinates: [-58, -26] })).toEqual([[-58, -26]]);
    expect(coordenadasDesvio(null)).toEqual([]);
  });
});

describe("avisos del operativo (pantalla)", () => {
  it("lista sin leer primero con tipo (ícono y texto) y la insignia de la cabecera", async () => {
    conSesion();
    renderRuta("/cuadrilla");
    const lista = await screen.findByRole("list", { name: "Avisos del operativo" });
    const filas = within(lista).getAllByTestId(/^aviso-/);
    expect(filas.map((f) => f.getAttribute("data-testid"))).toEqual(["aviso-3", "aviso-2", "aviso-1"]);
    expect(within(filas[0]).getByTestId("tipo-aviso-equipamiento")).toHaveTextContent("Qué llevar");
    expect(within(filas[1]).getByTestId("tipo-aviso-desvio")).toHaveTextContent("Desvío");
    expect(within(filas[2]).getByTestId("tipo-aviso-instruccion")).toHaveTextContent("Instrucción");
    expect(within(filas[2]).getByText("Leído")).toBeInTheDocument();
    expect(screen.getByTestId("insignia-avisos")).toHaveTextContent("2 avisos sin leer");
  });

  it("marcar como leído hace POST /avisos/{id}/leido y baja el contador", async () => {
    const f = conSesion({ "POST /avisos/2/leido": ok({ id: 2, leido_en: "2026-11-20T12:00:00Z", leido_por_rol: "zootecnista" }) });
    renderRuta("/cuadrilla");
    const fila = await screen.findByTestId("aviso-2");
    fireEvent.click(within(fila).getByRole("button", { name: "Marcar como leído" }));
    await waitFor(() => expect(llamadas(f, "POST /avisos/2/leido")).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId("insignia-avisos")).toHaveTextContent("1 aviso sin leer"));
    expect(within(screen.getByTestId("aviso-2")).queryByRole("button", { name: "Marcar como leído" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("aviso-2")).getByText("Leído")).toBeInTheDocument();
  });

  it("un error al marcar leído se muestra y el aviso sigue sin leer", async () => {
    conSesion({ "POST /avisos/2/leido": () => ({ estado: 403, json: { error: { codigo: "prohibido", mensaje: "No sos integrante de esta cuadrilla", detalle: [] } } }) });
    renderRuta("/cuadrilla");
    const fila = await screen.findByTestId("aviso-2");
    fireEvent.click(within(fila).getByRole("button", { name: "Marcar como leído" }));
    expect(await within(fila).findByText(/No sos integrante/)).toBeInTheDocument();
    expect(screen.getByTestId("insignia-avisos")).toHaveTextContent("2 avisos sin leer");
  });

  it("el desvío sin leer muestra el mapa con la línea y sus dos extremos", async () => {
    conSesion();
    renderRuta("/cuadrilla");
    const fila = await screen.findByTestId("aviso-2");
    await waitFor(() => expect(mocks.mapas.length).toBe(1));
    expect(within(fila).getByRole("button", { name: "Ocultar el desvío en el mapa" })).toBeInTheDocument();
    expect(mocks.mapas[0].fuentes).toContain("desvio");
    expect(mocks.mapas[0].fitBounds).toHaveBeenCalled();
    expect(mocks.marcadores).toHaveLength(2);
  });

  it("qué llevar: se tilda cada elemento y se recuerda en sessionStorage", async () => {
    conSesion();
    renderRuta("/cuadrilla");
    const fila = await screen.findByTestId("aviso-3");
    const palas = within(fila).getByLabelText("Palas");
    expect(palas).not.toBeChecked();
    fireEvent.click(palas);
    expect(within(fila).getByLabelText("Palas")).toBeChecked();
    expect(within(fila).getByText(/1 de 3 listos/)).toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem("e3_llevar_3") ?? "[]")).toEqual([1]);
  });

  it("qué llevar recupera lo tildado al volver a abrir la pantalla", async () => {
    window.sessionStorage.setItem("e3_llevar_3", JSON.stringify([0, 2]));
    conSesion();
    renderRuta("/cuadrilla");
    const fila = await screen.findByTestId("aviso-3");
    expect(within(fila).getByLabelText("Ruedas de auxilio")).toBeChecked();
    expect(within(fila).getByLabelText("Palas")).not.toBeChecked();
    expect(within(fila).getByLabelText("Sogas")).toBeChecked();
  });

  it("sin avisos muestra el estado vacío", async () => {
    conSesion({ "GET /cuadrillas/1/avisos": ok({ items: [] }) });
    renderRuta("/cuadrilla");
    expect(await screen.findByText("El operativo no te mandó avisos por ahora.")).toBeInTheDocument();
    expect(screen.getByTestId("insignia-avisos")).toHaveTextContent("Sin avisos nuevos");
  });

  it("Mi cuadrilla muestra roles y profesión, vehículo y equipamiento, sin nombres", async () => {
    conSesion();
    renderRuta("/cuadrilla");
    const resumen = await screen.findByTestId("mi-cuadrilla");
    expect(within(resumen).getByText("Cuadrilla ganadera 1")).toBeInTheDocument();
    expect(within(resumen).getByText(/Camión jaula/)).toBeInTheDocument();
    expect(within(resumen).getByText("Mangas portátiles")).toBeInTheDocument();
    expect(within(resumen).getByTestId("integrante-10")).toHaveTextContent("Zootecnia");
    expect(within(resumen).getByTestId("integrante-10")).toHaveTextContent("encargado");
    expect(resumen).not.toHaveTextContent("Nombre Ficticio");
  });

  it("sin cuadrilla (404 de /mi/cuadrilla) muestra el estado vacío y no pide avisos", async () => {
    const f = conSesion({ "GET /mi/cuadrilla": () => ({ estado: 404, json: { error: { codigo: "no_encontrado", mensaje: "No integrás ninguna cuadrilla", detalle: [] } } }) });
    renderRuta("/cuadrilla");
    expect(await screen.findByText(/Todavía no integrás ninguna cuadrilla/)).toBeInTheDocument();
    expect(screen.queryByTestId("mi-cuadrilla")).not.toBeInTheDocument();
    expect(await screen.findByText("El operativo no te mandó avisos por ahora.")).toBeInTheDocument();
    expect(llamadas(f, "GET /cuadrillas/1/avisos")).toHaveLength(0);
  });

  it("el evento aviso_cuadrilla del tiempo real vuelve a pedir los avisos", async () => {
    const f = conSesion();
    renderRuta("/cuadrilla");
    await screen.findByTestId("aviso-3");
    const antes = llamadas(f, "GET /cuadrillas/1/avisos").length;
    const ws = FakeWS.instancias[FakeWS.instancias.length - 1];
    act(() => ws.onmessage?.({ data: JSON.stringify({ tipo: "aviso_cuadrilla", datos: { id: 9, cuadrilla_id: 1, tipo: "desvio", accion: "creado" } }) }));
    await waitFor(() => expect(llamadas(f, "GET /cuadrillas/1/avisos").length).toBeGreaterThan(antes));
  });
});

describe("evidencia en los partes", () => {
  const foto = (nombre = "foto.jpg", tipo = "image/jpeg", bytes = 1000) => {
    const f = new File(["x"], nombre, { type: tipo });
    Object.defineProperty(f, "size", { value: bytes });
    return f;
  };

  it("valida tipo, tamaño y máximo de 5 archivos", () => {
    expect(validarAdjunto(foto())).toBeNull();
    expect(validarAdjunto(foto("a.mp4", "video/mp4", 19 * 1024 * 1024))).toBeNull();
    expect(validarAdjunto(foto("a.mp4", "video/mp4", 21 * 1024 * 1024))).toMatch(/20 MB/);
    expect(validarAdjunto(foto("a.png", "image/png", 6 * 1024 * 1024))).toMatch(/5 MB/);
    expect(validarAdjunto(foto("a.pdf", "application/pdf"))).toMatch(/solo se aceptan/);
    // Los videos de iPhone (.mov) se aceptan, también cuando el navegador no informa su tipo.
    expect(validarAdjunto(foto("a.mov", "video/quicktime", 10 * 1024 * 1024))).toBeNull();
    expect(validarAdjunto(foto("b.MOV", "", 10 * 1024 * 1024))).toBeNull();
    expect(validarAdjunto(foto("a.mov", "video/quicktime", 21 * 1024 * 1024))).toMatch(/20 MB/);
    const r = sumarAdjuntos([1, 2, 3, 4].map((i) => foto(`f${i}.jpg`)), [foto("f5.jpg"), foto("f6.jpg")]);
    expect(r.lista).toHaveLength(5);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toMatch(/máximo por parte/);
  });

  async function abrirAvance() {
    renderRuta("/cuadrilla");
    fireEvent.click(await screen.findByRole("button", { name: "Informar avance" }));
    return screen.findByRole("form", { name: /Informar avance de la tarea 7/ });
  }
  const elegir = (archivos: File[]) => fireEvent.change(screen.getByLabelText("Elegir fotos o videos de la galería"), { target: { files: archivos } });

  it("rechaza en el dispositivo lo que no cumple y lo explica", async () => {
    conSesion();
    await abrirAvance();
    elegir([foto("doc.pdf", "application/pdf"), foto("grande.png", "image/png", 6 * 1024 * 1024), foto("ok.jpg")]);
    const errores = await screen.findByTestId("errores-adjuntos");
    expect(errores).toHaveTextContent("doc.pdf");
    expect(errores).toHaveTextContent("grande.png");
    expect(screen.getAllByTestId(/^archivo-/)).toHaveLength(1);
    expect(screen.getByTestId("archivo-0")).toHaveTextContent("ok.jpg");
  });

  it("sube los archivos después de crear el parte y cierra el formulario", async () => {
    const f = conSesion({
      "POST /tareas/7/partes": () => ({ estado: 201, json: { id: 55, tarea_id: 7, cuadrilla_id: 1, tipo: "avance", resultado: null, observacion: "Llegamos", autor_rol: "encargado", creado_en: "2026-11-20T12:00:00Z", resuelta: null } }),
      "POST /tareas/7/partes/55/adjuntos": () => ({ estado: 201, json: { n: 1, tipo: "image/jpeg", bytes: 1000 } }),
    });
    await abrirAvance();
    fireEvent.change(screen.getByLabelText("Novedad (opcional)"), { target: { value: "Llegamos al paraje" } });
    elegir([foto("uno.jpg"), foto("dos.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/7/partes/55/adjuntos")).toHaveLength(2));
    // el parte se crea antes que cualquier adjunto
    const urls = f.mock.calls.map(([u, i]) => `${(i as RequestInit | undefined)?.method ?? "GET"} ${new URL(u as string, "http://localhost").pathname}`);
    expect(urls.indexOf("POST /api/v1/tareas/7/partes")).toBeLessThan(urls.indexOf("POST /api/v1/tareas/7/partes/55/adjuntos"));
    const cuerpo = (llamadas(f, "POST /tareas/7/partes/55/adjuntos")[0][1] as RequestInit).body as FormData;
    expect((cuerpo.get("archivo") as File).name).toBe("uno.jpg");
    expect(await screen.findByText("Avance informado.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: /Informar avance/ })).not.toBeInTheDocument();
  });

  it("si un archivo falla, el parte queda creado y se reintentan solo los pendientes", async () => {
    let intento = 0;
    const f = conSesion({
      "POST /tareas/7/partes": () => ({ estado: 201, json: { id: 56, tarea_id: 7, cuadrilla_id: 1, tipo: "avance", resultado: null, observacion: null, autor_rol: "encargado", creado_en: "2026-11-20T12:00:00Z", resuelta: null } }),
      "POST /tareas/7/partes/56/adjuntos": () => {
        intento++;
        return intento === 2
          ? { estado: 415, json: { error: { codigo: "tipo_no_permitido", mensaje: "El archivo no es una imagen válida", detalle: [] } } }
          : { estado: 201, json: { n: intento, tipo: "image/jpeg", bytes: 1000 } };
      },
    });
    await abrirAvance();
    elegir([foto("uno.jpg"), foto("dos.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByTestId("parte-sin-archivos")).toBeInTheDocument();
    expect(screen.getByText("El archivo no es una imagen válida")).toBeInTheDocument();
    expect(llamadas(f, "POST /tareas/7/partes")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar archivos" }));
    await waitFor(() => expect(llamadas(f, "POST /tareas/7/partes/56/adjuntos")).toHaveLength(3));
    expect(llamadas(f, "POST /tareas/7/partes")).toHaveLength(1);
    expect(await screen.findByText("Avance informado.")).toBeInTheDocument();
  });

  it("el historial muestra miniatura de foto y reproductor de video", async () => {
    const crear = vi.fn(() => "blob:prueba");
    const original = URL.createObjectURL;
    URL.createObjectURL = crear;
    try {
      const base = conSesion({
        "GET /tareas/7/partes": ok({
          items: [
            { id: 60, tarea_id: 7, cuadrilla_id: 1, tipo: "dificultad", resultado: null, observacion: "Camino cortado", autor_rol: "encargado", creado_en: "2026-11-20T12:00:00Z", resuelta: false, adjuntos: [{ n: 1, tipo: "image/jpeg", bytes: 2000 }, { n: 2, tipo: "video/mp4", bytes: 90000 }] },
          ],
        }),
      });
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string, init?: RequestInit) => (/\/adjuntos\/\d+$/.test(url) ? Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new Blob(["x"])) }) : base(url, init))),
      );
      renderRuta("/cuadrilla");
      await screen.findByTestId("adjunto-60-1");
      await waitFor(() => expect(screen.getByTestId("adjunto-60-1").tagName).toBe("IMG"));
      expect(screen.getByTestId("adjunto-60-1")).toHaveAttribute("alt", "Foto 1 del parte 60");
      await waitFor(() => expect(screen.getByTestId("adjunto-60-2").tagName).toBe("VIDEO"));
      expect(screen.getByTestId("adjunto-60-2")).toHaveAttribute("controls");
    } finally {
      URL.createObjectURL = original;
    }
  });
});
