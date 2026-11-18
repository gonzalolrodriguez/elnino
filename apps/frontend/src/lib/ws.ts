import { useEffect, useRef, useState } from "react";

import { API_URL } from "./api";

export type EventoTiempoReal = { tipo: "escenario" | "solicitud" | "orden" | "tarea"; datos: Record<string, unknown> };
export type EstadoWs = "desconectado" | "conectando" | "conectado";

const CIERRE_NO_AUTORIZADO = 1008;
const ESPERA_REINTENTO_MS = 4000;

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

    const conectar = () => {
      setEstado("conectando");
      socket = new WebSocket(urlWs());
      socket.onopen = () => socket?.send(JSON.stringify({ token }));
      socket.onmessage = (m: MessageEvent) => {
        try {
          const msg = JSON.parse(String(m.data)) as { tipo?: string; datos?: Record<string, unknown> };
          if (msg.tipo === "conectado") setEstado("conectado");
          else if (msg.tipo === "escenario" || msg.tipo === "solicitud" || msg.tipo === "orden" || msg.tipo === "tarea") {
            callback.current({ tipo: msg.tipo, datos: msg.datos ?? {} });
          }
        } catch {
          /* mensaje ajeno al protocolo: se ignora */
        }
      };
      socket.onclose = (c: CloseEvent) => {
        if (!activo) return;
        setEstado("desconectado");
        // Un cierre 1008 es token vencido o inválido: se espera al token renovado (nuevo efecto), no se reintenta con el mismo.
        if (c.code !== CIERRE_NO_AUTORIZADO) temporizador = setTimeout(conectar, ESPERA_REINTENTO_MS);
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
    detalle = `Solicitud ${d.id ?? ""} en estado ${String(d.estado ?? "")}${d.sector_id ? ` (sector ${String(d.sector_id)})` : ""}.`;
  } else if (e.tipo === "orden") {
    detalle = `Orden ${String(d.tipo ?? "")} para ${Array.isArray(d.sectores) ? d.sectores.join(", ") : "los sectores indicados"}.`;
  } else {
    detalle = d.estado ? `Tarea ${d.id ?? ""}: ${String(d.estado)}.` : "Se crearon o reasignaron tareas.";
  }
  return { titulo: TITULOS[e.tipo], detalle };
}
