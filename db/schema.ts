import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A Proyecto holds N Componentes (individual windows/doors) so a single quote can cover a
// whole building instead of one opening — ported from the Proyecto/Vano layer built once in
// static/cotizador.html (commit 88f18e8) but never carried into this app.
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Proyecto sin nombre"),
  activeComponentId: text("active_component_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// One window/door. Fields useful for an outliner list (code, designation, location, qty,
// dimensions, brand/system/color) are normalized columns; everything else that's still
// actively evolving in shape (the split/leaf tree, the assembly marco, and the remaining
// per-component scalars) is kept as one JSON blob in `data` -- matches how PersistedProject
// already shaped this in lib/persistence.ts, just moved server-side.
export const components = sqliteTable("components", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  code: text("code").notNull().default(""),
  designation: text("designation").notNull().default(""),
  location: text("location").notNull().default(""),
  qty: integer("qty").notNull().default(1),
  widthMm: integer("width_mm").notNull().default(0),
  heightMm: integer("height_mm").notNull().default(0),
  brand: text("brand").notNull().default("Aluplast"),
  systemIndex: integer("system_index").notNull().default(0),
  colorIndex: integer("color_index").notNull().default(0),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// One row per accepted request against a rate-limited public endpoint. Unlike every other
// table here this is throwaway telemetry, not user data: lib/rateLimit.ts counts the rows in
// a bucket inside a time window and sweeps anything older than the longest window on write.
// `createdAt` is epoch milliseconds (integer) rather than the ISO text the other tables use,
// because every read on it is a numeric window comparison, never a display value.
export const rateLimitHits = sqliteTable(
  "rate_limit_hits",
  {
    id: text("id").primaryKey(),
    /** `${scope}:${client ip}` -- what the limit is counted per. See lib/rateLimit.ts. */
    bucket: text("bucket").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    // Serves the per-bucket window count (bucket = ? AND created_at >= ?).
    index("rate_limit_hits_bucket_created_idx").on(table.bucket, table.createdAt),
    // Serves the global sweep of expired rows (created_at < ?), which has no bucket to filter on.
    index("rate_limit_hits_created_idx").on(table.createdAt),
  ]
);

// El brief acumulado de LUFT Asesor, para que recargar la página no borre la conversación
// (§90 del brief del asesor). La clave es un token opaco guardado en cookie, no un id
// consecutivo: el contenido incluye ubicación y preferencias del cliente, así que no debe ser
// adivinable. `brief` es JSON validado campo por campo al leerse -- ver lib/assistantSession.ts.
export const assistantSessions = sqliteTable(
  "assistant_sessions",
  {
    token: text("token").primaryKey(),
    brief: text("brief").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    // Sirve al barrido de sesiones viejas (updated_at < ?).
    index("assistant_sessions_updated_idx").on(table.updatedAt),
  ]
);
