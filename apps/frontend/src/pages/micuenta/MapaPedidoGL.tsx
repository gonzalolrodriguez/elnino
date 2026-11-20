import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { hexDe } from "../../estilo/paleta";

export type PuntoMapa = { lon: number; lat: number };
export type PropsMapaPedido = { pedido: PuntoMapa; cuadrilla: PuntoMapa | null; centro: (PuntoMapa & { nombre: string }) | null };

const ESTILO: maplibregl.StyleSpecification = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© colaboradores de OpenStreetMap" } },
  layers: [
    { id: "fondo", type: "background", paint: { "background-color": hexDe("mapa.fondo") } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.85 } },
  ],
};

/** Marcador de texto + forma: la leyenda nunca depende del color. */
function marcador(texto: string, forma: "circulo" | "cuadrado" | "rombo", color: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", texto);
  el.title = texto;
  el.style.cssText = `width:18px;height:18px;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px ${color};` + (forma === "circulo" ? "border-radius:50%;" : forma === "rombo" ? "transform:rotate(45deg);" : "border-radius:3px;");
  return el;
}

/** Mapa del pedido: tu punto (círculo), la cuadrilla (rombo) y el centro asignado (cuadrado). Se carga con React.lazy. */
export default function MapaPedidoGL({ pedido, cuadrilla, centro }: PropsMapaPedido) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcas = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!contenedor.current) return;
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: [pedido.lon, pedido.lat],
      zoom: 12,
      cooperativeGestures: touch,
      locale: { "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa" },
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapa.current = m;
    return () => {
      marcas.current.forEach((x) => x.remove());
      marcas.current = [];
      m.remove();
      mapa.current = null;
    };
    // El mapa se crea una vez; los puntos se actualizan en el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    marcas.current.forEach((x) => x.remove());
    marcas.current = [];
    const puntos: [number, number][] = [[pedido.lon, pedido.lat]];
    const poner = (p: PuntoMapa, el: HTMLElement) => {
      marcas.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m));
      puntos.push([p.lon, p.lat]);
    };
    marcas.current.push(new maplibregl.Marker({ element: marcador("Tu pedido", "circulo", hexDe("agua.700")) }).setLngLat([pedido.lon, pedido.lat]).addTo(m));
    if (cuadrilla) poner(cuadrilla, marcador("Cuadrilla", "rombo", hexDe("evacuacion.600")));
    if (centro) poner(centro, marcador(`Centro: ${centro.nombre}`, "cuadrado", hexDe("verde.600")));
    if (puntos.length > 1) {
      const b = new maplibregl.LngLatBounds(puntos[0], puntos[0]);
      puntos.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 });
    } else {
      m.jumpTo({ center: [pedido.lon, pedido.lat], zoom: 13 });
    }
    // Solo coordenadas (primitivas): los objetos nuevos en cada render no deben reencuadrar el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.lon, pedido.lat, cuadrilla?.lon, cuadrilla?.lat, centro?.lon, centro?.lat, centro?.nombre]);

  return <div ref={contenedor} style={{ width: "100%", height: "100%" }} />;
}
