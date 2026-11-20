import * as SecureStore from "expo-secure-store";

const mockBorrarCachePersonal = jest.fn(async () => undefined);
const mockBorrarNoPendientes = jest.fn(async () => undefined);

jest.mock("@/lib/cacheLocal", () => ({
  ...jest.requireActual("@/lib/cacheLocal"),
  borrarCachePersonal: () => mockBorrarCachePersonal(),
}));
jest.mock("@/lib/colaSqlite", () => ({
  RepositorioSqlite: jest.fn().mockImplementation(() => ({ borrarNoPendientes: () => mockBorrarNoPendientes() })),
}));

import { limpiarSesionLocal, renovarSesion } from "@/lib/api";
import { borrarDatosLocalesDeSesion } from "@/lib/limpiezaLocal";

const almacen = (SecureStore as unknown as { __almacen: Map<string, string> }).__almacen;

function respuesta(estado: number, cuerpo: unknown): Response {
  return { ok: estado >= 200 && estado < 300, status: estado, json: async () => cuerpo } as Response;
}

describe("datos locales al terminar la sesión", () => {
  beforeEach(() => {
    almacen.clear();
    jest.clearAllMocks();
  });

  it.each([401, 403])("un refresh rechazado (%i) borra la caché personal y la cola ya resuelta", async (estado) => {
    almacen.set("refresh_token", "vencido");
    almacen.set("usuario", JSON.stringify({ id: 9 }));
    globalThis.fetch = jest.fn().mockResolvedValue(respuesta(estado, { error: { codigo: "no_autenticado", mensaje: "x" } })) as unknown as typeof fetch;

    expect(await renovarSesion()).toBe(false);

    expect(almacen.size).toBe(0);
    expect(mockBorrarCachePersonal).toHaveBeenCalledTimes(1);
    expect(mockBorrarNoPendientes).toHaveBeenCalledTimes(1);
  });

  it("sin red el refresh no borra nada (la sesión puede seguir offline)", async () => {
    almacen.set("refresh_token", "vigente");
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as unknown as typeof fetch;

    await expect(renovarSesion()).rejects.toBeTruthy();

    expect(almacen.get("refresh_token")).toBe("vigente");
    expect(mockBorrarCachePersonal).not.toHaveBeenCalled();
  });

  it("el cierre local (p. ej. al cambiar de servidor) también limpia", async () => {
    await limpiarSesionLocal();
    expect(mockBorrarCachePersonal).toHaveBeenCalledTimes(1);
    expect(mockBorrarNoPendientes).toHaveBeenCalledTimes(1);
  });

  it("una falla de SQLite no impide cerrar la sesión", async () => {
    mockBorrarCachePersonal.mockRejectedValueOnce(new Error("sqlite"));
    mockBorrarNoPendientes.mockRejectedValueOnce(new Error("sqlite"));
    await expect(borrarDatosLocalesDeSesion()).resolves.toBeUndefined();
  });
});

describe("borrarCachePersonal", () => {
  it("borra todo salvo la lista pública de centros de la brújula sin sesión", async () => {
    const runAsync = jest.fn(async () => undefined);
    jest.resetModules();
    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync: jest.fn(async () => ({ execAsync: jest.fn(async () => undefined), runAsync })),
    }));
    const real = jest.requireActual<typeof import("@/lib/cacheLocal")>("@/lib/cacheLocal");
    await real.borrarCachePersonal();
    expect(runAsync).toHaveBeenCalledWith(expect.stringMatching(/^DELETE FROM cache_json WHERE/), "brujula:anonimo:".length, "brujula:anonimo:");
    expect(real.PREFIJO_CACHE_PUBLICA).toBe("brujula:anonimo:");
  });
});
