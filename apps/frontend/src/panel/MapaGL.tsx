import type { Layer } from "@deck.gl/core";
import { GeoJsonLayer, LineLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { hexDe, rgbaDe } from "../estilo/paleta";
import { hayWebGL, useMenosMovimiento } from "../lib/entorno";
import { accesoCortado, crearCapaAccesosCortados, crearCapasLamina } from "./capasLamina";
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
  /** Traslados de evacuaciones ya cerradas (origen del pedido a destino marcado). Opcional y solo para roles operativos. */
  traslados?: Traslado[];
  /** Última posición de las cuadrillas con tarea en curso. Opcional y solo para roles operativos. */
  cuadrillas?: PuntoCuadrilla[];
  /** Lámina de agua ilustrativa (SIMULADO): altura que dibuja, si se ve y si se está reproduciendo la subida. */
  lamina?: { altura: number; visible: boolean; reproduciendo: boolean };
  onAcceso: (a: AccesoProps) => void;
  onPunto: (lon: number, lat: number) => void;
};

export type Traslado = { id: number; origen: [number, number]; destino: [number, number]; estado: string };

export type PuntoCuadrilla = { id: number; posicion: [number, number]; vieja: boolean };

type RGBA = [number, number, number, number];

const FILL_ESTADO: Record<string, RGBA> = {
  normal: rgbaDe("estado.normal.fill", 120),
  en_riesgo: rgbaDe("estado.en_riesgo.fill", 170),
  comprometido: rgbaDe("estado.comprometido.fill", 190),
};
const LINEA_ESTADO: Record<string, RGBA> = {
  normal: rgbaDe("estado.normal.borde"),
  en_riesgo: rgbaDe("estado.en_riesgo.borde"),
  comprometido: rgbaDe("estado.comprometido.borde"),
};
const COLOR_ACCESO: Record<string, RGBA> = {
  transitable: rgbaDe("acceso.transitable"),
  cerrado_operador: rgbaDe("acceso.cerrado"),
  intransitable_lluvia: rgbaDe("acceso.lluvia"),
  anegado: rgbaDe("acceso.anegado"),
};
const COLOR_CAPA: Record<string, string> = {
  red_vial: hexDe("mapa.vial"),
  localidades_parajes: hexDe("mapa.localidades"),
  establecimientos_educativos: hexDe("mapa.educativos"),
  establecimientos_salud: hexDe("mapa.salud"),
  comisarias_destacamentos: hexDe("mapa.policia"),
  cursos_agua: hexDe("mapa.agua"),
};
const COLOR_TRASLADO: Record<string, RGBA> = {
  verificada: rgbaDe("confirmacion"),
  cerrada_cuadrilla: rgbaDe("umbral.alerta"),
  con_discrepancia: rgbaDe("acceso.cerrado"),
};
const COLOR_CURVA = hexDe("alerta.800");
const COLOR_DEPARTAMENTO = hexDe("pizarra.700");
const OPACIDAD_RELIEVE = 0.38;
const ZOOM_LOCAL = 9.5; // desde aquí se muestran las curvas y el tinte del corredor; por debajo, los de la cuenca
const TINTA = rgbaDe("acceso.ruta");
const BLANCO = rgbaDe("superficie");

export const LIMITES_INICIALES: [[number, number], [number, number]] = [
  [-58.27, -26.26],
  [-58.08, -26.12],
];

const ESTILO_BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": hexDe("mapa.fondo") } }],
};

function colorAcceso(p: AccesoProps, estado: Record<number, string>, cerrados: number[]): RGBA {
  if (cerrados.includes(p.id)) return COLOR_ACCESO.cerrado_operador;
  const e = estado[p.id] ?? (p.transitable ? "transitable" : "cerrado_operador");
  return COLOR_ACCESO[e] ?? COLOR_ACCESO.transitable;
}

const ESPECIALES = new Set(["relieve", "curvas_nivel", "departamentos"]);

const esquinas = (b: [number, number, number, number]): [[number, number], [number, number], [number, number], [number, number]] => [
  [b[0], b[3]],
  [b[2], b[3]],
  [b[2], b[1]],
  [b[0], b[1]],
];

/**
 * Relieve y planialtimetría (DOCUMENTO DE REFERENCIA, sin servicios externos): tinte hipsométrico como imagen,
 * curvas de nivel (corredor local y cuenca según el zoom) y departamentos de Formosa. Cada grupo se muestra u oculta
 * con su casilla de la lista de capas.
 */
function aplicarRelieve(m: maplibregl.Map, capas: CapaOficial[], activas: string[]) {
  const base = import.meta.env.BASE_URL;
  const vis = (id: string, visible: boolean) => {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  };
  const relieve = capas.find((c) => c.id === "relieve");
  if (relieve && activas.includes("relieve") && !m.getSource("relieve-cuenca") && relieve.bbox_cuenca && relieve.bbox_local && relieve.archivo_cuenca) {
    m.addSource("relieve-cuenca", { type: "image", url: `${base}${relieve.archivo_cuenca}`, coordinates: esquinas(relieve.bbox_cuenca) });
    m.addSource("relieve-local", { type: "image", url: `${base}${relieve.archivo}`, coordinates: esquinas(relieve.bbox_local) });
    const paint = { "raster-opacity": OPACIDAD_RELIEVE, "raster-fade-duration": 0 };
    m.addLayer({ id: "relieve-cuenca", type: "raster", source: "relieve-cuenca", paint }, "ancla-relieve");
    m.addLayer({ id: "relieve-local", type: "raster", source: "relieve-local", paint }, "ancla-relieve");
  }
  vis("relieve-cuenca", activas.includes("relieve"));
  vis("relieve-local", activas.includes("relieve"));

  const curvas = capas.find((c) => c.id === "curvas_nivel");
  if (curvas && activas.includes("curvas_nivel") && !m.getSource("curvas-local")) {
    m.addSource("curvas-local", { type: "geojson", data: `${base}${curvas.archivo}` });
    if (curvas.archivo_cuenca) m.addSource("curvas-cuenca", { type: "geojson", data: `${base}${curvas.archivo_cuenca}` });
    const estilo = (id: string, source: string, maestra: boolean, extra: { minzoom?: number; maxzoom?: number }) =>
      m.addLayer(
        {
          id,
          type: "line",
          source,
          filter: ["==", ["to-boolean", ["get", "maestra"]], maestra],
          paint: { "line-color": COLOR_CURVA, "line-width": maestra ? 1.3 : 0.6, "line-opacity": maestra ? 0.85 : 0.55 },
          ...extra,
        },
        "ancla-top",
      );
    estilo("curvas-local-menores", "curvas-local", false, { minzoom: ZOOM_LOCAL });
    estilo("curvas-local-mayores", "curvas-local", true, { minzoom: ZOOM_LOCAL });
    if (curvas.archivo_cuenca) {
      estilo("curvas-cuenca-menores", "curvas-cuenca", false, { maxzoom: ZOOM_LOCAL });
      estilo("curvas-cuenca-mayores", "curvas-cuenca", true, { maxzoom: ZOOM_LOCAL });
    }
  }
  for (const id of ["curvas-local-menores", "curvas-local-mayores", "curvas-cuenca-menores", "curvas-cuenca-mayores"]) vis(id, activas.includes("curvas_nivel"));

  const deps = capas.find((c) => c.id === "departamentos");
  if (deps && activas.includes("departamentos") && !m.getSource("departamentos")) {
    m.addSource("departamentos", { type: "geojson", data: `${base}${deps.archivo}` });
    m.addLayer(
      { id: "departamentos", type: "line", source: "departamentos", paint: { "line-color": COLOR_DEPARTAMENTO, "line-width": 1.6, "line-dasharray": [4, 2], "line-opacity": 0.85 } },
      "ancla-top",
    );
  }
  vis("departamentos", activas.includes("departamentos"));
}

/** Mapa operativo: MapLibre (capas oficiales, sin claves ni servicios externos) con Deck.gl para las capas operativas. */
export default function MapaGL(props: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const sinWebGL = useMemo(() => !hayWebGL(), []);
  const mapa = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const marcadores = useRef<maplibregl.Marker[]>([]);
  const rotulosCurvas = useRef<{ marca: maplibregl.Marker; el: HTMLElement; regimen: "local" | "cuenca" }[]>([]);
  const rotulosDepartamentos = useRef<maplibregl.Marker[]>([]);
  const listo = useRef(false);
  const ultimo = useRef(props);
  ultimo.current = props;

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (sinWebGL || !contenedor.current) return;
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const m = new maplibregl.Map({
      container: contenedor.current,
      // En pantallas táctiles el mapa no atrapa el desplazamiento de la página: se mueve con dos dedos.
      cooperativeGestures: touch,
      locale: { "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa" },
      style: ESTILO_BASE,
      bounds: LIMITES_INICIALES,
      fitBoundsOptions: { padding: 30 },
      attributionControl: { compact: true, customAttribution: "Capas: IGN, BAHRA/INDEC, Mapa Educativo, REFES, © colaboradores de OpenStreetMap (ODbL). Relieve: AWS Terrain Tiles (SRTM y otras fuentes)" },
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
  }, [sinWebGL]);

  // Pulso suave del borde de los sectores en riesgo (solo si la lámina se ve y no se pidió menos movimiento).
  const quieto = useMenosMovimiento();
  const [pulso, setPulso] = useState(false);
  const animarPulso = !quieto && !!props.lamina?.visible;
  useEffect(() => {
    if (!animarPulso) return;
    const t = window.setInterval(() => setPulso((p) => !p), 900);
    return () => window.clearInterval(t);
  }, [animarPulso]);

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
    if (props.lamina) {
      out.push(...crearCapasLamina({ sectores, altura: props.lamina.altura, visible: props.lamina.visible, reproduciendo: props.lamina.reproduciendo, pulso, quieto }));
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
          // Los accesos cortados se dibujan tenues acá y con trazo discontinuo encima (capa "accesos-cortados").
          getLineColor: (f) => {
            const p = (f as { properties: AccesoProps }).properties;
            const c = colorAcceso(p, estadoAccesos, cerradosSimulacion);
            return accesoCortado(p.id, estadoAccesos, cerradosSimulacion) ? [c[0], c[1], c[2], 80] : c;
          },
          updateTriggers: { getLineColor: [estadoAccesos, cerradosSimulacion] },
        }),
      );
      const cortados = crearCapaAccesosCortados(accesos, estadoAccesos, cerradosSimulacion);
      if (cortados) out.push(cortados);
    }
    if (ruta?.geometria) {
      out.push(
        new GeoJsonLayer({
          id: "ruta",
          data: { type: "Feature", geometry: ruta.geometria, properties: {} } as never,
          lineWidthUnits: "pixels",
          getLineWidth: 6,
          getLineColor: TINTA,
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
          getLineColor: [TINTA[0], TINTA[1], TINTA[2], 160],
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
        getFillColor: rgbaDe("acceso.transitable", 230),
        getLineColor: BLANCO,
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
        getFillColor: TINTA,
        getLineColor: rgbaDe("umbral.alerta"),
        stroked: true,
        lineWidthMinPixels: 3,
      }),
    );
    if (props.traslados && props.traslados.length > 0) {
      const colorDe = (t: Traslado): RGBA => COLOR_TRASLADO[t.estado] ?? COLOR_TRASLADO.cerrada_cuadrilla;
      out.push(
        new LineLayer<Traslado>({
          id: "traslados",
          data: props.traslados,
          getSourcePosition: (t) => t.origen,
          getTargetPosition: (t) => t.destino,
          getColor: colorDe,
          getWidth: 3,
          widthUnits: "pixels",
        }),
        new ScatterplotLayer<Traslado>({
          id: "traslados-destino",
          data: props.traslados,
          getPosition: (t) => t.destino,
          getRadius: 6,
          radiusUnits: "pixels",
          getFillColor: colorDe,
          getLineColor: BLANCO,
          stroked: true,
          lineWidthMinPixels: 2,
        }),
      );
    }
    if (props.cuadrillas && props.cuadrillas.length > 0) {
      out.push(
        new ScatterplotLayer<PuntoCuadrilla>({
          id: "cuadrillas",
          data: props.cuadrillas,
          getPosition: (c) => c.posicion,
          getRadius: 9,
          radiusUnits: "pixels",
          // Posición vieja: relleno ámbar; vigente: verde. El texto de la lista del panel repite el estado.
          getFillColor: (c) => (c.vieja ? rgbaDe("umbral.alerta") : rgbaDe("confirmacion")),
          getLineColor: BLANCO,
          stroked: true,
          lineWidthMinPixels: 3,
        }),
      );
    }
    if (origenRuta) {
      out.push(
        new ScatterplotLayer<{ lon: number; lat: number }>({
          id: "origen-ruta",
          data: [origenRuta],
          getPosition: (p) => [p.lon, p.lat],
          getRadius: 8,
          radiusUnits: "pixels",
          getFillColor: rgbaDe("mapa.marcador"),
          getLineColor: BLANCO,
          stroked: true,
          lineWidthMinPixels: 2,
        }),
      );
    }
    return out;
  }, [props, pulso, quieto]);

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
      el.style.cssText = `font:600 12px 'Atkinson Hyperlegible Next Variable','Segoe UI',sans-serif;color:${hexDe("texto")};background:${hexDe("superficie")};padding:1px 5px;border:1px solid ${hexDe("bordeFuerte")};pointer-events:none;white-space:nowrap`;
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
        if (ESPECIALES.has(c.id)) continue; // relieve, curvas y departamentos: ver aplicarRelieve
        if (activa && !m.getSource(sid)) {
          m.addSource(sid, { type: "geojson", data: `${import.meta.env.BASE_URL}${c.archivo}` });
          m.addLayer(
            c.tipo === "linea"
              ? { id: sid, type: "line", source: sid, paint: { "line-color": COLOR_CAPA[c.id] ?? hexDe("bordeFuerte"), "line-width": c.id === "red_vial" ? 1 : 1.5, "line-opacity": 0.8 } }
              : { id: sid, type: "circle", source: sid, paint: { "circle-color": COLOR_CAPA[c.id] ?? hexDe("texto"), "circle-radius": 3.5, "circle-stroke-color": hexDe("superficie"), "circle-stroke-width": 1 } },
            "ancla-top",
          );
        }
        if (m.getLayer(sid)) m.setLayoutProperty(sid, "visibility", activa ? "visible" : "none");
      }
      aplicarRelieve(m, props.capas, props.capasActivas);
      if (props.fondoOsm && !m.getSource("osm")) {
        m.addSource("osm", { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© colaboradores de OpenStreetMap" });
        m.addLayer({ id: "osm", type: "raster", source: "osm" }, "ancla-osm");
      }
      if (m.getLayer("osm")) m.setLayoutProperty("osm", "visibility", props.fondoOsm ? "visible" : "none");
    };
    const preparar = () => {
      if (!m.getLayer("ancla-osm")) m.addLayer({ id: "ancla-osm", type: "background", paint: { "background-opacity": 0 } });
      if (!m.getLayer("ancla-relieve")) m.addLayer({ id: "ancla-relieve", type: "background", paint: { "background-opacity": 0 } });
      if (!m.getLayer("ancla-top")) m.addLayer({ id: "ancla-top", type: "background", paint: { "background-opacity": 0 } });
      aplicar();
    };
    if (listo.current) preparar();
    else m.once("load", preparar);
  }, [props.capas, props.capasActivas, props.fondoOsm]);

  // Rótulos HTML de las curvas maestras (cota en metros) y de los departamentos: el estilo no tiene servidor de fuentes.
  const hayCurvas = props.capasActivas.includes("curvas_nivel");
  const hayDepartamentos = props.capasActivas.includes("departamentos");
  const capaCurvas = props.capas.find((c) => c.id === "curvas_nivel");
  const capaDepartamentos = props.capas.find((c) => c.id === "departamentos");
  useEffect(() => {
    const m = mapa.current;
    rotulosCurvas.current.forEach((r) => r.marca.remove());
    rotulosCurvas.current = [];
    if (!m || !hayCurvas || !capaCurvas) return;
    let activo = true;
    const base = import.meta.env.BASE_URL;
    const cargar = async (archivo: string | undefined, regimen: "local" | "cuenca") => {
      if (!archivo) return;
      try {
        const fc = (await (await fetch(`${base}${archivo}`)).json()) as { features: { properties: { elev_m: number; maestra: boolean }; geometry: { type: string; coordinates: unknown } }[] };
        if (!activo) return;
        for (const f of fc.features.filter((x) => x.properties.maestra)) {
          const lineas = (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) as [number, number][][];
          for (const ln of [...lineas].sort((a, b) => b.length - a.length).slice(0, regimen === "local" ? 3 : 2)) {
            if (ln.length < 6) continue;
            const [lon, lat] = ln[Math.floor(ln.length / 2)];
            const el = document.createElement("div");
            el.textContent = `${f.properties.elev_m} m`;
            el.style.cssText = `font:600 10px 'Atkinson Hyperlegible Next Variable','Segoe UI',sans-serif;color:${COLOR_CURVA};background:${hexDe("superficie")};opacity:.85;padding:0 3px;border-radius:2px;pointer-events:none;white-space:nowrap`;
            const marca = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m);
            rotulosCurvas.current.push({ marca, el, regimen });
          }
        }
        actualizarRotulos();
      } catch {
        /* sin archivo: no hay rótulos */
      }
    };
    const actualizarRotulos = () => {
      const z = m.getZoom();
      for (const r of rotulosCurvas.current) r.el.style.display = r.regimen === "local" ? (z >= ZOOM_LOCAL + 1 ? "block" : "none") : z < ZOOM_LOCAL ? "block" : "none";
    };
    void cargar(capaCurvas.archivo, "local");
    void cargar(capaCurvas.archivo_cuenca, "cuenca");
    m.on("zoom", actualizarRotulos);
    return () => {
      activo = false;
      m.off("zoom", actualizarRotulos);
      rotulosCurvas.current.forEach((r) => r.marca.remove());
      rotulosCurvas.current = [];
    };
  }, [hayCurvas, capaCurvas]);

  useEffect(() => {
    const m = mapa.current;
    rotulosDepartamentos.current.forEach((x) => x.remove());
    rotulosDepartamentos.current = [];
    if (!m || !hayDepartamentos || !capaDepartamentos) return;
    let activo = true;
    void fetch(`${import.meta.env.BASE_URL}${capaDepartamentos.archivo}`)
      .then((r) => r.json() as Promise<{ features: { properties: { nombre: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }>)
      .then((fc) => {
        if (!activo) return;
        for (const f of fc.features) {
          const anillo = (f.geometry.type === "Polygon" ? (f.geometry.coordinates as number[][][])[0] : (f.geometry.coordinates as number[][][][]).map((p) => p[0]).sort((a, b) => b.length - a.length)[0]) as number[][];
          const lon = anillo.reduce((s, p) => s + p[0], 0) / anillo.length;
          const lat = anillo.reduce((s, p) => s + p[1], 0) / anillo.length;
          const el = document.createElement("div");
          el.textContent = `Dpto. ${f.properties.nombre}`;
          el.style.cssText = `font:600 11px 'Atkinson Hyperlegible Next Variable','Segoe UI',sans-serif;letter-spacing:.04em;text-transform:uppercase;color:${COLOR_DEPARTAMENTO};opacity:.75;pointer-events:none;white-space:nowrap`;
          rotulosDepartamentos.current.push(new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m));
        }
      })
      .catch(() => undefined);
    return () => {
      activo = false;
      rotulosDepartamentos.current.forEach((x) => x.remove());
      rotulosDepartamentos.current = [];
    };
  }, [hayDepartamentos, capaDepartamentos]);

  if (sinWebGL) {
    return (
      <div role="alert" style={{ padding: "1rem", fontSize: "0.9375rem" }}>
        Este dispositivo no puede dibujar el mapa (necesita WebGL 2). Podés seguir usando el simulador, la lista de accesos y el ruteo: el
        estado de cada sector y de cada acceso se muestra en las tablas y listas.
      </div>
    );
  }
  return <div ref={contenedor} role="application" aria-label="Mapa operativo de Puerto Formosa" style={{ width: "100%", height: "100%", minHeight: 420, cursor: props.modoOrigen ? "crosshair" : "grab" }} />;
}
