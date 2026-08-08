import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
