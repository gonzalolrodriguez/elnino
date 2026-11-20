import { ChakraProvider } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { GRUPOS_NAVEGACION } from "./panel/PanelLayout";
import { NovedadesCuadrillas } from "./panel/cuadrillas/NovedadesCuadrillas";
import { ordenarNovedades } from "./panel/cuadrillas/partes";
import type { CuadrillaResumen, ParteReciente } from "./panel/tipos";
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

const PARTE_DIFICULTAD = {
  id: 3,
  tarea_id: 7,
  cuadrilla_id: 1,
  tipo: "dificultad",
  resultado: null,
  observacion: "El camino de tierra está anegado y no pasa el camión.",
  autor_rol: "encargado_cuadrilla",
  creado_en: "2026-11-20T14:00:00Z",
  resuelta: false,
} as const;

const PARTE_AVANCE = { ...PARTE_DIFICULTAD, id: 2, tipo: "avance", observacion: "Salimos hacia el sector.", autor_rol: "transporte", creado_en: "2026-11-20T13:00:00Z", resuelta: null } as const;

const RESUMEN: { items: CuadrillaResumen[] } = {
  items: [
    {
      id: 1,
      nombre: "Cuadrilla humana 1",
      tipo_incidente: "humana",
      vehiculo: "4x4",
      estado: "activa",
      integrantes: [
        { usuario_id: 10, rol_operativo: "encargado_cuadrilla", es_encargado: true },
        { usuario_id: 11, rol_operativo: "sipec", es_encargado: false },
      ],
      tarea_actual: { id: 7, estado: "pendiente", solicitud_id: 4, sector_id: "S4", requiere_atencion: true },
      ultimo_parte: PARTE_DIFICULTAD,
      dificultades_abiertas: 1,
    },
    {
      id: 2,
      nombre: "Cuadrilla ganadera 1",
      tipo_incidente: "ganadera",
      vehiculo: "camion_jaula",
      estado: "activa",
      integrantes: [{ usuario_id: 12, rol_operativo: "veterinario", es_encargado: false }],
      tarea_actual: null,
      ultimo_parte: null,
      dificultades_abiertas: 0,
    },
  ],
};

// La primera carga de la app en frío (imports perezosos) puede tardar con la máquina ocupada.
const FRIO = { timeout: 20_000 };

describe("página Cuadrillas", () => {
  it("muestra cada cuadrilla con sus integrantes por rol (sin nombres), tarea y último parte", async () => {
    conSesion("operador", { "GET /cuadrillas/resumen": ok(RESUMEN) });
    renderRuta("/comando/cuadrillas");
    const c1 = await screen.findByTestId("cuadrilla-1", {}, FRIO);
    expect(within(c1).getByText("Cuadrilla humana 1")).toBeInTheDocument();
    // Aparece como integrante y como autor del último parte.
    expect(within(c1).getAllByText("Encargado de cuadrilla")).toHaveLength(2);
    expect(within(c1).getByText("SIPEC")).toBeInTheDocument();
    expect(within(c1).getByTestId("encargado")).toHaveTextContent("Encargado");
    expect(within(c1).getByText("4x4", { selector: "span" })).toBeInTheDocument();
    expect(within(c1).getByText("SIMULADO")).toBeInTheDocument();
    expect(within(c1).getByRole("link", { name: "Tarea n.º 7" })).toHaveAttribute("href", "/comando/operacion?tarea=7#sec-tareas");
    expect(within(c1).getByTestId("requiere-atencion")).toHaveTextContent("Requiere atención");
    expect(within(c1).getByTestId("ultimo-parte-1")).toHaveTextContent("Dificultad");
    expect(within(c1).getByTestId("ultimo-parte-1")).toHaveTextContent("anegado");
    expect(screen.getByTestId("dificultades-1")).toHaveTextContent("1 dificultad abierta");
    expect(screen.queryByText(/Usuario n\.º/)).not.toBeInTheDocument();
    const c2 = screen.getByTestId("cuadrilla-2");
    expect(within(c2).getByText("Veterinario o zootecnista")).toBeInTheDocument();
    expect(within(c2).getByText("Libre: sin tarea asignada.")).toBeInTheDocument();
  }, 30_000);

  it("filtra por dificultades, atención y libres", async () => {
    conSesion("operador", { "GET /cuadrillas/resumen": ok(RESUMEN) });
    renderRuta("/comando/cuadrillas");
    await screen.findByTestId("cuadrilla-1", {}, FRIO);
    fireEvent.click(screen.getByRole("button", { name: /Libres/ }));
    expect(screen.queryByTestId("cuadrilla-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("cuadrilla-2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Con dificultades/ }));
    expect(screen.getByTestId("cuadrilla-1")).toBeInTheDocument();
    expect(screen.queryByTestId("cuadrilla-2")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Requieren atención/ }));
    expect(screen.getByTestId("cuadrilla-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByTestId("cuadrilla-2")).toBeInTheDocument();
  }, 30_000);

  it("el operador agrega un integrante eligiendo usuario y rol, y quita otro con confirmación", async () => {
    const f = conSesion("operador", {
      "GET /cuadrillas/resumen": ok(RESUMEN),
      "GET /roles-operativos": ok({ roles: [{ codigo: "policia", nombre: "Policía", descripcion: null }] }),
      "GET /usuarios": ok([{ id: 20, email: "x@ejemplo.invalid", nombre_visible: "Nadie Real", rol: "cuadrilla", rol_operativo: null, estado: "activo", ultimo_login: null }]),
      "POST /cuadrillas/1/integrantes": ok({}, 201),
      "DELETE /cuadrillas/1/integrantes/11": ok({}),
    });
    renderRuta("/comando/cuadrillas");
    const c1 = await screen.findByTestId("cuadrilla-1");
    fireEvent.click(within(c1).getByRole("button", { name: "Agregar integrante" }));
    const form = await screen.findByTestId("form-integrante-1");
    const usuario = await within(form).findByLabelText("Usuario de cuadrilla");
    // No se muestra el nombre de la persona, solo el número de usuario.
    expect(within(form).queryByText(/Nadie Real/)).not.toBeInTheDocument();
    fireEvent.change(usuario, { target: { value: "20" } });
    fireEvent.change(within(form).getByLabelText("Rol operativo"), { target: { value: "policia" } });
    fireEvent.click(within(form).getByRole("button", { name: "Agregar integrante" }));
    await waitFor(() => expect(llamadas(f, "POST /cuadrillas/1/integrantes")).toHaveLength(1));
    expect(JSON.parse((llamadas(f, "POST /cuadrillas/1/integrantes")[0][1] as RequestInit).body as string)).toEqual({ usuario_id: 20, rol_operativo: "policia" });

    fireEvent.click(within(await screen.findByTestId("cuadrilla-1")).getByRole("button", { name: "Quitar SIPEC de Cuadrilla humana 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar: quitar SIPEC" }));
    await waitFor(() => expect(llamadas(f, "DELETE /cuadrillas/1/integrantes/11")).toHaveLength(1));
  });

  it("si el operador no puede leer los usuarios, ingresa el número y se explica por qué", async () => {
    conSesion("operador", {
      "GET /cuadrillas/resumen": ok(RESUMEN),
      "GET /usuarios": ok({ error: { codigo: "prohibido", mensaje: "Sin permiso", detalle: [] } }, 403),
    });
    renderRuta("/comando/cuadrillas");
    const c2 = await screen.findByTestId("cuadrilla-2");
    fireEvent.click(within(c2).getByRole("button", { name: "Agregar integrante" }));
    const form = await screen.findByTestId("form-integrante-2");
    expect(await within(form).findByText(/ingresá el número de usuario/)).toBeInTheDocument();
    expect(within(form).getByLabelText("Usuario de cuadrilla")).toHaveAttribute("type", "number");
  });

  it("el decisor ve las cuadrillas pero no puede gestionar integrantes", async () => {
    conSesion("decisor", { "GET /cuadrillas/resumen": ok(RESUMEN) });
    renderRuta("/comando/cuadrillas");
    const c1 = await screen.findByTestId("cuadrilla-1");
    expect(within(c1).queryByRole("button", { name: "Agregar integrante" })).not.toBeInTheDocument();
    expect(within(c1).queryByRole("button", { name: /^Quitar/ })).not.toBeInTheDocument();
  });

  it("muestra el error con reintento y el estado vacío", async () => {
    conSesion("operador", { "GET /cuadrillas/resumen": ok({ error: { codigo: "x", mensaje: "Falló el servicio", detalle: [] } }, 500) });
    renderRuta("/comando/cuadrillas");
    expect(await screen.findByText("Falló el servicio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("estado vacío sin cuadrillas", async () => {
    conSesion("operador", { "GET /cuadrillas/resumen": ok({ items: [] }) });
    renderRuta("/comando/cuadrillas");
    expect(await screen.findByText(/Todavía no hay cuadrillas/)).toBeInTheDocument();
  });
});

describe("Operación: partes por tarea", () => {
  const TAREA = { id: 7, cuadrilla_id: 1, solicitud_id: 4, orden_id: null, sector_id: "S4", titulo: "Evacuar familia", descripcion: null, estado: "pendiente", creado_en: "2026-11-20T10:00:00Z", requiere_atencion: true, ultimo_parte: PARTE_DIFICULTAD };

  it("abre el historial, resalta la atención y resuelve una dificultad", async () => {
    const f = conSesion("operador", {
      "GET /cuadrillas": ok({ cuadrillas: [] }),
      "GET /solicitudes": ok({ solicitudes: [] }),
      "GET /tareas": ok({ tareas: [TAREA] }),
      "GET /tareas/7/partes": ok({ items: [PARTE_DIFICULTAD, PARTE_AVANCE] }),
      "PATCH /partes/3": ok({ ...PARTE_DIFICULTAD, resuelta: true }),
    });
    renderRuta("/comando/operacion");
    const fila = (await screen.findByText("Evacuar familia")).closest("li") as HTMLElement;
    expect(within(fila).getByTestId("requiere-atencion")).toBeInTheDocument();
    fireEvent.click(within(fila).getByRole("button", { name: "Ver partes de la tarea 7" }));
    const historial = await screen.findByTestId("partes-tarea-7");
    expect(within(historial).getByText(/reasignala a otra cuadrilla/)).toBeInTheDocument();
    const items = within(historial).getAllByTestId("parte-historial");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Dificultad");
    expect(items[0]).toHaveTextContent("Sin resolver");
    expect(items[0]).toHaveTextContent("Encargado de cuadrilla");
    expect(items[1]).toHaveTextContent("Avance");
    fireEvent.click(within(items[0]).getByRole("button", { name: "Marcar dificultad como resuelta" }));
    await waitFor(() => expect(llamadas(f, "PATCH /partes/3")).toHaveLength(1));
    expect(JSON.parse((llamadas(f, "PATCH /partes/3")[0][1] as RequestInit).body as string)).toEqual({ resuelta: true });
  });

  it("?tarea=7 deja abierto el historial de esa tarea", async () => {
    conSesion("operador", {
      "GET /cuadrillas": ok({ cuadrillas: [] }),
      "GET /solicitudes": ok({ solicitudes: [] }),
      "GET /tareas": ok({ tareas: [TAREA] }),
      "GET /tareas/7/partes": ok({ items: [] }),
    });
    renderRuta("/comando/operacion?tarea=7#sec-tareas");
    expect(await screen.findByText("La cuadrilla todavía no informó nada sobre esta tarea.")).toBeInTheDocument();
  });
});

const reciente = (p: Partial<ParteReciente> & { id: number }): ParteReciente => ({
  tarea_id: 7,
  cuadrilla_id: 1,
  tipo: "avance",
  resultado: null,
  observacion: null,
  autor_rol: "encargado_cuadrilla",
  creado_en: "2026-11-20T10:00:00Z",
  resuelta: null,
  sector_id: "S4",
  solicitud_id: 4,
  cuadrilla_nombre: "Cuadrilla humana 1",
  tarea_estado: "pendiente",
  ...p,
});

describe("NovedadesCuadrillas", () => {
  it("ordena primero dificultades sin resolver y resultados no completos, y después lo más reciente", () => {
    const orden = ordenarNovedades([
      reciente({ id: 1, creado_en: "2026-11-20T15:00:00Z" }),
      reciente({ id: 2, tipo: "resultado", resultado: "completa", creado_en: "2026-11-20T14:00:00Z" }),
      reciente({ id: 3, tipo: "resultado", resultado: "parcial", creado_en: "2026-11-20T09:00:00Z" }),
      reciente({ id: 4, tipo: "dificultad", resuelta: true, creado_en: "2026-11-20T16:00:00Z" }),
      reciente({ id: 5, tipo: "dificultad", resuelta: false, creado_en: "2026-11-20T08:00:00Z" }),
    ]).map((p) => p.id);
    expect(orden).toEqual([5, 3, 4, 1, 2]);
  });

  it("muestra la cuadrilla, el sector, el chip con texto y la observación truncada, con enlace a la cuadrilla", async () => {
    simularFetch({
      "GET /partes/recientes": ok({
        items: [
          reciente({ id: 1, creado_en: "2026-11-20T15:00:00Z", observacion: "Llegamos al paraje." }),
          reciente({ id: 2, tipo: "dificultad", resuelta: false, observacion: "x".repeat(300), cuadrilla_nombre: "Cuadrilla ganadera 1", cuadrilla_id: 2, sector_id: "S1" }),
        ],
      }),
    });
    window.localStorage.setItem("e3_sesion", "1");
    render(
      <ChakraProvider theme={theme}>
        <MemoryRouter>
          <NovedadesCuadrillas />
        </MemoryRouter>
      </ChakraProvider>,
    );
    const items = await screen.findAllByTestId("novedad-cuadrilla");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Dificultad");
    expect(items[0]).toHaveTextContent("Sin resolver");
    expect(items[0]).toHaveTextContent("Cuadrilla ganadera 1");
    expect(items[0]).toHaveTextContent("Sector S1");
    expect(items[0].textContent).toContain("…");
    expect(items[0].textContent?.includes("x".repeat(300))).toBe(false);
    expect(within(items[0]).getByRole("link", { name: "Cuadrilla ganadera 1" })).toHaveAttribute("href", "/comando/cuadrillas#cuadrilla-2");
    expect(items[1]).toHaveTextContent("Avance");
    expect(items[1]).toHaveTextContent("Llegamos al paraje.");
  });

  it("estado vacío", async () => {
    simularFetch({ "GET /partes/recientes": ok({ items: [] }) });
    render(
      <ChakraProvider theme={theme}>
        <MemoryRouter>
          <NovedadesCuadrillas />
        </MemoryRouter>
      </ChakraProvider>,
    );
    expect(await screen.findByText("Todavía no hay partes de las cuadrillas.")).toBeInTheDocument();
  });
});

describe("menú y acceso a /comando/cuadrillas", () => {
  it("la sección Cuadrillas está en el grupo Ejecutar", () => {
    const ejecutar = GRUPOS_NAVEGACION.find((g) => g.id === "ejecutar");
    expect(ejecutar?.secciones.map((s) => [s.texto, s.to])).toContainEqual(["Cuadrillas", "/comando/cuadrillas"]);
  });

  it("el operador la ve en el menú lateral", async () => {
    conSesion("operador", { "GET /cuadrillas/resumen": ok({ items: [] }) });
    renderRuta("/comando/cuadrillas");
    const nav = await screen.findByRole("navigation", { name: "Secciones del panel operativo" });
    expect(within(nav).getByRole("link", { name: "Cuadrillas" })).toHaveAttribute("href", "/comando/cuadrillas");
  });

  it("un ciudadano no llega al panel ni al menú", async () => {
    conSesion("ciudadano");
    renderRuta("/comando/cuadrillas");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Cuadrillas" })).not.toBeInTheDocument());
    expect(screen.queryByRole("navigation", { name: "Secciones del panel operativo" })).not.toBeInTheDocument();
  });
});
