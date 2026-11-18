import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ConfigServidor } from "@/components/ConfigServidor";
import { obtenerSalud, peticion } from "@/lib/api";
import {
  guardarServidor,
  normalizarUrlServidor,
  obtenerUrlServidor,
  probarConexion,
  reiniciarServidorParaPruebas,
  restablecerServidor,
  urlBaseApi,
} from "@/lib/servidor";
import { urlWebSocket } from "@/lib/tiempoReal";

function respuesta(cuerpo: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => cuerpo };
}

const SALUD_OK = { estado: "ok", servicio: "x", version: "1", base_de_datos: "ok" };

beforeEach(() => {
  reiniciarServidorParaPruebas();
  delete process.env.EXPO_PUBLIC_API_URL;
  const almacen = (jest.requireMock("expo-secure-store") as { __almacen: Map<string, string> }).__almacen;
  almacen.clear();
  globalThis.fetch = jest.fn().mockResolvedValue(respuesta(SALUD_OK)) as unknown as typeof fetch;
});

describe("normalizarUrlServidor", () => {
  it.each([
    ["http://192.168.1.50:8000", "http://192.168.1.50:8000"],
    ["  http://192.168.1.50:8000/  ", "http://192.168.1.50:8000"],
    ["http://192.168.1.50:8000/api/v1", "http://192.168.1.50:8000"],
    ["http://192.168.1.50:8000/api/v1/", "http://192.168.1.50:8000"],
    ["HTTPS://api.ejemplo.invalid/API/V1", "https://api.ejemplo.invalid"],
    ["https://host.invalid/prefijo/api/v1", "https://host.invalid/prefijo"],
  ])("normaliza %s", (entrada, esperada) => {
    expect(normalizarUrlServidor(entrada)).toEqual({ ok: true, url: esperada });
  });

  it.each(["", "   ", "192.168.1.50:8000", "ftp://host", "http://", "http://a b", "http://host?x=1", "localhost"])(
    "rechaza %p",
    (entrada) => {
      expect(normalizarUrlServidor(entrada).ok).toBe(false);
    },
  );
});

describe("URL vigente y servicios", () => {
  it("sin valor de compilación ni guardado queda vacía", () => {
    expect(obtenerUrlServidor()).toBe("");
  });

  it("usa EXPO_PUBLIC_API_URL por defecto y el valor guardado lo reemplaza", async () => {
    process.env.EXPO_PUBLIC_API_URL = "http://10.0.0.5:8000/";
    expect(obtenerUrlServidor()).toBe("http://10.0.0.5:8000");
    await guardarServidor("http://192.168.1.50:8000");
    expect(obtenerUrlServidor()).toBe("http://192.168.1.50:8000");
    await restablecerServidor();
    expect(obtenerUrlServidor()).toBe("http://10.0.0.5:8000");
  });

  it("los servicios usan la URL nueva en la llamada siguiente (sin constante vieja)", async () => {
    await guardarServidor("http://192.168.1.50:8000");
    await obtenerSalud();
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe("http://192.168.1.50:8000/api/v1/salud");

    await guardarServidor("https://otra.red.invalid/");
    await peticion("/solicitudes");
    expect((globalThis.fetch as jest.Mock).mock.calls[1][0]).toBe("https://otra.red.invalid/api/v1/solicitudes");
    expect(urlBaseApi()).toBe("https://otra.red.invalid/api/v1");
  });

  it("la subida multipart (fotos) también usa la URL vigente", async () => {
    await guardarServidor("http://192.168.1.60:8000");
    await peticion("/solicitudes/3/adjuntos", { metodo: "POST", cuerpo: new FormData() });
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe(
      "http://192.168.1.60:8000/api/v1/solicitudes/3/adjuntos",
    );
  });

  it("sin servidor configurado falla con un mensaje claro y no llama a la red", async () => {
    await expect(obtenerSalud()).rejects.toMatchObject({ codigo: "sin_servidor", estado: 0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("el valor guardado persiste en el almacén del dispositivo", async () => {
    await guardarServidor("http://192.168.1.50:8000/api/v1");
    const almacen = (jest.requireMock("expo-secure-store") as { __almacen: Map<string, string> }).__almacen;
    expect(almacen.get("servidor_url")).toBe("http://192.168.1.50:8000");
    reiniciarServidorParaPruebas();
    await obtenerSalud();
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe("http://192.168.1.50:8000/api/v1/salud");
  });
});

describe("URL del WebSocket", () => {
  it("http pasa a ws y https a wss", () => {
    expect(urlWebSocket("http://192.168.1.50:8000")).toBe("ws://192.168.1.50:8000/api/v1/ws");
    expect(urlWebSocket("https://api.ejemplo.invalid")).toBe("wss://api.ejemplo.invalid/api/v1/ws");
  });

  it("se deriva de la URL vigente en cada conexión", async () => {
    await guardarServidor("http://192.168.1.50:8000");
    expect(urlWebSocket(obtenerUrlServidor())).toBe("ws://192.168.1.50:8000/api/v1/ws");
    await guardarServidor("https://segura.invalid");
    expect(urlWebSocket(obtenerUrlServidor())).toBe("wss://segura.invalid/api/v1/ws");
  });
});

describe("probarConexion", () => {
  it("ok con base de datos ok", async () => {
    await expect(probarConexion("http://192.168.1.50:8000/")).resolves.toEqual({ ok: true, baseDeDatos: "ok" });
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe("http://192.168.1.50:8000/api/v1/salud");
  });

  it("informa error HTTP, respuesta ajena y error de red", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(respuesta({}, false, 404));
    expect(await probarConexion("http://h.invalid")).toMatchObject({ ok: false, mensaje: expect.stringContaining("404") });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce(respuesta({ otra: 1 }));
    expect(await probarConexion("http://h.invalid")).toMatchObject({ ok: false, mensaje: expect.stringContaining("no corresponde") });
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network request failed"));
    expect(await probarConexion("http://h.invalid")).toMatchObject({ ok: false, mensaje: expect.stringContaining("Network request failed") });
  });

  it("corta por tiempo y lo dice", async () => {
    globalThis.fetch = jest.fn(
      (_u: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_res, rej) => {
          init?.signal?.addEventListener("abort", () => rej(new Error("abortado")));
        }),
    ) as unknown as typeof fetch;
    const r = await probarConexion("http://h.invalid", 20);
    expect(r).toMatchObject({ ok: false, mensaje: expect.stringContaining("Sin respuesta") });
  });

  it("rechaza una URL inválida sin llamar a la red", async () => {
    expect(await probarConexion("nada")).toMatchObject({ ok: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("ConfigServidor", () => {
  it("muestra el resultado de «Probar conexión» (éxito y error)", async () => {
    await render(<ConfigServidor />);
    await fireEvent.changeText(screen.getByLabelText("Dirección del servidor"), "http://192.168.1.50:8000");
    await fireEvent.press(screen.getByLabelText("Probar conexión"));
    expect(await screen.findByText("Conexión correcta · base de datos: ok")).toBeTruthy();

    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network request failed"));
    await fireEvent.press(screen.getByLabelText("Probar conexión"));
    expect(await screen.findByText(/No se pudo conectar/)).toBeTruthy();
  });

  it("valida al guardar y muestra la ayuda con la IP de ejemplo", async () => {
    await render(<ConfigServidor />);
    expect(screen.getByText(/la IP de la computadora que corre el backend/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Dirección del servidor"), "192.168.1.50");
    await fireEvent.press(screen.getByLabelText("Guardar"));
    expect(await screen.findByText(/debe comenzar con http/)).toBeTruthy();
    expect(obtenerUrlServidor()).toBe("");
  });

  it("sin sesión guarda directamente", async () => {
    await render(<ConfigServidor />);
    await fireEvent.changeText(screen.getByLabelText("Dirección del servidor"), "http://192.168.1.50:8000/api/v1");
    await fireEvent.press(screen.getByLabelText("Guardar"));
    await waitFor(() => expect(obtenerUrlServidor()).toBe("http://192.168.1.50:8000"));
  });

  it("con sesión, cambiar de servidor pide confirmar y cierra la sesión local", async () => {
    await guardarServidor("http://viejo.invalid:8000");
    const sesion = {
      pendientes: 0,
      descartarPendientes: jest.fn(async () => undefined),
      cerrarSesionLocal: jest.fn(async () => undefined),
    };
    await render(<ConfigServidor sesion={sesion} />);
    await fireEvent.changeText(screen.getByLabelText("Dirección del servidor"), "http://nuevo.invalid:8000");
    await fireEvent.press(screen.getByLabelText("Guardar"));
    expect(await screen.findByText("Se cerrará tu sesión")).toBeTruthy();
    expect(sesion.cerrarSesionLocal).not.toHaveBeenCalled();
    expect(obtenerUrlServidor()).toBe("http://viejo.invalid:8000");

    await fireEvent.press(screen.getByLabelText("Cambiar servidor y cerrar sesión"));
    await waitFor(() => expect(obtenerUrlServidor()).toBe("http://nuevo.invalid:8000"));
    expect(sesion.cerrarSesionLocal).toHaveBeenCalledTimes(1);
    expect(sesion.descartarPendientes).not.toHaveBeenCalled();
  });

  it("con pendientes permite conservarlos o descartarlos", async () => {
    await guardarServidor("http://viejo.invalid:8000");
    const sesion = {
      pendientes: 2,
      descartarPendientes: jest.fn(async () => undefined),
      cerrarSesionLocal: jest.fn(async () => undefined),
    };
    await render(<ConfigServidor sesion={sesion} />);
    await fireEvent.changeText(screen.getByLabelText("Dirección del servidor"), "http://nuevo.invalid:8000");
    await fireEvent.press(screen.getByLabelText("Guardar"));
    expect(await screen.findByText(/Tenés 2 solicitud/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Descartar pendientes"));
    await waitFor(() => expect(obtenerUrlServidor()).toBe("http://nuevo.invalid:8000"));
    expect(sesion.descartarPendientes).toHaveBeenCalledTimes(1);
    expect(sesion.cerrarSesionLocal).toHaveBeenCalledTimes(1);
  });

  it("cancelar no cambia nada ni cierra la sesión", async () => {
    await guardarServidor("http://viejo.invalid:8000");
    const sesion = { pendientes: 0, descartarPendientes: jest.fn(), cerrarSesionLocal: jest.fn() };
    await render(<ConfigServidor sesion={sesion} />);
    await fireEvent.changeText(screen.getByLabelText("Dirección del servidor"), "http://nuevo.invalid:8000");
    await fireEvent.press(screen.getByLabelText("Guardar"));
    await fireEvent.press(await screen.findByLabelText("Cancelar"));
    expect(sesion.cerrarSesionLocal).not.toHaveBeenCalled();
    expect(obtenerUrlServidor()).toBe("http://viejo.invalid:8000");
  });
});
