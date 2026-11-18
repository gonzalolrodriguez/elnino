import * as SecureStore from "expo-secure-store";

import { cerrarSesion, iniciarSesion, obtenerAccessToken, peticion, usuarioGuardado } from "@/lib/api";

const usuario = {
  id: 9,
  email: "ana@ejemplo.invalid",
  nombre_visible: "Ana Prueba",
  rol: "ciudadano",
  rol_operativo: null,
  estado: "activo",
};

function respuesta(estado: number, cuerpo: unknown): Response {
  return { ok: estado >= 200 && estado < 300, status: estado, json: async () => cuerpo } as Response;
}

const almacen = (SecureStore as unknown as { __almacen: Map<string, string> }).__almacen;

describe("sesión móvil", () => {
  beforeEach(() => {
    almacen.clear();
    jest.clearAllMocks();
  });

  it("el login guarda el refresh token en expo-secure-store (no en AsyncStorage) y pide X-Cliente: movil", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      respuesta(200, { access_token: "acc1", refresh_token: "ref1", expires_in: 900, token_type: "bearer", usuario }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const u = await iniciarSesion("ana@ejemplo.invalid", "UnaClaveLarga-2026");

    expect(u.rol).toBe("ciudadano");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("refresh_token", "ref1");
    expect(almacen.get("refresh_token")).toBe("ref1");
    expect(obtenerAccessToken()).toBe("acc1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/auth\/login$/);
    expect(init.headers["X-Cliente"]).toBe("movil");
    // El access token vive solo en memoria: no se persiste en ningún lado.
    expect([...almacen.values()].some((v) => v === "acc1")).toBe(false);
  });

  it("no depende de AsyncStorage", () => {
    expect(() => jest.requireActual("@react-native-async-storage/async-storage")).toThrow();
  });

  it("ante un 401 renueva con rotación del refresh y reintenta una vez", async () => {
    almacen.set("refresh_token", "ref1");
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(respuesta(401, { error: { codigo: "no_autenticado", mensaje: "vencido" } }))
      .mockResolvedValueOnce(
        respuesta(200, { access_token: "acc2", refresh_token: "ref2", expires_in: 900, usuario }),
      )
      .mockResolvedValueOnce(respuesta(200, { ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const r = await peticion<{ ok: boolean }>("/mi/sector");

    expect(r.ok).toBe(true);
    expect(almacen.get("refresh_token")).toBe("ref2");
    const cuerpoRefresh = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(cuerpoRefresh).toEqual({ refresh_token: "ref1" });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer acc2");
  });

  it("el cierre de sesión llama al servidor y borra todo lo local", async () => {
    almacen.set("refresh_token", "ref2");
    almacen.set("usuario", JSON.stringify(usuario));
    const fetchMock = jest.fn().mockResolvedValue(respuesta(200, { mensaje: "Sesión cerrada" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cerrarSesion();

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/auth\/logout$/);
    expect(almacen.size).toBe(0);
    expect(obtenerAccessToken()).toBeNull();
    expect(await usuarioGuardado()).toBeNull();
  });

  it("el cierre de sesión borra lo local aunque no haya red", async () => {
    almacen.set("refresh_token", "ref2");
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;
    await cerrarSesion();
    expect(almacen.size).toBe(0);
  });
});
