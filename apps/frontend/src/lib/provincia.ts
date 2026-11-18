/**
 * Contorno de la provincia de Formosa (IGN, DOCUMENTO DE REFERENCIA) para avisar si una ubicación cae fuera.
 * `public/capas/provincia_contorno.json` (~30 KB, generado por scripts/preparar-datos.mjs) se carga bajo demanda.
 */
import { useEffect, useState } from "react";

type Anillo = [number, number][];
type Contorno = { anillos: Anillo[] };

let carga: Promise<Anillo[]> | null = null;

export function cargarContorno(): Promise<Anillo[]> {
  if (!carga) {
    carga = fetch(`${import.meta.env.BASE_URL}capas/provincia_contorno.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar el contorno (${r.status})`);
        return r.json() as Promise<Contorno>;
      })
      .then((c) => {
        if (!Array.isArray(c?.anillos) || c.anillos.length === 0) throw new Error("Contorno incompleto");
        return c.anillos;
      })
      .catch((e: unknown) => {
        carga = null; // se reintenta en el próximo uso
        throw e;
      });
  }
  return carga;
}

/** Solo para pruebas. */
export function reiniciarContorno() {
  carga = null;
}

/** Punto en polígono por trazado de rayos. */
export function puntoEnAnillo(lon: number, lat: number, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/**
 * Indica si el punto cae dentro de Formosa. Devuelve null mientras no se sabe (sin punto, cargando o sin datos):
 * el aviso nunca bloquea el formulario.
 */
export function useDentroDeFormosa(lon: number | null, lat: number | null): boolean | null {
  const [anillos, setAnillos] = useState<Anillo[] | null>(null);
  const hayPunto = lon !== null && lat !== null && Number.isFinite(lon) && Number.isFinite(lat);

  useEffect(() => {
    if (!hayPunto || anillos) return;
    let vigente = true;
    cargarContorno().then(
      (a) => vigente && setAnillos(a),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [hayPunto, anillos]);

  if (!hayPunto || !anillos) return null;
  return anillos.some((a) => puntoEnAnillo(lon as number, lat as number, a));
}
