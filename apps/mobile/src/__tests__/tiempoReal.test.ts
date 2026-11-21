import { CanalEventos, urlWebSocket, type Socket } from "@/lib/tiempoReal";

class SocketFalso implements Socket {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  enviados: string[] = [];
  cerrado = false;
  constructor(public url: string) {}
  send(dato: string) {
    this.enviados.push(dato);
  }
  close() {
    this.cerrado = true;
  }
}

describe("CanalEventos", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("construye la URL ws sin token", () => {
    expect(urlWebSocket("http://192.168.1.50:8000/")).toBe("ws://192.168.1.50:8000/api/v1/ws");
    expect(urlWebSocket("https://api.ejemplo.invalid")).toBe("wss://api.ejemplo.invalid/api/v1/ws");
  });

  it("envía el token como PRIMER mensaje y nunca en la URL", () => {
    const sockets: SocketFalso[] = [];
    const eventos: string[] = [];
    const canal = new CanalEventos({
      url: urlWebSocket("http://localhost:8000"),
      obtenerToken: () => "TOKEN-SECRETO",
      renovar: async () => true,
      alEvento: (e) => eventos.push(e.tipo),
      crearSocket: (u) => {
        const s = new SocketFalso(u);
        sockets.push(s);
        return s;
      },
    });
    canal.iniciar();
    const s = sockets[0];
    expect(s.url).not.toContain("TOKEN-SECRETO");
    expect(s.enviados).toEqual([]);

    s.onopen?.();
    expect(s.enviados).toHaveLength(1);
    expect(JSON.parse(s.enviados[0])).toEqual({ token: "TOKEN-SECRETO" });

    s.onmessage?.({ data: JSON.stringify({ tipo: "conectado", datos: { rol: "ciudadano" } }) });
    s.onmessage?.({ data: JSON.stringify({ tipo: "orden", datos: { id: 1, sectores: ["S4"] } }) });
    s.onmessage?.({ data: JSON.stringify({ tipo: "aviso_cuadrilla", datos: { id: 3, cuadrilla_id: 2, tipo: "desvio", accion: "creado" } }) });
    s.onmessage?.({ data: JSON.stringify({ tipo: "desconocido" }) });
    s.onmessage?.({ data: "no es json" });
    expect(eventos).toEqual(["conectado", "orden", "aviso_cuadrilla"]);
    canal.detener();
  });

  it("ante el cierre 1008 renueva la sesión y reconecta con el token nuevo", async () => {
    const sockets: SocketFalso[] = [];
    let token = "viejo";
    const renovar = jest.fn(async () => {
      token = "nuevo";
      return true;
    });
    const canal = new CanalEventos({
      url: "ws://x/api/v1/ws",
      obtenerToken: () => token,
      renovar,
      alEvento: () => undefined,
      crearSocket: (u) => {
        const s = new SocketFalso(u);
        sockets.push(s);
        return s;
      },
      esperaBaseMs: 10,
    });
    canal.iniciar();
    sockets[0].onopen?.();
    sockets[0].onclose?.({ code: 1008 });
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(50);

    expect(renovar).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2);
    sockets[1].onopen?.();
    expect(JSON.parse(sockets[1].enviados[0])).toEqual({ token: "nuevo" });
    canal.detener();
  });

  it("detener() cierra el socket y no reconecta", () => {
    const sockets: SocketFalso[] = [];
    const canal = new CanalEventos({
      url: "ws://x/api/v1/ws",
      obtenerToken: () => "t",
      renovar: async () => true,
      alEvento: () => undefined,
      crearSocket: (u) => {
        const s = new SocketFalso(u);
        sockets.push(s);
        return s;
      },
    });
    canal.iniciar();
    canal.detener();
    jest.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].cerrado).toBe(true);
  });
});
