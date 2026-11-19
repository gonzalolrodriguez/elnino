import type { Rol } from "@evacuaciones/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  ErrorApi,
  cerrarSesion,
  hayRefreshGuardado,
  iniciarSesion,
  limpiarSesionLocal,
  registrarAlCerrarSesion,
  renovarSesion,
  usuarioGuardado,
  type Usuario,
} from "@/lib/api";

export type EstadoSesion =
  | { tipo: "cargando" }
  | { tipo: "anonimo" }
  | { tipo: "autenticado"; usuario: Usuario };

type Valor = {
  estado: EstadoSesion;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
  /** Cierra la sesión solo en el teléfono, sin avisar al servidor (p. ej. al cambiar de servidor). */
  salirLocal: () => Promise<void>;
};

const Contexto = createContext<Valor | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: "cargando" });

  useEffect(() => {
    registrarAlCerrarSesion(() => setEstado({ tipo: "anonimo" }));
    let activo = true;
    (async () => {
      const cacheado = await usuarioGuardado();
      if (!cacheado || !(await hayRefreshGuardado())) {
        if (cacheado) await limpiarSesionLocal();
        if (activo) setEstado({ tipo: "anonimo" });
        return;
      }
      // Con usuario guardado se entra igual (offline-first); el token se renueva si hay red.
      if (activo) setEstado({ tipo: "autenticado", usuario: cacheado });
      try {
        await renovarSesion();
      } catch (e) {
        if (!(e instanceof ErrorApi && e.esRed)) {
          // Error no recuperable distinto de falta de red: la próxima petición reintentará.
        }
      }
    })();
    return () => {
      activo = false;
      registrarAlCerrarSesion(null);
    };
  }, []);

  const entrar = useCallback(async (email: string, password: string) => {
    const usuario = await iniciarSesion(email.trim(), password);
    setEstado({ tipo: "autenticado", usuario });
  }, []);

  const salir = useCallback(async () => {
    await cerrarSesion();
    setEstado({ tipo: "anonimo" });
  }, []);

  const salirLocal = useCallback(async () => {
    await limpiarSesionLocal();
    setEstado({ tipo: "anonimo" });
  }, []);

  const valor = useMemo(() => ({ estado, entrar, salir, salirLocal }), [estado, entrar, salir, salirLocal]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useSesion requiere SesionProvider");
  return v;
}

export function useUsuario(): Usuario {
  const { estado } = useSesion();
  if (estado.tipo !== "autenticado") throw new Error("Sin sesión");
  return estado.usuario;
}

/** Pestañas visibles por rol. La de cuadrilla solo existe para ese rol. */
export type Pestana = "asistencia" | "solicitudes" | "alertas" | "sector" | "perfil" | "cuadrilla";

export function pestanasPorRol(rol: Rol): Pestana[] {
  switch (rol) {
    case "ciudadano":
    case "productor":
      return ["asistencia", "solicitudes", "alertas", "sector", "perfil"];
    case "cuadrilla":
      return ["cuadrilla", "alertas", "perfil"];
    default:
      return ["alertas", "perfil"];
  }
}
