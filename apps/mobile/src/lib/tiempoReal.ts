import { EVENTOS_WS, WS_CIERRE_POLITICA, type EventoWs } from "@evacuaciones/shared";

export type EventoServidor = { tipo: EventoWs | "conectado"; datos?: Record<string, unknown> };

export type EstadoCanal = "desconectado" | "conectando" | "conectado";

export type Socket = {
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code?: number }) => void) | null;
  onerror: (() => void) | null;
  send(dato: string): void;
  close(): void;
};

type Opciones = {
  /** URL `ws://` o `wss://` terminada en `/api/v1/ws` (o función que la entrega: se evalúa en cada conexión). NUNCA lleva el token. */
  url: string | (() => string);
  obtenerToken: () => string | null;
  /** Llamado cuando el servidor cierra con 1008 (token vencido o inválido): debe renovar la sesión. */
  renovar: () => Promise<boolean>;
  alEvento: (e: EventoServidor) => void;
  alEstado?: (estado: EstadoCanal) => void;
  crearSocket?: (url: string) => Socket;
  esperaBaseMs?: number;
  esperaMaxMs?: number;
  /**
   * Tiempo máximo (ms) para completar el saludo (`conectado`) tras abrir el socket. En una red sin
   * salida el socket puede quedar "conectando" sin fallar nunca: pasado el plazo se cierra y se
   * reintenta. El servidor no envía pings, por lo que no hay señal de vida posterior al saludo.
   */
  esperaSaludoMs?: number;
};

export function urlWebSocket(apiUrl: string): string {
  return `${apiUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/api/v1/ws`;
}

/**
 * Canal de eventos en tiempo real. El token de acceso se envía SOLO como primer mensaje
 * `{"token": "..."}` (contrato API · Tiempo real); nunca en la URL. Reconecta con espera creciente.
 */
export class CanalEventos {
  private socket: Socket | null = null;
  private activo = false;
  private intentos = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private vigilante: ReturnType<typeof setTimeout> | null = null;
  private conectado = false;

  constructor(private readonly op: Opciones) {}

  iniciar(): void {
    if (this.activo) return;
    this.activo = true;
    this.conectar();
  }

  detener(): void {
    this.activo = false;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.quitarVigilante();
    this.conectado = false;
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onclose = null;
      try {
        s.close();
      } catch {
        // ya cerrado
      }
    }
    this.op.alEstado?.("desconectado");
  }

  private conectar(): void {
    if (!this.activo) return;
    const token = this.op.obtenerToken();
    if (!token) {
      this.programar();
      return;
    }
    this.op.alEstado?.("conectando");
    const crear = this.op.crearSocket ?? ((u: string) => new WebSocket(u) as unknown as Socket);
    let s: Socket;
    try {
      const url = typeof this.op.url === "function" ? this.op.url() : this.op.url;
      s = crear(url);
    } catch {
      // URL inválida o WebSocket no disponible: se reintenta con espera creciente en vez de romper.
      this.op.alEstado?.("desconectado");
      this.programar();
      return;
    }
    this.socket = s;
    this.conectado = false;
    this.quitarVigilante();
    this.vigilante = setTimeout(() => {
      if (this.socket !== s || this.conectado) return;
      this.cerrarSocket();
      this.op.alEstado?.("desconectado");
      this.programar();
    }, this.op.esperaSaludoMs ?? 15000);
    s.onopen = () => {
      s.send(JSON.stringify({ token }));
    };
    s.onmessage = (m) => {
      try {
        const e = JSON.parse(String(m.data)) as EventoServidor;
        if (e.tipo === "conectado") {
          this.intentos = 0;
          this.conectado = true;
          this.quitarVigilante();
          this.op.alEstado?.("conectado");
        }
        if (e.tipo === "conectado" || (EVENTOS_WS as readonly string[]).includes(e.tipo)) {
          this.op.alEvento(e);
        }
      } catch {
        // mensaje que no es JSON: se ignora
      }
    };
    s.onerror = () => undefined;
    s.onclose = (e) => {
      if (this.socket !== s) return;
      this.socket = null;
      this.conectado = false;
      this.quitarVigilante();
      this.op.alEstado?.("desconectado");
      if (!this.activo) return;
      if (e.code === WS_CIERRE_POLITICA) {
        this.op.renovar().then(
          () => this.programar(),
          () => this.programar(),
        );
      } else {
        this.programar();
      }
    };
  }

  private quitarVigilante(): void {
    if (this.vigilante) clearTimeout(this.vigilante);
    this.vigilante = null;
  }

  private cerrarSocket(): void {
    const s = this.socket;
    this.socket = null;
    if (!s) return;
    s.onclose = null;
    try {
      s.close();
    } catch {
      // ya cerrado
    }
  }

  /**
   * Reconecta de inmediato (sin esperar el backoff) si el canal no está conectado. Se llama al volver
   * la red o al pasar la app a primer plano, donde el sistema pudo haber cortado el socket.
   */
  reconectarYa(): void {
    if (!this.activo || this.conectado) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.cerrarSocket();
    this.quitarVigilante();
    this.intentos = 0;
    this.conectar();
  }

  private programar(): void {
    if (!this.activo) return;
    const base = this.op.esperaBaseMs ?? 2000;
    const max = this.op.esperaMaxMs ?? 60000;
    const espera = Math.min(base * 2 ** this.intentos, max);
    this.intentos += 1;
    this.temporizador = setTimeout(() => this.conectar(), espera);
  }
}
