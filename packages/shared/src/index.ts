/** Constantes compartidas entre la web y la app móvil. */

export const LEYENDA =
  "PROTOTIPO · AI LAB Misión: Código Formosa · no es una herramienta oficial";

export const CATEGORIAS = {
  OBSERVADO: "DATO OBSERVADO",
  REFERENCIA: "DOCUMENTO DE REFERENCIA",
  SIMULADO: "SIMULADO",
} as const;

export type Categoria = (typeof CATEGORIAS)[keyof typeof CATEGORIAS];

export const ROLES = [
  "ciudadano",
  "productor",
  "cuadrilla",
  "operador",
  "decisor",
  "admin",
] as const;

export type Rol = (typeof ROLES)[number];

export const FECHA_CORTE = "2026-10-31";
