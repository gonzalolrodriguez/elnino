import { ChakraProvider } from "@chakra-ui/react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import App from "../App";

export const LEYENDA = "PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial";

export function renderRuta(ruta: string) {
  return render(
    <ChakraProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </ChakraProvider>,
  );
}

type Respuesta = { estado: number; json: unknown };
type Manejador = (cuerpo: Record<string, unknown> | undefined) => Respuesta;

/** Reemplaza fetch: las claves son "METODO /ruta" (sin el prefijo /api/v1). Lo no declarado responde 404. */
export function simularFetch(rutas: Record<string, Manejador> = {}) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    const ruta = new URL(url, "http://localhost").pathname.replace(/^\/api\/v1/, "");
    const clave = `${init?.method ?? "GET"} ${ruta}`;
    const cuerpo = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    const r = rutas[clave]?.(cuerpo) ?? {
      estado: 404,
      json: { error: { codigo: "no_encontrado", mensaje: "No encontrado", detalle: [] } },
    };
    return Promise.resolve({ ok: r.estado < 400, status: r.estado, json: () => Promise.resolve(r.json) });
  });
  vi.stubGlobal("fetch", f);
  return f;
}

export function llamadas(f: ReturnType<typeof simularFetch>, clave: string) {
  return f.mock.calls.filter(([u, i]) => `${(i as RequestInit | undefined)?.method ?? "GET"} ${new URL(u as string, "http://localhost").pathname.replace(/^\/api\/v1/, "")}` === clave);
}

export const USUARIO = {
  id: 9,
  email: "ana@ejemplo.invalid",
  nombre_visible: "Ana Prueba",
  rol: "ciudadano",
  rol_operativo: null,
  estado: "activo",
  creado_en: "2026-11-17T22:41:03Z",
  ultimo_login: null,
};

export const sesion = (rol = "ciudadano") => ({
  estado: 200,
  json: { access_token: "tok-en-memoria", token_type: "bearer", expires_in: 900, usuario: { ...USUARIO, rol } },
});
