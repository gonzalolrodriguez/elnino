import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, type MutableRefObject } from "react";

import { hexDe } from "../../estilo/paleta";
import { CENTRO_FORMOSA, ESTILO_OSM } from "../../lib/estiloOsm";

export type Punto = [number, number];

export type PropsMapaDesvio = {
  /** Puntos del trazado como [lon, lat]. */
  puntos: Punto[];
  onChange: (p: Punto[]) => void;
  /** `punto` deja un solo punto; `linea` encadena puntos. */
  modo: "linea" | "punto";
  /** Recorrido actual de la cuadrilla, de referencia (gris). */
  referencia?: Punto[] | null;
  centro?: Punto | null;
  /** El padre lee de acá el centro del mapa para agregar un punto sin usar el mouse. */
  centroRef?: MutableRefObject<(() => Punto) | null>;
  onFallo?: () => void;
};

const linea = (c: Punto[]): GeoJSON.Feature<GeoJSON.LineString> => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } });
const puntosFc = (c: Punto[]): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: "FeatureCollection",
  features: c.map((p, i) => ({ type: "Feature", properties: { n: i + 1 }, geometry: { type: "Point", coordinates: p } })),
});

/** Mapa para dibujar un desvío con clics: cada clic suma un punto; el trazado se corrige desde los botones del padre. */
export default function MapaDesvioGL({ puntos, onChange, modo, referencia = null, centro = null, centroRef, onFallo }: PropsMapaDesvio) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const vivas = useRef({ puntos, onChange, modo });
  vivas.current = { puntos, onChange, modo };
  const inicial = useRef(centro);
  const listo = useRef(false);

  useEffect(() => {
    if (!contenedor.current) return;
    let m: maplibregl.Map;
    try {
      const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      m = new maplibregl.Map({ container: contenedor.current, style: ESTILO_OSM, center: inicial.current ?? CENTRO_FORMOSA, zoom: 13, cooperativeGestures: touch, attributionControl: { compact: true } });
    } catch {
      onFallo?.();
      return;
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
      const p: Punto = [Number(e.lngLat.lng.toFixed(5)), Number(e.lngLat.lat.toFixed(5))];
      const v = vivas.current;
      v.onChange(v.modo === "punto" ? [p] : [...v.puntos, p]);
    });
    const montar = () => {
      if (m.getSource("desvio")) return;
      m.addSource("ref", { type: "geojson", data: linea([]) });
      m.addSource("desvio", { type: "geojson", data: linea([]) });
      m.addSource("desvio-pts", { type: "geojson", data: puntosFc([]) });
      m.addLayer({ id: "ref", type: "line", source: "ref", paint: { "line-color": "#64748b", "line-width": 4, "line-dasharray": [2, 2], "line-opacity": 0.8 } });
      m.addLayer({ id: "desvio-borde", type: "line", source: "desvio", paint: { "line-color": "#ffffff", "line-width": 9 } });
      m.addLayer({ id: "desvio", type: "line", source: "desvio", paint: { "line-color": hexDe("evacuacion.600"), "line-width": 5 } });
      m.addLayer({ id: "desvio-pts", type: "circle", source: "desvio-pts", paint: { "circle-radius": 7, "circle-color": hexDe("evacuacion.600"), "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
      listo.current = true;
      pintar();
    };
    m.on("load", montar);
    mapa.current = m;
    if (centroRef) centroRef.current = () => {
      const c = m.getCenter();
      return [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))];
    };
    return () => {
      if (centroRef) centroRef.current = null;
      listo.current = false;
      m.remove();
      mapa.current = null;
    };
    // El mapa se crea una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pintar() {
    const m = mapa.current;
    if (!m || !listo.current) return;
    const v = vivas.current;
    (m.getSource("desvio") as maplibregl.GeoJSONSource | undefined)?.setData(linea(v.puntos.length > 1 ? v.puntos : []));
    (m.getSource("desvio-pts") as maplibregl.GeoJSONSource | undefined)?.setData(puntosFc(v.puntos));
    (m.getSource("ref") as maplibregl.GeoJSONSource | undefined)?.setData(linea(refActual.current ?? []));
  }
  const refActual = useRef(referencia);
  refActual.current = referencia;

  useEffect(pintar, [puntos, referencia]);

  // Encuadre: la referencia (si hay) o el último punto cargado.
  const claveRef = referencia ? `${referencia.length}|${referencia[0]?.join(",")}` : "";
  useEffect(() => {
    const m = mapa.current;
    if (!m || !referencia || referencia.length < 2) return;
    const b = new maplibregl.LngLatBounds(referencia[0], referencia[0]);
    referencia.forEach((c) => b.extend(c));
    m.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRef]);

  return <div ref={contenedor} style={{ width: "100%", height: "100%" }} aria-label="Mapa para dibujar el desvío" />;
}
