import type { Layer } from "@deck.gl/core";
import { GeoJsonLayer, PathLayer } from "@deck.gl/layers";

import { rgbaDe } from "../estilo/paleta";
import { colorBordeRiesgo, colorLamina, discontinuar, elevacionVisualM, excedenteM, type RGBA } from "./lamina";
import type { AccesoProps, Geo } from "./tipos";

type Props = { id?: string; altura_escala_compromiso_m?: number };
type FeatureSector = { properties: Props };

export const TRANSICION_LAMINA_MS = 350;
/** Largo de cada trazo de un acceso cortado, en grados (unos 80 m en el corredor de Formosa). */
export const TRAZO_ACCESO_CORTADO_GRADOS = 0.0007;

const ESTADOS_CORTADOS = new Set(["cerrado_operador", "intransitable_lluvia", "anegado"]);

function compromiso(f: unknown): number {
  const v = (f as FeatureSector).properties.altura_escala_compromiso_m;
  return typeof v === "number" ? v : Number.POSITIVE_INFINITY;
}

export type OpcionesLamina = {
  sectores: Geo | null;
  /** Altura de Puerto Formosa con la que se dibuja (la del deslizador o la de la reproducción). */
  altura: number;
  visible: boolean;
  /** Alterna el grosor del borde de advertencia (animación suave de los sectores en riesgo). */
  pulso: boolean;
  /** prefers-reduced-motion: sin transiciones ni pulso. */
  quieto: boolean;
  /** true mientras se reproduce la subida: cada cuadro ya es la animación, sin transición propia. */
  reproduciendo: boolean;
};

/** Capas de deck.gl de la lámina: relleno extruido por excedente y borde de advertencia. Vacío si está oculta. */
export function crearCapasLamina(o: OpcionesLamina): Layer[] {
  if (!o.visible || !o.sectores) return [];
  const duracion = o.quieto || o.reproduciendo ? 0 : TRANSICION_LAMINA_MS;
  const trans = duracion > 0 ? { duration: duracion } : undefined;
  const { altura } = o;
  return [
    new GeoJsonLayer({
      id: "lamina-agua",
      data: o.sectores as never,
      pickable: false,
      stroked: false,
      filled: true,
      extruded: true,
      getFillColor: (f) => colorLamina(altura, compromiso(f)),
      getElevation: (f) => elevacionVisualM(excedenteM(altura, compromiso(f))),
      updateTriggers: { getFillColor: [altura], getElevation: [altura] },
      transitions: trans ? { getFillColor: trans, getElevation: trans } : undefined,
    }),
    new GeoJsonLayer({
      id: "lamina-riesgo",
      data: o.sectores as never,
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels",
      getLineColor: (f) => colorBordeRiesgo(altura, compromiso(f)),
      getLineWidth: o.pulso && !o.quieto ? 6 : 3,
      updateTriggers: { getLineColor: [altura], getLineWidth: [o.pulso, o.quieto] },
      transitions: o.quieto ? undefined : { getLineWidth: { duration: 800 }, getLineColor: trans },
    }),
  ];
}

/** Un acceso está cortado si lo cerró el operador o la simulación, o si el escenario lo da por intransitable (lluvia o anegado). */
export function accesoCortado(id: number, estadoAccesos: Record<number, string>, cerrados: number[]): boolean {
  return cerrados.includes(id) || ESTADOS_CORTADOS.has(estadoAccesos[id] ?? "");
}

type Tramo = { path: [number, number][]; id: number };

/** Trazos discontinuos rojos sobre los accesos cortados (también los marcados no transitables por el operador); el estado sale del backend (`/simulacion/escenario`), no se recalcula acá. */
export function crearCapaAccesosCortados(accesos: Geo | null, estadoAccesos: Record<number, string>, cerrados: number[]): Layer | null {
  if (!accesos) return null;
  const tramos: Tramo[] = [];
  for (const f of accesos.features) {
    const p = f.properties as unknown as AccesoProps;
    if (p.transitable && !accesoCortado(p.id, estadoAccesos, cerrados)) continue;
    const g = f.geometry as { type: string; coordinates: unknown };
    const lineas = (g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []) as [number, number][][];
    for (const ln of lineas) for (const t of discontinuar(ln, TRAZO_ACCESO_CORTADO_GRADOS)) tramos.push({ path: t, id: p.id });
  }
  if (tramos.length === 0) return null;
  const color: RGBA = rgbaDe("acceso.cerrado");
  return new PathLayer<Tramo>({
    id: "accesos-cortados",
    data: tramos,
    pickable: false,
    getPath: (t) => t.path,
    getColor: color,
    getWidth: 5,
    widthUnits: "pixels",
    capRounded: false,
  });
}
