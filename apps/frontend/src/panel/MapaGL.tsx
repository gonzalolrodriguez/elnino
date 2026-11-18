import type { Layer } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";

import type { AccesoProps, CapaOficial, Centro, Estacion, Geo, Ruta, SectorEscenario } from "./tipos";

export type PropsMapa = {
  sectores: Geo | null;
  accesos: Geo | null;
  centros: Centro[];
  estaciones: Estacion[];
  /** Estado de cada sector según el escenario calculado (si hay). */
  estadoSectores: Record<string, SectorEscenario>;
  /** Estado de cada acceso según el escenario (por id) y accesos cerrados solo en la simulación. */
  estadoAccesos: Record<number, string>;
  cerradosSimulacion: number[];
  capas: CapaOficial[];
  capasActivas: string[];
  fondoOsm: boolean;
  ruta: Ruta | null;
  modoOrigen: boolean;
  origenRuta: { lon: number; lat: number } | null;
  onAcceso: (a: AccesoProps) => void;
  onPunto: (lon: number, lat: number) => void;
};

type RGBA = [number, number, number, number];

const FILL_ESTADO: Record<string, RGBA> = {
  normal: [234, 239, 236, 120],
  en_riesgo: [246, 217, 142, 170],
  comprometido: [229, 140, 128, 190],
};
const LINEA_ESTADO: Record<string, RGBA> = {
  normal: [91, 107, 104, 255],
  en_riesgo: [176, 122, 18, 255],
  comprometido: [155, 45, 32, 255],
};
const COLOR_ACCESO: Record<string, RGBA> = {
  transitable: [27, 92, 88, 255],
  cerrado_operador: [194, 59, 42, 255],
  intransitable_lluvia: [217, 154, 30, 255],
  anegado: [52, 92, 160, 255],
};
const COLOR_CAPA: Record<string, string> = {
  red_vial: "#8A9A96",
  localidades_parajes: "#13242A",
  establecimientos_educativos: "#6B4C9A",
  establecimientos_salud: "#C23B2A",
  comisarias_destacamentos: "#345CA0",
  cursos_agua: "#2F8F8A",
};

export const LIMITES_INICIALES: [[number, number], [number, number]] = [
  [-58.27, -26.26],
  [-58.08, -26.12],
];

const ESTILO_BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": "#EEF2EF" } }],
};

function colorAcceso(p: AccesoProps, estado: Record<number, string>, cerrados: number[]): RGBA {
  if (cerrados.includes(p.id)) return COLOR_ACCESO.cerrado_operador;
  const e = estado[p.id] ?? (p.transitable ? "transitable" : "cerrado_operador");
  return COLOR_ACCESO[e] ?? COLOR_ACCESO.transitable;
}

/** Mapa operativo: MapLibre (capas oficiales, sin claves ni servicios externos) con Deck.gl para las capas operativas. */
export default function MapaGL(props: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const marcadores = useRef<maplibregl.Marker[]>([]);
  const listo = useRef(false);
  const ultimo = useRef(props);
  ultimo.current = props;

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO_BASE,
      bounds: LIMITES_INICIALES,
      fitBoundsOptions: { padding: 30 },
      attributionControl: { compact: true, customAttribution: "Capas: IGN, BAHRA/INDEC, Mapa Educativo, REFES, © colaboradores de OpenStreetMap (ODbL)" },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    const ov = new MapboxOverlay({
      interleaved: false,
      onClick: (info) => {
        const actual = ultimo.current;
        const obj = info.object as { properties?: AccesoProps } | undefined;
        if (actual.modoOrigen && info.coordinate) {
          actual.onPunto(Number(info.coordinate[0].toFixed(5)), Number(info.coordinate[1].toFixed(5)));
        } else if (info.layer?.id === "accesos" && obj?.properties) {
          actual.onAcceso(obj.properties);
        }
      },
      getTooltip: ({ object, layer }) => {
        if (!object || !layer) return null;
        const o = object as { properties?: Record<string, unknown>; nombre?: string; capacidad_personas?: number };
        if (layer.id === "sectores" && o.properties) return `${String(o.properties.id)} · ${String(o.properties.nombre)} (SIMULADO)`;
        if (layer.id === "accesos" && o.properties) return `${String(o.properties.nombre)} · ${String(o.properties.superficie)} (SIMULADO)`;
        if (layer.id === "centros") return `${String(o.nombre)} · capacidad ${String(o.capacidad_personas)} personas (SIMULADO)`;
        if (layer.id === "estaciones") return `${String(o.nombre)} (DATO OBSERVADO, K3)`;
        return null;
      },
    });
    m.addControl(ov as unknown as maplibregl.IControl);
    m.on("click", (e) => {
      if (ultimo.current.modoOrigen) ultimo.current.onPunto(Number(e.lngLat.lng.toFixed(5)), Number(e.lngLat.lat.toFixed(5)));
    });
    m.on("load", () => {
      listo.current = true;
    });
    mapa.current = m;
    overlay.current = ov;
    return () => {
      marcadores.current.forEach((x) => x.remove());
      marcadores.current = [];
      m.remove();
      mapa.current = null;
      overlay.current = null;
      listo.current = false;
    };
  }, []);

  // Capas de Deck.gl (operativas, con selección).
  const capasDeck = useMemo(() => {
    const out: Layer[] = [];
    const { sectores, accesos, centros, estaciones, estadoSectores, estadoAccesos, cerradosSimulacion, ruta, origenRuta } = props;
    if (sectores) {
      out.push(
        new GeoJsonLayer({
          id: "sectores",
          data: sectores as never,
          pickable: true,
          stroked: true,
          filled: true,
          lineWidthMinPixels: 2,
          getFillColor: (f) => FILL_ESTADO[estadoSectores[String((f as { properties: { id: string } }).properties.id)]?.estado ?? "normal"],
          getLineColor: (f) => LINEA_ESTADO[estadoSectores[String((f as { properties: { id: string } }).properties.id)]?.estado ?? "normal"],
          getLineWidth: (f) => (estadoSectores[String((f as { properties: { id: string } }).properties.id)]?.aislado ? 5 : 2),
          lineWidthUnits: "pixels",
          updateTriggers: { getFillColor: [estadoSectores], getLineColor: [estadoSectores], getLineWidth: [estadoSectores] },
        }),
      );
    }
    if (accesos) {
      out.push(
        new GeoJsonLayer({
          id: "accesos",
          data: accesos as never,
          pickable: true,
          stroked: false,
          filled: false,
          lineWidthUnits: "pixels",
          getLineWidth: 5,
          lineWidthMinPixels: 4,
          getLineColor: (f) => colorAcceso((f as { properties: AccesoProps }).properties, estadoAccesos, cerradosSimulacion),
          updateTriggers: { getLineColor: [estadoAccesos, cerradosSimulacion] },
        }),
      );
    }
    if (ruta?.geometria) {
      out.push(
        new GeoJsonLayer({
          id: "ruta",
          data: { type: "Feature", geometry: ruta.geometria, properties: {} } as never,
          lineWidthUnits: "pixels",
          getLineWidth: 6,
          getLineColor: [19, 36, 42, 255],
        }),
      );
    } else if (ruta && ruta.encontrada) {
      // Estimación aproximada: línea recta entre origen y destino (se rotula como aproximada en el panel).
      out.push(
        new GeoJsonLayer({
          id: "ruta",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [[ruta.origen.lon, ruta.origen.lat], [ruta.destino.lon, ruta.destino.lat]] },
            properties: {},
          } as never,
          lineWidthUnits: "pixels",
          getLineWidth: 3,
          getLineColor: [19, 36, 42, 160],
        }),
      );
    }
    out.push(
      new ScatterplotLayer<Centro>({
        id: "centros",
        data: centros,
        pickable: true,
        getPosition: (c) => [c.lon, c.lat],
        getRadius: (c) => 120 + Math.sqrt(c.capacidad_personas) * 6,
        radiusUnits: "meters",
        getFillColor: [27, 92, 88, 230],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2,
      }),
      new ScatterplotLayer<Estacion>({
        id: "estaciones",
        data: estaciones,
        pickable: true,
        getPosition: (e) => [e.lon, e.lat],
        getRadius: 9,
        radiusUnits: "pixels",
        getFillColor: [19, 36, 42, 255],
        getLineColor: [217, 154, 30, 255],
        stroked: true,
        lineWidthMinPixels: 3,
      }),
    );
    if (origenRuta) {
      out.push(
        new ScatterplotLayer<{ lon: number; lat: number }>({
          id: "origen-ruta",
          data: [origenRuta],
          getPosition: (p) => [p.lon, p.lat],
          getRadius: 8,
          radiusUnits: "pixels",
          getFillColor: [194, 59, 42, 255],
          getLineColor: [255, 255, 255, 255],
          stroked: true,
          lineWidthMinPixels: 2,
        }),
      );
    }
    return out;
  }, [props]);

  useEffect(() => {
    overlay.current?.setProps({ layers: capasDeck });
  }, [capasDeck]);

  // Marcas HTML con el id y el estado de cada sector (no necesitan servidor de fuentes).
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    marcadores.current.forEach((x) => x.remove());
    marcadores.current = [];
    for (const f of props.sectores?.features ?? []) {
      const id = String(f.properties.id);
      const anillo = (f.geometry.coordinates as number[][][])[0];
      const lon = anillo.reduce((s, p) => s + p[0], 0) / anillo.length;
      const lat = anillo.reduce((s, p) => s + p[1], 0) / anillo.length;
      const est = props.estadoSectores[id];
      const el = document.createElement("div");
      el.style.cssText = "font:600 12px 'Segoe UI',sans-serif;color:#13242A;background:rgba(255,255,255,.85);padding:1px 5px;border:1px solid #5B6B68;pointer-events:none;white-space:nowrap";
      el.textContent = est ? `${id} · ${est.estado.replace("_", " ")}${est.aislado ? " · aislado" : ""}` : id;
      marcadores.current.push(new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m));
    }
  }, [props.sectores, props.estadoSectores]);

  // Capas oficiales (MapLibre nativo; se piden al activarlas) y fondo OpenStreetMap opcional.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const aplicar = () => {
      for (const c of props.capas) {
        const sid = `capa-${c.id}`;
        const activa = props.capasActivas.includes(c.id);
        if (activa && !m.getSource(sid)) {
          m.addSource(sid, { type: "geojson", data: `${import.meta.env.BASE_URL}${c.archivo}` });
          m.addLayer(
            c.tipo === "linea"
              ? { id: sid, type: "line", source: sid, paint: { "line-color": COLOR_CAPA[c.id] ?? "#5B6B68", "line-width": c.id === "red_vial" ? 1 : 1.5, "line-opacity": 0.8 } }
              : { id: sid, type: "circle", source: sid, paint: { "circle-color": COLOR_CAPA[c.id] ?? "#13242A", "circle-radius": 3.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
            "ancla-top",
          );
        }
        if (m.getLayer(sid)) m.setLayoutProperty(sid, "visibility", activa ? "visible" : "none");
      }
      if (props.fondoOsm && !m.getSource("osm")) {
        m.addSource("osm", { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© colaboradores de OpenStreetMap" });
        m.addLayer({ id: "osm", type: "raster", source: "osm" }, "ancla-osm");
      }
      if (m.getLayer("osm")) m.setLayoutProperty("osm", "visibility", props.fondoOsm ? "visible" : "none");
    };
    const preparar = () => {
      if (!m.getLayer("ancla-osm")) m.addLayer({ id: "ancla-osm", type: "background", paint: { "background-opacity": 0 } });
      if (!m.getLayer("ancla-top")) m.addLayer({ id: "ancla-top", type: "background", paint: { "background-opacity": 0 } });
      aplicar();
    };
    if (listo.current) preparar();
    else m.once("load", preparar);
  }, [props.capas, props.capasActivas, props.fondoOsm]);

  return <div ref={contenedor} role="application" aria-label="Mapa operativo de Puerto Formosa" style={{ width: "100%", height: "100%", minHeight: 420, cursor: props.modoOrigen ? "crosshair" : "grab" }} />;
}
