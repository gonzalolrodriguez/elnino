import { leerEntero } from "@/lib/ayudaSms";
import type { DatosCierre } from "@/lib/cola";
import type { Coordenadas } from "@/lib/dispositivo";

/** Tope de fotos por constancia (el backend admite 5 por defecto). */
export const MAX_FOTOS = 5;
const MAX_PERSONAS_CIERRE = 5000;
const MAX_ANIMALES_CIERRE = 100000;
const MAX_NOTA = 1000;

export const ETIQUETA_ESPECIE: Record<string, string> = {
  bovinos: "Bovinos",
  ovinos: "Ovinos",
  caprinos: "Caprinos",
  porcinos: "Porcinos",
  equinos: "Equinos",
  colmenas: "Colmenas",
};

/**
 * Valida el formulario y arma el cierre. Devuelve el aviso en español o los datos listos para la
 * cola. Si no se trasladó a nadie ni nada, la nota es obligatoria (lo exige el backend).
 */
export function armarCierre(entrada: {
  tareaId: number;
  ubicacion: Coordenadas | null;
  centroId: number | null;
  personas: string;
  animales: Record<string, string>;
  nota: string;
  fotos: string[];
}): { ok: true; datos: DatosCierre } | { ok: false; mensaje: string } {
  if (!entrada.ubicacion) return { ok: false, mensaje: "Tomá la ubicación del destino con el GPS." };
  const p = leerEntero(entrada.personas);
  if (p === null) return { ok: false, mensaje: "Las personas se escriben con números, sin signos ni letras." };
  if (p > MAX_PERSONAS_CIERRE) return { ok: false, mensaje: `Personas: el máximo es ${MAX_PERSONAS_CIERRE}.` };
  const animales: Record<string, number> = {};
  for (const [especie, texto] of Object.entries(entrada.animales)) {
    const n = leerEntero(texto);
    if (n === null) return { ok: false, mensaje: "Los animales se escriben con números, sin signos ni letras." };
    if (n > MAX_ANIMALES_CIERRE) return { ok: false, mensaje: `Animales: el máximo es ${MAX_ANIMALES_CIERRE}.` };
    if (n > 0) animales[especie] = n;
  }
  const nota = entrada.nota.trim().slice(0, MAX_NOTA);
  if (p === 0 && Object.keys(animales).length === 0 && !nota) {
    return { ok: false, mensaje: "Si no se trasladaron personas ni animales, explicalo en la nota." };
  }
  return {
    ok: true,
    datos: {
      clase: "cierre",
      tarea_id: entrada.tareaId,
      lat: entrada.ubicacion.lat,
      lon: entrada.ubicacion.lon,
      ...(entrada.centroId ? { centro_id: entrada.centroId } : {}),
      personas_trasladadas: p,
      animales_trasladados: animales,
      ...(nota ? { nota } : {}),
      fotos: entrada.fotos.slice(0, MAX_FOTOS),
    },
  };
}

