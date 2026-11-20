import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { ajustarFilas, filaVacia, geometriaDe, normalizarPlantillas, validarAviso, validarIntegrantes, type Borrador } from "./panel/cuadrillas/catalogos";
import type { CuadrillaCompleta, CuadrillaResumen } from "./panel/tipos";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

// La máquina de desarrollo suele estar cargada: las esperas de esta suite son más largas que las de por defecto.
configure({ asyncUtilTimeout: 8000 });

const mocks = vi.hoisted(() => ({ webgl: { activo: false } }));

vi.mock("./lib/entorno", async (orig) => ({ ...(await orig<typeof import("./lib/entorno")>()), hayWebGL: () => mocks.webgl.activo }));
vi.mock("./panel/api", async (orig) => ({ ...(await orig<typeof import("./panel/api")>()), adjuntoParte: vi.fn(async () => new Blob(["x"])) }));
vi.mock("./panel/cuadrillas/MapaSeguimientoGL", () => ({
  default: (p: { items: { cuadrilla_id: number; nombre: string }[]; onSeleccionar: (id: number) => void }) => (
    <div data-testid="gl-seguimiento" data-n={p.items.length}>
      {p.items.map((i) => (
        <button key={i.cuadrilla_id} onClick={() => p.onSeleccionar(i.cuadrilla_id)}>
          {`Marcador de ${i.nombre}`}
        </button>
      ))}
    </div>
  ),
}));

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
  mocks.webgl.activo = false;
  vi.stubGlobal("WebSocket", FakeWS);
  URL.createObjectURL = vi.fn(() => "blob:evidencia");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

type Rutas = Parameters<typeof simularFetch>[0];
function conSesion(rol: string, rutas: Rutas = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({ "POST /auth/refresh": () => sesion(rol), ...rutas });
}
const ok = (json: unknown, estado = 200) => () => ({ estado, json });
const cuerpoDe = (f: ReturnType<typeof simularFetch>, clave: string, i = 0) => JSON.parse(String((llamadas(f, clave)[i][1] as RequestInit).body)) as Record<string, unknown>;

const RESUMEN: { items: CuadrillaResumen[] } = {
  items: [
    {
      id: 1,
      nombre: "Cuadrilla humana 1",
      tipo_incidente: "humana",
      tipo_operativo: "familias",
      vehiculo: "4x4",
      estado: "disponible",
      integrantes: [
        { usuario_id: 10, rol_operativo: "encargado_cuadrilla", es_encargado: true, profesion: "trabajo_social" },
        { usuario_id: 11, rol_operativo: "transporte", es_encargado: false, profesion: "chofer" },
      ],
      tarea_actual: { id: 7, estado: "en_curso", solicitud_id: 3, sector_id: "S4", requiere_atencion: false },
      ultimo_parte: null,
      dificultades_abiertas: 0,
    },
  ],
};

const COMPLETA: CuadrillaCompleta = {
  id: 1,
  nombre: "Cuadrilla humana 1",
  tipo_operativo: "familias",
  tipo_incidente: "humana",
  cantidad_integrantes: 2,
  vehiculo: "4x4",
  equipamiento: ["Botiquín", "Palas"],
  estado: "disponible",
  base: { lat: -26.18, lon: -58.18 },
  notas: null,
  integrantes: [
    { id: 100, usuario_id: 10, rol_operativo: "encargado_cuadrilla", profesion: "trabajo_social", es_encargado: true, nombre_visible: "Persona Ficticia Uno" },
    { id: 101, usuario_id: null, rol_operativo: "transporte", profesion: "chofer", es_encargado: false, nombre_visible: null },
  ],
  creado_en: "2026-11-20T10:00:00Z",
};

function borrador(parcial: Partial<Borrador> = {}): Borrador {
  const filas = [
    { ...filaVacia("a"), rol_operativo: "policia", profesion: "policia", es_encargado: true },
    { ...filaVacia("b"), rol_operativo: "transporte", profesion: "chofer" },
  ];
  return { nombre: "Costa Norte", tipo_operativo: "personas", cantidad: 2, vehiculo: "", notas: "", lat: "", lon: "", integrantes: filas, equipamiento: [], ...parcial };
}

describe("validación de la cuadrilla", () => {
  it("exige exactamente un encargado y una fila por integrante", () => {
    expect(validarIntegrantes(borrador())).toEqual({});
    const sin = borrador({ integrantes: borrador().integrantes.map((f) => ({ ...f, es_encargado: false })) });
    expect(validarIntegrantes(sin).encargado).toMatch(/encargado/i);
    const dos = borrador({ integrantes: borrador().integrantes.map((f) => ({ ...f, es_encargado: true })) });
    expect(validarIntegrantes(dos).encargado).toMatch(/un solo encargado/i);
    expect(validarIntegrantes(borrador({ cantidad: 3 })).cantidad).toMatch(/3 integrantes/);
  });

  it("pide rol y profesión de cada fila", () => {
    const b = borrador({ integrantes: [{ ...filaVacia("x"), es_encargado: true }], cantidad: 1 });
    const e = validarIntegrantes(b);
    expect(e["fila-x-rol"]).toBeTruthy();
    expect(e["fila-x-profesion"]).toBeTruthy();
  });

  it("ajusta las filas a la cantidad", () => {
    let n = 0;
    const clave = () => `k${++n}`;
    expect(ajustarFilas([], 4, clave)).toHaveLength(4);
    expect(ajustarFilas(ajustarFilas([], 4, clave), 2, clave)).toHaveLength(2);
  });

  it("valida el aviso y arma la geometría", () => {
    expect(validarAviso({ tipo: "desvio", texto: "Cortado", items: [], geometria: null }).geometria).toBeTruthy();
    expect(validarAviso({ tipo: "equipamiento", texto: "Llevar", items: [], geometria: null }).items).toBeTruthy();
    expect(geometriaDe([[1, 2]])?.type).toBe("Point");
    expect(geometriaDe([[1, 2], [3, 4]])?.type).toBe("LineString");
  });

  it("toma las plantillas del servidor y cae al respaldo", () => {
    const p = normalizarPlantillas({ plantillas: { apicola: { equipamiento: ["Ahumador"], profesiones: ["zootecnia"] } } });
    expect(p.apicola.equipamiento).toEqual(["Ahumador"]);
    expect(p.personas.equipamiento.length).toBeGreaterThan(0);
  });
});

describe("alta, edición y baja", () => {
  const base = () => ({
    "GET /cuadrillas/resumen": ok(RESUMEN),
    "GET /cuadrillas/plantillas": ok({ plantillas: { familias: { equipamiento: ["Botiquín", "Lonas"], profesiones: ["trabajo_social", "chofer"] } } }),
  });

  it("crea una cuadrilla en cuatro pasos con un encargado", async () => {
    const f = conSesion("operador", { ...base(), "POST /cuadrillas": ok({ ...COMPLETA, id: 2 }, 201) });
    renderRuta("/comando/cuadrillas");
    fireEvent.click(await screen.findByRole("button", { name: "Nueva cuadrilla" }));
    const asistente = await screen.findByTestId("asistente-cuadrilla");

    // Paso 1: sin tipo de operativo no avanza.
    fireEvent.change(within(asistente).getByLabelText(/Nombre de la cuadrilla/), { target: { value: "Costa Norte" } });
    fireEvent.change(within(asistente).getByLabelText(/Cantidad de integrantes/), { target: { value: "2" } });
    fireEvent.click(within(asistente).getByRole("button", { name: "Siguiente" }));
    expect(await within(asistente).findByText("Elegí el tipo de operativo.")).toBeInTheDocument();
    fireEvent.click(within(asistente).getByRole("radio", { name: /Familias/ }));
    fireEvent.click(within(asistente).getByRole("button", { name: "Siguiente" }));

    // Paso 2: dos filas; sin encargado no avanza.
    expect(await within(asistente).findAllByTestId("fila-integrante")).toHaveLength(2);
    const roles = within(asistente).getAllByLabelText("Rol operativo");
    const profes = within(asistente).getAllByLabelText("Profesión");
    fireEvent.change(roles[0], { target: { value: "encargado_cuadrilla" } });
    fireEvent.change(profes[0], { target: { value: "trabajo_social" } });
    fireEvent.change(roles[1], { target: { value: "transporte" } });
    fireEvent.change(profes[1], { target: { value: "chofer" } });
    fireEvent.click(within(asistente).getByRole("button", { name: "Siguiente" }));
    expect(await within(asistente).findByText("Marcá quién es el encargado de la cuadrilla.")).toBeInTheDocument();
    fireEvent.click(within(asistente).getByRole("radio", { name: "Encargado (integrante 1)" }));
    fireEvent.click(within(asistente).getByRole("button", { name: "Siguiente" }));

    // Paso 3: equipamiento prellenado desde la plantilla del tipo.
    const equipo = await within(asistente).findByTestId("paso-equipamiento");
    expect(within(equipo).getByRole("checkbox", { name: "Botiquín" })).toBeChecked();
    fireEvent.change(within(equipo).getByLabelText("Otro equipamiento"), { target: { value: "Soga de arrastre" } });
    fireEvent.click(within(equipo).getByRole("button", { name: "Sumar" }));
    fireEvent.click(within(asistente).getByRole("button", { name: "Siguiente" }));

    // Paso 4: resumen y confirmación.
    expect(await within(asistente).findByTestId("paso-resumen")).toHaveTextContent("Costa Norte");
    fireEvent.click(within(asistente).getByRole("button", { name: "Crear cuadrilla" }));
    await waitFor(() => expect(llamadas(f, "POST /cuadrillas")).toHaveLength(1));
    const c = cuerpoDe(f, "POST /cuadrillas");
    expect(c).toMatchObject({ nombre: "Costa Norte", tipo_operativo: "familias", tipo_incidente: "humana", cantidad_integrantes: 2, base: null });
    expect(c.equipamiento).toEqual(["Botiquín", "Lonas", "Soga de arrastre"]);
    const ints = c.integrantes as { es_encargado: boolean; profesion: string }[];
    expect(ints).toHaveLength(2);
    expect(ints.filter((i) => i.es_encargado)).toHaveLength(1);
    expect(ints[0].profesion).toBe("trabajo_social");
  });

  it("edita una cuadrilla guardada con PATCH", async () => {
    const f = conSesion("operador", { ...base(), "GET /cuadrillas/1": ok(COMPLETA), "PATCH /cuadrillas/1": ok(COMPLETA) });
    renderRuta("/comando/cuadrillas");
    fireEvent.click(await screen.findByRole("button", { name: "Editar Cuadrilla humana 1" }));
    const asistente = await screen.findByTestId("asistente-cuadrilla");
    expect(within(asistente).getByLabelText(/Nombre de la cuadrilla/)).toHaveValue("Cuadrilla humana 1");
    fireEvent.change(within(asistente).getByLabelText(/Nombre de la cuadrilla/), { target: { value: "Cuadrilla Costa" } });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(within(asistente).getByRole("button", { name: "Siguiente" }));
      await within(asistente).findByRole("button", { name: i < 2 ? "Siguiente" : "Guardar cambios" });
    }
    fireEvent.click(within(asistente).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(llamadas(f, "PATCH /cuadrillas/1")).toHaveLength(1));
    expect(cuerpoDe(f, "PATCH /cuadrillas/1")).toMatchObject({ nombre: "Cuadrilla Costa", tipo_operativo: "familias", equipamiento: ["Botiquín", "Palas"], base: { lat: -26.18, lon: -58.18 } });
    // Los integrantes no cambiaron: no hay llamadas a sus rutas.
    expect(llamadas(f, "POST /cuadrillas/1/integrantes")).toHaveLength(0);
  });

  it("da de baja con confirmación", async () => {
    const f = conSesion("operador", { ...base(), "DELETE /cuadrillas/1": ok({ ok: true }) });
    renderRuta("/comando/cuadrillas");
    fireEvent.click(await screen.findByRole("button", { name: "Dar de baja a Cuadrilla humana 1" }));
    expect(await screen.findByText(/¿Dar de baja a/)).toBeInTheDocument();
    expect(llamadas(f, "DELETE /cuadrillas/1")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    await waitFor(() => expect(llamadas(f, "DELETE /cuadrillas/1")).toHaveLength(1));
  });

  it("muestra el mensaje del 409 cuando tiene una tarea en curso", async () => {
    const f = conSesion("operador", {
      ...base(),
      "DELETE /cuadrillas/1": () => ({ estado: 409, json: { error: { codigo: "conflicto", mensaje: "La cuadrilla tiene una tarea en curso", detalle: [] } } }),
    });
    renderRuta("/comando/cuadrillas");
    fireEvent.click(await screen.findByRole("button", { name: "Dar de baja a Cuadrilla humana 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dar de baja" }));
    expect(await screen.findByText("La cuadrilla tiene una tarea en curso")).toBeInTheDocument();
    expect(llamadas(f, "DELETE /cuadrillas/1")).toHaveLength(1);
  });

  it("el decisor no ve las acciones de gestión", async () => {
    conSesion("decisor", base());
    renderRuta("/comando/cuadrillas");
    await screen.findByText("Cuadrilla humana 1");
    expect(screen.queryByRole("button", { name: "Nueva cuadrilla" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar Cuadrilla/ })).not.toBeInTheDocument();
  });
});

describe("seguimiento en el mapa", () => {
  it("alterna entre lista y mapa y pide las posiciones con su ruta", async () => {
    mocks.webgl.activo = true;
    const f = conSesion("operador", {
      "GET /cuadrillas/resumen": ok(RESUMEN),
      "GET /cuadrillas/posiciones": ok({
        posiciones: [
          {
            cuadrilla_id: 1,
            nombre: "Cuadrilla humana 1",
            tipo_incidente: "humana",
            roles: [],
            lat: -26.18,
            lon: -58.18,
            precision_m: null,
            actualizada_en: "2026-11-20T14:00:00Z",
            posicion_vieja: false,
            tareas_en_curso: 1,
            categoria: "SIMULADO",
            destino: { lat: -26.17, lon: -58.17 },
            ruta: { coordenadas: [[-58.18, -26.18], [-58.17, -26.17]], distancia_km: 2.4, llegada_estimada_min: 6, metodo: "red_vial", simulada: true, progreso: 0.2, velocidad_kmh: 30 },
          },
        ],
        categoria: "SIMULADO",
        fuente: "demo",
        fecha_dato: "2026-11-20T14:00:00Z",
        supuestos: { factor_desvio: 1.3, velocidad_cuadrilla_kmh: 30, posicion_vieja_minutos: 10 },
      }),
    });
    renderRuta("/comando/cuadrillas");
    const mapa = await screen.findByRole("button", { name: "Mapa" });
    expect(mapa).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mapa);
    expect(await screen.findByTestId("gl-seguimiento")).toHaveAttribute("data-n", "1");
    expect(screen.getByRole("button", { name: "Mapa" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Recorrido simulado")).toBeInTheDocument();
    expect(screen.getByText(/2,4 km, llega en unos 6 min/)).toBeInTheDocument();
    expect(llamadas(f, "GET /cuadrillas/posiciones").length).toBeGreaterThan(0);
    // Un clic en el marcador abre la ficha.
    fireEvent.click(screen.getByRole("button", { name: "Marcador de Cuadrilla humana 1" }));
    await waitFor(() => expect(llamadas(f, "GET /cuadrillas/1").length).toBeGreaterThan(0));
  });
});

describe("ficha de la cuadrilla", () => {
  const PARTE = {
    id: 3,
    tarea_id: 7,
    cuadrilla_id: 1,
    tipo: "avance",
    resultado: null,
    observacion: "Llegamos al sector.",
    autor_rol: "transporte",
    creado_en: "2026-11-20T13:00:00Z",
    resuelta: null,
    adjuntos: [
      { n: 1, tipo: "imagen", bytes: 120000 },
      { n: 2, tipo: "video/mp4", bytes: 3000000 },
    ],
  };
  const AVISOS = [
    { id: 9, cuadrilla_id: 1, tipo: "desvio", texto: "Ruta 11 cortada", items: [], geometria: { type: "LineString", coordinates: [[-58.2, -26.2], [-58.19, -26.19]] }, tarea_id: 7, creado_en: "2026-11-20T12:00:00Z", emitido_por_rol: "defensa_civil", lecturas: [{ leido_por_rol: "encargado_cuadrilla", leido_en: "2026-11-20T12:05:00Z" }] },
    { id: 10, cuadrilla_id: 1, tipo: "equipamiento", texto: "Sumar herramientas", items: ["Palas"], geometria: null, tarea_id: 7, creado_en: "2026-11-20T12:30:00Z", lecturas: [] },
  ];
  const rutas = (extra: Rutas = {}): Rutas => ({
    "GET /cuadrillas/1": ok(COMPLETA),
    "GET /cuadrillas/resumen": ok(RESUMEN),
    "GET /cuadrillas/posiciones": ok({ posiciones: [], categoria: "SIMULADO", fuente: "demo", fecha_dato: "2026-11-20T14:00:00Z", supuestos: {} }),
    "GET /tareas/7/partes": ok({ items: [PARTE] }),
    "GET /cuadrillas/1/avisos": ok({ avisos: AVISOS }),
    "GET /cuadrillas/plantillas": ok({}),
    ...extra,
  });

  it("muestra integrantes con cuenta, equipamiento, la galería de evidencia y las lecturas de los avisos", async () => {
    conSesion("operador", rutas());
    renderRuta("/comando/cuadrillas/1");
    expect(await screen.findByRole("heading", { level: 1, name: "Cuadrilla humana 1" })).toBeInTheDocument();
    const filas = await screen.findAllByTestId("integrante");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Persona Ficticia Uno");
    expect(filas[0]).toHaveTextContent("Trabajo social");
    expect(filas[0]).toHaveTextContent("Encargado");
    expect(filas[1]).toHaveTextContent("Sin cuenta vinculada");
    expect(screen.getByRole("list", { name: "Equipamiento" })).toHaveTextContent("Palas");

    // Evidencia: foto y video con su texto alternativo.
    const foto = await screen.findByAltText("Evidencia del parte n.º 3, archivo 1 de 2");
    expect(foto).toHaveAttribute("src", "blob:evidencia");
    const video = await screen.findByLabelText("Evidencia del parte n.º 3, archivo 2 de 2");
    expect(video.tagName).toBe("VIDEO");

    // Lecturas: quién leyó y qué falta.
    const avisos = await screen.findAllByTestId("aviso");
    expect(avisos).toHaveLength(2);
    expect(within(avisos[0]).getByTestId("lecturas-aviso")).toHaveTextContent("Leído por Encargado de cuadrilla");
    expect(within(avisos[1]).getByTestId("lecturas-aviso")).toHaveTextContent("Pendiente de lectura");
  });

  it("envía un desvío con la geometría dibujada", async () => {
    const f = conSesion("operador", rutas({ "POST /cuadrillas/1/avisos": ok({ ...AVISOS[0], id: 11 }, 201) }));
    renderRuta("/comando/cuadrillas/1");
    await screen.findByTestId("form-aviso");
    fireEvent.click(screen.getByRole("radio", { name: /Desvío de camino/ }));
    fireEvent.change(screen.getByLabelText("Mensaje para la cuadrilla"), { target: { value: "Tomen el camino de ripio" } });

    // Sin trazado no se envía.
    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(await screen.findByText(/Dibujá el desvío en el mapa/)).toBeInTheDocument();
    expect(llamadas(f, "POST /cuadrillas/1/avisos")).toHaveLength(0);

    // Sin WebGL, los puntos se suman por coordenadas.
    for (const [la, lo] of [["-26,2", "-58,2"], ["-26.19", "-58.19"]]) {
      fireEvent.change(screen.getByLabelText("Latitud"), { target: { value: la } });
      fireEvent.change(screen.getByLabelText("Longitud"), { target: { value: lo } });
      fireEvent.click(screen.getByRole("button", { name: "Sumar punto" }));
    }
    expect(screen.getByTestId("desvio-estado")).toHaveTextContent("2 puntos en el desvío");
    fireEvent.click(screen.getByRole("button", { name: "Deshacer último punto" }));
    expect(screen.getByTestId("desvio-estado")).toHaveTextContent("1 punto marcado");
    fireEvent.change(screen.getByLabelText("Latitud"), { target: { value: "-26.19" } });
    fireEvent.change(screen.getByLabelText("Longitud"), { target: { value: "-58.19" } });
    fireEvent.click(screen.getByRole("button", { name: "Sumar punto" }));

    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
    await waitFor(() => expect(llamadas(f, "POST /cuadrillas/1/avisos")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /cuadrillas/1/avisos")).toEqual({
      tipo: "desvio",
      texto: "Tomen el camino de ripio",
      items: [],
      geometria: { type: "LineString", coordinates: [[-58.2, -26.2], [-58.19, -26.19]] },
      tarea_id: 7,
    });
  });

  it("envía un aviso de qué llevar con sus ítems", async () => {
    const f = conSesion("operador", rutas({ "POST /cuadrillas/1/avisos": ok({ ...AVISOS[1], id: 12 }, 201) }));
    renderRuta("/comando/cuadrillas/1");
    await screen.findByTestId("form-aviso");
    fireEvent.click(screen.getByRole("radio", { name: /Qué llevar/ }));
    fireEvent.change(screen.getByLabelText("Mensaje para la cuadrilla"), { target: { value: "Camino anegado" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(await screen.findByText("Sumá al menos un ítem para llevar.")).toBeInTheDocument();
    const grupo = screen.getByRole("group", { name: "Ítems sugeridos" });
    fireEvent.click(within(grupo).getByRole("button", { name: "Ruedas de auxilio" }));
    fireEvent.click(within(grupo).getByRole("button", { name: "Palas" }));
    fireEvent.change(screen.getByLabelText("Otro ítem"), { target: { value: "Cuerda larga" } });
    fireEvent.click(screen.getByRole("button", { name: "Sumar ítem" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
    await waitFor(() => expect(llamadas(f, "POST /cuadrillas/1/avisos")).toHaveLength(1));
    expect(cuerpoDe(f, "POST /cuadrillas/1/avisos")).toMatchObject({ tipo: "equipamiento", items: ["Ruedas de auxilio", "Palas", "Cuerda larga"], geometria: null });
  });
});
