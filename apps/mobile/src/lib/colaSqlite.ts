import * as SQLite from "expo-sqlite";

import { cargarServidor, obtenerUrlServidor } from "@/lib/servidor";
import type { DatosCola, ItemCola, RepositorioCola } from "@/lib/cola";

type Fila = {
  id: number;
  usuario_id: number;
  datos: string;
  foto_uri: string | null;
  estado: ItemCola["estado"];
  intentos: number;
  proximo_intento: number;
  ultimo_error: string | null;
  servidor_id: number | null;
  clave_idempotencia: string | null;
  foto_subida: number;
  creado_en: number;
  servidor_url: string | null;
};

const COLUMNAS: Record<keyof Omit<ItemCola, "id">, string> = {
  usuarioId: "usuario_id",
  datos: "datos",
  fotoUri: "foto_uri",
  estado: "estado",
  intentos: "intentos",
  proximoIntento: "proximo_intento",
  ultimoError: "ultimo_error",
  servidorId: "servidor_id",
  claveIdempotencia: "clave_idempotencia",
  fotoSubida: "foto_subida",
  creadoEn: "creado_en",
  servidorUrl: "servidor_url",
};

function aItem(f: Fila): ItemCola {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    datos: JSON.parse(f.datos) as DatosCola,
    fotoUri: f.foto_uri,
    estado: f.estado,
    intentos: f.intentos,
    proximoIntento: f.proximo_intento,
    ultimoError: f.ultimo_error,
    servidorId: f.servidor_id,
    claveIdempotencia: f.clave_idempotencia ?? "",
    fotoSubida: f.foto_subida === 1,
    creadoEn: f.creado_en,
    servidorUrl: f.servidor_url ?? "",
  };
}

/** Repositorio de la cola sobre expo-sqlite. No guarda credenciales: solo solicitudes pendientes. */
export class RepositorioSqlite implements RepositorioCola {
  private abierta: Promise<SQLite.SQLiteDatabase> | null = null;

  private db(): Promise<SQLite.SQLiteDatabase> {
    this.abierta ??= (async () => {
      const db = await SQLite.openDatabaseAsync("evacuaciones.db");
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cola_solicitudes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER NOT NULL,
          datos TEXT NOT NULL,
          foto_uri TEXT,
          estado TEXT NOT NULL DEFAULT 'pendiente',
          intentos INTEGER NOT NULL DEFAULT 0,
          proximo_intento INTEGER NOT NULL DEFAULT 0,
          ultimo_error TEXT,
          servidor_id INTEGER,
          clave_idempotencia TEXT,
          foto_subida INTEGER NOT NULL DEFAULT 0,
          creado_en INTEGER NOT NULL,
          servidor_url TEXT
        );
      `);
      // Bases creadas por versiones anteriores de la app: se agregan las columnas nuevas.
      const columnas = await db.getAllAsync<{ name: string }>("PRAGMA table_info(cola_solicitudes)");
      const nombres = new Set(columnas.map((c) => c.name));
      if (!nombres.has("clave_idempotencia")) {
        await db.execAsync("ALTER TABLE cola_solicitudes ADD COLUMN clave_idempotencia TEXT");
      }
      if (!nombres.has("foto_subida")) {
        await db.execAsync("ALTER TABLE cola_solicitudes ADD COLUMN foto_subida INTEGER NOT NULL DEFAULT 0");
      }
      if (!nombres.has("servidor_url")) {
        await db.execAsync("ALTER TABLE cola_solicitudes ADD COLUMN servidor_url TEXT");
      }
      // Filas previas a la columna: se asignan al servidor vigente al momento de la migración.
      await cargarServidor();
      await db.runAsync(
        "UPDATE cola_solicitudes SET servidor_url = ? WHERE servidor_url IS NULL",
        obtenerUrlServidor(),
      );
      return db;
    })();
    return this.abierta;
  }

  async insertar(item: Omit<ItemCola, "id">): Promise<ItemCola> {
    const db = await this.db();
    const r = await db.runAsync(
      `INSERT INTO cola_solicitudes
        (usuario_id, datos, foto_uri, estado, intentos, proximo_intento, ultimo_error, servidor_id, clave_idempotencia, foto_subida, creado_en, servidor_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.usuarioId,
      JSON.stringify(item.datos),
      item.fotoUri,
      item.estado,
      item.intentos,
      item.proximoIntento,
      item.ultimoError,
      item.servidorId,
      item.claveIdempotencia,
      item.fotoSubida ? 1 : 0,
      item.creadoEn,
      item.servidorUrl,
    );
    return { ...item, id: r.lastInsertRowId };
  }

  async listar(usuarioId: number): Promise<ItemCola[]> {
    const db = await this.db();
    const filas = await db.getAllAsync<Fila>(
      "SELECT * FROM cola_solicitudes WHERE usuario_id = ? ORDER BY id ASC",
      usuarioId,
    );
    return filas.map(aItem);
  }

  async actualizar(id: number, cambios: Partial<Omit<ItemCola, "id">>): Promise<void> {
    const claves = Object.keys(cambios) as (keyof typeof COLUMNAS)[];
    if (claves.length === 0) return;
    const db = await this.db();
    const sets = claves.map((k) => `${COLUMNAS[k]} = ?`).join(", ");
    const valores = claves.map((k) => {
      if (k === "datos") return JSON.stringify(cambios[k]);
      if (k === "fotoSubida") return cambios[k] ? 1 : 0;
      return cambios[k] ?? null;
    }) as SQLite.SQLiteBindValue[];
    await db.runAsync(`UPDATE cola_solicitudes SET ${sets} WHERE id = ?`, ...valores, id);
  }

  async eliminar(id: number): Promise<void> {
    const db = await this.db();
    await db.runAsync("DELETE FROM cola_solicitudes WHERE id = ?", id);
  }

  async eliminarDeOtrosUsuarios(usuarioId: number): Promise<void> {
    const db = await this.db();
    await db.runAsync("DELETE FROM cola_solicitudes WHERE usuario_id <> ?", usuarioId);
  }

  /**
   * Borra los ítems ya resueltos (enviados o rechazados) de todas las cuentas: ya no se van a enviar y
   * guardan ubicación y texto. Los pendientes se conservan para no perder un pedido de ayuda sin enviar.
   */
  async borrarNoPendientes(): Promise<void> {
    const db = await this.db();
    await db.runAsync("DELETE FROM cola_solicitudes WHERE estado <> 'pendiente'");
  }

  async borrarDeUsuario(usuarioId: number): Promise<void> {
    const db = await this.db();
    await db.runAsync("DELETE FROM cola_solicitudes WHERE usuario_id = ?", usuarioId);
  }
}
