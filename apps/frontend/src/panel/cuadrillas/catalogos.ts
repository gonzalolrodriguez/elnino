import type { CuerpoIntegrante, GeometriaAviso, Plantillas, PlantillaOperativo, TipoAviso, TipoOperativo } from "../tipos";

/** Tipos de operativo: qué evacúa cada cuadrilla. Las descripciones son para quien arma la cuadrilla. */
export const TIPOS_OPERATIVO: { id: TipoOperativo; nombre: string; descripcion: string; incidente: "humana" | "ganadera" | "apicola" }[] = [
  { id: "personas", nombre: "Personas", descripcion: "Traslado de personas solas o en grupo desde un sector comprometido hacia un centro de recepción.", incidente: "humana" },
  { id: "familias", nombre: "Familias", descripcion: "Familias completas con niños, mayores y personas con necesidades de salud o de movilidad.", incidente: "humana" },
  { id: "productores_ganado", nombre: "Productores y ganado", descripcion: "Productores con su hacienda: arreo o traslado en camión jaula hasta un predio alto.", incidente: "ganadera" },
  { id: "apicola", nombre: "Apícola", descripcion: "Colmenas y material apícola, vivas o muertas, por camino vehicular o a pie.", incidente: "apicola" },
  { id: "bienes", nombre: "Bienes materiales", descripcion: "Enseres, maquinaria, granos e insumos que se resguardan en altura.", incidente: "humana" },
  { id: "traslado_mixto", nombre: "Traslado mixto", descripcion: "Personas, bienes y animales chicos en un mismo viaje.", incidente: "humana" },
];

export const etiquetaTipoOperativo = (id: string | null | undefined): string => TIPOS_OPERATIVO.find((t) => t.id === id)?.nombre ?? (id ? id.replace(/_/g, " ") : "");
export const incidenteDe = (t: TipoOperativo): string => TIPOS_OPERATIVO.find((x) => x.id === t)?.incidente ?? "humana";

export const PROFESIONES: Record<string, string> = {
  medicina: "Medicina",
  enfermeria: "Enfermería",
  veterinaria: "Veterinaria",
  zootecnia: "Zootecnia",
  trabajo_social: "Trabajo social",
  policia: "Policía",
  bomberos: "Bomberos",
  defensa_civil: "Defensa Civil",
  prefectura: "Prefectura",
  chofer: "Chofer",
  tecnico_energia: "Técnico de energía",
  logistica: "Logística",
  otra: "Otra",
};
export const etiquetaProfesion = (p: string | null | undefined): string => (p ? (PROFESIONES[p] ?? p.replace(/_/g, " ")) : "Sin profesión");

/** Respaldo cuando `GET /cuadrillas/plantillas` no responde. SUPUESTO: el servidor es la fuente (`supuestos.yaml`). */
export const PLANTILLAS_RESPALDO: Required<Plantillas> = {
  personas: { equipamiento: ["Chalecos salvavidas", "Botiquín", "Linternas", "Bidones de agua"], profesiones: ["medicina", "enfermeria", "defensa_civil", "chofer"] },
  familias: { equipamiento: ["Botiquín", "Bidones de agua", "Lonas", "Chalecos salvavidas", "Linternas"], profesiones: ["trabajo_social", "enfermeria", "defensa_civil", "chofer"] },
  productores_ganado: { equipamiento: ["Forraje", "Bebederos", "Mangas portátiles", "Jaulas", "Sogas", "Ruedas de auxilio", "Palas"], profesiones: ["veterinaria", "zootecnia", "chofer", "policia"] },
  apicola: { equipamiento: ["Lonas", "Sogas", "Ruedas de auxilio", "Botiquín"], profesiones: ["zootecnia", "chofer", "logistica"] },
  bienes: { equipamiento: ["Lonas", "Sogas", "Cadenas", "Ruedas de auxilio", "Palas", "Generador"], profesiones: ["logistica", "chofer", "tecnico_energia"] },
  traslado_mixto: { equipamiento: ["Ruedas de auxilio", "Palas", "Cadenas", "Sogas", "Chalecos salvavidas", "Botiquín", "Linternas"], profesiones: ["chofer", "defensa_civil", "medicina", "logistica"] },
};

const arreglo = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Acepta `{ plantillas: {...} }` o el objeto directo; lo que no reconoce cae al respaldo. */
export function normalizarPlantillas(crudo: unknown): Required<Plantillas> {
  const base = (crudo && typeof crudo === "object" && "plantillas" in crudo ? (crudo as { plantillas: unknown }).plantillas : crudo) as Record<string, unknown> | null;
  const salida = { ...PLANTILLAS_RESPALDO };
  if (!base || typeof base !== "object") return salida;
  for (const t of TIPOS_OPERATIVO) {
    const p = base[t.id] as Partial<PlantillaOperativo> | undefined;
    if (p && typeof p === "object") {
      const equipamiento = arreglo(p.equipamiento);
      const profesiones = arreglo(p.profesiones);
      salida[t.id] = {
        equipamiento: equipamiento.length ? equipamiento : PLANTILLAS_RESPALDO[t.id].equipamiento,
        profesiones: profesiones.length ? profesiones : PLANTILLAS_RESPALDO[t.id].profesiones,
      };
    }
  }
  return salida;
}

export const TIPOS_AVISO: { id: TipoAviso; nombre: string; ayuda: string }[] = [
  { id: "desvio", nombre: "Desvío de camino", ayuda: "Dibujá en el mapa el recorrido alternativo." },
  { id: "equipamiento", nombre: "Qué llevar", ayuda: "Lista de equipamiento que tiene que sumar la cuadrilla." },
  { id: "instruccion", nombre: "Instrucción", ayuda: "Una indicación del operativo para la cuadrilla." },
  { id: "seguridad", nombre: "Seguridad", ayuda: "Un riesgo en la zona. Podés marcar el punto en el mapa." },
];
export const etiquetaTipoAviso = (t: string): string => TIPOS_AVISO.find((x) => x.id === t)?.nombre ?? t;

/** Sugerencias de «Qué llevar» además del equipamiento de la cuadrilla. */
export const ITEMS_SUGERIDOS = ["Ruedas de auxilio", "Palas", "Cadenas", "Sogas", "Chalecos salvavidas", "Botiquín", "Forraje", "Lonas", "Linternas", "Bidones de agua"];

// ---------- Validación del alta y la edición ----------

export type FilaIntegrante = {
  clave: string;
  /** Id del integrante guardado; vacío en filas nuevas. */
  id: number | null;
  usuario_id: number | null;
  rol_operativo: string;
  profesion: string;
  es_encargado: boolean;
};

export type Borrador = {
  nombre: string;
  tipo_operativo: TipoOperativo | "";
  cantidad: number;
  vehiculo: string;
  notas: string;
  lat: string;
  lon: string;
  integrantes: FilaIntegrante[];
  equipamiento: string[];
};

export const MIN_INTEGRANTES = 1;
export const MAX_INTEGRANTES = 20;

export type Errores = Record<string, string>;

export function filaVacia(clave: string): FilaIntegrante {
  return { clave, id: null, usuario_id: null, rol_operativo: "", profesion: "", es_encargado: false };
}

/** Ajusta la cantidad de filas: agrega filas vacías o recorta desde el final. */
export function ajustarFilas(filas: FilaIntegrante[], cantidad: number, nuevaClave: () => string): FilaIntegrante[] {
  const n = Math.max(0, Math.min(MAX_INTEGRANTES, Math.trunc(cantidad)));
  if (filas.length === n) return filas;
  if (filas.length > n) return filas.slice(0, n);
  return [...filas, ...Array.from({ length: n - filas.length }, () => filaVacia(nuevaClave()))];
}

export function validarDatos(b: Borrador): Errores {
  const e: Errores = {};
  const nombre = b.nombre.trim();
  if (nombre.length < 2) e.nombre = "El nombre lleva al menos 2 letras.";
  else if (nombre.length > 80) e.nombre = "El nombre no puede superar los 80 caracteres.";
  if (!b.tipo_operativo) e.tipo_operativo = "Elegí el tipo de operativo.";
  if (!Number.isInteger(b.cantidad) || b.cantidad < MIN_INTEGRANTES || b.cantidad > MAX_INTEGRANTES) e.cantidad = `La cantidad va de ${MIN_INTEGRANTES} a ${MAX_INTEGRANTES} integrantes.`;
  const hayLat = b.lat.trim() !== "";
  const hayLon = b.lon.trim() !== "";
  if (hayLat !== hayLon) e.base = "Completá latitud y longitud, o dejá los dos vacíos.";
  else if (hayLat) {
    const la = Number(b.lat.replace(",", "."));
    const lo = Number(b.lon.replace(",", "."));
    if (!Number.isFinite(la) || la < -90 || la > 90 || !Number.isFinite(lo) || lo < -180 || lo > 180) e.base = "Las coordenadas no son válidas.";
  }
  if (b.notas.length > 500) e.notas = "Las notas no pueden superar los 500 caracteres.";
  return e;
}

/** Una fila por integrante, con rol y profesión, y exactamente un encargado. Claves: `fila-<clave>-rol`, `fila-<clave>-profesion`, `encargado`. */
export function validarIntegrantes(b: Borrador): Errores {
  const e: Errores = {};
  if (b.integrantes.length !== b.cantidad) e.cantidad = `Hay ${b.integrantes.length} filas y la cuadrilla declara ${b.cantidad} integrantes.`;
  b.integrantes.forEach((f) => {
    if (!f.rol_operativo) e[`fila-${f.clave}-rol`] = "Elegí el rol operativo.";
    if (!f.profesion) e[`fila-${f.clave}-profesion`] = "Elegí la profesión.";
  });
  const encargados = b.integrantes.filter((f) => f.es_encargado).length;
  if (encargados === 0) e.encargado = "Marcá quién es el encargado de la cuadrilla.";
  else if (encargados > 1) e.encargado = "Tiene que haber un solo encargado.";
  const cuentas = b.integrantes.filter((f) => f.usuario_id !== null).map((f) => f.usuario_id);
  if (new Set(cuentas).size !== cuentas.length) e.cuentas = "Una misma cuenta no puede ocupar dos lugares.";
  return e;
}

export function validarEquipamiento(b: Borrador): Errores {
  const e: Errores = {};
  const norm = b.equipamiento.map((x) => x.trim().toLowerCase());
  if (new Set(norm).size !== norm.length) e.equipamiento = "Hay equipamiento repetido.";
  else if (b.equipamiento.some((x) => x.trim().length > 60)) e.equipamiento = "Cada ítem admite hasta 60 caracteres.";
  return e;
}

export const hayErrores = (e: Errores): boolean => Object.keys(e).length > 0;

export function puntoDe(b: Pick<Borrador, "lat" | "lon">): { lat: number; lon: number } | null {
  if (b.lat.trim() === "" || b.lon.trim() === "") return null;
  return { lat: Number(b.lat.replace(",", ".")), lon: Number(b.lon.replace(",", ".")) };
}

export function integrantesDe(b: Borrador): CuerpoIntegrante[] {
  return b.integrantes.map((f) => ({ usuario_id: f.usuario_id, rol_operativo: f.rol_operativo, profesion: f.profesion, es_encargado: f.es_encargado }));
}

// ---------- Avisos ----------

export type ErroresAviso = { texto?: string; items?: string; geometria?: string };

export function validarAviso(a: { tipo: TipoAviso; texto: string; items: string[]; geometria: GeometriaAviso | null }): ErroresAviso {
  const e: ErroresAviso = {};
  const t = a.texto.trim();
  if (t.length < 3) e.texto = "Escribí el mensaje (al menos 3 letras).";
  else if (t.length > 500) e.texto = "El mensaje no puede superar los 500 caracteres.";
  if (a.tipo === "equipamiento" && a.items.length === 0) e.items = "Sumá al menos un ítem para llevar.";
  if (a.tipo === "desvio" && !a.geometria) e.geometria = "Dibujá el desvío en el mapa: al menos dos puntos, o un punto.";
  return e;
}

/** `[lon, lat][]` → geometría: un punto solo es `Point`; dos o más, `LineString`. */
export function geometriaDe(puntos: [number, number][]): GeometriaAviso | null {
  if (puntos.length === 0) return null;
  if (puntos.length === 1) return { type: "Point", coordinates: puntos[0] };
  return { type: "LineString", coordinates: puntos };
}
