import * as SQLite from "expo-sqlite";

import type { DatosSolicitud, ItemCola, RepositorioCola } from "@/lib/cola";

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
  creado_en: number;
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
  creadoEn: "creado_en",
};

function aItem(f: Fila): ItemCola {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    datos: JSON.parse(f.datos) as DatosSolicitud,
    fotoUri: f.foto_uri,
    estado: f.estado,
    intentos: f.intentos,
    proximoIntento: f.proximo_intento,
    ultimoError: f.ultimo_error,
    servidorId: f.servidor_id,
    creadoEn: f.creado_en,
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
          creado_en INTEGER NOT NULL
        );
      `);
      return db;
    })();
    return this.abierta;
  }

  async insertar(item: Omit<ItemCola, "id">): Promise<ItemCola> {
    const db = await this.db();
    const r = await db.runAsync(
      `INSERT INTO cola_solicitudes
        (usuario_id, datos, foto_uri, estado, intentos, proximo_intento, ultimo_error, servidor_id, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.usuarioId,
      JSON.stringify(item.datos),
      item.fotoUri,
      item.estado,
      item.intentos,
      item.proximoIntento,
      item.ultimoError,
      item.servidorId,
      item.creadoEn,
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
    const valores = claves.map((k) =>
      k === "datos" ? JSON.stringify(cambios[k]) : (cambios[k] ?? null),
    ) as SQLite.SQLiteBindValue[];
    await db.runAsync(`UPDATE cola_solicitudes SET ${sets} WHERE id = ?`, ...valores, id);
  }

  async eliminar(id: number): Promise<void> {
    const db = await this.db();
    await db.runAsync("DELETE FROM cola_solicitudes WHERE id = ?", id);
  }

  async borrarDeUsuario(usuarioId: number): Promise<void> {
    const db = await this.db();
    await db.runAsync("DELETE FROM cola_solicitudes WHERE usuario_id = ?", usuarioId);
  }
}
