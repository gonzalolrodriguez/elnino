// Genera JSON compactos para la web a partir de archivos del repositorio (solo lectura de data/).
// Salidas en src/datos/: k1_diario.json (serie diaria de Puerto Formosa) y k10_sectores.json.
// Uso: node scripts/preparar-datos.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..", "..");
const salida = resolve(aqui, "..", "src", "datos");
mkdirSync(salida, { recursive: true });

// --- K1 limpio, resumen diario (máximo del día). Días sin dato -> null (no se interpola). ---
const csv = readFileSync(resolve(raiz, "data", "processed", "k1_diario.csv"), "utf-8")
  .replace(/^﻿/, "")
  .trim()
  .split(/\r?\n/);
const filas = csv.slice(1).map((l) => l.split(","));
const desde = filas[0][0];
const hasta = filas[filas.length - 1][0];
const valores = filas.map((f) => (f[1] === "" || f[1] === undefined ? null : Number(f[1])));
writeFileSync(
  resolve(salida, "k1_diario.json"),
  JSON.stringify({
    fuente: "K1 limpio (data/processed/k1_diario.csv)",
    categoria: "DATO OBSERVADO",
    estacion: "Puerto Formosa (INA siteCode 57)",
    unidad: "m",
    desde,
    hasta,
    valores,
  }),
);

// --- K10 sin cambios en geometría ni atributos ---
const k10 = JSON.parse(readFileSync(resolve(raiz, "data", "kit", "K10_sectores_simulados.geojson"), "utf-8"));
const sectores = k10.features.map((f) => ({
  id: f.properties.id,
  nombre: f.properties.nombre,
  compromiso_m: f.properties.altura_escala_compromiso_m,
  poblacion: f.properties.poblacion_simulada,
  acceso: f.properties.acceso_simulado,
  anillo: f.geometry.coordinates[0],
}));
writeFileSync(
  resolve(salida, "k10_sectores.json"),
  JSON.stringify({ version: k10.metadata.version, fecha: k10.metadata.fecha, categoria: "SIMULADO", sectores }),
);
console.log(`k1_diario.json: ${valores.length} días (${desde} a ${hasta}); k10_sectores.json: ${sectores.length} sectores`);

// --- Capas oficiales de data/geo/ recortadas al corredor del panel, para que el mapa funcione sin internet ---
// Salidas en public/capas/: un GeoJSON por capa (solo propiedades útiles, coordenadas a 5 decimales) y capas.json
// con la fuente, la licencia y la fecha de descarga de cada una (se muestran junto a cada capa del mapa).
const geo = resolve(raiz, "data", "geo");
const pub = resolve(aqui, "..", "public", "capas");
mkdirSync(pub, { recursive: true });
const [W, S, E, N] = [-58.6, -26.5, -57.8, -25.85];
const manifiesto = JSON.parse(readFileSync(resolve(geo, "manifiesto.json"), "utf-8"));
const redondear = (c) => (typeof c[0] === "number" ? [Number(c[0].toFixed(5)), Number(c[1].toFixed(5))] : c.map(redondear));
const dentro = ([x, y]) => x >= W && x <= E && y >= S && y <= N;
const vertices = (c) => (typeof c[0] === "number" ? [c] : c.flatMap(vertices));
const CAPAS = [
  { id: "red_vial", archivo: "red_vial.geojson", props: ["nombre", "ref", "superficie"], tipo: "linea", etiqueta: "Red vial (OSM)" },
  { id: "localidades_parajes", archivo: "localidades_parajes.geojson", props: ["nombre", "categoria_asentamiento", "departamento"], tipo: "punto", etiqueta: "Localidades y parajes" },
  { id: "establecimientos_educativos", archivo: "establecimientos_educativos.geojson", props: ["nombre", "nivel", "ambito"], tipo: "punto", etiqueta: "Escuelas", nota: "Ubicación aproximada. Qué edificio es centro de recepción lo define la autoridad." },
  { id: "establecimientos_salud", archivo: "establecimientos_salud.geojson", props: ["nombre", "localidad", "tipologia_sigla"], tipo: "punto", etiqueta: "Establecimientos de salud", nota: "Ubicación aproximada (centroide de localidad): REFES no publica coordenadas." },
  { id: "comisarias_destacamentos", archivo: "comisarias_destacamentos.geojson", props: ["nombre"], tipo: "punto", etiqueta: "Comisarías y destacamentos", nota: "Complemento de OpenStreetMap; cobertura parcial." },
  { id: "cursos_agua", archivo: "cursos_agua.geojson", props: ["nombre", "tipo", "regimen"], tipo: "linea", etiqueta: "Cursos de agua (IGN)", nota: "Esquema ilustrativo: no sirve para cotas ni inundación." },
];
const capasSalida = [];
for (const c of CAPAS) {
  const fc = JSON.parse(readFileSync(resolve(geo, c.archivo), "utf-8"));
  const m = manifiesto.capas?.find((x) => x.id === c.id) ?? manifiesto.find?.((x) => x.id === c.id);
  const features = fc.features
    .filter((f) => vertices(f.geometry.coordinates).some(dentro))
    .map((f) => ({
      type: "Feature",
      geometry: { type: f.geometry.type, coordinates: redondear(f.geometry.coordinates) },
      properties: Object.fromEntries(c.props.map((p) => [p, f.properties[p] ?? null])),
    }));
  writeFileSync(resolve(pub, `${c.id}.geojson`), JSON.stringify({ type: "FeatureCollection", features }));
  capasSalida.push({
    id: c.id,
    etiqueta: c.etiqueta,
    tipo: c.tipo,
    archivo: `capas/${c.id}.geojson`,
    n: features.length,
    nota: c.nota ?? null,
    categoria: "DOCUMENTO DE REFERENCIA",
    fuente: m?.url?.split(" (")[0] ?? "",
    nombre_fuente: m?.nombre ?? c.etiqueta,
    licencia: m?.licencia ?? "",
    fecha_actualizacion: m?.fecha_descarga ?? "",
  });
}
// Relieve y departamentos: capas de planialtimetría (data/geo/relieve/, ver descargar_relieve.py) para el mapa operativo.
const mRc = manifiesto.capas?.find((x) => x.id === "relieve_cuenca");
const mRl = manifiesto.capas?.find((x) => x.id === "relieve_local");
const mDep = manifiesto.capas?.find((x) => x.id === "departamentos");
if (mRc && mRl) {
  const base = { categoria: "DOCUMENTO DE REFERENCIA", fecha_actualizacion: mRc.fecha_descarga, n: 0 };
  capasSalida.push(
    {
      ...base,
      id: "departamentos",
      etiqueta: "Departamentos de Formosa",
      tipo: "poligono",
      archivo: "relieve/departamentos.geojson",
      n: mDep?.n_features ?? 9,
      nota: "Límites del IGN, simplificados (~50 m).",
      fuente: mDep?.url?.split(" (")[0] ?? "",
      nombre_fuente: "IGN, Capas SIG (WFS ign:departamento)",
      licencia: mDep?.licencia ?? "IGN, datos abiertos",
      fecha_actualizacion: mDep?.fecha_descarga ?? base.fecha_actualizacion,
    },
    {
      ...base,
      id: "curvas_nivel",
      etiqueta: "Curvas de nivel",
      tipo: "curvas",
      archivo: "relieve/curvas_local.geojson",
      archivo_cuenca: "relieve/curvas_cuenca.geojson",
      n: 0,
      nota: `Corredor de los sectores: cada ${mRl.intervalo_curvas} sobre un DEM de ~75 m suavizado (error vertical de varios metros: muestran el gradiente regional, no cotas de inundación). Vista general: ${mRc.intervalo_curvas}.`,
      fuente: mRl.url,
      nombre_fuente: "AWS Terrain Tiles (terrarium), SRTM y otras fuentes",
      licencia: "AWS Terrain Tiles (SRTM y otras fuentes; ver data/geo/LEEME.md)",
    },
    {
      ...base,
      id: "relieve",
      etiqueta: "Relieve (tinte hipsométrico)",
      tipo: "relieve",
      archivo: "relieve/tinte_local_mercator.png",
      archivo_cuenca: "relieve/tinte_cuenca_mercator.png",
      bbox_local: mRl.bbox,
      bbox_cuenca: mRc.bbox,
      rampa_local: mRl.rampa,
      rampa_cuenca: mRc.rampa,
      nota: `Tinte local de ${mRl.elevacion_min_m} a ${mRl.elevacion_max_m} m (rampa propia: p2 a p98 = ${mRl.rampa_p2_p98_m.join(" a ")} m); fuera del corredor, tinte de la cuenca (${mRc.elevacion_min_m} a ${mRc.elevacion_max_m} m). Ruido del DEM ~${mRl.ruido_dem_m} m: no usar para cotas.`,
      fuente: mRl.url,
      nombre_fuente: "AWS Terrain Tiles (terrarium, z7 y z11)",
      licencia: "AWS Terrain Tiles (SRTM y otras fuentes; ver data/geo/LEEME.md)",
    },
  );
}
writeFileSync(resolve(pub, "capas.json"), JSON.stringify({ recorte: { oeste: W, sur: S, este: E, norte: N }, capas: capasSalida }, null, 1));
console.log(`public/capas: ${capasSalida.map((c) => `${c.id}=${c.n}`).join(", ")}`);

// --- Relieve (planialtimetría) de data/geo/relieve/ y límites de Formosa, para la landing y los mapas ---
// Salidas en public/relieve/ (se cargan por fetch, fuera del bundle inicial). Generado por
// apps/backend/scripts/descargar_relieve.py; aquí solo se copian (sin modificar) más los límites del IGN.
import { copyFileSync, existsSync, statSync } from "node:fs";
const rel = resolve(geo, "relieve");
const pubRel = resolve(aqui, "..", "public", "relieve");
mkdirSync(pubRel, { recursive: true });
const ARCHIVOS_RELIEVE = [
  "meta.json",
  "dem_cuenca_malla.json",
  "curvas_cuenca.geojson",
  "curvas_local.geojson",
  "rio_paraguay.geojson",
  "tinte_cuenca.png",
  "tinte_cuenca_mercator.png",
  "tinte_local_mercator.png",
];
if (ARCHIVOS_RELIEVE.every((a) => existsSync(resolve(rel, a)))) {
  for (const a of ARCHIVOS_RELIEVE) copyFileSync(resolve(rel, a), resolve(pubRel, a));
  for (const a of ["departamentos.geojson", "provincia.geojson"]) copyFileSync(resolve(geo, a), resolve(pubRel, a));
  const kb = (a) => `${a}=${Math.round(statSync(resolve(pubRel, a)).size / 1024)} KB`;
  console.log(`public/relieve: ${[...ARCHIVOS_RELIEVE, "departamentos.geojson", "provincia.geojson"].map(kb).join(", ")}`);
} else {
  console.warn("public/relieve: faltan archivos en data/geo/relieve/ (ejecutá apps/backend/scripts/descargar_relieve.py); se omite.");
}

// --- Contorno de la provincia de Formosa para avisar si una ubicación cae fuera (formularios de registro) ---
// Salida: public/capas/provincia_contorno.json (anillos exteriores simplificados a ~200 m; se carga bajo demanda).
const provGeo = JSON.parse(readFileSync(resolve(geo, "provincia.geojson"), "utf-8"));
// Douglas-Peucker (tolerancia ~0,002° ≈ 200 m): el aviso es orientativo, no un límite jurídico.
function simplificar(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1e-12;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplificar(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(pts.slice(idx), tol)];
}
const anillos = provGeo.features.flatMap((f) =>
  (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((poligono) => {
    const sal = [];
    for (const [x, y] of poligono[0]) {
      const p = [Number(x.toFixed(3)), Number(y.toFixed(3))];
      const u = sal[sal.length - 1];
      if (!u || u[0] !== p[0] || u[1] !== p[1]) sal.push(p);
    }
    // Anillo cerrado: se parte en dos por el punto más alejado del primero para no degenerar la recta base.
    const m = sal.reduce((k, p, i) => (Math.hypot(p[0] - sal[0][0], p[1] - sal[0][1]) > Math.hypot(sal[k][0] - sal[0][0], sal[k][1] - sal[0][1]) ? i : k), 0);
    return [...simplificar(sal.slice(0, m + 1), 0.002).slice(0, -1), ...simplificar(sal.slice(m), 0.002)];
  }),
);
writeFileSync(
  resolve(pub, "provincia_contorno.json"),
  JSON.stringify({
    categoria: "DOCUMENTO DE REFERENCIA",
    fuente: "IGN - Capas SIG (WFS), provincia de Formosa",
    fecha_descarga: provGeo.metadata?.fecha_descarga ?? "",
    nota: "Contorno simplificado (~200 m): solo sirve para avisar si un punto queda fuera de la provincia.",
    anillos,
  }),
);
console.log(`public/capas/provincia_contorno.json: ${Math.round(statSync(resolve(pub, "provincia_contorno.json")).size / 1024)} KB`);
