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
    const url = typeof this.op.url === "function" ? this.op.url() : this.op.url;
    const s = crear(url);
    this.socket = s;
    s.onopen = () => {
      s.send(JSON.stringify({ token }));
    };
    s.onmessage = (m) => {
      try {
        const e = JSON.parse(String(m.data)) as EventoServidor;
        if (e.tipo === "conectado") {
          this.intentos = 0;
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

  private programar(): void {
    if (!this.activo) return;
    const base = this.op.esperaBaseMs ?? 2000;
    const max = this.op.esperaMaxMs ?? 60000;
    const espera = Math.min(base * 2 ** this.intentos, max);
    this.intentos += 1;
    this.temporizador = setTimeout(() => this.conectar(), espera);
  }
}
