import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { hexDe } from "../../estilo/paleta";
import { CENTRO_FORMOSA, ESTILO_OSM } from "../../lib/estiloOsm";

type Props = {
  /** Coordenadas [lon, lat] del desvío: una sola = punto; dos o más = línea. */
  coordenadas: [number, number][];
  /** Se llama si el mapa no se pudo crear (p. ej. sin WebGL). */
  onFallo: () => void;
  alto?: string;
};

/** Mapa chico del desvío indicado por el operativo (carga diferida): la línea o el punto sobre OpenStreetMap. */
export default function MapaDesvioGL({ coordenadas, onFallo, alto = "14rem" }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const alFallar = useRef(onFallo);
  alFallar.current = onFallo;
  const clave = coordenadas.map((c) => c.join(",")).join(";");

  useEffect(() => {
    if (!contenedor.current || coordenadas.length === 0) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: contenedor.current,
        style: ESTILO_OSM,
        center: coordenadas[0] ?? CENTRO_FORMOSA,
        zoom: 13,
        cooperativeGestures: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
        attributionControl: { compact: true },
      });
    } catch {
      alFallar.current();
      return;
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("error", () => undefined);
    const color = hexDe("evacuacion.600");
    const marcas: maplibregl.Marker[] = [];

    const el = document.createElement("div");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", coordenadas.length === 1 ? "Punto indicado" : "Inicio del desvío");
    el.style.cssText = `width:18px;height:18px;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px ${color};border-radius:50%;`;
    marcas.push(new maplibregl.Marker({ element: el }).setLngLat(coordenadas[0]).addTo(m));

    if (coordenadas.length > 1) {
      const fin = document.createElement("div");
      fin.setAttribute("role", "img");
      fin.setAttribute("aria-label", "Fin del desvío");
      fin.style.cssText = `width:18px;height:18px;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px ${color};border-radius:3px;`;
      marcas.push(new maplibregl.Marker({ element: fin }).setLngLat(coordenadas[coordenadas.length - 1]).addTo(m));
      const b = new maplibregl.LngLatBounds(coordenadas[0], coordenadas[0]);
      coordenadas.forEach((c) => b.extend(c));
      m.fitBounds(b, { padding: 36, maxZoom: 16, duration: 0 });
      const montar = () => {
        if (m.getSource("desvio")) return;
        m.addSource("desvio", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coordenadas } } });
        m.addLayer({ id: "desvio-borde", type: "line", source: "desvio", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
        m.addLayer({ id: "desvio-linea", type: "line", source: "desvio", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 5, "line-dasharray": [2, 1.5] } });
      };
      try {
        montar();
      } catch {
        /* el estilo todavía no cargó: se monta en `load` */
      }
      m.on("load", montar);
    }
    return () => {
      marcas.forEach((x) => x.remove());
      m.remove();
    };
    // `clave` resume las coordenadas: un arreglo nuevo con los mismos valores no debe recrear el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return <div ref={contenedor} style={{ width: "100%", height: alto }} data-testid="mapa-desvio" />;
}
