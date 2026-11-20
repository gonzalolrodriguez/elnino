import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { SECTORES_K10 } from "../datos/kit";
import { hexDe } from "../estilo/paleta";
import { CENTRO_FORMOSA, ESTILO_OSM, ZOOM_INICIAL } from "../lib/estiloOsm";

export type PuntoMapa = { lat: number; lon: number };

type Props = {
  lon: number | null;
  lat: number | null;
  onChange: (p: PuntoMapa) => void;
  /** Se llama si el mapa no se pudo crear (p. ej. sin WebGL). */
  onFallo: () => void;
  /** Alto del mapa (CSS); por defecto 20rem. */
  alto?: string;
};

const redondear5 = (n: number) => Number(n.toFixed(5));
const valido = (n: number | null): n is number => n !== null && Number.isFinite(n);

/** Mapa MapLibre (carga diferida): sectores K10 (SIMULADO) sobre OpenStreetMap; clic o arrastre del marcador fijan el punto. */
export default function ElegirEnMapaGL({ lon, lat, onChange, onFallo, alto = "20rem" }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcador = useRef<maplibregl.Marker | null>(null);
  const alCambiar = useRef(onChange);
  alCambiar.current = onChange;
  const alFallar = useRef(onFallo);
  alFallar.current = onFallo;
  const inicial = useRef({ lon, lat });

  useEffect(() => {
    if (!contenedor.current) return;
    let m: maplibregl.Map;
    try {
      const { lon: lo, lat: la } = inicial.current;
      const centro: [number, number] = valido(lo) && valido(la) ? [lo, la] : CENTRO_FORMOSA;
      m = new maplibregl.Map({
        container: contenedor.current,
        style: ESTILO_OSM,
        center: centro,
        zoom: ZOOM_INICIAL,
        cooperativeGestures: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
        attributionControl: { compact: true },
      });
    } catch {
      alFallar.current();
      return;
    }
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("error", () => undefined); // un tile que falla no debe romper el formulario

    const fijar = (lo: number, la: number) => alCambiar.current({ lon: redondear5(lo), lat: redondear5(la) });
    const poner = (lo: number, la: number) => {
      if (marcador.current) marcador.current.setLngLat([lo, la]);
      else {
        const mk = new maplibregl.Marker({ draggable: true, color: hexDe("estado.comprometido.borde") }).setLngLat([lo, la]).addTo(m);
        mk.on("dragend", () => {
          const p = mk.getLngLat();
          fijar(p.lng, p.lat);
        });
        marcador.current = mk;
      }
    };
    if (valido(inicial.current.lon) && valido(inicial.current.lat)) poner(inicial.current.lon, inicial.current.lat);

    m.on("load", () => {
      m.addSource("sectores", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: SECTORES_K10.map((s) => ({
            type: "Feature" as const,
            properties: { id: s.id },
            geometry: { type: "Polygon" as const, coordinates: [s.anillo] },
          })),
        },
      });
      m.addLayer({ id: "sectores-relleno", type: "fill", source: "sectores", paint: { "fill-color": hexDe("estado.en_riesgo.fill"), "fill-opacity": 0.35 } });
      m.addLayer({ id: "sectores-borde", type: "line", source: "sectores", paint: { "line-color": hexDe("estado.en_riesgo.borde"), "line-width": 2 } });
    });
    m.on("click", (e) => {
      poner(e.lngLat.lng, e.lngLat.lat);
      fijar(e.lngLat.lng, e.lngLat.lat);
    });
    return () => {
      marcador.current = null;
      mapa.current = null;
      m.remove();
    };
  }, []);

  // Sincroniza el marcador cuando el punto cambia desde afuera (GPS o campos manuales).
  useEffect(() => {
    const m = mapa.current;
    if (!m || !valido(lon) || !valido(lat)) return;
    if (marcador.current) {
      const p = marcador.current.getLngLat();
      if (Math.abs(p.lng - lon) < 1e-7 && Math.abs(p.lat - lat) < 1e-7) return;
      marcador.current.setLngLat([lon, lat]);
    } else {
      marcador.current = new maplibregl.Marker({ draggable: true, color: hexDe("estado.comprometido.borde") }).setLngLat([lon, lat]).addTo(m);
      const mk = marcador.current;
      mk.on("dragend", () => {
        const p = mk.getLngLat();
        alCambiar.current({ lon: redondear5(p.lng), lat: redondear5(p.lat) });
      });
    }
    m.easeTo({ center: [lon, lat], duration: 300 });
  }, [lon, lat]);

  return <div ref={contenedor} role="application" aria-label="Mapa para marcar tu ubicación. Si no podés usarlo, escribí las coordenadas a mano." style={{ width: "100%", height: alto }} />;
}
