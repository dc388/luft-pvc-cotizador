// Acceso a la base D1 LOCAL desde un script de Node.
//
// En desarrollo, D1 es un archivo SQLite que Miniflare guarda bajo
// `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`. El nombre es un hash interno,
// así que no se puede escribir en el código: se BUSCA el archivo que ya tiene las tablas de este
// proyecto. Ese es también el motivo por el que las migraciones se aplican con Wrangler y no
// desde aquí -- Wrangler sabe cuál es su archivo y lleva su propia bitácora en `d1_migrations`.
//
// Se usa `node:sqlite`, incluido en Node 22.5+, en vez de agregar better-sqlite3: no hay
// compilación nativa que instalar y este script solo corre en local. La ventaja frente a
// `wrangler d1 execute` es la transacción de verdad: BEGIN IMMEDIATE / COMMIT / ROLLBACK sobre
// ~1300 escrituras, que es lo que hace que una importación a medias no deje precios huérfanos.
//
// NUNCA apunta a producción. No hay bandera ni variable que lo permita: para la base remota este
// repositorio usa `wrangler d1 migrations apply` y una decisión humana.

import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const D1_STATE_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

/** Tabla que debe existir para considerar que un archivo es la base de este proyecto. */
const MARKER_TABLE = "supplier_catalog_sources";

export type LocalDatabase = {
  path: string;
  db: DatabaseSync;
};

function hasTable(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return row !== undefined;
}

/**
 * Localiza y abre la D1 local. Si hay varios archivos candidatos (pasa cuando el proyecto cambió
 * de `database_id` en algún momento) se elige el modificado más recientemente y se informa cuál.
 *
 * `explicitPath` permite forzar el archivo con `--db-file=`, para no quedar atrapado si la
 * heurística falla.
 */
export function openLocalD1(explicitPath?: string): LocalDatabase {
  if (explicitPath) {
    if (!existsSync(explicitPath)) throw new Error(`No existe la base indicada: ${explicitPath}`);
    return { path: explicitPath, db: new DatabaseSync(explicitPath) };
  }

  if (!existsSync(D1_STATE_DIR)) {
    throw new Error(
      `No se encontró la D1 local (${D1_STATE_DIR}).\n` +
        "Arranca la app una vez con `npm run dev` y aplica las migraciones con `npm run db:migrate:local`."
    );
  }

  const files = readdirSync(D1_STATE_DIR)
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
    .map((name) => join(D1_STATE_DIR, name));

  const candidates: { path: string; mtimeMs: number }[] = [];
  for (const path of files) {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      if (hasTable(db, MARKER_TABLE)) candidates.push({ path, mtimeMs: statSync(path).mtimeMs });
    } finally {
      db.close();
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      `La D1 local no tiene la tabla \`${MARKER_TABLE}\`.\n` +
        "Aplica las migraciones primero: npm run db:migrate:local"
    );
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { path: candidates[0].path, db: new DatabaseSync(candidates[0].path) };
}

/**
 * Ejecuta `work` dentro de una transacción. Si lanza, se deshace TODO y se vuelve a lanzar: una
 * importación que falla a la mitad no debe dejar la revisión creada sin sus precios.
 *
 * BEGIN IMMEDIATE y no BEGIN: toma el candado de escritura de entrada, así que si el servidor de
 * desarrollo está escribiendo, falla aquí y no a mitad del volcado.
 */
export function inTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Si el ROLLBACK también falla no hay nada que rescatar; se reporta el error original.
    }
    throw error;
  }
}
