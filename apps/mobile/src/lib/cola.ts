/**
 * Cola offline de solicitudes de asistencia (CLAUDE.md §5.5). La lógica es independiente del
 * almacenamiento: `RepositorioCola` se implementa con expo-sqlite en producción (`colaSqlite.ts`)
 * y en memoria en las pruebas.
 */

export type DatosSolicitud = {
  tipo: "evacuacion" | "asistencia" | "ganado" | "logistica" | "otro";
  personas: number;
  animales: number;
  lon: number;
  lat: number;
  texto: string | null;
  /** Campo propio del backend; se omite cuando está vacío (no se manda `null`). */
  referencia_ubicacion?: string;
  origen: "app";
};

export type EstadoItem = "pendiente" | "enviada" | "rechazada";

export type ItemCola = {
  id: number;
  usuarioId: number;
  datos: DatosSolicitud;
  fotoUri: string | null;
  estado: EstadoItem;
  intentos: number;
  proximoIntento: number;
  ultimoError: string | null;
  /** Id de la solicitud en el servidor; se fija al terminar el primer tiempo (JSON). */
  servidorId: number | null;
  /** UUID generado al encolar; se reenvía igual en cada reintento (cabecera `Idempotency-Key`). */
  claveIdempotencia: string;
  /** Segundo tiempo del envío: la foto ya fue recibida por el servidor. */
  fotoSubida: boolean;
  creadoEn: number;
  /**
   * URL normalizada del servidor al que pertenece el ítem. Solo se envía si coincide con el
   * servidor vigente y con el usuario de la sesión: así una solicitud nunca llega a otro servidor
   * ni queda registrada bajo otra cuenta.
   */
  servidorUrl: string;
};

/** Host (con puerto) de una URL de servidor, para mostrarlo al usuario. */
export function hostDeUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") || "(sin servidor)";
}

export interface RepositorioCola {
  insertar(item: Omit<ItemCola, "id">): Promise<ItemCola>;
  listar(usuarioId: number): Promise<ItemCola[]>;
  actualizar(id: number, cambios: Partial<Omit<ItemCola, "id">>): Promise<void>;
  eliminar(id: number): Promise<void>;
  /** Borra los ítems de cualquier usuario distinto del indicado (teléfono compartido). */
  eliminarDeOtrosUsuarios(usuarioId: number): Promise<void>;
}

export type ResultadoEnvio =
  | { ok: true; servidorId: number }
  | { ok: false; tipo: "red" | "sesion" | "rechazo"; mensaje: string };

export type ResultadoFoto =
  | { ok: true }
  | { ok: false; tipo: "red" | "sesion" | "rechazo"; mensaje: string };

export type Dependencias = {
  repo: RepositorioCola;
  hayRed: () => Promise<boolean>;
  /** Primer tiempo: JSON mínimo con la clave de idempotencia del ítem. */
  enviar: (datos: DatosSolicitud, claveIdempotencia: string) => Promise<ResultadoEnvio>;
  /** Segundo tiempo: sube la foto comprimida a la solicitud ya creada. */
  subirFoto: (servidorId: number, fotoUri: string) => Promise<ResultadoFoto>;
  /** URL normalizada del servidor vigente; se evalúa en cada operación. Por defecto "". */
  servidorActual?: () => string;
  ahora?: () => number;
  /** Generador de UUID; por defecto `crypto.randomUUID` o un v4 de respaldo. */
  generarClave?: () => string;
  /** Intentos fallidos tras los cuales el ítem se rechaza para no bloquear la cola. Por defecto 10. */
  maxIntentos?: number;
  /** Antigüedad (ms) tras la cual un ítem que sigue fallando se rechaza. Por defecto 3 días. */
  maxEdadMs?: number;
};

export type VaciadoResultado = {
  enviadas: number;
  rechazadas: number;
  pendientes: number;
  sinRed: boolean;
};

/** UUID v4. La clave de idempotencia no es un secreto: basta con que no se repita. */
export function uuidV4(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const MAX_INTENTOS = 10;
export const MAX_EDAD_MS = 3 * 24 * 60 * 60_000;
/** Los ítems enviados se conservan un día en el teléfono y después se purgan. */
export const RETENCION_ENVIADAS_MS = 24 * 60 * 60_000;

const BASE_MS = 5_000;
const MAX_MS = 5 * 60_000;

/** Espera exponencial: 5 s, 10 s, 20 s... con tope de 5 minutos. */
export function esperaBackoffMs(intentos: number): number {
  return Math.min(BASE_MS * 2 ** Math.max(intentos - 1, 0), MAX_MS);
}

export class ColaOffline {
  private vaciando: Promise<VaciadoResultado> | null = null;
  /** Se pidió vaciar mientras otro vaciado estaba en curso: se encadena una segunda pasada. */
  private repetir = false;
  private repetirForzado = false;

  constructor(private readonly dep: Dependencias) {}

  private ahora(): number {
    return (this.dep.ahora ?? Date.now)();
  }

  async encolar(usuarioId: number, datos: DatosSolicitud, fotoUri: string | null): Promise<ItemCola> {
    return this.dep.repo.insertar({
      usuarioId,
      datos,
      fotoUri,
      estado: "pendiente",
      intentos: 0,
      proximoIntento: 0,
      ultimoError: null,
      servidorId: null,
      claveIdempotencia: this.clave(),
      fotoSubida: false,
      creadoEn: this.ahora(),
      servidorUrl: this.servidor(),
    });
  }

  private servidor(): string {
    return (this.dep.servidorActual ?? (() => ""))();
  }

  private clave(): string {
    return (this.dep.generarClave ?? uuidV4)();
  }

  async listar(usuarioId: number): Promise<ItemCola[]> {
    return this.dep.repo.listar(usuarioId);
  }

  /** Pendientes del usuario que corresponden al servidor vigente (los únicos que se envían). */
  async pendientes(usuarioId: number): Promise<ItemCola[]> {
    const actual = this.servidor();
    return (await this.dep.repo.listar(usuarioId)).filter(
      (i) => i.estado === "pendiente" && i.servidorUrl === actual,
    );
  }

  /** Pendientes del usuario que pertenecen a otro servidor: se conservan sin enviarse. */
  async pendientesOtroServidor(usuarioId: number): Promise<ItemCola[]> {
    const actual = this.servidor();
    return (await this.dep.repo.listar(usuarioId)).filter(
      (i) => i.estado === "pendiente" && i.servidorUrl !== actual,
    );
  }

  /**
   * Envía en orden de creación. Sin red, o ante un error de red o de sesión, se detiene para no
   * reordenar. Un rechazo de validación (4xx) marca el ítem como `rechazada` y sigue con el resto.
   * `forzar` ignora la espera del backoff (botón de reintento manual).
   */
  vaciar(usuarioId: number, forzar = false): Promise<VaciadoResultado> {
    if (this.vaciando) {
      // Algo se insertó (o cambió la red) durante el vaciado en curso: el ciclo hace otra pasada.
      this.repetir = true;
      this.repetirForzado ||= forzar;
      return this.vaciando;
    }
    this.vaciando = this.ciclo(usuarioId, forzar).finally(() => {
      this.vaciando = null;
    });
    return this.vaciando;
  }

  private async ciclo(usuarioId: number, forzar: boolean): Promise<VaciadoResultado> {
    let total = await this.vaciarInterno(usuarioId, forzar);
    while (this.repetir) {
      const forzado = this.repetirForzado;
      this.repetir = false;
      this.repetirForzado = false;
      const r = await this.vaciarInterno(usuarioId, forzado);
      total = {
        enviadas: total.enviadas + r.enviadas,
        rechazadas: total.rechazadas + r.rechazadas,
        pendientes: r.pendientes,
        sinRed: r.sinRed,
      };
    }
    return total;
  }

  private async vaciarInterno(usuarioId: number, forzar: boolean): Promise<VaciadoResultado> {
    const res: VaciadoResultado = { enviadas: 0, rechazadas: 0, pendientes: 0, sinRed: false };
    if (!(await this.dep.hayRed())) {
      res.sinRed = true;
      res.pendientes = (await this.pendientes(usuarioId)).length;
      return res;
    }
    for (const item of await this.pendientes(usuarioId)) {
      if (!forzar && item.proximoIntento > this.ahora()) break;
      let servidorId = item.servidorId;
      if (servidorId === null) {
        // Los ítems creados antes de existir la clave la reciben aquí y la conservan en los reintentos.
        let clave = item.claveIdempotencia;
        if (!clave) {
          clave = this.clave();
          await this.dep.repo.actualizar(item.id, { claveIdempotencia: clave });
        }
        const r = await this.dep.enviar(item.datos, clave);
        if (!r.ok) {
          if (r.tipo === "rechazo") {
            await this.dep.repo.actualizar(item.id, { estado: "rechazada", ultimoError: r.mensaje });
            res.rechazadas += 1;
            continue;
          }
          if (r.tipo === "red" && this.agotado(item)) {
            // Un ítem que no logra enviarse no debe bloquear a los que siguen.
            await this.dep.repo.actualizar(item.id, {
              estado: "rechazada",
              intentos: item.intentos + 1,
              ultimoError: `No se pudo enviar después de ${item.intentos + 1} intentos: ${r.mensaje}`,
            });
            res.rechazadas += 1;
            continue;
          }
          await this.reprogramar(item, r.mensaje);
          break;
        }
        servidorId = r.servidorId;
        await this.dep.repo.actualizar(item.id, { servidorId, ultimoError: null });
      }

      if (item.fotoUri && !item.fotoSubida) {
        const f = await this.dep.subirFoto(servidorId, item.fotoUri);
        if (f.ok) {
          await this.dep.repo.actualizar(item.id, { fotoSubida: true, ultimoError: null });
        } else if (f.tipo === "rechazo") {
          // La solicitud ya llegó: la foto rechazada no debe reintentarse ni bloquear el envío.
          await this.dep.repo.actualizar(item.id, {
            fotoUri: null,
            ultimoError: `La solicitud se envió, pero el servidor no aceptó la foto: ${f.mensaje}`,
          });
        } else if (f.tipo === "red" && this.agotado(item)) {
          // La solicitud ya llegó: tras muchos intentos se abandona la foto y se sigue con la cola.
          await this.dep.repo.actualizar(item.id, {
            fotoUri: null,
            intentos: item.intentos + 1,
            ultimoError: `La solicitud se envió, pero la foto no pudo subirse: ${f.mensaje}`,
          });
        } else {
          await this.reprogramar(item, f.mensaje);
          break;
        }
      }

      await this.dep.repo.actualizar(item.id, { estado: "enviada" });
      res.enviadas += 1;
    }
    // Se purgan las enviadas viejas en cada vaciado (también el del arranque de la app).
    await this.purgarEnviadas(usuarioId, this.ahora() - RETENCION_ENVIADAS_MS);
    res.pendientes = (await this.pendientes(usuarioId)).length;
    return res;
  }

  /** `true` si este fallo reintentable ya superó el máximo de intentos o de antigüedad. */
  private agotado(item: ItemCola): boolean {
    const maxIntentos = this.dep.maxIntentos ?? MAX_INTENTOS;
    const maxEdad = this.dep.maxEdadMs ?? MAX_EDAD_MS;
    return item.intentos + 1 >= maxIntentos || this.ahora() - item.creadoEn > maxEdad;
  }

  /** Quita de la cola los ítems de otras cuentas (p. ej. al ingresar otra persona en el teléfono). */
  async limpiarAjenos(usuarioId: number): Promise<void> {
    await this.dep.repo.eliminarDeOtrosUsuarios(usuarioId);
  }

  private async reprogramar(item: ItemCola, mensaje: string): Promise<void> {
    const intentos = item.intentos + 1;
    await this.dep.repo.actualizar(item.id, {
      intentos,
      proximoIntento: this.ahora() + esperaBackoffMs(intentos),
      ultimoError: mensaje,
    });
  }

  /** Elimina un ítem (p. ej. el usuario descarta una solicitud rechazada). */
  async descartar(id: number): Promise<void> {
    await this.dep.repo.eliminar(id);
  }

  /** Los ítems ya enviados se purgan para que la tabla no crezca sin límite. */
  async purgarEnviadas(usuarioId: number, antesDe: number): Promise<void> {
    for (const i of await this.dep.repo.listar(usuarioId)) {
      if (i.estado === "enviada" && i.creadoEn < antesDe) await this.dep.repo.eliminar(i.id);
    }
  }
}

export class RepositorioMemoria implements RepositorioCola {
  private filas: ItemCola[] = [];
  private seq = 0;
  async insertar(item: Omit<ItemCola, "id">): Promise<ItemCola> {
    const fila = { ...item, id: ++this.seq };
    this.filas.push(fila);
    return { ...fila };
  }
  async listar(usuarioId: number): Promise<ItemCola[]> {
    return this.filas.filter((f) => f.usuarioId === usuarioId).map((f) => ({ ...f }));
  }
  async actualizar(id: number, cambios: Partial<Omit<ItemCola, "id">>): Promise<void> {
    const f = this.filas.find((x) => x.id === id);
    if (f) Object.assign(f, cambios);
  }
  async eliminar(id: number): Promise<void> {
    this.filas = this.filas.filter((f) => f.id !== id);
  }
  async eliminarDeOtrosUsuarios(usuarioId: number): Promise<void> {
    this.filas = this.filas.filter((f) => f.usuarioId === usuarioId);
  }
}
