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
  tipo?: string;
  datos?: Record<string, unknown> | null;
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
  intentos_fallidos?: number;
  bloqueado_hasta?: string | null;
};

export type CapaOficial = {
  id: string;
  etiqueta: string;
  tipo: "linea" | "punto" | "poligono" | "curvas" | "relieve";
  archivo: string;
  /** Capas de relieve: archivo de la cuenca (vista general), recuadros y rampas de color. */
  archivo_cuenca?: string;
  bbox_local?: [number, number, number, number];
  bbox_cuenca?: [number, number, number, number];
  rampa_local?: [number, string][];
  rampa_cuenca?: [number, string][];
  n: number;
  nota: string | null;
  categoria: Categoria;
  fuente: string;
  nombre_fuente: string;
  licencia: string;
  fecha_actualizacion: string;
};

/** Tableros de decisión: GET /panel/resumen y GET /admin/resumen (ver docs/contrato_api.md). */
export type BloqueResumen = { categoria: Categoria; fuente: string; fecha_dato: string | null };

export type TiempoAUmbral = { objetivo: string; valor_m: number; ya_alcanzado: boolean; dias_minimo: number | null; dias_maximo: number | null };

export type ResumenRio = BloqueResumen & {
  disponible: boolean;
  altura_m?: number;
  fecha_lectura?: string;
  umbral_alerta_m?: number;
  umbral_evacuacion_m?: number;
  distancia_a_alerta_m?: number;
  distancia_a_evacuacion_m?: number;
  tendencia_7d_m?: number | null;
  tendencia_7d_m_por_dia?: number | null;
  tiempo_a_umbrales?: TiempoAUmbral[];
  supuesto_proyeccion?: string;
  categoria_proyeccion?: Categoria;
};

export type ResumenSector = {
  id: string;
  nombre: string;
  estado: EstadoSector;
  aislado: boolean;
  margen_a_compromiso_m: number;
  altura_compromiso_m: number;
  personas_k10: number;
  personas_registradas: number;
  familias_registradas: number;
  animales_expuestos: number;
  colmenas: number;
  accesos: { nombre: string; superficie: string; estado: EstadoAcceso }[];
  centro_sugerido: {
    personas: { id: number; nombre: string; tipo: string; distancia_linea_recta_m: number } | null;
    animales: { id: number; nombre: string; tipo: string; distancia_linea_recta_m: number } | null;
    nota: string;
  } | null;
};

export type ResumenCentro = {
  id: number;
  nombre: string;
  tipo: string;
  capacidad_personas: number;
  capacidad_animales: number;
  ocupacion: number;
  ocupacion_pct: number | null;
};

export type ResumenCuadrilla = {
  id: number;
  nombre: string;
  tipo_incidente: string;
  estado: string;
  tareas: Record<string, number>;
};

export type EstadoEvacuacion = "pendiente" | "en_curso" | "cerrada_cuadrilla" | "verificada" | "con_discrepancia";

export type ResumenEvacuaciones = BloqueResumen & {
  total?: number;
  por_estado: Partial<Record<EstadoEvacuacion, number>>;
  por_sector?: Record<string, Partial<Record<EstadoEvacuacion, number>>>;
  verificadas_pct?: number | null;
  discrepancias_abiertas?: number;
  personas_trasladadas?: number;
  animales_trasladados?: Record<string, number>;
  animales_trasladados_total?: number;
  distancia_max_destino_m?: number;
};

export type ResumenPanel = {
  generado_en: string;
  leyenda: string;
  categoria: Categoria;
  fuente: string;
  fecha_dato: string;
  rio: ResumenRio;
  sectores: BloqueResumen & { altura_usada_m: number; items: ResumenSector[] };
  solicitudes: BloqueResumen & {
    total: number;
    por_estado: Record<string, number>;
    por_sector: Record<string, number>;
    por_origen: Record<string, number>;
    recibidas_mas_antigua_min: number | null;
    a_verificar: number;
  };
  centros: BloqueResumen & { items: ResumenCentro[] };
  cuadrillas: BloqueResumen & { items: ResumenCuadrilla[]; tareas_sin_cuadrilla: number };
  ordenes: BloqueResumen & {
    recientes: { id: number; tipo: TipoOrden; sectores: string[]; emitida_por_rol: string | null; creada_en: string }[];
    bitacora_borradores: number;
  };
  lluvia_7d: BloqueResumen & {
    desde: string;
    sin_dato_observado: boolean;
    por_origen: Record<string, { lecturas: number; mm_total: number; sin_medicion: number; categoria: Categoria }>;
  };
  frescura: { rio_ultima_lectura: string | null; k10_sectores: string | null; lluvia_ultima_lectura: string | null; fecha_corte: string };
  evacuaciones?: ResumenEvacuaciones;
};

export type ResumenAdmin = BloqueResumen & {
  generado_en: string;
  usuarios: {
    total: number;
    por_rol: Record<string, number>;
    por_estado: Record<string, number>;
    sin_login_30_dias: number;
    cuentas_bloqueadas: number;
    intentos_fallidos_en_curso: number;
    bloqueos: { usuario_id: number | null; ip: string | null; bloqueado_hasta: string }[];
  };
  auditoria: { cadena_integra: boolean; primera_fila_inconsistente: number | null; filas: number };
  servicio: { base_de_datos: string; websockets_activos: number; version: string };
};

/** Constancias de evacuación (ver docs/contrato_api.md, "Constancias de evacuación"). */
export type MotivoDiscrepancia = "evacuado_dice_no" | "evacuado_reporta_problema" | "destino_lejos_del_centro";

export type Constancia = {
  id: number;
  rol_operativo: string | null;
  destino: { lat: number; lon: number; centro_id: number | null; centro_nombre: string | null; distancia_a_centro_m: number | null };
  personas_trasladadas: number;
  animales_trasladados: Record<string, number>;
  nota: string | null;
  adjuntos: { n: number; mime: string; bytes: number }[];
  creada_en: string;
};

export type ConfirmacionEvacuado = {
  respuesta: "si" | "no" | "problema";
  canal: string;
  comentario: string | null;
  solicitada_en: string;
  respondida_en: string | null;
};

export type Evacuacion = {
  tarea_id: number;
  tarea_estado: string;
  estado: EstadoEvacuacion;
  titulo: string;
  sector_id: string | null;
  cuadrilla_id: number | null;
  cuadrilla_nombre: string | null;
  solicitud_id: number | null;
  orden_id: number | null;
  origen: { lat: number; lon: number; tipo: "solicitud" | "sector" } | null;
  constancia: Constancia | null;
  confirmacion: ConfirmacionEvacuado | null;
  discrepancia: { motivos: MotivoDiscrepancia[] } | null;
  actualizado_en: string;
  categoria: Categoria;
  fuente: string;
};

export type ListaEvacuaciones = { evacuaciones: Evacuacion[]; total: number; limite: number; offset: number; categoria: Categoria; fuente: string; fecha_dato: string };

export type CierreEvacuacion = {
  lat: number;
  lon: number;
  centro_id?: number;
  personas_trasladadas: number;
  animales_trasladados: Record<string, number>;
  nota?: string;
};

export type ConsultaConfirmacion = {
  id: number;
  tarea_id: number;
  solicitud_id: number | null;
  codigo: string;
  centro_nombre: string | null;
  respondida: boolean;
  respuesta: "si" | "no" | "problema" | null;
  comentario: string | null;
  solicitada_en: string;
  respondida_en: string | null;
};

/** Un pedido propio con tarea en curso (`GET /mi/seguimiento`). La cuadrilla se identifica por tipo y roles, nunca por personas. */
export type SeguimientoCuadrilla = {
  solicitud_id: number;
  tarea_id: number;
  tipo_cuadrilla: string;
  roles: string[];
  estado: "en_camino" | "asignada_sin_posicion";
  posicion: { lat: number; lon: number; precision_m: number | null } | null;
  actualizada_en: string | null;
  posicion_vieja: boolean | null;
  distancia_m: number | null;
  llegada_estimada_min: number | null;
  categoria: string;
  supuestos: { factor_desvio: number; velocidad_cuadrilla_kmh: number; posicion_vieja_minutos: number };
  nota: string;
};

export type RespuestaSeguimiento = { seguimientos: SeguimientoCuadrilla[]; categoria: string; fuente: string; fecha_dato: string };

/** Última posición de una cuadrilla con tarea en curso (`GET /cuadrillas/posiciones`, solo roles operativos). */
export type PosicionCuadrilla = {
  cuadrilla_id: number;
  nombre: string;
  tipo_incidente: string;
  roles: string[];
  lat: number;
  lon: number;
  precision_m: number | null;
  actualizada_en: string;
  posicion_vieja: boolean;
  tareas_en_curso: number;
  categoria: string;
};

export type RespuestaPosiciones = {
  posiciones: PosicionCuadrilla[];
  categoria: string;
  fuente: string;
  fecha_dato: string;
  supuestos: { factor_desvio: number; velocidad_cuadrilla_kmh: number; posicion_vieja_minutos: number };
};
