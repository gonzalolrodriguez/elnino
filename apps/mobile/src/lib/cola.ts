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
  servidorId: number | null;
  creadoEn: number;
};

export interface RepositorioCola {
  insertar(item: Omit<ItemCola, "id">): Promise<ItemCola>;
  listar(usuarioId: number): Promise<ItemCola[]>;
  actualizar(id: number, cambios: Partial<Omit<ItemCola, "id">>): Promise<void>;
  eliminar(id: number): Promise<void>;
}

export type ResultadoEnvio =
  | { ok: true; servidorId: number }
  | { ok: false; tipo: "red" | "sesion" | "rechazo"; mensaje: string };

export type Dependencias = {
  repo: RepositorioCola;
  hayRed: () => Promise<boolean>;
  enviar: (datos: DatosSolicitud) => Promise<ResultadoEnvio>;
  ahora?: () => number;
};

export type VaciadoResultado = {
  enviadas: number;
  rechazadas: number;
  pendientes: number;
  sinRed: boolean;
};

const BASE_MS = 5_000;
const MAX_MS = 5 * 60_000;

/** Espera exponencial: 5 s, 10 s, 20 s... con tope de 5 minutos. */
export function esperaBackoffMs(intentos: number): number {
  return Math.min(BASE_MS * 2 ** Math.max(intentos - 1, 0), MAX_MS);
}

export class ColaOffline {
  private vaciando: Promise<VaciadoResultado> | null = null;

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
      creadoEn: this.ahora(),
    });
  }

  async listar(usuarioId: number): Promise<ItemCola[]> {
    return this.dep.repo.listar(usuarioId);
  }

  async pendientes(usuarioId: number): Promise<ItemCola[]> {
    return (await this.dep.repo.listar(usuarioId)).filter((i) => i.estado === "pendiente");
  }

  /**
   * Envía en orden de creación. Sin red, o ante un error de red o de sesión, se detiene para no
   * reordenar. Un rechazo de validación (4xx) marca el ítem como `rechazada` y sigue con el resto.
   * `forzar` ignora la espera del backoff (botón de reintento manual).
   */
  vaciar(usuarioId: number, forzar = false): Promise<VaciadoResultado> {
    if (this.vaciando) return this.vaciando;
    this.vaciando = this.vaciarInterno(usuarioId, forzar).finally(() => {
      this.vaciando = null;
    });
    return this.vaciando;
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
      const r = await this.dep.enviar(item.datos);
      if (r.ok) {
        await this.dep.repo.actualizar(item.id, {
          estado: "enviada",
          servidorId: r.servidorId,
          ultimoError: null,
        });
        res.enviadas += 1;
        continue;
      }
      if (r.tipo === "rechazo") {
        await this.dep.repo.actualizar(item.id, { estado: "rechazada", ultimoError: r.mensaje });
        res.rechazadas += 1;
        continue;
      }
      const intentos = item.intentos + 1;
      await this.dep.repo.actualizar(item.id, {
        intentos,
        proximoIntento: this.ahora() + esperaBackoffMs(intentos),
        ultimoError: r.mensaje,
      });
      break;
    }
    res.pendientes = (await this.pendientes(usuarioId)).length;
    return res;
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
}
