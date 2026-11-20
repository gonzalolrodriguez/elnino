import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fijarToken } from "./lib/api";
import {
  ESTADO_SOLICITUD,
  ESTADO_TAREA,
  ORIGEN_SOLICITUD,
  ROL,
  ROL_OPERATIVO,
  TIPO_SOLICITUD,
  etiquetaEstadoSolicitud,
  etiquetaOrigenSolicitud,
  etiquetaRol,
  fechaCorta,
  fechaHora,
} from "./lib/etiquetas";
import { llamadas, renderRuta, sesion, simularFetch } from "./test/utils";

beforeEach(() => {
  window.localStorage.clear();
  fijarToken(null);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (json: unknown) => () => ({ estado: 200, json });

const SECTOR = {
  sectores: [
    {
      id: "S4",
      nombre: "Sector Rural Este",
      estado: "en_riesgo",
      aislado: false,
      altura_compromiso_m: 7.5,
      margen_a_compromiso_m: 1.9,
      accesos: [{ nombre: "Camino de tierra a S4", superficie: "tierra", estado: "transitable" }],
      alertas: [],
    },
  ],
  altura_referencia: { altura_m: 5.6, fecha: "2026-10-31", categoria: "DATO OBSERVADO", fuente: "K1 · serie limpia de Puerto Formosa" },
  centro_asignado: null,
  nota: "Estado calculado con la última altura observada; no es una orden de evacuación.",
};

function conSesion(rol: string, rutas: Parameters<typeof simularFetch>[0] = {}) {
  window.localStorage.setItem("e3_sesion", "1");
  return simularFetch({
    "POST /auth/refresh": () => sesion(rol),
    "GET /auth/yo": ok({ id: 9, email: "ana@ejemplo.invalid", nombre_visible: "Ana Prueba", rol, rol_operativo: null, estado: "activo", creado_en: "2026-11-17T22:41:03Z", ultimo_login: null }),
    "GET /mi/grupo-familiar": ok({ integrantes: 3, menores: 1, mayores: 0, mascotas: 1, telefono: null, salud: "dato cifrado", vulnerabilidad: null, lon: null, lat: null, sector_id: null, actualizado_en: "2026-11-18T10:00:00+00:00" }),
    "GET /mi/sector": ok(SECTOR),
    "GET /mi/notificaciones": ok({
      notificaciones: [
        { id: 5, orden_id: 1, mensaje: "Orden de evacuación preventiva", leida: false, creada_en: "2026-11-18T15:30:00+00:00" },
        { id: 4, orden_id: 1, mensaje: "Aviso anterior", leida: true, creada_en: "2026-11-17T15:30:00+00:00" },
      ],
      no_leidas: 1,
    }),
    ...rutas,
  });
}

describe("/mi-cuenta", () => {
  it("muestra primero la banda del sector, con su categoría, y la altura observada con su fecha real", async () => {
    conSesion("ciudadano");
    renderRuta("/mi-cuenta");
    const seccion = await screen.findByRole("region", { name: "Estado de tu sector" });
    expect(await within(seccion).findByText(/S4 · Sector Rural Este: En riesgo/)).toBeInTheDocument();
    expect(seccion).toHaveTextContent("5,60 m");
    // La lectura es del 31/10/2026: no debe correrse al 30 por el huso horario.
    expect(seccion).toHaveTextContent("(31/10/2026)");
    expect(seccion.querySelector('[data-categoria="SIMULADO"]')).not.toBeNull();
    expect(seccion.querySelector('[data-categoria="DATO OBSERVADO"]')).not.toBeNull();
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titulos[0]).toMatch(/Sector Rural Este/);
  });

  it("«Pedir ayuda» valida y envía el pedido con la forma que espera el backend y una clave de idempotencia", async () => {
    const f = conSesion("ciudadano", {
      "POST /solicitudes": () => ({ estado: 201, json: { id: 41, estado: "recibida" } }),
    });
    renderRuta("/mi-cuenta");
    const form = await screen.findByRole("form", { name: "Pedir ayuda" });

    // Sin ubicación no se llama al backend.
    fireEvent.change(within(form).getByLabelText(/^Personas/), { target: { value: "3" } });
    fireEvent.click(within(form).getByRole("button", { name: "Enviar pedido" }));
    expect(await within(form).findByText(/longitud debe estar/i)).toBeInTheDocument();
    expect(llamadas(f, "POST /solicitudes")).toHaveLength(0);

    fireEvent.change(within(form).getByLabelText(/^Latitud/), { target: { value: "-26,18" } });
    fireEvent.change(within(form).getByLabelText(/^Longitud/), { target: { value: "-58,139" } });
    fireEvent.change(within(form).getByLabelText(/^Mensaje/), { target: { value: "Agua en el patio" } });
    fireEvent.click(within(form).getByRole("button", { name: "Enviar pedido" }));

    expect(await screen.findByText(/Pedido enviado \(n\.º 41\)\. Estado: Recibida/)).toBeInTheDocument();
    const [, init] = llamadas(f, "POST /solicitudes")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      tipo: "asistencia",
      personas: 3,
      animales: 0,
      lon: -58.139,
      lat: -26.18,
      texto: "Agua en el patio",
      origen: "web",
    });
    const cab = init.headers as Record<string, string>;
    expect(cab["Idempotency-Key"]).toMatch(/[0-9a-f-]{20,}/);
    expect(cab.Authorization).toMatch(/^Bearer /);
  });

  it("las notificaciones muestran fecha y marca de no leída, y se pueden marcar como leídas", async () => {
    const f = conSesion("ciudadano", { "PATCH /mi/notificaciones/5/leida": ok({ id: 5, leida: true }) });
    renderRuta("/mi-cuenta");
    const seccion = await screen.findByRole("region", { name: "Avisos y órdenes" });
    expect(await within(seccion).findByText("Nueva")).toBeInTheDocument();
    expect(seccion).toHaveTextContent(/18\/11\/2026/);
    expect(within(seccion).getAllByRole("button", { name: "Marcar como leída" })).toHaveLength(1);
    fireEvent.click(within(seccion).getByRole("button", { name: "Marcar como leída" }));
    await waitFor(() => expect(llamadas(f, "PATCH /mi/notificaciones/5/leida")).toHaveLength(1));
  });

  it("«Editar mi grupo familiar» reenvía los campos que la pantalla no muestra para no borrarlos", async () => {
    const f = conSesion("ciudadano", { "PUT /mi/grupo-familiar": ok({}) });
    renderRuta("/mi-cuenta");
    const form = await screen.findByRole("form", { name: "Editar mi grupo familiar" });
    fireEvent.change(within(form).getByLabelText(/^Integrantes/), { target: { value: "4" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(llamadas(f, "PUT /mi/grupo-familiar")).toHaveLength(1));
    const [, init] = llamadas(f, "PUT /mi/grupo-familiar")[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ integrantes: 4, menores: 1, mayores: 0, mascotas: 1, salud: "dato cifrado" });
  });
});

describe("registro con inicio de sesión automático", () => {
  it("tras registrar a una persona ciudadana inicia sesión y la lleva a su cuenta", async () => {
    const f = simularFetch({
      "POST /auth/registro/ciudadano": () => ({ estado: 201, json: { id: 9, email: "ana@ejemplo.invalid", nombre_visible: "Ana", rol: "ciudadano" } }),
      "POST /auth/login": () => sesion("ciudadano"),
      "GET /auth/yo": ok({}),
      "GET /mi/sector": ok(SECTOR),
    });
    renderRuta("/registro/ciudadania");
    await screen.findByRole("heading", { level: 1, name: /^Registro de/ });
    fireEvent.change(screen.getByLabelText(/^Nombre para mostrar/), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/^Correo electrónico/), { target: { value: "ana@ejemplo.invalid" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: "UnaClaveLarga-2026" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(llamadas(f, "POST /auth/login")).toHaveLength(1);
  });
});

describe("etiquetas", () => {
  it("todos los códigos conocidos tienen una etiqueta legible, sin guiones bajos", () => {
    const mapas = [ROL, ROL_OPERATIVO, ESTADO_SOLICITUD, ESTADO_TAREA, ORIGEN_SOLICITUD, TIPO_SOLICITUD];
    for (const m of mapas) {
      for (const [codigo, etiqueta] of Object.entries(m)) {
        expect(etiqueta, codigo).not.toMatch(/_/);
        expect(etiqueta, codigo).not.toBe(codigo);
      }
    }
    expect(etiquetaOrigenSolicitud("whatsapp_sim")).toBe("WhatsApp (simulado)");
    expect(etiquetaEstadoSolicitud("en_curso")).toBe("En curso");
    expect(etiquetaRol("operador")).toBe("Operador");
  });

  it("un código desconocido se humaniza en vez de mostrarse crudo", () => {
    expect(etiquetaEstadoSolicitud("en_revision_externa")).toBe("En revision externa");
  });

  it("una fecha sin hora es un día de calendario: no se corre un día por el huso horario", () => {
    expect(fechaCorta("2026-10-31")).toBe("31/10/2026");
    expect(fechaCorta("2026-01-01")).toBe("01/01/2026");
    expect(fechaCorta("2026-13-45")).toBe("sin fecha");
    // Un instante sí se convierte a horario de Argentina (UTC-3).
    expect(fechaCorta("2026-10-31T01:00:00Z")).toBe("30/10/2026");
  });

  it("las fechas salen en formato es-AR y horario de Argentina", () => {
    expect(fechaHora("2026-11-18T15:30:00+00:00")).toMatch(/^18\/11\/2026,? 12:30$/);
    expect(fechaHora(null)).toBe("sin fecha");
  });
});
