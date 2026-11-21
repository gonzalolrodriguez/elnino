import { MAX_ADJUNTOS_PARTE, type AdjuntoLocal } from "@/lib/adjuntos";
import type { DatosParte } from "@/lib/cola";

/**
 * Lógica pura de los partes de la cuadrilla (`POST /tareas/{id}/partes`): validación de la observación,
 * etiquetas en palabras simples y la línea de novedad que ve la persona que pidió ayuda.
 */

export type TipoParte = "avance" | "dificultad" | "resultado";
export type ResultadoParte = "completa" | "parcial" | "no_realizada" | "reprogramada";

/** Un parte tal como lo devuelve el servidor. El autor se identifica por rol, nunca por nombre. */
export type ParteTarea = {
  id: number;
  tarea_id: number;
  cuadrilla_id: number;
  tipo: TipoParte;
  resultado: ResultadoParte | null;
  observacion: string | null;
  autor_rol: string | null;
  creado_en: string;
  resuelta: boolean | null;
  /** Evidencia ya subida (ausente en backends anteriores). */
  adjuntos?: { n: number; tipo: string; bytes: number }[];
};

export const OBSERVACION_MIN = 3;
export const OBSERVACION_MAX = 1000;

/** Orden en que se ofrecen los resultados al terminar la tarea. */
export const RESULTADOS: ResultadoParte[] = ["completa", "parcial", "no_realizada", "reprogramada"];

const ETIQUETA_RESULTADO: Record<ResultadoParte, string> = {
  completa: "Completa",
  parcial: "A medias",
  no_realizada: "No se pudo",
  reprogramada: "Reprogramar",
};
export const etiquetaResultadoParte = (r: ResultadoParte): string => ETIQUETA_RESULTADO[r];

/** Texto del parte en el historial: «Avance», «Dificultad», «Terminó: A medias». */
export function etiquetaParte(p: Pick<ParteTarea, "tipo" | "resultado">): string {
  if (p.tipo === "avance") return "Avance";
  if (p.tipo === "dificultad") return "Dificultad";
  return p.resultado ? `Terminó: ${ETIQUETA_RESULTADO[p.resultado]}` : "Resultado";
}

/** `true` si el parte exige observación: toda dificultad y todo resultado que no sea «completa». */
export const exigeObservacion = (tipo: TipoParte, resultado: ResultadoParte | null): boolean =>
  tipo === "dificultad" || (tipo === "resultado" && resultado !== "completa");

/**
 * Valida el formulario y arma el parte para la cola. La observación es obligatoria (3 a 1000
 * caracteres) en una dificultad y en un resultado distinto de «completa»; en el resto es opcional.
 */
export function armarParte(entrada: {
  tareaId: number;
  tipo: TipoParte;
  resultado: ResultadoParte | null;
  observacion: string;
  adjuntos?: AdjuntoLocal[];
}): { ok: true; datos: DatosParte } | { ok: false; mensaje: string } {
  if (entrada.tipo === "resultado" && !entrada.resultado) {
    return { ok: false, mensaje: "Elegí cómo terminó la tarea." };
  }
  const obs = entrada.observacion.trim();
  const obligatoria = exigeObservacion(entrada.tipo, entrada.resultado);
  if (obligatoria && obs.length < OBSERVACION_MIN) {
    return {
      ok: false,
      mensaje: `Contá qué pasó (de ${OBSERVACION_MIN} a ${OBSERVACION_MAX} caracteres).`,
    };
  }
  if (obs.length > 0 && obs.length < OBSERVACION_MIN) {
    return { ok: false, mensaje: `La observación necesita al menos ${OBSERVACION_MIN} caracteres, o dejala vacía.` };
  }
  if (obs.length > OBSERVACION_MAX) {
    return { ok: false, mensaje: `La observación admite hasta ${OBSERVACION_MAX} caracteres.` };
  }
  const adjuntos = entrada.adjuntos ?? [];
  if (adjuntos.length > MAX_ADJUNTOS_PARTE) {
    return { ok: false, mensaje: `Cada parte admite hasta ${MAX_ADJUNTOS_PARTE} archivos.` };
  }
  return {
    ok: true,
    datos: {
      clase: "parte",
      tarea_id: entrada.tareaId,
      tipo: entrada.tipo,
      ...(entrada.tipo === "resultado" && entrada.resultado ? { resultado: entrada.resultado } : {}),
      ...(obs ? { observacion: obs } : {}),
      ...(adjuntos.length > 0 ? { adjuntos } : {}),
    },
  };
}

/** Cuerpo de `POST /tareas/{id}/partes`: solo los campos del contrato. */
export function cuerpoParte(d: DatosParte): Record<string, unknown> {
  return {
    tipo: d.tipo,
    ...(d.resultado ? { resultado: d.resultado } : {}),
    ...(d.observacion ? { observacion: d.observacion } : {}),
  };
}

/** El backend responde 409 «Cerrá la tarea con constancia» cuando la tarea de evacuación exige constancia. */
export const exigeConstancia = (mensaje: string | null | undefined): boolean => /constancia/i.test(mensaje ?? "");

/** Resumen de un parte de la cola local en palabras simples. */
export function descripcionParte(d: DatosParte): string {
  const que = d.tipo === "resultado" && d.resultado ? `Terminar la tarea: ${ETIQUETA_RESULTADO[d.resultado]}` : d.tipo === "dificultad" ? "Dificultad" : "Avance";
  return `${que} · tarea #${d.tarea_id}`;
}

export type NovedadPedido = { tipo: "demora" | "dificultad" | "parcial" | "no_realizada" | "reprogramada"; en: string | null };

const NOVEDAD: Record<NovedadPedido["tipo"], string> = {
  dificultad: "La cuadrilla informó una dificultad y el operador ya lo sabe",
  demora: "La cuadrilla informó una demora",
  parcial: "La tarea quedó a medias: el operador va a reprogramarla",
  no_realizada: "La cuadrilla no pudo completar la tarea: el operador va a reprogramarla",
  reprogramada: "La cuadrilla no pudo completar la tarea: el operador va a reprogramarla",
};

/** Una sola línea discreta para quien pidió ayuda; nunca incluye el texto de la observación. */
export function textoNovedad(n: { tipo: string } | null | undefined): string | null {
  return n ? (NOVEDAD[n.tipo as NovedadPedido["tipo"]] ?? null) : null;
}
