import type { Rol } from "@evacuaciones/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { fijarToken, solicitar } from "../lib/api";

export type Usuario = {
  id: number;
  email: string;
  nombre_visible: string;
  rol: Rol;
  rol_operativo: string | null;
  estado: string;
  creado_en: string;
  ultimo_login: string | null;
};

type Sesion = { access_token: string; expires_in: number; usuario: Usuario };

type EstadoAuth = "cargando" | "anonimo" | "autenticado";

type Contexto = {
  estado: EstadoAuth;
  usuario: Usuario | null;
  /** Token de acceso vigente (solo en memoria); cambia cada vez que se renueva. */
  token: string | null;
  iniciarSesion: (email: string, password: string) => Promise<Usuario>;
  cerrarSesion: () => Promise<void>;
};

const AuthCtx = createContext<Contexto | null>(null);

// Solo una marca no sensible ("hubo sesión"): sirve para intentar restaurarla con la cookie HttpOnly.
// El token de acceso nunca se guarda en el navegador.
const MARCA = "e3_sesion";
function leerMarca(): boolean {
  try {
    return window.localStorage.getItem(MARCA) === "1";
  } catch {
    return false;
  }
}
function escribirMarca(activa: boolean): void {
  try {
    if (activa) window.localStorage.setItem(MARCA, "1");
    else window.localStorage.removeItem(MARCA);
  } catch {
    /* sin almacenamiento: la sesión vive solo mientras la pestaña esté abierta */
  }
}

function esSesion(x: unknown): x is Sesion {
  return !!x && typeof x === "object" && typeof (x as Sesion).access_token === "string" && !!(x as Sesion).usuario;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>(() => (leerMarca() ? "cargando" : "anonimo"));
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    fijarToken(null);
    setToken(null);
    setUsuario(null);
    setEstado("anonimo");
    escribirMarca(false);
  }, []);

  const aplicar = useCallback(
    (s: Sesion, renovar: () => void) => {
      fijarToken(s.access_token);
      setToken(s.access_token);
      setUsuario(s.usuario);
      setEstado("autenticado");
      escribirMarca(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      // Renueva el token de acceso un minuto antes de que venza.
      temporizador.current = setTimeout(renovar, Math.max(30, s.expires_in - 60) * 1000);
    },
    [],
  );

  const renovar = useCallback(async (): Promise<boolean> => {
    try {
      const s = await solicitar<unknown>("/auth/refresh", { metodo: "POST", cuerpo: {} });
      if (!esSesion(s)) {
        limpiar();
        return false;
      }
      aplicar(s, () => void renovar());
      return true;
    } catch {
      limpiar();
      return false;
    }
  }, [aplicar, limpiar]);

  useEffect(() => {
    if (estado === "cargando") void renovar();
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      const s = await solicitar<unknown>("/auth/login", { cuerpo: { email: email.trim(), password } });
      if (!esSesion(s)) throw new Error("Respuesta de inicio de sesión inesperada");
      aplicar(s, () => void renovar());
      return s.usuario;
    },
    [aplicar, renovar],
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await solicitar("/auth/logout", { metodo: "POST", cuerpo: {} });
    } catch {
      /* el cierre local ocurre igual */
    }
    limpiar();
  }, [limpiar]);

  const valor = useMemo(
    () => ({ estado, usuario, token, iniciarSesion, cerrarSesion }),
    [estado, usuario, token, iniciarSesion, cerrarSesion],
  );
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Contexto {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth requiere <AuthProvider>");
  return c;
}

/** Destino inicial según el rol. */
export function rutaInicio(rol: Rol): string {
  switch (rol) {
    case "ciudadano":
    case "productor":
      return "/mi-cuenta";
    case "admin":
      return "/admin";
    case "cuadrilla":
      return "/app";
    default:
      return "/comando";
  }
}
