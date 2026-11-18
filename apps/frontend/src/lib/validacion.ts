/** Validación de formularios; refleja las reglas de apps/backend/app/api/v1/esquemas.py. */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export type Errores = Record<string, string>;

export function validarAcceso(v: {
  email: string;
  password: string;
  nombre_visible: string;
  consentimiento: boolean;
}): Errores {
  const e: Errores = {};
  const email = v.email.trim();
  if (email.length > 254 || !EMAIL.test(email)) e.email = "Ingresá un correo electrónico válido.";
  if (v.password.length < PASSWORD_MIN) e.password = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  else if (v.password.length > PASSWORD_MAX) e.password = `La contraseña no puede superar los ${PASSWORD_MAX} caracteres.`;
  const n = v.nombre_visible.trim().length;
  if (n < 2 || n > 120) e.nombre_visible = "El nombre debe tener entre 2 y 120 caracteres.";
  if (!v.consentimiento) e.consentimiento = "Necesitamos tu consentimiento informado para registrarte.";
  return e;
}

export function entero(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function decimal(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

export function enRango(n: number | null, min: number, max: number): boolean {
  return n !== null && !Number.isNaN(n) && n >= min && n <= max;
}

export function validarCoordenadas(lonTxt: string, latTxt: string, obligatorias: boolean): Errores {
  const e: Errores = {};
  const lon = decimal(lonTxt);
  const lat = decimal(latTxt);
  if (!obligatorias && lon === null && lat === null) return e;
  if (!enRango(lon, -180, 180)) e.lon = "La longitud debe estar entre -180 y 180 (por ejemplo -58,139).";
  if (!enRango(lat, -90, 90)) e.lat = "La latitud debe estar entre -90 y 90 (por ejemplo -26,18).";
  return e;
}
