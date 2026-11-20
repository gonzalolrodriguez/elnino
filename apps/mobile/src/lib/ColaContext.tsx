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

import { PendientesContext } from "@/lib/EstadoCola";
import { ColaOffline, type DatosCola, type ItemCola, type VaciadoResultado } from "@/lib/cola";
import { RepositorioSqlite } from "@/lib/colaSqlite";
import { escucharRed, hayRed } from "@/lib/red";
import { escucharServidor, obtenerUrlServidor } from "@/lib/servidor";
import { enviarItem, subirFotoItem } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

type Valor = {
  items: ItemCola[];
  /** Pendientes que se enviarán: usuario y servidor vigentes. */
  pendientes: number;
  /** Pendientes que esperan a otro servidor (no se envían a este). */
  otroServidor: ItemCola[];
  sinRed: boolean;
  /** Guarda la solicitud en la cola local y trata de enviarla de inmediato. */
  enviar: (datos: DatosCola, fotoUri: string | null) => Promise<{ enviadaYa: boolean; fotoPendiente: boolean; rechazada: string | null; resultado: DatosCola | null; servidorId?: number | null; itemId?: number }>;
  reintentar: () => Promise<VaciadoResultado>;
  descartar: (id: number) => Promise<void>;
  borrarLocal: () => Promise<void>;
};

const Contexto = createContext<Valor | null>(null);
const INTERVALO_MS = 15_000;

export function ColaProvider({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const repo = useRef(new RepositorioSqlite()).current;
  const cola = useMemo(() => new ColaOffline({ repo, hayRed, enviar: enviarItem, subirFoto: subirFotoItem, servidorActual: obtenerUrlServidor }), [repo]);
  const [items, setItems] = useState<ItemCola[]>([]);
  const [sinRed, setSinRed] = useState(false);
  // Al cambiar el servidor se recalcula qué ítems corresponden al vigente.
  const [versionServidor, setVersionServidor] = useState(0);
  useEffect(() => escucharServidor(() => setVersionServidor((v) => v + 1)), []);

  const refrescar = useCallback(async () => {
    setItems(await cola.listar(usuario.id));
  }, [cola, usuario.id]);

  const vaciar = useCallback(
    async (forzar = false) => {
      const r = await cola.vaciar(usuario.id, forzar);
      setSinRed(r.sinRed);
      await refrescar();
      return r;
    },
    [cola, usuario.id, refrescar],
  );

  useEffect(() => {
    // Teléfono compartido: lo que dejó otra cuenta (ubicación, texto) no queda en la cola de esta.
    void cola.limpiarAjenos(usuario.id).catch(() => undefined);
  }, [cola, usuario.id]);

  useEffect(() => {
    void refrescar();
    void vaciar();
    const intervalo = setInterval(() => void vaciar(), INTERVALO_MS);
    // Al recuperar la conexión se vacía de inmediato, sin esperar al intervalo.
    const quitar = escucharRed((conectado) => {
      setSinRed(!conectado);
      if (conectado) void vaciar(true);
    });
    return () => {
      clearInterval(intervalo);
      quitar();
    };
  }, [refrescar, vaciar, versionServidor]);

  const enviar = useCallback<Valor["enviar"]>(
    async (datos, fotoUri) => {
      const item = await cola.encolar(usuario.id, datos, fotoUri);
      const r = await vaciar(true);
      const actual = (await cola.listar(usuario.id)).find((i) => i.id === item.id);
      return {
        enviadaYa: r.enviadas > 0 && actual?.estado === "enviada",
        // La solicitud ya llegó al servidor pero la foto espera su turno (sin red o reintento).
        fotoPendiente: actual?.estado === "pendiente" && actual.servidorId !== null,
        // El servidor rechazó el envío (p. ej. 409): se informa el motivo en vez de decir «se enviará».
        rechazada: actual?.estado === "rechazada" ? (actual.ultimoError ?? "El servidor no aceptó el envío.") : null,
        resultado: actual?.datos ?? null,
        servidorId: actual?.servidorId ?? null,
        itemId: item.id,
      };
    },
    [cola, usuario.id, vaciar],
  );

  const valor = useMemo<Valor>(
    () => ({
      items,
      pendientes: items.filter((i) => i.estado === "pendiente" && i.servidorUrl === obtenerUrlServidor()).length,
      otroServidor: items.filter((i) => i.estado === "pendiente" && i.servidorUrl !== obtenerUrlServidor()),
      sinRed,
      enviar,
      reintentar: () => vaciar(true),
      descartar: async (id) => {
        await cola.descartar(id);
        await refrescar();
      },
      borrarLocal: async () => {
        await repo.borrarDeUsuario(usuario.id);
        await refrescar();
      },
    }),
    [items, sinRed, enviar, vaciar, cola, refrescar, repo, usuario.id, versionServidor],
  );
  return (
    <Contexto.Provider value={valor}>
      <PendientesContext.Provider value={valor.pendientes}>{children}</PendientesContext.Provider>
    </Contexto.Provider>
  );
}

export function useCola(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useCola requiere ColaProvider");
  return v;
}
