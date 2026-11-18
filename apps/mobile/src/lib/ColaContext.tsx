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

import { ColaOffline, type DatosSolicitud, type ItemCola, type VaciadoResultado } from "@/lib/cola";
import { RepositorioSqlite } from "@/lib/colaSqlite";
import { escucharRed, hayRed } from "@/lib/red";
import { enviarSolicitud } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

type Valor = {
  items: ItemCola[];
  pendientes: number;
  sinRed: boolean;
  /** Guarda la solicitud en la cola local y trata de enviarla de inmediato. */
  enviar: (datos: DatosSolicitud, fotoUri: string | null) => Promise<{ enviadaYa: boolean }>;
  reintentar: () => Promise<VaciadoResultado>;
  descartar: (id: number) => Promise<void>;
  borrarLocal: () => Promise<void>;
};

const Contexto = createContext<Valor | null>(null);
const INTERVALO_MS = 15_000;

export function ColaProvider({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const repo = useRef(new RepositorioSqlite()).current;
  const cola = useMemo(() => new ColaOffline({ repo, hayRed, enviar: enviarSolicitud }), [repo]);
  const [items, setItems] = useState<ItemCola[]>([]);
  const [sinRed, setSinRed] = useState(false);

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
  }, [refrescar, vaciar]);

  const enviar = useCallback<Valor["enviar"]>(
    async (datos, fotoUri) => {
      const item = await cola.encolar(usuario.id, datos, fotoUri);
      const r = await vaciar(true);
      const estado = (await cola.listar(usuario.id)).find((i) => i.id === item.id)?.estado;
      return { enviadaYa: r.enviadas > 0 && estado === "enviada" };
    },
    [cola, usuario.id, vaciar],
  );

  const valor = useMemo<Valor>(
    () => ({
      items,
      pendientes: items.filter((i) => i.estado === "pendiente").length,
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
    [items, sinRed, enviar, vaciar, cola, refrescar, repo, usuario.id],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCola(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useCola requiere ColaProvider");
  return v;
}
