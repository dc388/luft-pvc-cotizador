import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// A Proyecto holds N Componentes (individual windows/doors) so a single quote can cover a
// whole building instead of one opening — ported from the Proyecto/Vano layer built once in
// static/cotizador.html (commit 88f18e8) but never carried into this app.
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Proyecto sin nombre"),
  activeComponentId: text("active_component_id"),
  // Procedencia del proyecto: "web" cuando lo creó un cliente en /cotizar, "interno" cuando lo
  // abrió alguien del equipo. Son columnas y no un prefijo en `name` a propósito: la lista de
  // proyectos necesita distinguir el origen, el folio y el cliente aunque después se renombre
  // la carpeta -- y renombrar es justo lo primero que se hace con una cotización que avanza.
  source: text("source").notNull().default("interno"),
  /** Folio público (W-XXXXXX) del envío que originó el proyecto. Vacío en los internos. */
  folio: text("folio").notNull().default(""),
  /** Nombre del cliente tal como lo capturó el cotizador público. Vacío en los internos. */
  client: text("client").notNull().default(""),
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

// La persona detrás de una cotización, no la carpeta de trabajo. Existe aparte de `projects`
// porque un cliente vuelve: pide dos ventanas en marzo y la puerta en julio, y esas son dos
// cotizaciones del MISMO cliente. Con los datos escritos dentro de cada componente (como estaban
// hasta ahora) no había forma de saber que era la misma persona.
//
// `phoneKey` son solo los dígitos del teléfono y es la llave de deduplicación: el cliente escribe
// "993 221 1158", "9932211158" o "+52 993 2211158" y las tres son la misma persona. El teléfono
// tal como lo escribió se conserva en `phone` para devolverle su propio formato.
export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phoneKey: text("phone_key").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    company: text("company").notNull().default(""),
    city: text("city").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    address: text("address").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    // La deduplicación se apoya en el índice, no solo en la consulta previa: dos envíos
    // simultáneos del mismo teléfono llegarían los dos a "no existe" y crearían dos clientes.
    uniqueIndex("customers_phone_key_idx").on(table.phoneKey),
    // Búsqueda del panel interno por correo, y segundo criterio de deduplicación.
    index("customers_email_idx").on(table.email),
  ]
);

// Una cotización registrada. `snapshot` es el documento tal como se le entregó al cliente
// (renglones, medidas, importes y condiciones ya resueltos), no la configuración cruda: el PDF
// de una cotización de marzo no debe cambiar porque en abril subió el precio de un perfil.
// Las configuraciones siguen guardadas en `components` a través de `projectId`, así que la
// trazabilidad hacia el editor interno se conserva.
export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    /** Folio comercial visible: LUFT-2026-000001. Se compone de `folioYear` y `folioSeq`. */
    folio: text("folio").notNull(),
    folioYear: integer("folio_year").notNull(),
    folioSeq: integer("folio_seq").notNull(),
    /** Llave de acceso al documento. Opaca a propósito: el folio es consecutivo y por tanto
     * adivinable, así que no puede ser lo que abre la cotización de otra persona. */
    token: text("token").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** Carpeta creada en el editor interno con esta cotización. Nullable porque el expediente
     * comercial debe sobrevivir aunque alguien borre la carpeta de trabajo. */
    projectId: text("project_id"),
    projectName: text("project_name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** Etapa comercial. Ver lib/quoteStatus.ts para la lista y su orden. */
    status: text("status").notNull().default("generada"),
    itemCount: integer("item_count").notNull().default(0),
    pieceCount: integer("piece_count").notNull().default(0),
    /** Total en pesos, redondeado. Es para la lista interna: el documento usa `snapshot`. */
    total: integer("total").notNull().default(0),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("quotes_folio_idx").on(table.folio),
    uniqueIndex("quotes_token_idx").on(table.token),
    // El consecutivo se reserva escribiendo: si dos envíos calculan el mismo número, el segundo
    // choca contra este índice y reintenta. Sin él, dos clientes compartirían folio.
    uniqueIndex("quotes_folio_seq_idx").on(table.folioYear, table.folioSeq),
    index("quotes_customer_idx").on(table.customerId),
    index("quotes_created_idx").on(table.createdAt),
  ]
);

// Bitácora de la cotización: cada cambio de etapa queda escrito en vez de sobrescribir el
// anterior. Es lo que hace que "Contactado el 12, visita el 15" sea recuperable y no una sola
// columna con el último valor.
export const quoteEvents = sqliteTable(
  "quote_events",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("quote_events_quote_idx").on(table.quoteId, table.createdAt)]
);

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
