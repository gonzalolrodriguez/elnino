import { useEffect, useRef, useState } from "react";

import { API_URL, renovarSesion } from "./api";
import { etiquetaEstadoSolicitud, etiquetaEstadoTarea } from "./etiquetas";

const TIPO_ORDEN: Record<string, string> = { alerta: "Alerta", evacuacion_preventiva: "Evacuación preventiva", evacuacion: "Evacuación" };

export type EventoTiempoReal = { tipo: "escenario" | "solicitud" | "orden" | "tarea"; datos: Record<string, unknown> };
export type EstadoWs = "desconectado" | "conectando" | "conectado";

const CIERRE_NO_AUTORIZADO = 1008;
const ESPERA_BASE_MS = 1000;
const ESPERA_MAX_MS = 30_000;

/** Espera exponencial con tope y algo de azar, para que muchos paneles no reconecten a la vez. */
export function esperaReintento(intento: number, azar: number = Math.random()): number {
  const base = Math.min(ESPERA_MAX_MS, ESPERA_BASE_MS * 2 ** intento);
  return Math.round(base * (0.75 + azar * 0.5));
}

export function urlWs(): string {
  return `${API_URL.replace(/^http/, "ws")}/api/v1/ws`;
}

/**
 * Conexión de tiempo real. El token viaja solo como primer mensaje `{"token": ...}` (nunca en la URL).
 * Al renovarse el token el efecto se vuelve a ejecutar: cierra la conexión vieja y abre una nueva.
 */
export function useTiempoReal(token: string | null, alEvento: (e: EventoTiempoReal) => void): EstadoWs {
  const [estado, setEstado] = useState<EstadoWs>("desconectado");
  const callback = useRef(alEvento);
  callback.current = alEvento;

  useEffect(() => {
    if (!token || typeof WebSocket === "undefined") {
      setEstado("desconectado");
      return;
    }
    let activo = true;
    let socket: WebSocket | null = null;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let intentos = 0;

    const conectar = () => {
      setEstado("conectando");
      socket = new WebSocket(urlWs());
      socket.onopen = () => socket?.send(JSON.stringify({ token }));
      socket.onmessage = (m: MessageEvent) => {
        try {
          const msg = JSON.parse(String(m.data)) as { tipo?: string; datos?: Record<string, unknown> };
          if (msg.tipo === "conectado") {
            intentos = 0;
            setEstado("conectado");
          } else if (msg.tipo === "escenario" || msg.tipo === "solicitud" || msg.tipo === "orden" || msg.tipo === "tarea") {
            callback.current({ tipo: msg.tipo, datos: msg.datos ?? {} });
          }
        } catch {
          /* mensaje ajeno al protocolo: se ignora */
        }
      };
      socket.onclose = (c: CloseEvent) => {
        if (!activo) return;
        setEstado("desconectado");
        const espera = esperaReintento(intentos++);
        if (c.code === CIERRE_NO_AUTORIZADO) {
          // Token vencido o inválido: se renueva antes de reconectar. Si la renovación tiene éxito cambia `token`
          // y este efecto se reinicia solo; si no, se reintenta con espera creciente.
          void renovarSesion().finally(() => {
            if (activo) temporizador = setTimeout(conectar, espera);
          });
        } else {
          temporizador = setTimeout(conectar, espera);
        }
      };
    };
    conectar();

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [token]);

  return estado;
}

const TITULOS: Record<EventoTiempoReal["tipo"], string> = {
  escenario: "Escenario actualizado",
  solicitud: "Solicitud de asistencia",
  orden: "Orden emitida",
  tarea: "Tarea actualizada",
};

export function describirEvento(e: EventoTiempoReal): { titulo: string; detalle: string } {
  const d = e.datos;
  let detalle = "";
  if (e.tipo === "escenario") {
    detalle = d.motivo === "acceso_actualizado" ? `Un acceso se marcó ${d.transitable ? "transitable" : "no transitable"}.` : "Se calculó un escenario.";
  } else if (e.tipo === "solicitud") {
    detalle = `Solicitud ${d.id ?? ""} en estado ${etiquetaEstadoSolicitud(String(d.estado ?? "")).toLowerCase()}${d.sector_id ? ` (sector ${String(d.sector_id)})` : ""}.`;
  } else if (e.tipo === "orden") {
    detalle = `Orden de ${(TIPO_ORDEN[String(d.tipo)] ?? String(d.tipo ?? "")).toLowerCase()} para ${Array.isArray(d.sectores) ? d.sectores.join(", ") : "los sectores indicados"}.`;
  } else {
    detalle = d.estado ? `Tarea ${d.id ?? ""}: ${etiquetaEstadoTarea(String(d.estado)).toLowerCase()}.` : "Se crearon o reasignaron tareas.";
  }
  return { titulo: TITULOS[e.tipo], detalle };
}
