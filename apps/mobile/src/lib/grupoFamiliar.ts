import { leerEntero } from "@/lib/ayudaSms";

export type CamposGrupo = { integrantes: string; menores: string; mayores: string; mascotas: string };

export type GrupoValidado = { integrantes: number; menores: number; mayores: number; mascotas: number };

/**
 * Valida los números del grupo familiar sin valores por defecto silenciosos: un campo con letras o
 * signos es un error (antes se guardaba 0 o 1 sin avisar). Devuelve el mensaje o los números.
 */
export function validarGrupo(c: CamposGrupo): { error: string } | { ok: GrupoValidado } {
  const integrantes = leerEntero(c.integrantes);
  const menores = leerEntero(c.menores);
  const mayores = leerEntero(c.mayores);
  const mascotas = leerEntero(c.mascotas);
  if (integrantes === null || menores === null || mayores === null || mascotas === null) {
    return { error: "Integrantes, menores, mayores y mascotas se escriben con números, sin signos ni letras." };
  }
  if (c.integrantes.trim() === "" || integrantes < 1) {
    return { error: "El grupo tiene que tener al menos 1 integrante." };
  }
  if (menores + mayores > integrantes) {
    return { error: "Menores y mayores sumados no pueden ser más que los integrantes." };
  }
  return { ok: { integrantes, menores, mayores, mascotas } };
}
