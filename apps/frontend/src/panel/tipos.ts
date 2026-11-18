import type { Categoria, EstadoAcceso, EstadoSector, EstadoSolicitud, EstadoTarea, PerfilRuteo, TipoOrden } from "@evacuaciones/shared";

/** Tipos de las respuestas del backend usadas por el panel (ver docs/contrato_api.md). */

export type OrigenLluvia = "simulado" | "manual" | "parte_policial" | "planilla_upca";

export type EntradaEscenario = {
  altura_formosa_m: number;
  lluvia_mm: number;
  lluvia_origen: OrigenLluvia;
  caminos_cerrados: number[];
};

export type RioEstado = {
  estado: "normal" | "alerta" | "evacuacion";
  altura_m: number;
  distancia_a_alerta_m: number;
  distancia_a_evacuacion_m: number;
};

export type AccesoEscenario = { id: number; nombre: string; superficie: string; estado: EstadoAcceso; motivo: string | null };

export type SectorEscenario = {
  id: string;
  nombre: string;
  estado: EstadoSector;
  aislado: boolean;
  altura_compromiso_m: number;
  margen_a_compromiso_m: number;
  poblacion_simulada: number;
  accesos: AccesoEscenario[];
  isad: { valor: number; categoria: string } | null;
  categoria: Categoria;
};

export type Escenario = {
  rio: RioEstado;
  sectores: SectorEscenario[];
  resumen: { comprometidos: string[]; en_riesgo: string[]; normales: string[]; aislados: string[] };
  lluvia: { mm: number; origen: OrigenLluvia; categoria: Categoria };
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
};

export type Umbrales = { aguas_bajas_m: number; alerta_m: number; evacuacion_m: number; categoria: Categoria; fuente: string };

export type SerieFormosa = {
  umbrales: Umbrales;
  picos: { anio: number; altura_m: number; fecha: string }[];
  maximo: { altura_m: number; fecha: string } | null;
  ultima: { fecha: string; altura_m: number } | null;
  n: number;
  puntos: { fecha: string; altura_max_m: number }[];
  notas: string[];
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
};

export type TiempoRestante = {
  objetivo: string;
  valor_m: number;
  categoria_del_umbral: Categoria;
  ya_alcanzado: boolean;
  dias_minimo: number | null;
  dias_maximo: number | null;
};

export type Ascenso = {
  altura_actual_m: number;
  fecha_altura: string | null;
  periodos: {
    periodo: string;
    mayor_suba_1d: { metros: number; fecha: string } | null;
    mayor_suba_7d: { metros: number; fecha: string } | null;
    cruces: Record<string, string | null>;
  }[];
  tasas_m_dia: Record<string, number>;
  tiempo_restante: TiempoRestante[];
  supuesto: string;
  horizonte_pronostico_oficial_dias: number;
  categoria_proyeccion: Categoria;
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
};

export type Lectura = {
  id: number;
  puesto: string;
  puesto_nombre: string;
  zona: string | null;
  fecha: string;
  turno: string;
  mm: number | null;
  origen: string;
  categoria: Categoria;
  fuente: string;
  advertencias?: string[];
};

export type Lluvia = { lecturas: Lectura[]; n: number; sin_dato_observado: boolean; nota: string };
export type Puesto = { codigo: string; nombre: string; zona: string | null };

export type GeoFeature = { type: "Feature"; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
export type Geo = { type: "FeatureCollection"; features: GeoFeature[]; metadata?: Record<string, unknown> };

export type AccesoProps = {
  id: number;
  sector_id: string | null;
  nombre: string;
  superficie: string;
  transitable: boolean;
  motivo: string | null;
  actualizado_en: string;
  actualizado_por_rol: string | null;
};

export type Centro = {
  id: number;
  nombre: string;
  tipo: string;
  lon: number;
  lat: number;
  sector_id: string | null;
  capacidad_personas: number;
  capacidad_animales: number;
  ocupacion: number;
  cupo_libre_personas: number;
  servicios: string[] | null;
  nota: string | null;
  categoria: Categoria;
};

export type Estacion = {
  codigo: number;
  clave: string;
  nombre: string;
  rio: string;
  lon: number;
  lat: number;
  alerta_m: number;
  evacuacion_m: number;
  categoria: Categoria;
  fecha_dato: string;
};

export type Ruta = {
  perfil: PerfilRuteo;
  encontrada: boolean;
  metodo: "pgrouting" | "aproximado";
  limitacion: string | null;
  motivo?: string;
  distancia_m?: number;
  tiempo_min?: number;
  geometria: { type: string; coordinates: unknown } | null;
  advertencias: string[];
  origen: { lon: number; lat: number; sector_id: string | null };
  destino: { lon: number; lat: number };
  categoria: Categoria;
};

export type Metricas = {
  personas_a_evacuar: number;
  personas_evacuadas: number;
  personas_sin_lugar: number;
  animales_a_trasladar: number;
  animales_con_cupo: number;
  animales_sin_cupo: number;
  viajes_por_vehiculo: Record<string, number>;
  camiones_jaula_necesarios: number;
  tiempo_primer_sector_min: number | null;
  tiempo_total_min: number | null;
  accesos_vulnerables_usados: string[];
  faltantes: Record<string, unknown>;
};

export type PlanSector = {
  id: string;
  nombre: string;
  prioridad: number;
  estado: EstadoSector;
  aislado: boolean;
  poblacion: { familias_registradas: number; personas_registradas: number; total_estimada: number; nota?: string };
  produccion: { establecimientos: { id: number; nombre: string }[]; bovinos: number; colmenas: number };
  ventana: {
    ya_comprometido: boolean;
    dias_hasta_compromiso_minimo: number | null;
    dias_hasta_compromiso_maximo: number | null;
    supuesto: string;
  } & Record<string, unknown>;
  traslado_personas: { vehiculo: string; superficie_acceso: string; viajes: number };
  asignacion_personas: { centro_id: number; centro: string; cantidad: number }[];
  personas_sin_lugar: number;
  asignacion_animales: { centro_id: number; centro: string; cantidad: number }[];
  animales_sin_cupo: number;
  camiones_jaula: number;
  cuadrillas_sugeridas: { tipo: string; roles: string[] }[];
  advertencias: string[];
};

export type Plan = {
  orden_sectores: string[];
  centros_excluidos: number[];
  metricas: Metricas;
  sectores: PlanSector[];
};

export type Recomendacion = {
  etiqueta: string;
  entrada: Record<string, unknown>;
  escenario: { rio: RioEstado; resumen: Escenario["resumen"] };
  recomendacion: Plan;
  limites: string[];
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
};

export type Alternativa = Plan & { id: number; tipo: string; nombre: string; parametros: Record<string, unknown> };
export type Alternativas = {
  etiqueta: string;
  alternativas: Alternativa[];
  comparacion: { metrica: string; etiqueta: string; valores: unknown[] }[];
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
};

export type CalculoGanadero = {
  dormidero: { m2_necesarios: number; superficie_albardon_m2: number | null; alcanza: boolean | null; faltante_m2: number | null; divisiones_internas: boolean };
  transporte: { camiones_jaula: number; bovinos_por_camion: number; camion_con_divisiones: boolean; vehiculos_categoria_b: number; nota: string };
  lote_maximo_cabezas: number;
  racion_diaria: { maiz_kg: number; pellet_girasol_kg: number };
  apicultura: { recomendacion: string; colmenas_vivas: number; colmenas_muertas: number } | null;
  checklist_destino: string[];
  advertencias: string[];
  supuestos: Record<string, unknown>;
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
};

export type Cuadrilla = {
  id: number;
  nombre: string;
  tipo_incidente: string;
  estado: string;
  integrantes: { rol_operativo: string; usuario_id: number | null }[];
  roles_faltantes: string[];
};

export type Tarea = {
  id: number;
  cuadrilla_id: number | null;
  solicitud_id: number | null;
  orden_id: number | null;
  sector_id: string | null;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  checklist?: { item: string; hecho: boolean }[] | null;
  creado_en: string;
  actualizado_en?: string;
};

export type Notificacion = {
  id: number;
  orden_id: number | null;
  mensaje: string;
  leida: boolean;
  creada_en: string;
};

export type Solicitud = {
  id: number;
  origen: string;
  tipo: string;
  personas: number;
  animales: number;
  texto: string | null;
  estado: EstadoSolicitud;
  sector_id: string | null;
  creado_en: string;
};

export type Orden = {
  id: number;
  tipo: TipoOrden;
  sectores: string[];
  emitida_por_rol: string | null;
  fundamento: string;
  creada_en: string;
  notificaciones_creadas?: number;
  tareas_creadas?: number;
  bitacora_borrador_id?: number | null;
};

export type CamposBitacora = {
  decision: string;
  evidencia: string;
  limites: string;
  riesgos: string;
  gatillos: string;
  fecha_simulada: string;
  responsable_rol?: string | null;
};

export type EntradaBitacora = CamposBitacora & {
  id: number;
  estado: "borrador" | "completa";
  responsable_rol: string | null;
  orden_id: number | null;
  creada_en: string;
};

export type AfirmacionK6 = { id: string; afirmacion: string; veredicto: string; evidencia: string; fuente: string; categoria: Categoria };
export type RelacionK7 = {
  id: string;
  relacion: string;
  veredicto: string;
  correccion: string;
  fuente: string;
  verificado_con: string;
  categoria: Categoria;
  evidencia_cartografica?: string | null;
};

export type UsuarioAdmin = {
  id: number;
  email: string;
  nombre_visible: string;
  rol: string;
  rol_operativo: string | null;
  estado: string;
  ultimo_login: string | null;
};

export type CapaOficial = {
  id: string;
  etiqueta: string;
  tipo: "linea" | "punto";
  archivo: string;
  n: number;
  nota: string | null;
  categoria: Categoria;
  fuente: string;
  nombre_fuente: string;
  licencia: string;
  fecha_actualizacion: string;
};
