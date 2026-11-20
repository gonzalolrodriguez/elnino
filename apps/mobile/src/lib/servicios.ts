import { Image } from "react-native";

import { ErrorApi, peticion } from "@/lib/api";
import { canonicaRespuesta } from "@/lib/respuestas";
import { esCierre, esConfirmacion, esParte, type DatosCierre, type DatosCola, type DatosConfirmacion, type DatosParte, type DatosSolicitud, type ResultadoEnvio, type ResultadoFoto } from "@/lib/cola";
import { cuerpoParte, type ParteTarea } from "@/lib/partes";

export type { ParteTarea, ResultadoParte, TipoParte } from "@/lib/partes";

/** Tipos de las respuestas de la API que consume la app (contrato: docs/contrato_api.md). */
export type Categoria = "DATO OBSERVADO" | "DOCUMENTO DE REFERENCIA" | "SIMULADO";

export type Solicitud = {
  id: number;
  origen: string;
  tipo: string;
  personas: number;
  animales: number;
  texto: string | null;
  estado: "recibida" | "verificada" | "asignada" | "en_curso" | "resuelta";
  sector_id: string | null;
  creado_en: string;
  actualizado_en: string;
  categoria: Categoria;
  /** Ausentes en backends anteriores: se tratan como `false` / `null`. */
  ubicacion_aproximada?: boolean;
  referencia_ubicacion?: string | null;
  requiere_verificacion?: boolean;
};

/** Datos de la notificación `confirmacion_evacuacion` (`GET /mi/notificaciones`). */
export type DatosConfirmacionEvacuacion = {
  tarea_id: number;
  solicitud_id: number;
  codigo: string;
  centro_nombre: string | null;
  respuestas: string[];
};

export type Notificacion = {
  id: number;
  orden_id: number | null;
  /** `orden`, `confirmacion_evacuacion` o `discrepancia`; ausente en backends anteriores. */
  tipo?: string;
  datos?: Record<string, unknown> | null;
  mensaje: string;
  leida: boolean;
  creada_en: string;
};

/** Respuestas canónicas de `POST /mi/confirmaciones` (contrato del panel ciudadano). */
export type RespuestaCanonica = "completa" | "parcial" | "no_encontraron" | "no_vinieron" | "otro_problema";

/** Valores viejos (SMS, cola guardada antes de esta versión, datos previos): el servidor los sigue aceptando. */
export type RespuestaLegada = "si" | "no" | "problema";

export type RespuestaEvacuado = RespuestaCanonica | RespuestaLegada;

/** Consulta de confirmación propia (`GET /mi/confirmaciones`); nunca trae ubicaciones. */
export type ConsultaConfirmacion = {
  id: number;
  tarea_id: number;
  solicitud_id: number;
  codigo: string;
  centro_nombre: string | null;
  respondida: boolean;
  respuesta: RespuestaEvacuado | null;
  comentario: string | null;
  solicitada_en: string;
  respondida_en: string | null;
};

/** Un pedido propio con tarea en curso (`GET /mi/seguimiento`). La cuadrilla se identifica por tipo y roles. */
export type SeguimientoCuadrilla = {
  solicitud_id: number;
  tarea_id: number;
  tipo_cuadrilla: string;
  roles: string[];
  estado: "en_camino" | "asignada_sin_posicion";
  actualizada_en: string | null;
  posicion_vieja: boolean | null;
  distancia_m: number | null;
  llegada_estimada_min: number | null;
  categoria: Categoria;
  supuestos: { factor_desvio: number; velocidad_cuadrilla_kmh: number; posicion_vieja_minutos: number };
};

export type VehiculoCuadrilla = "4x4" | "camion_jaula" | "colectivo" | "lancha" | "moto";

/** Un pedido propio con su recorrido (`GET /mi/pedidos`). Sin nombres de personas: la cuadrilla va por rol y tipo. */
export type PedidoCiudadano = {
  id: number;
  tipo: string;
  personas: number;
  estado: Solicitud["estado"];
  origen: string;
  creada_en: string;
  lat: number | null;
  lon: number | null;
  sector_id: string | null;
  linea_tiempo: { estado: Solicitud["estado"]; en: string | null }[];
  tarea: null | {
    id: number;
    estado: string;
    cuadrilla: { id: number; tipo_incidente: string; rol_encargado: string | null; vehiculo: VehiculoCuadrilla | string | null };
    iniciada_en: string | null;
    cerrada_en: string | null;
  };
  seguimiento: SeguimientoCuadrilla | null;
  confirmacion: null | { solicitud_id: number; respondida: boolean; respuesta: RespuestaEvacuado | null; comentario: string | null };
  centro: null | { id: number; nombre: string; lat: number | null; lon: number | null };
  /** Última novedad de la cuadrilla, sin el texto de la observación. Ausente en backends anteriores. */
  novedad?: null | { tipo: "demora" | "dificultad" | "parcial" | "no_realizada" | "reprogramada"; en: string | null };
};

export type GrupoFamiliar = {
  integrantes: number;
  menores: number;
  mayores: number;
  mascotas: number;
  telefono?: string | null;
  /** La app no los edita, pero se reenvían intactos para no borrarlos al guardar. */
  salud?: string | null;
  vulnerabilidad?: string | null;
  lon: number | null;
  lat: number | null;
  sector_id: string | null;
};

export type ItemStock = { especie: string; categoria_animal: string; cantidad: number };

export type Establecimiento = {
  id: number;
  nombre: string;
  renspa: string | null;
  lon: number;
  lat: number;
  sector_id: string | null;
  stock: ItemStock[];
};

export type AccesoSector = { nombre: string; superficie: string; estado: string };

export type SectorPropio = {
  id: string;
  nombre: string;
  estado: "normal" | "en_riesgo" | "comprometido";
  aislado: boolean;
  altura_compromiso_m: number;
  margen_a_compromiso_m: number;
  accesos: AccesoSector[];
  alertas: { orden_id: number; tipo: string; fundamento: string; creada_en: string }[];
  categoria: Categoria;
  fuente: string;
  /** GeoJSON Polygon (EPSG:4326, K10 sin cambios). Ausente en backends anteriores. */
  geometria?: { type: string; coordinates: number[][][] } | null;
};

export type CentroSugerido = {
  id: number;
  nombre: string;
  tipo: string;
  distancia_linea_recta_m: number;
  lon?: number | null;
  lat?: number | null;
  categoria: Categoria;
};

export type MiSector = {
  sectores: SectorPropio[];
  altura_referencia: { altura_m: number; fecha: string; categoria: Categoria; fuente: string };
  centro_asignado: {
    personas: CentroSugerido | null;
    animales: CentroSugerido | null;
    nota: string;
  } | null;
  nota: string;
};

export type Centro = {
  id: number;
  nombre: string;
  tipo: string;
  lon: number;
  lat: number;
  sector_id: string | null;
  capacidad_personas: number;
  cupo_libre_personas: number;
  categoria: Categoria;
};

export type ItemChecklist = { item: string; hecho: boolean };

export type Tarea = {
  id: number;
  titulo: string;
  descripcion: string | null;
  estado: "pendiente" | "en_curso" | "completada" | "cancelada";
  sector_id: string | null;
  checklist: ItemChecklist[] | null;
  actualizado_en: string;
  /** Una tarea que volvió a `pendiente` tras un parte parcial, no realizado o reprogramado. */
  requiere_atencion?: boolean;
  ultimo_parte?: ParteTarea | null;
};

/** Bloque común del resumen del panel: cada bloque trae su categoría, fuente y fecha. */
type BloquePanel = { categoria: Categoria; fuente: string; fecha_dato: string | null };

export type TiempoAUmbral = {
  objetivo: string;
  valor_m: number;
  ya_alcanzado: boolean;
  dias_minimo: number | null;
  dias_maximo: number | null;
};

export type RioPanel = BloquePanel & {
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

export type SectorPanel = {
  id: string;
  nombre: string;
  estado: "normal" | "en_riesgo" | "comprometido";
  aislado: boolean;
  margen_a_compromiso_m: number;
  personas_k10?: number;
  personas_registradas?: number;
  animales_expuestos?: number;
  accesos: AccesoSector[];
};

export type CentroPanel = {
  nombre: string;
  capacidad_personas: number | null;
  ocupacion: number | null;
  ocupacion_pct: number | null;
};

export type CuadrillaPanel = {
  nombre: string;
  estado: string;
  tareas: Partial<Record<"pendiente" | "en_curso" | "completada" | "cancelada", number>>;
};

export type EvacuacionesPanel = BloquePanel & {
  total?: number;
  por_estado?: Record<string, number>;
  verificadas_pct?: number;
  discrepancias_abiertas?: number;
  personas_trasladadas?: number;
  animales_trasladados?: Record<string, number>;
  animales_trasladados_total?: number;
};

/** `GET /panel/resumen` (mandos). Todo lo que no es el río ni los sectores puede faltar. */
export type PanelResumen = {
  generado_en?: string;
  rio: RioPanel;
  sectores: BloquePanel & { items: SectorPanel[] };
  solicitudes: BloquePanel & {
    total: number;
    por_estado: Record<string, number>;
    a_verificar?: number;
    recibidas_mas_antigua_min?: number | null;
  };
  centros: BloquePanel & { items: CentroPanel[] };
  cuadrillas?: BloquePanel & { items: CuadrillaPanel[] };
  frescura?: {
    rio_ultima_lectura?: string | null;
    k10_sectores?: string | null;
    lluvia_ultima_lectura?: string | null;
    fecha_corte?: string | null;
  };
  /** Bloque de evacuaciones (constancias): se muestra solo si el backend lo envía. */
  evacuaciones?: EvacuacionesPanel | null;
  categoria: Categoria;
  fuente: string;
  fecha_dato: string | null;
};

export type GeoSectores = {
  features: {
    geometry: { type: string; coordinates: number[][][] };
    properties: { id: string; nombre: string; categoria: Categoria };
  }[];
};

type Falla = { ok: false; tipo: "red" | "sesion" | "rechazo"; mensaje: string };

/** Traduce un error de la API al vocabulario de la cola: reintentable, sesión o rechazo definitivo. */
function clasificar(e: unknown): Falla {
  if (e instanceof ErrorApi) {
    if (e.esRed || e.estado >= 500 || e.estado === 429) return { ok: false, tipo: "red", mensaje: e.message };
    if (e.estado === 401) return { ok: false, tipo: "sesion", mensaje: e.message };
    return { ok: false, tipo: "rechazo", mensaje: e.message };
  }
  return { ok: false, tipo: "red", mensaje: "Error inesperado" };
}

/**
 * Primer tiempo del envío. La cabecera `Idempotency-Key` hace que un reintento tras una respuesta
 * perdida devuelva la solicitud original (200) en lugar de duplicarla.
 */
export async function enviarSolicitud(
  datos: DatosSolicitud,
  claveIdempotencia: string,
): Promise<ResultadoEnvio> {
  try {
    const s = await peticion<Solicitud>("/solicitudes", {
      metodo: "POST",
      cuerpo: datos,
      cabeceras: { "Idempotency-Key": claveIdempotencia },
    });
    return { ok: true, servidorId: s.id };
  } catch (e) {
    return clasificar(e);
  }
}

type RespuestaCierre = {
  evacuacion?: { estado: string; motivos_discrepancia?: string[]; confirmacion_solicitada?: boolean };
  repetida?: boolean;
};

/** Cuerpo de `POST /tareas/{id}/cierre`: solo los campos del contrato (el backend prohíbe extras). */
export function cuerpoCierre(d: DatosCierre): Record<string, unknown> {
  return {
    lat: d.lat,
    lon: d.lon,
    ...(d.centro_id ? { centro_id: d.centro_id } : {}),
    personas_trasladadas: d.personas_trasladadas,
    animales_trasladados: d.animales_trasladados,
    ...(d.nota ? { nota: d.nota } : {}),
  };
}

/** Cierre con constancia: la `Idempotency-Key` es obligatoria y se conserva en los reintentos. */
export async function enviarCierre(datos: DatosCierre, clave: string): Promise<ResultadoEnvio> {
  try {
    const r = await peticion<RespuestaCierre>(`/tareas/${datos.tarea_id}/cierre`, {
      metodo: "POST",
      cuerpo: cuerpoCierre(datos),
      cabeceras: { "Idempotency-Key": clave },
    });
    return {
      ok: true,
      servidorId: datos.tarea_id,
      resultado: {
        estado: r.evacuacion?.estado ?? "cerrada_cuadrilla",
        motivos_discrepancia: r.evacuacion?.motivos_discrepancia ?? [],
        confirmacion_solicitada: r.evacuacion?.confirmacion_solicitada ?? false,
        repetida: Boolean(r.repetida),
      },
    };
  } catch (e) {
    return clasificar(e);
  }
}

/**
 * Parte de la cuadrilla. Un 409 («Cerrá la tarea con constancia») es un rechazo definitivo: la pantalla
 * lo traduce en abrir el cierre con constancia. La `Idempotency-Key` acompaña los reintentos.
 */
export async function enviarParte(datos: DatosParte, clave: string): Promise<ResultadoEnvio> {
  try {
    const p = await peticion<{ id: number }>(`/tareas/${datos.tarea_id}/partes`, {
      metodo: "POST",
      cuerpo: cuerpoParte(datos),
      cabeceras: { "Idempotency-Key": clave },
    });
    return { ok: true, servidorId: p.id };
  } catch (e) {
    return clasificar(e);
  }
}

/** Respuesta del evacuado: 201 la primera vez, 200 repetida; otra respuesta distinta da 409 (rechazo). */
export async function enviarConfirmacion(datos: DatosConfirmacion): Promise<ResultadoEnvio> {
  try {
    const r = await peticion<{ id: number; repetida?: boolean }>("/mi/confirmaciones", {
      metodo: "POST",
      cuerpo: {
        solicitud_id: datos.solicitud_id,
        respuesta: canonicaRespuesta(datos.respuesta),
        ...(datos.comentario ? { comentario: datos.comentario } : {}),
      },
    });
    return { ok: true, servidorId: r.id, resultado: { repetida: Boolean(r.repetida) } };
  } catch (e) {
    return clasificar(e);
  }
}

/** Despacha el primer tiempo según la clase del ítem de la cola. */
export function enviarItem(datos: DatosCola, clave: string): Promise<ResultadoEnvio> {
  if (esCierre(datos)) return enviarCierre(datos, clave);
  if (esConfirmacion(datos)) return enviarConfirmacion(datos);
  if (esParte(datos)) return enviarParte(datos, clave);
  return enviarSolicitud(datos, clave);
}

/**
 * `true` si la imagen local todavía existe. `Image.getSize` solo lee el archivo (sin red): rechaza
 * enseguida si el sistema borró la caché o el archivo se movió.
 */
export function archivoExiste(uri: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      Image.getSize(
        uri,
        () => resolve(true),
        () => resolve(false),
      );
    } catch {
      resolve(false);
    }
  });
}

/**
 * Segundo tiempo: sube la foto ya comprimida (JPEG) como adjunto de la solicitud. Si el envío falla
 * por red y la foto ya no está en el teléfono, se informa como rechazo definitivo (la solicitud ya
 * llegó): si no, el fallo de `fetch` pasaría por caída de red y se reintentaría para siempre,
 * bloqueando a las solicitudes que siguen en la cola.
 */
export async function subirFotoSolicitud(servidorId: number, fotoUri: string): Promise<ResultadoFoto> {
  return subirFotoA(`/solicitudes/${servidorId}/adjuntos`, fotoUri);
}

/** Despacha la subida de la foto: a la solicitud o a la constancia del cierre (`servidorId` = tarea). */
export function subirFotoItem(servidorId: number, fotoUri: string, datos: DatosCola): Promise<ResultadoFoto> {
  return subirFotoA(esCierre(datos) ? `/tareas/${servidorId}/cierre/adjuntos` : `/solicitudes/${servidorId}/adjuntos`, fotoUri);
}

async function subirFotoA(ruta: string, fotoUri: string): Promise<ResultadoFoto> {
  try {
    const form = new FormData();
    // En React Native un archivo local se adjunta como { uri, name, type }.
    form.append("archivo", { uri: fotoUri, name: "foto.jpg", type: "image/jpeg" } as unknown as Blob);
    await peticion<unknown>(ruta, { metodo: "POST", cuerpo: form });
    return { ok: true };
  } catch (e) {
    const falla = clasificar(e);
    if (falla.tipo === "red" && !(await archivoExiste(fotoUri))) {
      return { ok: false, tipo: "rechazo", mensaje: "la foto ya no está en el teléfono" };
    }
    return falla;
  }
}

export const api = {
  solicitudes: () => peticion<{ solicitudes: Solicitud[] }>("/solicitudes"),
  notificaciones: () =>
    peticion<{ notificaciones: Notificacion[]; no_leidas: number }>("/mi/notificaciones"),
  marcarLeida: (id: number) =>
    peticion<Notificacion>(`/mi/notificaciones/${id}/leida`, { metodo: "PATCH" }),
  grupo: () => peticion<GrupoFamiliar>("/mi/grupo-familiar"),
  guardarGrupo: (cuerpo: Record<string, unknown>) =>
    peticion<GrupoFamiliar>("/mi/grupo-familiar", { metodo: "PUT", cuerpo }),
  establecimientos: () => peticion<{ establecimientos: Establecimiento[] }>("/mi/establecimientos"),
  guardarStock: (id: number, stock: ItemStock[]) =>
    peticion<unknown>(`/mi/establecimientos/${id}/stock`, { metodo: "PUT", cuerpo: { stock } }),
  confirmaciones: () => peticion<{ confirmaciones: ConsultaConfirmacion[]; pendientes: number }>("/mi/confirmaciones"),
  miSector: () => peticion<MiSector>("/mi/sector"),
  misPedidos: () => peticion<{ categoria: Categoria; items: PedidoCiudadano[] }>("/mi/pedidos"),
  miSeguimiento: () => peticion<{ seguimientos: SeguimientoCuadrilla[] }>("/mi/seguimiento"),
  compartirPosicion: (p: { lat: number; lon: number; precision_m?: number }) =>
    peticion<{ cuadrillas: number[] }>("/cuadrillas/mi-posicion", { metodo: "POST", cuerpo: p }),
  panelResumen: () => peticion<PanelResumen>("/panel/resumen"),
  centros: () => peticion<{ centros: Centro[] }>("/centros"),
  sectoresGeo: () => peticion<GeoSectores>("/sectores", { auth: false }),
  tareas: () => peticion<{ tareas: Tarea[] }>("/tareas"),
  partesDeTarea: (id: number) => peticion<{ items: ParteTarea[] }>(`/tareas/${id}/partes`),
  actualizarTarea: (
    id: number,
    cambios: { estado?: Tarea["estado"]; checklist?: ItemChecklist[] },
  ) => peticion<Tarea>(`/tareas/${id}`, { metodo: "PATCH", cuerpo: cambios }),
  registroCiudadano: (cuerpo: Record<string, unknown>) =>
    peticion<unknown>("/auth/registro/ciudadano", { metodo: "POST", cuerpo, auth: false }),
  registroProductor: (cuerpo: Record<string, unknown>) =>
    peticion<unknown>("/auth/registro/productor", { metodo: "POST", cuerpo, auth: false }),
};
