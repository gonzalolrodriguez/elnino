import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import { GRUPOS_NAVEGACION } from "./panel/PanelLayout";
import { evaluarFrescura } from "./panel/tablero/frescura";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

vi.mock("./panel/MapaGL", () => ({ default: () => null }));

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
const ok = (json: unknown) => () => ({ estado: 200, json });

const sector = (id: string, estado: string, aislado: boolean, margen: number) => ({
  id,
  nombre: `Sector ${id}`,
  estado,
  aislado,
  margen_a_compromiso_m: margen,
  altura_compromiso_m: 8,
  personas_k10: 1200,
  personas_registradas: 0,
  familias_registradas: 0,
  animales_expuestos: id === "S4" ? 200 : 0,
  colmenas: 0,
  accesos: id === "S4" ? [{ nombre: "Camino de tierra a S4", superficie: "tierra", estado: "intransitable_lluvia" }] : [],
  centro_sugerido: { personas: { id: 1, nombre: "Escuela de referencia", tipo: "escuela", distancia_linea_recta_m: 2300 }, animales: null, nota: "Sugerencia SIMULADA" },
});

const RESUMEN = {
  generado_en: "2026-11-19T15:00:00+00:00",
  leyenda: "x",
  categoria: "SIMULADO",
  fuente: "Resumen",
  fecha_dato: "2026-11-19",
  rio: {
    categoria: "DATO OBSERVADO",
    fuente: "K1",
    fecha_dato: "2026-10-31",
    disponible: true,
    altura_m: 5.6,
    fecha_lectura: "2026-10-31",
    umbral_alerta_m: 7.8,
    umbral_evacuacion_m: 8.3,
    distancia_a_alerta_m: 2.2,
    distancia_a_evacuacion_m: 2.7,
    tendencia_7d_m: 0.42,
    tendencia_7d_m_por_dia: 0.06,
    tiempo_a_umbrales: [
      { objetivo: "Alerta", valor_m: 7.8, ya_alcanzado: false, dias_minimo: 6.1, dias_maximo: 20.4 },
      { objetivo: "Evacuación", valor_m: 8.3, ya_alcanzado: false, dias_minimo: 9, dias_maximo: 30 },
    ],
    supuesto_proyeccion: "Proyección lineal a tasa constante: es un SUPUESTO, no un pronóstico.",
    categoria_proyeccion: "SIMULADO",
  },
  sectores: {
    categoria: "SIMULADO",
    fuente: "K10",
    fecha_dato: "2026-11-19",
    altura_usada_m: 5.6,
    items: [sector("S1", "normal", false, 2.4), sector("S2", "normal", false, 3), sector("S3", "normal", false, 2.3), sector("S4", "en_riesgo", false, 0.4)],
  },
  solicitudes: {
    categoria: "SIMULADO",
    fuente: "Plataforma",
    fecha_dato: "2026-11-19",
    total: 6,
    por_estado: { recibida: 3, verificada: 1, asignada: 1, resuelta: 1 },
    por_sector: { S4: 4, sin_sector: 2 },
    por_origen: { sms_sim: 3, app: 3 },
    recibidas_mas_antigua_min: 135,
    a_verificar: 2,
  },
  centros: {
    categoria: "SIMULADO",
    fuente: "Centros",
    fecha_dato: "2026-11-12",
    items: [{ id: 1, nombre: "Escuela de referencia", tipo: "escuela", capacidad_personas: 200, capacidad_animales: 0, ocupacion: 150, ocupacion_pct: 75 }],
  },
  cuadrillas: {
    categoria: "SIMULADO",
    fuente: "Plataforma",
    fecha_dato: "2026-11-19",
    items: [
      { id: 1, nombre: "Cuadrilla ganadera 1", tipo_incidente: "ganadera", estado: "activa", tareas: { pendiente: 2, en_curso: 1, completada: 0, cancelada: 0 } },
      { id: 2, nombre: "Cuadrilla humana 1", tipo_incidente: "humana", estado: "activa", tareas: { pendiente: 0, en_curso: 0, completada: 3, cancelada: 0 } },
    ],
    tareas_sin_cuadrilla: 1,
  },
  ordenes: {
    categoria: "SIMULADO",
    fuente: "Órdenes",
    fecha_dato: "2026-11-18",
    recientes: [{ id: 7, tipo: "evacuacion_preventiva", sectores: ["S4"], emitida_por_rol: "defensa_civil", creada_en: "2026-11-18T13:00:00Z" }],
    bitacora_borradores: 2,
  },
  lluvia_7d: { categoria: "SIMULADO", fuente: "Partes", fecha_dato: null, desde: "2026-11-12", sin_dato_observado: true, por_origen: {} },
  frescura: { rio_ultima_lectura: "2026-10-31", k10_sectores: "2026-11-12", lluvia_ultima_lectura: null, fecha_corte: "2026-10-31" },
};

const SOLICITUDES = {
  total: 2,
  solicitudes: [
    { id: 2, origen: "app", tipo: "evacuacion", personas: 4, animales: 0, texto: null, estado: "recibida", sector_id: "S4", creado_en: "2026-11-19T14:00:00Z" },
    { id: 1, origen: "sms_sim", tipo: "ganado", personas: 2, animales: 30, texto: null, estado: "recibida", sector_id: "S4", creado_en: "2026-11-19T12:00:00Z" },
  ],
};

describe("evaluarFrescura", () => {
  const generado = "2026-11-19T15:00:00+00:00";
  it("la lectura al corte no se marca como vieja, aunque sea de hace semanas", () => {
    expect(evaluarFrescura("2026-10-31", generado, "2026-10-31", 2).estado).toBe("al_corte");
  });
  it("una lectura anterior al corte y fuera del límite es vieja; sin lectura es sin dato", () => {
    expect(evaluarFrescura("2026-10-20", generado, "2026-10-31", 2).estado).toBe("vieja");
    expect(evaluarFrescura("2026-10-30", "2026-10-31T10:00:00Z", "2026-10-31", 2).estado).toBe("al_dia");
    expect(evaluarFrescura(null, generado, "2026-10-31", 2).estado).toBe("sin_dato");
  });
});

describe("navegación del panel", () => {
  it("agrupa las secciones por tarea con nombres corrientes y mantiene las rutas", () => {
    expect(GRUPOS_NAVEGACION.map((g) => g.titulo)).toEqual(["Situación", "Decidir", "Ejecutar", "Respaldo y registro"]);
    const textos = GRUPOS_NAVEGACION.flatMap((g) => g.secciones.map((s) => s.texto));
    expect(textos).toContain("Tablero");
    expect(textos).toContain("Río y lluvia");
    expect(textos).toContain("Producción y ganado");
    expect(textos).toContain("Auditoría de datos (Centinela)");
    expect(textos).toContain("Bitácora de decisiones");
    expect(textos.join(" ")).not.toMatch(/Arca|K8|^Centinela/);
    const rutas = GRUPOS_NAVEGACION.flatMap((g) => g.secciones.map((s) => s.to));
    expect(rutas).toEqual(expect.arrayContaining(["/comando", "/comando/mapa", "/comando/ordenes", "/comando/bitacora", "/comando/centinela"]));
  });

  it("el menú lateral muestra los cuatro grupos", async () => {
    conSesion("decisor", { "GET /panel/resumen": ok(RESUMEN) });
    renderRuta("/comando");
    const nav = await screen.findByRole("navigation", { name: "Secciones del panel operativo" });
    for (const g of ["Situación", "Decidir", "Ejecutar", "Respaldo y registro"]) expect(within(nav).getByText(g)).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Producción y ganado" })).toHaveAttribute("href", "/comando/produccion");
  });
});

describe("Tablero", () => {
  it("el decisor ve el río frente a los umbrales, los sectores, y el botón Emitir orden", async () => {
    conSesion("decisor", { "GET /panel/resumen": ok(RESUMEN) });
    renderRuta("/comando");
    expect(await screen.findByTestId("tablero-altura")).toHaveTextContent("5,60 m");
    expect(screen.getByTestId("escala-rio")).toHaveAttribute("aria-label", expect.stringContaining("alerta en 7,80 m"));
    expect(screen.getByTestId("tablero-supuesto")).toHaveTextContent("es un supuesto del equipo, no un pronóstico");
    expect(screen.getByText("6 a 20 días")).toBeInTheDocument();
    for (const id of ["S1", "S2", "S3", "S4"]) expect(screen.getByTestId(`tablero-sector-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId("tablero-sector-S4")).toHaveTextContent("en riesgo");
    // La categoría va una vez en el encabezado del bloque y no en cada tarjeta; cada bloque expone la suya.
    const bloqueSectores = screen.getByRole("region", { name: "Sectores" });
    expect(bloqueSectores.querySelector('[data-categoria="SIMULADO"]')).not.toBeNull();
    expect(screen.getByTestId("tablero-sector-S4").querySelector("[data-categoria]")).toBeNull();
    for (const nombre of ["Río en Puerto Formosa", "Sectores"]) {
      expect(screen.getByRole("region", { name: nombre }).querySelector("[data-categoria]")).not.toBeNull();
    }
    expect(screen.getByTestId("tablero-mas-antigua")).toHaveTextContent("2 h 15 min");
    expect(screen.getByTestId("tablero-a-verificar")).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: "Ver las recibidas" })).toHaveAttribute("href", "/comando/operacion?estado=recibida");
    expect(screen.getByTestId("tablero-centro-1")).toHaveTextContent("150 de 200 personas (75 %)");
    expect(screen.getByTestId("tablero-sin-cuadrilla")).toHaveTextContent("1 tarea sin cuadrilla");
    expect(screen.getByTestId("tablero-borradores")).toHaveTextContent("2 borradores de bitácora");
    expect(screen.getByTestId("tablero-lluvia-sin-observado")).toHaveTextContent("Sin dato observado");
    expect(screen.getByRole("link", { name: "Emitir orden" })).toHaveAttribute("href", "/comando/ordenes");
    // El decisor no ve la cola del operador ni el bloque de evacuaciones (el backend todavía no lo envía).
    expect(screen.queryByText("Cola de pedidos")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Evacuaciones" })).not.toBeInTheDocument();
  });

  it("cada bloque lleva su categoría visible", async () => {
    conSesion("decisor", { "GET /panel/resumen": ok(RESUMEN) });
    renderRuta("/comando");
    const seccion = (await screen.findByRole("heading", { name: "Río en Puerto Formosa" })).closest("section") as HTMLElement;
    expect(within(seccion).getAllByText("DATO OBSERVADO").length).toBeGreaterThan(0);
    const centros = screen.getByRole("heading", { name: "Centros de recepción" }).closest("section") as HTMLElement;
    expect(within(centros).getByText("SIMULADO")).toBeInTheDocument();
  });

  it("el operador ve la cola de pedidos primero, y no tiene el botón Emitir orden", async () => {
    const f = conSesion("operador", { "GET /panel/resumen": ok(RESUMEN), "GET /solicitudes": ok(SOLICITUDES) });
    renderRuta("/comando");
    const cola = await screen.findByTestId("cola-1");
    // Más antigua primero: la 1 (12:00) antes que la 2 (14:00).
    const filas = screen.getAllByTestId(/^cola-/).map((n) => n.getAttribute("data-testid"));
    expect(filas).toEqual(["cola-1", "cola-2"]);
    expect(cola).toHaveTextContent("SMS (simulado)");
    expect(screen.queryByRole("link", { name: "Emitir orden" })).not.toBeInTheDocument();

    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titulos.indexOf("Cola de pedidos")).toBe(0);
    expect(titulos.indexOf("Accesos no transitables")).toBeLessThan(titulos.indexOf("Sectores"));
    expect(titulos).not.toContain("Río en Puerto Formosa"); // el operador ve el río en una sola línea
    expect(screen.getByTestId("escenario-resumido")).toHaveTextContent("Río en Puerto Formosa: 5,60 m");
    expect(screen.getByTestId("tablero-accesos-cerrados")).toHaveTextContent("Camino de tierra a S4");
    expect(screen.getByTestId("tablero-libres")).toHaveTextContent("Cuadrilla humana 1");

    // El filtro por sector se aplica en el servidor.
    fireEvent.change(screen.getByLabelText("Sector"), { target: { value: "S4" } });
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes("sector_id=S4"))).toBe(true));
    expect(llamadas(f, "GET /panel/resumen").length).toBeGreaterThanOrEqual(1);
  });

  it("avisa cuando el dato del río está desactualizado o no hay lluvia cargada", async () => {
    conSesion("decisor", { "GET /panel/resumen": ok(RESUMEN) });
    renderRuta("/comando");
    const aviso = await screen.findByTestId("aviso-datos-viejos");
    expect(aviso).toHaveTextContent("Lluvia");
    expect(screen.getByTestId("frescura-rio")).toHaveTextContent("Al corte de datos");
    expect(screen.getByTestId("frescura-lluvia")).toHaveTextContent("Sin datos");
  });

  it("marca el río como desactualizado cuando la última lectura es anterior al corte y vieja", async () => {
    const r = { ...RESUMEN, frescura: { ...RESUMEN.frescura, rio_ultima_lectura: "2026-10-10" } };
    conSesion("decisor", { "GET /panel/resumen": ok(r) });
    renderRuta("/comando");
    expect(await screen.findByTestId("aviso-datos-viejos")).toHaveTextContent("Río (Puerto Formosa)");
    expect(screen.getByTestId("frescura-rio")).toHaveTextContent("Desactualizado");
  });

  it("si el backend manda el bloque de evacuaciones lo muestra", async () => {
    const r = {
      ...RESUMEN,
      evacuaciones: {
        categoria: "SIMULADO",
        fuente: "x",
        fecha_dato: "2026-11-19",
        total: 4,
        por_estado: { pendiente: 1, en_curso: 0, cerrada_cuadrilla: 1, verificada: 1, con_discrepancia: 1 },
        por_sector: { S4: { pendiente: 1, en_curso: 0, cerrada_cuadrilla: 1, verificada: 1, con_discrepancia: 1 } },
        verificadas_pct: 33.3,
        discrepancias_abiertas: 1,
        personas_trasladadas: 120,
        animales_trasladados: { bovinos: 30 },
        animales_trasladados_total: 30,
        distancia_max_destino_m: 500,
      },
    };
    conSesion("decisor", { "GET /panel/resumen": ok(r) });
    renderRuta("/comando");
    expect(await screen.findByRole("heading", { name: "Evacuaciones" })).toBeInTheDocument();
    expect(screen.getByTestId("evac-verificadas")).toHaveTextContent("33 %");
    expect(screen.getByTestId("evac-personas")).toHaveTextContent("120");
    expect(screen.getByTestId("evac-animales")).toHaveTextContent("30");
    expect(screen.getByTestId("evac-sector-S4")).toHaveTextContent("1");
    expect(screen.getByTestId("evac-aviso-discrepancias")).toHaveTextContent("1 evacuación para revisar");
    const bloque = screen.getByRole("heading", { name: "Evacuaciones" }).closest("section") as HTMLElement;
    expect(within(bloque).getAllByText("SIMULADO").length).toBeGreaterThan(0);
  });

  it("muestra el error con reintento cuando el resumen falla", async () => {
    conSesion("decisor", { "GET /panel/resumen": () => ({ estado: 500, json: { error: { codigo: "error", mensaje: "Falla interna", detalle: [] } } }) });
    renderRuta("/comando");
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("aviso de escenario", () => {
  it("aparece cuando la altura simulada difiere de la observada y se quita con Volver a observado", async () => {
    conSesion("operador", {
      "GET /sectores": ok({ type: "FeatureCollection", features: [] }),
      "GET /accesos": ok({ type: "FeatureCollection", features: [] }),
      "GET /centros": ok({ centros: [] }),
      "GET /estaciones": ok({ estaciones: [] }),
    });
    renderRuta("/comando/mapa");
    expect(screen.queryByTestId("aviso-escenario")).not.toBeInTheDocument();
    const altura = await screen.findByLabelText(/Altura de Puerto Formosa/);
    fireEvent.change(altura, { target: { value: "7.6" } });
    const aviso = await screen.findByTestId("aviso-escenario");
    expect(aviso).toHaveTextContent("Escenario activo: 7,60 m");
    expect(aviso).toHaveTextContent("SIMULADO");
    fireEvent.click(within(aviso).getByRole("button", { name: /Volver a observado/ }));
    await waitFor(() => expect(screen.queryByTestId("aviso-escenario")).not.toBeInTheDocument());
  });

  it("la barra del escenario está en páginas que no son el mapa y cambia el escenario sin consultar al backend", async () => {
    const f = conSesion("operador", { "GET /panel/resumen": ok(RESUMEN) });
    renderRuta("/comando");
    const barra = await screen.findByTestId("barra-escenario");
    expect(barra).toHaveTextContent("5,60 m");
    expect(barra).toHaveTextContent("DATO OBSERVADO");
    fireEvent.change(within(barra).getByLabelText("Altura del escenario (control deslizante)"), { target: { value: "8.2" } });
    const aviso = await screen.findByTestId("aviso-escenario");
    expect(aviso).toHaveTextContent("Escenario activo: 8,20 m");
    expect(aviso).toHaveTextContent("SIMULADO");
    fireEvent.change(within(barra).getByLabelText(/^Lluvia del escenario:/), { target: { value: "40" } });
    expect(screen.getByTestId("aviso-escenario")).toHaveTextContent("40 mm de lluvia");
    expect(llamadas(f, "POST /simulacion/escenario")).toHaveLength(0);
  });
});

const ADMIN = {
  generado_en: "2026-11-19T15:00:00+00:00",
  categoria: "SIMULADO",
  fuente: "Estado interno",
  fecha_dato: "2026-11-19",
  usuarios: {
    total: 12,
    por_rol: { ciudadano: 6, productor: 3, operador: 1, decisor: 1, admin: 1 },
    por_estado: { activo: 11, inactivo: 1 },
    sin_login_30_dias: 4,
    cuentas_bloqueadas: 1,
    intentos_fallidos_en_curso: 5,
    bloqueos: [{ usuario_id: 3, ip: "10.0.0.8", bloqueado_hasta: "2026-11-19T18:00:00+00:00" }],
  },
  auditoria: { cadena_integra: true, primera_fila_inconsistente: null, filas: 321 },
  servicio: { base_de_datos: "ok", websockets_activos: 2, version: "1.0.0" },
};
const usuario = (id: number, rol: string, nombre: string, estado = "activo") => ({ id, email: `${nombre.toLowerCase().replace(/ /g, ".")}@ejemplo.invalid`, nombre_visible: nombre, rol, rol_operativo: null, estado, ultimo_login: null, intentos_fallidos: 0, bloqueado_hasta: null });
const USUARIOS = [usuario(1, "admin", "Admin Demo"), usuario(2, "decisor", "Decisor Demo"), usuario(3, "operador", "Operador Demo"), ...Array.from({ length: 20 }, (_, i) => usuario(10 + i, "ciudadano", `Vecina ${i + 1}`, i === 0 ? "inactivo" : "activo"))];

describe("tablero de administración", () => {
  const rutas = (a: unknown = ADMIN): Rutas => ({ "GET /admin/resumen": ok(a), "GET /usuarios": ok(USUARIOS), "GET /roles-operativos": ok({ roles: [] }) });

  it("muestra usuarios por rol y estado, cuentas bloqueadas con su correo y el estado del servicio", async () => {
    conSesion("admin", rutas());
    renderRuta("/admin");
    expect(await screen.findByTestId("adm-total")).toHaveTextContent("12");
    expect(screen.getByTestId("adm-bloqueadas")).toHaveTextContent("1");
    expect(screen.getByTestId("adm-inactivos")).toHaveTextContent("4");
    expect(screen.getByRole("list", { name: "Usuarios por rol" })).toHaveTextContent("Ciudadanía");
    const tabla = await screen.findByTestId("tabla-bloqueos");
    expect(tabla).toHaveTextContent("operador.demo@ejemplo.invalid");
    expect(tabla).toHaveTextContent("10.0.0.8");
    expect(screen.getByTestId("auditoria-estado")).toHaveTextContent("Cadena de auditoría íntegra");
    expect(screen.getByTestId("adm-bd")).toHaveTextContent("Conectada");
    expect(screen.getByTestId("adm-ws")).toHaveTextContent("2");
    expect(screen.getByTestId("adm-version")).toHaveTextContent("1.0.0");
  });

  it("si la cadena de auditoría está rota lo dice con la fila y como alerta", async () => {
    conSesion("admin", rutas({ ...ADMIN, auditoria: { cadena_integra: false, primera_fila_inconsistente: 42, filas: 321 } }));
    renderRuta("/admin");
    const estado = await screen.findByTestId("auditoria-estado");
    expect(estado).toHaveAttribute("role", "alert");
    expect(estado).toHaveTextContent("Cadena de auditoría rota en la fila 42");
  });

  it("la lista de usuarios filtra por rol, estado y texto, y se pagina", async () => {
    conSesion("admin", rutas());
    renderRuta("/admin");
    expect(await screen.findByTestId("usuarios-rango")).toHaveTextContent("Mostrando 1 a 15 de 23");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByTestId("usuarios-rango")).toHaveTextContent("Mostrando 16 a 23 de 23");

    fireEvent.change(screen.getByLabelText("Rol", { selector: "#filtro-rol" }), { target: { value: "decisor" } });
    expect(screen.getByTestId("usuarios-rango")).toHaveTextContent("Mostrando 1 a 1 de 1");
    fireEvent.change(screen.getByLabelText("Rol", { selector: "#filtro-rol" }), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "inactivo" } });
    expect(screen.getByTestId("usuarios-rango")).toHaveTextContent("Mostrando 1 a 1 de 1");
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Buscar por nombre o correo"), { target: { value: "no-existe" } });
    expect(screen.getByTestId("usuarios-sin-resultados")).toBeInTheDocument();
  });
});
