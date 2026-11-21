import { useCallback, useEffect, useRef, useState } from "react";

import { useSenalAvisos } from "@/lib/AlertasContext";
import { ErrorApi } from "@/lib/api";

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
export const claveCuadrillaPropia = (usuarioId: number) => `micuadrilla:${usuarioId}:${obtenerUrlServidor()}`;

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
 * El evento de tiempo real `aviso_cuadrilla` (`useSenalAvisos`) la refresca al instante; el sondeo queda de respaldo.
 */
export function useAvisosCuadrilla(cuadrillaId: number | null) {
  const usuario = useUsuario();
  const [avisos, setAvisos] = useState<AvisoCuadrilla[] | null>(null);
  const [copia, setCopia] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vistos = useRef<Set<number> | null>(null);
  const senal = useSenalAvisos();

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

  useEffect(() => {
    if (senal > 0) void cargar();
  }, [senal, cargar]);

  return { avisos, copia, error, recargar: cargar };
}

export type EstadoCuadrillaPropia = "cargando" | "ok" | "sin_cuadrilla" | "error";

/**
 * Cuadrilla del integrante, de `GET /mi/cuadrilla` (ya no se deduce de las tareas). Se guarda la última copia
 * para verla sin conexión; un 404 es «todavía no integrás ninguna cuadrilla» (estado vacío, no error).
 */
export function useCuadrillaPropia() {
  const usuario = useUsuario();
  const [estado, setEstado] = useState<EstadoCuadrillaPropia>("cargando");
  const [cuadrilla, setCuadrilla] = useState<CuadrillaDetalle | null>(null);
  const [copia, setCopia] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const clave = claveCuadrillaPropia(usuario.id);
    try {
      const c = await api.miCuadrilla();
      setCuadrilla(c);
      setCopia(null);
      setError(null);
      setEstado("ok");
      await guardarCache(clave, c);
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 404) {
        setCuadrilla(null);
        setCopia(null);
        setError(null);
        setEstado("sin_cuadrilla");
        await guardarCache(clave, null);
        return;
      }
      const guardado = await leerCache<CuadrillaDetalle>(clave);
      if (guardado?.valor && typeof guardado.valor === "object") {
        setCuadrilla(guardado.valor);
        setCopia(guardado.guardadoEn);
        setError(null);
        setEstado("ok");
      } else {
        setError(mensajeError(e));
        setEstado("error");
      }
    }
  }, [usuario.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { estado, cuadrilla, cuadrillaId: cuadrilla?.id ?? null, copia, error, recargar: cargar };
}
