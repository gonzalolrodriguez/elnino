import type { Tarea } from "../panel/tipos";
import { solicitar } from "./api";

/** Contrato de los partes de tarea (ver odd/tasks/partes-cuadrilla.md). Sin nombres de personas: el autor es un rol operativo. */
export type TipoParte = "avance" | "dificultad" | "resultado";
export type ResultadoParte = "completa" | "parcial" | "no_realizada" | "reprogramada";

export type Parte = {
  id: number;
  tarea_id: number;
  cuadrilla_id: number | null;
  tipo: TipoParte;
  resultado: ResultadoParte | null;
  observacion: string | null;
  autor_rol: string | null;
  creado_en: string;
  resuelta: boolean | null;
};

export type CuerpoParte = { tipo: TipoParte; resultado: ResultadoParte | null; observacion: string | null };

/** `GET /tareas` agrega estos dos campos a cada tarea. */
export type TareaConPartes = Tarea & { requiere_atencion?: boolean; ultimo_parte?: Parte | null };

const a = { autenticado: true } as const;
export const partesDeTarea = (tareaId: number) => solicitar<{ items: Parte[] }>(`/tareas/${tareaId}/partes`, a).then((r) => r.items);
export const enviarParte = (tareaId: number, c: CuerpoParte) => solicitar<Parte>(`/tareas/${tareaId}/partes`, { ...a, cuerpo: c });

export const MIN_OBSERVACION = 3;
export const MAX_OBSERVACION = 1000;

/** Etiquetas del resultado, como las ve la cuadrilla. */
export const ETIQUETA_RESULTADO: Record<ResultadoParte, string> = {
  completa: "Completa",
  parcial: "A medias",
  no_realizada: "No se pudo",
  reprogramada: "Reprogramar",
};

export const AYUDA_RESULTADO: Record<ResultadoParte, string> = {
  completa: "Se hizo todo lo pedido.",
  parcial: "Se hizo una parte; el resto queda pendiente.",
  no_realizada: "No se pudo hacer. Contá por qué.",
  reprogramada: "Hay que volver otro día u hora. Contá por qué.",
};

export const ORDEN_RESULTADOS: ResultadoParte[] = ["completa", "parcial", "no_realizada", "reprogramada"];

/**
 * Valida un parte antes de enviarlo. La observación es obligatoria para una dificultad y para un resultado que no es «completa»;
 * en un avance es opcional, pero si se escribe tiene que tener sentido (3 a 1000 caracteres).
 */
export function validarParte(tipo: TipoParte, resultado: ResultadoParte | null, observacion: string): { cuerpo: CuerpoParte } | { error: string } {
  const texto = observacion.trim();
  const obligatoria = tipo === "dificultad" || (tipo === "resultado" && resultado !== "completa");
  if (tipo === "resultado" && resultado === null) return { error: "Elegí cómo terminó la tarea." };
  if (texto.length > MAX_OBSERVACION) return { error: `La observación admite hasta ${MAX_OBSERVACION} caracteres.` };
  if ((obligatoria || texto.length > 0) && texto.length < MIN_OBSERVACION) {
    return { error: obligatoria ? `Contá qué pasó: la observación es obligatoria (de ${MIN_OBSERVACION} a ${MAX_OBSERVACION} caracteres).` : `Si agregás un texto, que tenga al menos ${MIN_OBSERVACION} caracteres.` };
  }
  return { cuerpo: { tipo, resultado: tipo === "resultado" ? resultado : null, observacion: texto === "" ? null : texto } };
}
