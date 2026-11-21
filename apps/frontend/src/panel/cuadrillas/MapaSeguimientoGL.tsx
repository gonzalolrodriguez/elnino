import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { IconoVehiculo } from "../../components/iconos/Iconos";
import { hexDe } from "../../estilo/paleta";
import { CENTRO_FORMOSA, ESTILO_OSM } from "../../lib/estiloOsm";
import { acumuladas, dividir, estimarDistancia, largoTotal, proyectar, puntoEn, rumboEn, suavizar, type Par } from "../../lib/animacionRuta";
import type { PosicionSeguimiento } from "../tipos";

export type PropsMapaSeguimiento = {
  items: PosicionSeguimiento[];
  /** Vehículo de cada cuadrilla (el ícono del marcador). */
  vehiculos: Record<number, string | null>;
  reducido: boolean;
  onSeleccionar: (id: number) => void;
  onFallo?: () => void;
};

const HORIZONTE_REAL_S = 90;
const FUENTE = "seguimiento-resto";

type Motor = {
  clave: string;
  coords: Par[];
  acum: number[];
  largo: number;
  disp: number;
  base: number;
  t0: number;
  velocidadKmh: number;
  horizonteS: number | undefined;
  angulo: number;
  marca: maplibregl.Marker;
  flecha: HTMLElement;
  root: Root;
};
type Fijo = { marca: maplibregl.Marker; root: Root };

function crearMarca(nombre: string, vehiculo: string | null, simulada: boolean, alElegir: () => void): { el: HTMLElement; flecha: HTMLElement; root: Root } {
  const color = hexDe("evacuacion.600");
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${nombre}: ver detalle`);
  el.title = nombre;
  el.style.cssText = "position:relative;width:46px;height:46px;padding:0;border:0;background:transparent;cursor:pointer;";
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    alElegir();
  });
  const flecha = document.createElement("div");
  flecha.setAttribute("aria-hidden", "true");
  flecha.style.cssText = "position:absolute;inset:0;transition:transform .5s linear;";
  const punta = document.createElement("div");
  punta.style.cssText = `position:absolute;left:50%;top:-2px;margin-left:-7px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid ${color};`;
  flecha.appendChild(punta);
  const insignia = document.createElement("div");
  insignia.style.cssText = `position:absolute;left:8px;top:8px;width:30px;height:30px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;${simulada ? "outline:2px dashed #fff;outline-offset:2px;" : ""}`;
  const rotulo = document.createElement("span");
  rotulo.textContent = nombre;
  rotulo.style.cssText = "position:absolute;top:46px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 11px/1.2 system-ui,sans-serif;background:#fff;color:#1b2733;padding:1px 6px;border-radius:9px;box-shadow:0 1px 3px rgba(0,0,0,.35);max-width:9rem;overflow:hidden;text-overflow:ellipsis;";
  el.append(flecha, insignia, rotulo);
  const root = createRoot(insignia);
  root.render(<IconoVehiculo vehiculo={vehiculo} tam="16px" />);
  return { el, flecha, root };
}

const cuadradoDestino = (nombre: string): HTMLElement => {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `Destino de ${nombre}`);
  el.title = `Destino de ${nombre}`;
  el.style.cssText = `width:16px;height:16px;border-radius:3px;background:${hexDe("verde.600")};border:3px solid #fff;box-shadow:0 0 0 1px ${hexDe("verde.600")};`;
  return el;
};

const colecion = (lineas: { id: number; coords: Par[] }[]): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
  type: "FeatureCollection",
  features: lineas.filter((l) => l.coords.length > 1).map((l) => ({ type: "Feature", properties: { id: l.id }, geometry: { type: "LineString", coordinates: l.coords } })),
});

/** Todas las cuadrillas con su recorrido animado hacia la tarea en curso. Sin ruta, un punto fijo en su última posición. */
export default function MapaSeguimientoGL({ items, vehiculos, reducido, onSeleccionar, onFallo }: PropsMapaSeguimiento) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const motores = useRef(new Map<number, Motor>());
  const fijos = useRef(new Map<number, Fijo>());
  const destinos = useRef(new Map<number, maplibregl.Marker>());
  const encuadrado = useRef(false);
  const ultLinea = useRef(0);
  const vivas = useRef({ onSeleccionar, reducido });
  vivas.current = { onSeleccionar, reducido };

  useEffect(() => {
    if (!contenedor.current) return;
    let m: maplibregl.Map;
    try {
      const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      m = new maplibregl.Map({ container: contenedor.current, style: ESTILO_OSM, center: CENTRO_FORMOSA, zoom: 10, cooperativeGestures: touch, attributionControl: { compact: true } });
    } catch {
      onFallo?.();
      return;
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const montar = () => {
      if (m.getSource(FUENTE)) return;
      m.addSource(FUENTE, { type: "geojson", data: colecion([]) });
      m.addLayer({ id: "seg-borde", type: "line", source: FUENTE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 8 } });
      m.addLayer({ id: "seg-linea", type: "line", source: FUENTE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": hexDe("agua.700"), "line-width": 4 } });
    };
    m.on("load", montar);
    mapa.current = m;
    const mots = motores.current;
    const fij = fijos.current;
    const dest = destinos.current;
    return () => {
      for (const mo of mots.values()) {
        mo.marca.remove();
        const r = mo.root;
        queueMicrotask(() => r.unmount());
      }
      for (const f of fij.values()) {
        f.marca.remove();
        const r = f.root;
        queueMicrotask(() => r.unmount());
      }
      dest.forEach((d) => d.remove());
      mots.clear();
      fij.clear();
      dest.clear();
      m.remove();
      mapa.current = null;
    };
    // El mapa se crea una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Un cuadro: acerca cada vehículo a su posición estimada y refresca las líneas. */
  function paso(dtMs: number) {
    const m = mapa.current;
    if (!m) return;
    const ahora = Date.now();
    const lineas: { id: number; coords: Par[] }[] = [];
    for (const [id, mo] of motores.current) {
      const objetivo = estimarDistancia({ base: mo.base, velocidadKmh: mo.velocidadKmh, transcurridoMs: ahora - mo.t0, largo: mo.largo, maxSegundos: mo.horizonteS });
      const antes = mo.disp;
      mo.disp = Number.isFinite(dtMs) ? suavizar(mo.disp, objetivo, dtMs) : objetivo;
      mo.marca.setLngLat(puntoEn(mo.coords, mo.acum, mo.disp));
      if (mo.disp !== antes) {
        const b = rumboEn(mo.coords, mo.acum, mo.disp);
        mo.angulo += ((b - mo.angulo + 540) % 360) - 180;
        mo.flecha.style.transform = `rotate(${mo.angulo}deg)`;
      }
      lineas.push({ id, coords: dividir(mo.coords, mo.acum, mo.disp).restante });
    }
    if (ahora - ultLinea.current >= 250 || !Number.isFinite(dtMs)) {
      ultLinea.current = ahora;
      (m.getSource(FUENTE) as maplibregl.GeoJSONSource | undefined)?.setData(colecion(lineas));
    }
  }

  // Sincroniza motores y marcadores con los datos más nuevos.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const ids = new Set(items.map((i) => i.cuadrilla_id));
    for (const [id, mo] of motores.current) {
      if (!ids.has(id)) {
        mo.marca.remove();
        queueMicrotask(() => mo.root.unmount());
        motores.current.delete(id);
      }
    }
    for (const [id, f] of fijos.current) {
      if (!ids.has(id)) {
        f.marca.remove();
        queueMicrotask(() => f.root.unmount());
        fijos.current.delete(id);
      }
    }
    for (const [id, d] of destinos.current) {
      if (!ids.has(id)) {
        d.remove();
        destinos.current.delete(id);
      }
    }
    const puntos: Par[] = [];
    for (const it of items) {
      const id = it.cuadrilla_id;
      const ruta = it.ruta && it.ruta.coordenadas.length >= 2 ? it.ruta : null;
      puntos.push([it.lon, it.lat]);
      if (it.destino && !destinos.current.has(id)) {
        destinos.current.set(id, new maplibregl.Marker({ element: cuadradoDestino(it.nombre) }).setLngLat([it.destino.lon, it.destino.lat]).addTo(m));
      }
      if (it.destino) puntos.push([it.destino.lon, it.destino.lat]);
      const alElegir = () => vivas.current.onSeleccionar(id);
      if (!ruta) {
        const prev = motores.current.get(id);
        if (prev) {
          prev.marca.remove();
          queueMicrotask(() => prev.root.unmount());
          motores.current.delete(id);
        }
        const f = fijos.current.get(id);
        if (f) f.marca.setLngLat([it.lon, it.lat]);
        else {
          const { el, root } = crearMarca(it.nombre, it.vehiculo ?? vehiculos[id] ?? null, false, alElegir);
          fijos.current.set(id, { marca: new maplibregl.Marker({ element: el, rotationAlignment: "viewport" }).setLngLat([it.lon, it.lat]).addTo(m), root });
        }
        continue;
      }
      const fijo = fijos.current.get(id);
      if (fijo) {
        fijo.marca.remove();
        queueMicrotask(() => fijo.root.unmount());
        fijos.current.delete(id);
      }
      const coords = ruta.coordenadas as Par[];
      ruta.coordenadas.forEach((c) => puntos.push(c));
      const clave = `${coords.length}|${coords[0].join(",")}|${coords[coords.length - 1].join(",")}`;
      let mo = motores.current.get(id);
      if (!mo || mo.clave !== clave) {
        const acum = acumuladas(coords);
        const previo = mo;
        const disp = previo ? proyectar(coords, acum, puntoEn(previo.coords, previo.acum, previo.disp)).distancia : 0;
        if (previo) {
          previo.marca.remove();
          queueMicrotask(() => previo.root.unmount());
        }
        const { el, flecha, root } = crearMarca(it.nombre, it.vehiculo ?? vehiculos[id] ?? null, ruta.simulada, alElegir);
        const marca = new maplibregl.Marker({ element: el, rotationAlignment: "viewport" }).setLngLat(coords[0]).addTo(m);
        mo = { clave, coords, acum, largo: largoTotal(acum), disp, base: disp, t0: Date.now(), velocidadKmh: 0, horizonteS: undefined, angulo: 0, marca, flecha, root };
        motores.current.set(id, mo);
        if (!previo) mo.disp = -1; // se fija en el primer rebase
      }
      const real = !ruta.simulada;
      mo.base = real ? proyectar(mo.coords, mo.acum, [it.lon, it.lat]).distancia : Math.min(1, Math.max(0, ruta.progreso)) * mo.largo;
      mo.t0 = Date.now();
      mo.velocidadKmh = ruta.velocidad_kmh;
      mo.horizonteS = real ? HORIZONTE_REAL_S : undefined;
      if (mo.disp < 0) mo.disp = mo.base;
    }
    paso(vivas.current.reducido ? Infinity : 0);
    if (!encuadrado.current && puntos.length > 0) {
      encuadrado.current = true;
      if (puntos.length > 1) {
        const b = new maplibregl.LngLatBounds(puntos[0], puntos[0]);
        puntos.forEach((p) => b.extend(p));
        m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
      } else m.jumpTo({ center: puntos[0], zoom: 13 });
    }
  }, [items, vehiculos]);

  // Animación cuadro a cuadro; con movimiento reducido, saltos cada pocos segundos.
  useEffect(() => {
    if (reducido) {
      const id = window.setInterval(() => paso(Infinity), 5000);
      return () => window.clearInterval(id);
    }
    let raf = 0;
    let previo = performance.now();
    const cuadro = (t: number) => {
      const dt = t - previo;
      previo = t;
      paso(dt);
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [reducido]);

  return <div ref={contenedor} style={{ width: "100%", height: "100%" }} aria-label="Mapa de seguimiento de las cuadrillas" />;
}
