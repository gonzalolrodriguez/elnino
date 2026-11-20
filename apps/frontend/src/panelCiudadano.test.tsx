import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OPCIONES_ASISTENCIA } from "./lib/confirmacion";
import { fijarToken } from "./lib/api";
import { pasosDe, pedidoActivo, type Pedido } from "./lib/pedidos";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (json: unknown) => () => ({ estado: 200, json });

const SECTOR = (sectores: unknown[] = []) => ({
  sectores,
  altura_referencia: { altura_m: 5.6, fecha: "2026-10-31", categoria: "DATO OBSERVADO", fuente: "K1" },
  centro_asignado: null,
  nota: "Estado calculado con la última altura observada; no es una orden de evacuación.",
});
const S4 = {
  id: "S4",
  nombre: "Sector Rural Este",
  estado: "en_riesgo",
  aislado: false,
  altura_compromiso_m: 7.5,
  margen_a_compromiso_m: 1.9,
  accesos: [],
  alertas: [
    { orden_id: 1, tipo: "alerta", fundamento: "Vigilar el río", creada_en: "2026-11-19T12:00:00Z" },
    { orden_id: 2, tipo: "evacuacion_preventiva", fundamento: "Evacuar ganado", creada_en: "2026-11-18T12:00:00Z" },
  ],
};

const pedido = (extra: Partial<Pedido> = {}): Pedido => ({
  id: 41,
  tipo: "asistencia",
  personas: 3,
  estado: "en_curso",
  origen: "web",
  creada_en: "2026-11-20T17:00:00Z",
  lat: -26.18,
  lon: -58.14,
  sector_id: "S4",
  linea_tiempo: [
    { estado: "recibida", en: "2026-11-20T17:00:00Z" },
    { estado: "verificada", en: "2026-11-20T17:05:00Z" },
    { estado: "asignada", en: "2026-11-20T17:10:00Z" },
    { estado: "en_curso", en: "2026-11-20T17:20:00Z" },
    { estado: "resuelta", en: null },
  ],
  tarea: {
    id: 7,
    estado: "en_curso",
    cuadrilla: { id: 2, tipo_incidente: "humana", rol_encargado: "encargado_cuadrilla", vehiculo: "camion_jaula" },
    iniciada_en: "2026-11-20T17:20:00Z",
    cerrada_en: null,
  },
  seguimiento: {
    solicitud_id: 41,
    tarea_id: 7,
    tipo_cuadrilla: "humana",
    roles: ["encargado_cuadrilla"],
    estado: "en_camino",
    posicion: { lat: -26.19, lon: -58.15, precision_m: 10 },
    actualizada_en: "2026-11-20T18:02:11Z",
    posicion_vieja: false,
    distancia_m: 3450,
    llegada_estimada_min: 8,
    categoria: "SIMULADO",
    supuestos: { factor_desvio: 1.3, velocidad_cuadrilla_kmh: 40, posicion_vieja_minutos: 5 },
    nota: "estimación",
  },
  confirmacion: null,
  centro: { id: 3, nombre: "Escuela de referencia", lat: -26.2, lon: -58.2 },
  ...extra,
});

function conSesion(pedidos: Pedido[] | null, sector: unknown = SECTOR([S4]), rutas: Parameters<typeof simularFetch>[0] = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({
    "POST /auth/refresh": () => sesion("ciudadano"),
    "GET /auth/yo": ok({ id: 9, email: "ana@ejemplo.invalid", nombre_visible: "Ana Prueba", rol: "ciudadano", rol_operativo: null, estado: "activo", creado_en: "2026-11-17T22:41:03Z", ultimo_login: null }),
    "GET /mi/grupo-familiar": ok({ integrantes: 3, menores: 1, mayores: 0, mascotas: 0, sector_id: "S4", actualizado_en: "2026-11-18T10:00:00+00:00" }),
    "GET /mi/sector": ok(sector),
    "GET /mi/notificaciones": ok({ notificaciones: [], no_leidas: 0 }),
    ...(pedidos ? { "GET /mi/pedidos": ok({ categoria: "SIMULADO", items: pedidos }) } : {}),
    ...rutas,
  });
}

describe("panel personal en /mi-cuenta", () => {
  it("saluda por el nombre y deja siempre a mano la llamada al 103", async () => {
    conSesion([]);
    renderRuta("/mi-cuenta");
    expect(await screen.findByTestId("saludo")).toHaveTextContent("Hola, Ana Prueba");
    expect(screen.getByRole("link", { name: /Emergencia: llamar al 103/ })).toHaveAttribute("href", "tel:103");
  });

  it("la banda del sector usa texto, y la orden vigente es la de mayor gravedad", async () => {
    conSesion([]);
    renderRuta("/mi-cuenta");
    const banda = await screen.findByTestId("banda-sector");
    expect(banda).toHaveAttribute("data-estado", "en_riesgo");
    expect(banda).toHaveTextContent("Tu sector está en riesgo");
    expect(banda).toHaveTextContent("faltan 1,90 m");
    expect(screen.getByTestId("orden-vigente")).toHaveTextContent("Evacuación preventiva");
    // En la lista de avisos, evacuación preventiva va antes que alerta.
    const items = within(await screen.findByTestId("ordenes-vigentes")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Evacuación preventiva");
    expect(items[1]).toHaveTextContent("Alerta");
  });

  it("sector desconocido: invita a marcar el domicilio y abre el grupo familiar", async () => {
    conSesion([], SECTOR([]));
    renderRuta("/mi-cuenta");
    const aviso = await screen.findByTestId("sector-desconocido");
    expect(aviso).toHaveTextContent("Todavía no sabemos en qué sector estás");
    fireEvent.click(within(aviso).getByRole("button", { name: "Marcá tu domicilio" }));
    await waitFor(() => expect(screen.getByRole("form", { name: "Editar mi grupo familiar" }).closest("details")).toHaveAttribute("open"));
  });

  it("pedido activo: línea de tiempo, cuadrilla por rol, vehículo, distancia y llegada estimada", async () => {
    conSesion([pedido()]);
    renderRuta("/mi-cuenta");
    const tarjeta = await screen.findByTestId("pedido-activo-41");
    expect(tarjeta).toHaveTextContent("Pedido n.º 41 · Asistencia · 3 personas");
    const linea = within(tarjeta).getByTestId("linea-tiempo-41");
    for (const t of ["Recibido", "Verificado", "Cuadrilla asignada", "En camino", "Asistido"]) expect(linea).toHaveTextContent(t);
    expect(within(linea).getByTestId("paso-en_curso")).toHaveAttribute("data-actual", "true");
    expect(within(linea).getByTestId("paso-resuelta")).toHaveAttribute("data-alcanzado", "false");
    expect(within(linea).getByTestId("paso-verificada")).toHaveTextContent(/20\/11\/2026,? 14:05/);
    const cuad = within(tarjeta).getByTestId("cuadrilla-asignada");
    expect(cuad).toHaveTextContent("Encargado: Encargado de cuadrilla");
    expect(cuad).toHaveTextContent("Vehículo: Camión jaula");
    expect(cuad.querySelector('[data-categoria="SIMULADO"]')).not.toBeNull();
    expect(within(tarjeta).getByTestId("seguimiento-estado")).toHaveTextContent("A 3,5 km de tu pedido · llegada estimada: unos 8 min");
    expect(tarjeta).toHaveTextContent("Última posición recibida a las 15:02");
    expect(tarjeta).toHaveTextContent("Centro de destino: Escuela de referencia");
    expect(within(tarjeta).queryByTestId("confirmacion-asistencia")).not.toBeInTheDocument();
  });

  it("asignada sin posición: no inventa distancia ni llegada", async () => {
    const p = pedido();
    conSesion([pedido({ seguimiento: { ...(p.seguimiento as NonNullable<Pedido["seguimiento"]>), estado: "asignada_sin_posicion", posicion: null, distancia_m: null, llegada_estimada_min: null, actualizada_en: null, posicion_vieja: null } })]);
    renderRuta("/mi-cuenta");
    expect(await screen.findByTestId("seguimiento-sin-posicion")).toHaveTextContent("Todavía no recibimos su posición");
    expect(screen.queryByTestId("seguimiento-estado")).not.toBeInTheDocument();
  });

  it("posición vieja: avisa que la llegada puede no ser confiable", async () => {
    const p = pedido();
    conSesion([pedido({ seguimiento: { ...(p.seguimiento as NonNullable<Pedido["seguimiento"]>), posicion_vieja: true } })]);
    renderRuta("/mi-cuenta");
    expect(await screen.findByTestId("seguimiento-vieja")).toHaveTextContent("pueden no ser confiables");
  });

  it("con un pedido activo «Nuevo pedido» queda plegado; sin pedidos, desplegado", async () => {
    conSesion([pedido()]);
    const { unmount } = renderRuta("/mi-cuenta");
    const plegado = await screen.findByTestId("nuevo-pedido");
    await screen.findByTestId("pedido-activo-41");
    expect(plegado.querySelector("details")).not.toHaveAttribute("open");
    unmount();

    conSesion([]);
    renderRuta("/mi-cuenta");
    const form = await screen.findByRole("form", { name: "Pedir ayuda" });
    expect(form).toBeVisible();
    expect(screen.getByTestId("nuevo-pedido").querySelector("details")).toHaveAttribute("open");
    expect(screen.queryByTestId("pedido-activo-41")).not.toBeInTheDocument();
  });

  it("consulta los pedidos otra vez cada ~20 s mientras hay uno en curso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const f = conSesion([pedido()]);
      renderRuta("/mi-cuenta");
      await screen.findByTestId("pedido-activo-41");
      const antes = llamadas(f, "GET /mi/pedidos").length;
      await vi.advanceTimersByTimeAsync(21_000);
      expect(llamadas(f, "GET /mi/pedidos").length).toBeGreaterThan(antes);
    } finally {
      vi.useRealTimers();
    }
  });

  it("error al cargar los pedidos: mensaje con salida de emergencia", async () => {
    conSesion(null, SECTOR([S4]), { "GET /mi/pedidos": () => ({ estado: 500, json: { error: { codigo: "interno", mensaje: "Error", detalle: [] } } }) });
    renderRuta("/mi-cuenta");
    expect(await screen.findByTestId("pedidos-error")).toHaveTextContent("llamá al 103");
  });

  it("historial: los pedidos anteriores van plegados con su estado final en texto", async () => {
    const resuelto = pedido({ id: 30, estado: "resuelta", seguimiento: null, confirmacion: { solicitud_id: 30, respondida: true, respuesta: "completa", comentario: null } });
    const conProblema = pedido({ id: 31, estado: "resuelta", seguimiento: null, confirmacion: { solicitud_id: 31, respondida: true, respuesta: "no_encontraron", comentario: null } });
    conSesion([pedido(), conProblema, resuelto]);
    renderRuta("/mi-cuenta");
    const hist = await screen.findByTestId("pedidos-anteriores");
    expect(hist.querySelector("details")).not.toHaveAttribute("open");
    expect(within(hist).getByTestId("estado-final-30")).toHaveTextContent("Resuelto");
    expect(within(hist).getByTestId("estado-final-31")).toHaveTextContent("Vinieron pero no me encontraron");
  });
});

describe("confirmación «¿Te asistieron?»", () => {
  const cerrado = () =>
    pedido({
      estado: "resuelta",
      seguimiento: null,
      tarea: { id: 7, estado: "completada", cuadrilla: { id: 2, tipo_incidente: "humana", rol_encargado: "encargado_cuadrilla", vehiculo: "4x4" }, iniciada_en: "2026-11-20T17:20:00Z", cerrada_en: "2026-11-20T18:20:00Z" },
      confirmacion: { solicitud_id: 41, respondida: false, respuesta: null, comentario: null },
    });

  it("las cinco opciones canónicas están disponibles", async () => {
    conSesion([cerrado()]);
    renderRuta("/mi-cuenta");
    const tarjeta = await screen.findByTestId("confirmacion-asistencia");
    expect(within(tarjeta).getAllByRole("radio")).toHaveLength(5);
    for (const o of OPCIONES_ASISTENCIA) expect(within(tarjeta).getByLabelText(new RegExp(o.etiqueta))).toBeInTheDocument();
    expect(within(tarjeta).getByRole("button", { name: "Enviar respuesta" })).toBeDisabled();
  });

  it.each(OPCIONES_ASISTENCIA.map((o) => [o.valor, o.etiqueta] as const))("envía «%s» con el comentario y muestra la nota del servidor", async (valor, etiqueta) => {
    const f = conSesion([cerrado()], SECTOR([S4]), {
      "POST /mi/confirmaciones": () => ({ estado: 201, json: { id: 5, respuesta: valor, repetida: false, nota: "Gracias, tu respuesta ayuda a revisar la asistencia." } }),
    });
    renderRuta("/mi-cuenta");
    const tarjeta = await screen.findByTestId("confirmacion-asistencia");
    fireEvent.click(within(tarjeta).getByLabelText(new RegExp(etiqueta)));
    fireEvent.change(within(tarjeta).getByLabelText(/Comentario|Contanos qué pasó/), { target: { value: "Detalle" } });
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Enviar respuesta" }));
    expect(await screen.findByTestId("confirmacion-gracias")).toHaveTextContent("Gracias, tu respuesta ayuda a revisar la asistencia.");
    const [, init] = llamadas(f, "POST /mi/confirmaciones")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ solicitud_id: 41, respuesta: valor, comentario: "Detalle" });
  });

  it("sin comentario no lo manda, y un 409 del servidor se muestra", async () => {
    const f = conSesion([cerrado()], SECTOR([S4]), {
      "POST /mi/confirmaciones": () => ({ estado: 409, json: { error: { codigo: "conflicto", mensaje: "Ya respondiste esta consulta con otra opción.", detalle: [] } } }),
    });
    renderRuta("/mi-cuenta");
    const tarjeta = await screen.findByTestId("confirmacion-asistencia");
    fireEvent.click(within(tarjeta).getByLabelText(/No vinieron/));
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Enviar respuesta" }));
    expect(await within(tarjeta).findByText("Ya respondiste esta consulta con otra opción.")).toBeInTheDocument();
    const [, init] = llamadas(f, "POST /mi/confirmaciones")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ solicitud_id: 41, respuesta: "no_vinieron" });
  });

  it("ya respondida: no vuelve a preguntar y el pedido pasa al historial", async () => {
    const respondido = { ...cerrado(), confirmacion: { solicitud_id: 41, respondida: true, respuesta: "completa", comentario: null } };
    conSesion([respondido]);
    renderRuta("/mi-cuenta");
    const hist = await screen.findByTestId("pedidos-anteriores");
    expect(within(hist).getByTestId("estado-final-41")).toHaveTextContent("Resuelto");
    expect(screen.queryByTestId("confirmacion-asistencia")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pedido-activo-41")).not.toBeInTheDocument();
  });
});

describe("lib/pedidos", () => {
  it("pedidoActivo elige el más nuevo sin resolver o resuelto sin confirmar", () => {
    const viejo = pedido({ id: 1, estado: "resuelta", confirmacion: null });
    const abierto = pedido({ id: 2 });
    expect(pedidoActivo([viejo])).toBeNull();
    expect(pedidoActivo([abierto, viejo])?.id).toBe(2);
    const sinConfirmar = pedido({ id: 3, estado: "resuelta", confirmacion: { solicitud_id: 3, respondida: false, respuesta: null, comentario: null } });
    expect(pedidoActivo([sinConfirmar, viejo])?.id).toBe(3);
  });

  it("pasosDe agrega «Confirmado por vos» solo cuando ya respondió", () => {
    const base = pedido({ estado: "resuelta" });
    expect(pasosDe(base)).toHaveLength(5);
    const conf = pasosDe({ ...base, confirmacion: { solicitud_id: 41, respondida: true, respuesta: "completa", comentario: null } });
    expect(conf).toHaveLength(6);
    expect(conf[5].etiqueta).toBe("Confirmado por vos");
  });
});
