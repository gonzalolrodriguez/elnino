import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { obtenerAccessToken, renovarSesion } from "@/lib/api";
import { obtenerUrlServidor } from "@/lib/servidor";
import { avisarLocal, prepararNotificaciones } from "@/lib/notificacionesLocales";
import { api, type Notificacion } from "@/lib/servicios";
import { CanalEventos, urlWebSocket, type EstadoCanal } from "@/lib/tiempoReal";

/** Notificaciones no leídas que no se habían visto en la lectura anterior. */
export function nuevasNoLeidas(vistas: Set<number>, actuales: Notificacion[]): Notificacion[] {
  return actuales.filter((n) => !n.leida && !vistas.has(n.id));
}

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok" }
  | { tipo: "error"; mensaje: string };

type Valor = {
  estado: Estado;
  notificaciones: Notificacion[];
  noLeidas: number;
  canal: EstadoCanal;
  recargar: () => Promise<void>;
  marcarLeida: (id: number) => Promise<void>;
};

const Contexto = createContext<Valor | null>(null);
const SONDEO_MS = 30_000;

export function AlertasProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [canal, setCanal] = useState<EstadoCanal>("desconectado");
  const vistas = useRef<Set<number> | null>(null);

  const recargar = useCallback(async () => {
    try {
      const r = await api.notificaciones();
      // La primera lectura fija la línea base: no se avisa de lo que ya estaba pendiente.
      if (vistas.current === null) {
        vistas.current = new Set(r.notificaciones.map((n) => n.id));
      } else {
        for (const n of nuevasNoLeidas(vistas.current, r.notificaciones)) {
          vistas.current.add(n.id);
          void avisarLocal("Nueva orden o alerta", n.mensaje);
        }
      }
      setNotificaciones(r.notificaciones);
      setEstado({ tipo: "ok" });
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "Error desconocido" });
    }
  }, []);

  useEffect(() => {
    void prepararNotificaciones();
    void recargar();
    // Respaldo: sondeo periódico por si el WebSocket no está disponible.
    const sondeo = setInterval(() => void recargar(), SONDEO_MS);
    const ws = new CanalEventos({
      url: () => urlWebSocket(obtenerUrlServidor()),
      obtenerToken: obtenerAccessToken,
      renovar: renovarSesion,
      alEvento: (e) => {
        if (e.tipo === "orden") void recargar();
      },
      alEstado: setCanal,
    });
    ws.iniciar();
    return () => {
      clearInterval(sondeo);
      ws.detener();
    };
  }, [recargar]);

  const marcarLeida = useCallback(async (id: number) => {
    await api.marcarLeida(id);
    setNotificaciones((previas) => previas.map((n) => (n.id === id ? { ...n, leida: true } : n)));
  }, []);

  const valor = useMemo<Valor>(
    () => ({
      estado,
      notificaciones,
      noLeidas: notificaciones.filter((n) => !n.leida).length,
      canal,
      recargar,
      marcarLeida,
    }),
    [estado, notificaciones, canal, recargar, marcarLeida],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAlertas(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useAlertas requiere AlertasProvider");
  return v;
}
