/** Respuestas canónicas de «¿Te asistieron?». El backend también acepta si / no / problema por compatibilidad con SMS. */
export type RespuestaAsistencia = "completa" | "parcial" | "no_encontraron" | "no_vinieron" | "otro_problema";

export const OPCIONES_ASISTENCIA: { valor: RespuestaAsistencia; etiqueta: string; ayuda: string; conforme: boolean }[] = [
  { valor: "completa", etiqueta: "Me asistieron por completo", ayuda: "Recibí todo lo que necesitaba.", conforme: true },
  { valor: "parcial", etiqueta: "Me asistieron en parte", ayuda: "Faltó algo o quedó gente o animales sin atender.", conforme: false },
  { valor: "no_encontraron", etiqueta: "Vinieron pero no me encontraron", ayuda: "La cuadrilla llegó, pero no dio conmigo.", conforme: false },
  { valor: "no_vinieron", etiqueta: "No vinieron", ayuda: "Nadie llegó a mi domicilio.", conforme: false },
  { valor: "otro_problema", etiqueta: "Otro problema", ayuda: "Pasó algo distinto; contanos en el comentario.", conforme: false },
];

export const ETIQUETA_ASISTENCIA: Record<string, string> = {
  ...Object.fromEntries(OPCIONES_ASISTENCIA.map((o) => [o.valor, o.etiqueta])),
  // Valores históricos (SMS y datos viejos).
  si: "Me asistieron por completo",
  no: "No vinieron",
  problema: "Otro problema",
};

export const etiquetaAsistencia = (r: string | null | undefined): string => (r ? (ETIQUETA_ASISTENCIA[r] ?? r) : "");

/** La respuesta cierra el pedido sin dudas (el resto queda marcado para revisar). */
export const esConforme = (r: string | null | undefined): boolean => r === "completa" || r === "si";
