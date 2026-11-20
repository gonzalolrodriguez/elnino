import { useCallback, useEffect, useRef, useState } from "react";

import { guardarCache, leerCache } from "@/lib/cacheLocal";
import { avisosNuevos, etiquetaTipoAviso, type AvisoCuadrilla, type CuadrillaDetalle } from "@/lib/cuadrillas";
import { mensajeError } from "@/lib/errores";
import { avisarLocal } from "@/lib/notificacionesLocales";
import { obtenerUrlServidor } from "@/lib/servidor";
import { api } from "@/lib/servicios";
import { useUsuario } from "@/lib/SesionContext";

/**
 * Las claves de la caché llevan el usuario y el servidor y NO empiezan con el prefijo público de la brújula:
 * `borrarCachePersonal` las borra cuando la sesión termina (cierre, cambio de servidor o refresh rechazado).
 */
export const claveAvisos = (usuarioId: number, cuadrillaId: number) => `avisos:${usuarioId}:${obtenerUrlServidor()}:${cuadrillaId}`;
export const claveEquipoTildado = (usuarioId: number, avisoId: number) => `equipo:${usuarioId}:${obtenerUrlServidor()}:${avisoId}`;
export const claveCuadrilla = (usuarioId: number, cuadrillaId: number) => `micuadrilla:${usuarioId}:${obtenerUrlServidor()}:${cuadrillaId}`;
export const claveIdCuadrilla = (usuarioId: number) => `idcuadrilla:${usuarioId}:${obtenerUrlServidor()}`;

export const SONDEO_AVISOS_MS = 30_000;

/** Respuesta del servidor como lista, tolerando que venga `{ items }` o directamente un arreglo. */
function comoLista<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const items = (r as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

/**
 * Avisos del operativo a la cuadrilla. Sin conexión muestra la última copia guardada con su fecha. Se
 * sondea cada 30 s mientras la pantalla está abierta y, si llega un aviso nuevo sin leer, se dispara una
 * notificación local (la misma vía que las órdenes). La primera lectura solo fija la línea base.
 */
export function useAvisosCuadrilla(cuadrillaId: number | null) {
  const usuario = useUsuario();
  const [avisos, setAvisos] = useState<AvisoCuadrilla[] | null>(null);
  const [copia, setCopia] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vistos = useRef<Set<number> | null>(null);

  const cargar = useCallback(async () => {
    if (cuadrillaId === null) return;
    const clave = claveAvisos(usuario.id, cuadrillaId);
    try {
      const lista = comoLista<AvisoCuadrilla>(await api.avisosCuadrilla(cuadrillaId));
      if (vistos.current === null) {
        vistos.current = new Set(lista.map((a) => a.id));
      } else {
        for (const a of avisosNuevos(vistos.current, lista)) {
          vistos.current.add(a.id);
          void avisarLocal(`Aviso del operativo: ${etiquetaTipoAviso(a.tipo)}`, a.texto);
        }
      }
      setAvisos(lista);
      setCopia(null);
      setError(null);
      await guardarCache(clave, lista);
    } catch (e) {
      const guardado = await leerCache<AvisoCuadrilla[]>(clave);
      if (guardado && Array.isArray(guardado.valor)) {
        setAvisos(guardado.valor);
        setCopia(guardado.guardadoEn);
        setError(null);
      } else {
        setError(mensajeError(e));
      }
    }
  }, [cuadrillaId, usuario.id]);

  useEffect(() => {
    vistos.current = null;
    setAvisos(null);
    void cargar();
    const sondeo = setInterval(() => void cargar(), SONDEO_AVISOS_MS);
    return () => clearInterval(sondeo);
  }, [cargar]);

  return { avisos, copia, error, recargar: cargar };
}

/** Ficha de la cuadrilla del integrante (con la última copia guardada si no hay conexión). */
export function useMiCuadrilla(cuadrillaId: number | null) {
  const usuario = useUsuario();
  const [cuadrilla, setCuadrilla] = useState<CuadrillaDetalle | null>(null);
  const [copia, setCopia] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cuadrillaId === null) return;
    let vivo = true;
    const clave = claveCuadrilla(usuario.id, cuadrillaId);
    (async () => {
      try {
        const c = await api.cuadrilla(cuadrillaId);
        if (!vivo) return;
        setCuadrilla(c);
        setCopia(null);
        setError(null);
        await guardarCache(clave, c);
      } catch (e) {
        const guardado = await leerCache<CuadrillaDetalle>(clave);
        if (!vivo) return;
        if (guardado?.valor && typeof guardado.valor === "object") {
          setCuadrilla(guardado.valor);
          setCopia(guardado.guardadoEn);
        } else {
          setError(mensajeError(e));
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cuadrillaId, usuario.id]);

  return { cuadrilla, copia, error };
}

/**
 * Id de la cuadrilla del integrante: sale de sus tareas (`cuadrilla_id`). Se recuerda la última para que los
 * avisos y la ficha sigan viéndose sin conexión o cuando todavía no tiene tareas cargadas.
 */
export function useIdCuadrilla(tareasCuadrilla: (number | null | undefined)[] | null): number | null {
  const usuario = useUsuario();
  const [id, setId] = useState<number | null>(null);
  const deTareas = tareasCuadrilla?.find((x): x is number => typeof x === "number") ?? null;

  useEffect(() => {
    let vivo = true;
    if (deTareas !== null) {
      setId(deTareas);
      void guardarCache(claveIdCuadrilla(usuario.id), deTareas);
      return;
    }
    (async () => {
      const guardado = await leerCache<number>(claveIdCuadrilla(usuario.id));
      if (vivo && typeof guardado?.valor === "number") setId(guardado.valor);
    })();
    return () => {
      vivo = false;
    };
  }, [deTareas, usuario.id]);

  return id;
}
