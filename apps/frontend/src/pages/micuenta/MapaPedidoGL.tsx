import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { IconoVehiculo } from "../../components/iconos/Iconos";
import { hexDe } from "../../estilo/paleta";
import { acumuladas, dividir, estimarDistancia, largoTotal, proyectar, puntoEn, rumboEn, suavizar, type Par } from "../../lib/animacionRuta";
import type { RutaPedido } from "../../lib/pedidos";

export type PuntoMapa = { lon: number; lat: number };
export type PropsMapaPedido = {
  pedido: PuntoMapa;
  cuadrilla: PuntoMapa | null;
  centro: (PuntoMapa & { nombre: string }) | null;
  /** Recorrido de la cuadrilla hasta el pedido; sin él, el mapa muestra solo los puntos. */
  ruta?: RutaPedido | null;
  vehiculo?: string | null;
  /** `prefers-reduced-motion`: el vehículo salta a su posición y la cámara no lo sigue. */
  reducido?: boolean;
  /** La cámara acompaña al vehículo (true) o muestra todo el recorrido (false). */
  seguir?: boolean;
  alCambiarSeguir?: (seguir: boolean) => void;
  /** Distancia que falta (m) y largo total de la ruta (m), cerca de una vez por segundo. */
  alAvanzar?: (restanteM: number, largoM: number) => void;
};

const ESTILO: maplibregl.StyleSpecification = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© colaboradores de OpenStreetMap" } },
  layers: [
    { id: "fondo", type: "background", paint: { "background-color": hexDe("mapa.fondo") } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.85 } },
  ],
};

const FUENTE_HECHO = "recorrido-hecho";
const FUENTE_RESTO = "recorrido-resto";
/** Sin posición real nueva, la extrapolación de una cuadrilla real se corta a este horizonte (s). */
const HORIZONTE_REAL_S = 90;
const ZOOM_SEGUIMIENTO = 14.5;

/** Marcador de texto + forma: la leyenda nunca depende del color. */
function marcador(texto: string, forma: "circulo" | "cuadrado" | "rombo", color: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", texto);
  el.title = texto;
  el.style.cssText = `width:18px;height:18px;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px ${color};` + (forma === "circulo" ? "border-radius:50%;" : forma === "rombo" ? "transform:rotate(45deg);" : "border-radius:3px;");
  return el;
}

/** Vehículo: insignia circular con su ícono y una flecha que gira hacia el rumbo de marcha. */
function marcadorVehiculo(vehiculo: string | null | undefined, color: string): { el: HTMLElement; flecha: HTMLElement; root: Root } {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Cuadrilla en camino");
  el.title = "Cuadrilla en camino";
  el.style.cssText = "position:relative;width:46px;height:46px;";
  const flecha = document.createElement("div");
  flecha.setAttribute("aria-hidden", "true");
  flecha.style.cssText = "position:absolute;inset:0;transition:transform .5s linear;";
  const punta = document.createElement("div");
  punta.style.cssText = `position:absolute;left:50%;top:-2px;margin-left:-7px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid ${color};`;
  flecha.appendChild(punta);
  const insignia = document.createElement("div");
  insignia.style.cssText = `position:absolute;left:8px;top:8px;width:30px;height:30px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;`;
  el.append(flecha, insignia);
  const root = createRoot(insignia);
  root.render(<IconoVehiculo vehiculo={vehiculo} tam="16px" />);
  return { el, flecha, root };
}

const lineaGeoJSON = (coords: Par[]): GeoJSON.Feature<GeoJSON.LineString> => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });

type Motor = {
  coords: Par[];
  acum: number[];
  largo: number;
  /** Distancia mostrada (m) y base de estima. */
  disp: number;
  base: number;
  t0: number;
  velocidadKmh: number;
  horizonteS: number | undefined;
  angulo: number;
  inicializado: boolean;
  marca: maplibregl.Marker;
  flecha: HTMLElement;
  root: Root;
  ultLinea: number;
  ultAviso: number;
  ultCamara: number;
};

/**
 * Mapa del pedido: tu punto (círculo), el centro asignado (cuadrado) y, con ruta, el vehículo de la cuadrilla que se
 * mueve por la red vial; sin ruta, la cuadrilla es un rombo en su última posición. Se carga con React.lazy.
 */
export default function MapaPedidoGL(props: PropsMapaPedido) {
  const { pedido, cuadrilla, centro, ruta = null, vehiculo = null, reducido = false } = props;
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcas = useRef<maplibregl.Marker[]>([]);
  const motor = useRef<Motor | null>(null);
  const vivas = useRef(props);
  vivas.current = props;

  const coordsRuta = ruta?.coordenadas ?? null;
  // Identidad de la geometría: una ruta nueva (otro trazado) rearma el motor; un progreso nuevo solo lo rebasa.
  const claveGeometria = coordsRuta ? `${coordsRuta.length}|${coordsRuta[0].join(",")}|${coordsRuta[coordsRuta.length - 1].join(",")}` : "";

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
    // Si la persona mueve el mapa con la mano, dejamos de seguir al vehículo.
    m.on("dragstart", (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) vivas.current.alCambiarSeguir?.(false);
    });
    mapa.current = m;
    return () => {
      marcas.current.forEach((x) => x.remove());
      marcas.current = [];
      m.remove();
      mapa.current = null;
    };
    // El mapa se crea una vez; los puntos se actualizan en los efectos siguientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Puntos fijos y encuadre inicial. Con ruta, la cuadrilla es el vehículo animado y no un punto que reencuadre.
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
    if (cuadrilla && !coordsRuta) poner(cuadrilla, marcador("Cuadrilla", "rombo", hexDe("evacuacion.600")));
    if (centro) poner(centro, marcador(`Centro: ${centro.nombre}`, "cuadrado", hexDe("verde.600")));
    coordsRuta?.forEach((c) => puntos.push(c));
    if (puntos.length > 1) {
      const b = new maplibregl.LngLatBounds(puntos[0], puntos[0]);
      puntos.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 });
    } else {
      m.jumpTo({ center: [pedido.lon, pedido.lat], zoom: 13 });
    }
    // Solo primitivas: los objetos nuevos en cada render no deben reencuadrar el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.lon, pedido.lat, coordsRuta ? null : cuadrilla?.lon, coordsRuta ? null : cuadrilla?.lat, centro?.lon, centro?.lat, centro?.nombre, claveGeometria]);

  // Geometría del recorrido: capas de la línea y marcador del vehículo.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !coordsRuta) return;
    const coords = coordsRuta as Par[];
    const acum = acumuladas(coords);
    const color = hexDe("agua.700");
    const { el, flecha, root } = marcadorVehiculo(vehiculo, hexDe("evacuacion.600"));
    const marca = new maplibregl.Marker({ element: el, rotationAlignment: "viewport" }).setLngLat(coords[0]).addTo(m);
    const previo = motor.current;
    const largo = largoTotal(acum);
    // Si la ruta cambia (recálculo), el vehículo sigue donde estaba y se proyecta sobre el trazado nuevo.
    const disp = previo ? proyectar(coords, acum, puntoEn(previo.coords, previo.acum, previo.disp)).distancia : 0;
    motor.current = { coords, acum, largo, disp, base: disp, t0: Date.now(), velocidadKmh: 0, horizonteS: undefined, angulo: 0, inicializado: !!previo, marca, flecha, root, ultLinea: 0, ultAviso: 0, ultCamara: 0 };

    const montar = () => {
      if (m.getSource(FUENTE_RESTO)) return;
      m.addSource(FUENTE_HECHO, { type: "geojson", data: lineaGeoJSON([]) });
      m.addSource(FUENTE_RESTO, { type: "geojson", data: lineaGeoJSON(coords) });
      m.addLayer({ id: "hecho-borde", type: "line", source: FUENTE_HECHO, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.5 } });
      m.addLayer({ id: "hecho", type: "line", source: FUENTE_HECHO, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 4, "line-opacity": 0.3 } });
      m.addLayer({ id: "resto-borde", type: "line", source: FUENTE_RESTO, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
      m.addLayer({ id: "resto", type: "line", source: FUENTE_RESTO, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 5 } });
    };
    try {
      montar();
    } catch {
      /* el estilo todavía no cargó: se monta en `load` */
    }
    m.on("load", montar);
    return () => {
      marca.remove();
      queueMicrotask(() => root.unmount());
      if (mapa.current === m) {
        try {
          m.off("load", montar);
          for (const id of ["resto", "resto-borde", "hecho", "hecho-borde"]) if (m.getLayer(id)) m.removeLayer(id);
          for (const id of [FUENTE_RESTO, FUENTE_HECHO]) if (m.getSource(id)) m.removeSource(id);
        } catch {
          /* el mapa se está destruyendo */
        }
      }
    };
    // `ruta` completo no entra: un progreso nuevo se atiende en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveGeometria, vehiculo]);

  // Cada dato nuevo del servidor redefine la base de la estima; la animación sigue desde donde está el vehículo.
  useEffect(() => {
    const mo = motor.current;
    if (!mo || !ruta) return;
    const real = !ruta.simulada && cuadrilla;
    mo.base = real ? proyectar(mo.coords, mo.acum, [cuadrilla.lon, cuadrilla.lat]).distancia : Math.min(1, Math.max(0, ruta.progreso)) * mo.largo;
    // Reloj propio: el momento en que llegó el dato, para no depender de que el reloj del servidor coincida con el del equipo.
    mo.t0 = Date.now();
    mo.velocidadKmh = ruta.velocidad_kmh;
    mo.horizonteS = real ? HORIZONTE_REAL_S : undefined;
    if (!mo.inicializado) {
      mo.disp = mo.base;
      mo.inicializado = true;
    }
    paso(vivas.current.reducido ? Infinity : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveGeometria, vehiculo, ruta?.calculada_en, ruta?.progreso, ruta?.simulada, ruta?.velocidad_kmh, cuadrilla?.lon, cuadrilla?.lat]);

  /** Un cuadro de animación: acerca el vehículo a su posición estimada y refresca línea, rumbo, cámara y aviso. */
  function paso(dtMs: number) {
    const m = mapa.current;
    const mo = motor.current;
    if (!m || !mo) return;
    const ahora = Date.now();
    const objetivo = estimarDistancia({ base: mo.base, velocidadKmh: mo.velocidadKmh, transcurridoMs: ahora - mo.t0, largo: mo.largo, maxSegundos: mo.horizonteS });
    const antes = mo.disp;
    mo.disp = Number.isFinite(dtMs) ? suavizar(mo.disp, objetivo, dtMs) : objetivo;
    const pos = puntoEn(mo.coords, mo.acum, mo.disp);
    mo.marca.setLngLat(pos);
    if (mo.disp !== antes || mo.ultLinea === 0) {
      const b = rumboEn(mo.coords, mo.acum, mo.disp);
      mo.angulo += ((b - mo.angulo + 540) % 360) - 180;
      mo.flecha.style.transform = `rotate(${mo.angulo}deg)`;
    }
    if (ahora - mo.ultLinea >= 120 || !Number.isFinite(dtMs)) {
      mo.ultLinea = ahora;
      const { recorrida, restante } = dividir(mo.coords, mo.acum, mo.disp);
      (m.getSource(FUENTE_HECHO) as maplibregl.GeoJSONSource | undefined)?.setData(lineaGeoJSON(recorrida));
      (m.getSource(FUENTE_RESTO) as maplibregl.GeoJSONSource | undefined)?.setData(lineaGeoJSON(restante));
    }
    if (ahora - mo.ultAviso >= 1000 || !Number.isFinite(dtMs) || mo.disp >= mo.largo) {
      mo.ultAviso = ahora;
      vivas.current.alAvanzar?.(Math.max(0, mo.largo - mo.disp), mo.largo);
    }
    if (!vivas.current.reducido && vivas.current.seguir !== false && ahora - mo.ultCamara >= 400) {
      mo.ultCamara = ahora;
      seguirConLaCamara(m, pos);
    }
  }

  // Bucle de animación: cuadro a cuadro; con movimiento reducido, saltos cada pocos segundos.
  useEffect(() => {
    if (!coordsRuta) return;
    if (reducido) {
      const id = window.setInterval(() => paso(Infinity), 5000);
      return () => window.clearInterval(id);
    }
    let raf = 0;
    let previo = performance.now();
    const cuadro = (t: number) => {
      const dt = t - previo;
      previo = t;
      const mo = motor.current;
      // Cuando llegó y se asentó, el bucle sigue barato: solo compara y no toca el mapa.
      if (mo && mo.disp < mo.largo) paso(dt);
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveGeometria, reducido]);

  // Alternar «seguir» / «ver todo el recorrido».
  const seguirPrevio = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const m = mapa.current;
    const mo = motor.current;
    const estaba = seguirPrevio.current;
    seguirPrevio.current = props.seguir;
    if (!m || !mo || estaba === undefined || estaba === props.seguir) return;
    const duracion = reducido ? 0 : 700;
    if (props.seguir) {
      m.easeTo({ center: puntoEn(mo.coords, mo.acum, mo.disp), zoom: Math.max(m.getZoom(), ZOOM_SEGUIMIENTO), duration: duracion });
    } else {
      const b = new maplibregl.LngLatBounds(mo.coords[0], mo.coords[0]);
      mo.coords.forEach((c) => b.extend(c));
      b.extend([pedido.lon, pedido.lat]);
      m.fitBounds(b, { padding: 40, maxZoom: 15, duration: duracion });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.seguir]);

  // Tras el encuadre inicial, acercar la cámara al vehículo (solo si el recorrido es largo y hay movimiento permitido).
  useEffect(() => {
    if (!coordsRuta || reducido) return;
    const id = window.setTimeout(() => {
      const m = mapa.current;
      const mo = motor.current;
      if (!m || !mo || vivas.current.seguir === false || mo.largo < 1500 || mo.disp >= mo.largo) return;
      m.easeTo({ center: puntoEn(mo.coords, mo.acum, mo.disp), zoom: ZOOM_SEGUIMIENTO, duration: 1200 });
    }, 2500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveGeometria, reducido]);

  return <div ref={contenedor} style={{ width: "100%", height: "100%" }} />;
}

/** Cámara suave: solo se mueve cuando el vehículo se acerca al borde de lo visible. */
function seguirConLaCamara(m: maplibregl.Map, pos: Par) {
  const lienzo = m.getCanvas();
  const p = m.project(pos);
  const mx = lienzo.clientWidth * 0.25;
  const my = lienzo.clientHeight * 0.25;
  if (p.x < mx || p.x > lienzo.clientWidth - mx || p.y < my || p.y > lienzo.clientHeight - my) {
    m.easeTo({ center: pos, duration: 900 });
  }
}
