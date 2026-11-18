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
writeFileSync(resolve(pub, "capas.json"), JSON.stringify({ recorte: { oeste: W, sur: S, este: E, norte: N }, capas: capasSalida }, null, 1));
console.log(`public/capas: ${capasSalida.map((c) => `${c.id}=${c.n}`).join(", ")}`);
