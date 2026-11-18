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
