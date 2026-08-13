import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// A Proyecto holds N Componentes (individual windows/doors) so a single quote can cover a
// whole building instead of one opening — ported from the Proyecto/Vano layer built once in
// static/cotizador.html (commit 88f18e8) but never carried into this app.
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().default("Proyecto sin nombre"),
    activeComponentId: text("active_component_id"),
    // Procedencia del proyecto: "web" cuando lo creó un cliente en /cotizar, "interno" cuando lo
    // abrió alguien del equipo. Son columnas y no un prefijo en `name` a propósito: la lista de
    // proyectos necesita distinguir el origen, el folio y el cliente aunque después se renombre
    // la carpeta -- y renombrar es justo lo primero que se hace con una cotización que avanza.
    source: text("source").notNull().default("interno"),
    /** "platform" (creado aquí) o "imported" (archivo, respaldo o cotización pública). Es la
     * categoría del explorador de proyectos; ver ProjectOrigin en types/project.ts para por qué
     * no basta con `source`. */
    origin: text("origin").notNull().default("platform"),
    /** Etapa del proyecto. Ver lib/projectStatus.ts para la lista y su orden. */
    status: text("status").notNull().default("draft"),
    /** Folio del proyecto: el público (W-XXXXXX) cuando llegó del cotizador, o el que genera la
     * plataforma (LP-AAAA-NNNN). Vacío solo en proyectos creados antes de que se generaran. */
    folio: text("folio").notNull().default(""),
    /** Nombre del cliente. Espejo de `requester.fullName`, mantenido para no romper lo que ya lo
     * leía (etiquetado de folios, informes) antes de que existiera la ficha completa. */
    client: text("client").notNull().default(""),
    /** Ficha del solicitante en JSON (ver Requester en types/project.ts). Es un blob y no quince
     * columnas por la misma razón que `components.data`: sigue cambiando de forma, y nada se
     * consulta por SQL contra sus campos -- el buscador del explorador filtra en el cliente sobre
     * la lista ya resuelta. */
    requester: text("requester").notNull().default("{}"),
    notes: text("notes").notNull().default(""),
    currency: text("currency").notNull().default("MXN"),
    pricingListId: text("pricing_list_id").notNull().default(""),
    estimatedDate: text("estimated_date").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    /** Cuándo entró a esta plataforma, si llegó de fuera. Nulo en los creados aquí. */
    importedAt: text("imported_at"),
    /** Fecha de creación original declarada por el archivo importado. Se conserva aparte de
     * `createdAt` porque las dos son ciertas y responden preguntas distintas: cuándo se hizo el
     * proyecto y cuándo entró aquí. */
    originalCreatedAt: text("original_created_at"),
    archivedAt: text("archived_at"),
    /** Papelera. Un proyecto borrado se marca y deja de listarse, pero sus componentes siguen
     * existiendo hasta que se purgue: es lo que hace que "Deshacer" pueda deshacer de verdad. */
    deletedAt: text("deleted_at"),
    duplicatedFromId: text("duplicated_from_id"),
    schemaVersion: integer("schema_version").notNull().default(1),
  },
  (table) => [
    // Sirve a la consulta de la lista, que siempre filtra la papelera y ordena por fecha.
    index("projects_deleted_created_idx").on(table.deletedAt, table.createdAt),
    // Índice parcial: la unicidad del folio se exige solo donde hay folio. Los proyectos creados
    // antes de que se generaran tienen folio vacío y son varios, así que un índice único total
    // los rechazaría y la migración fallaría sobre datos ya guardados.
    uniqueIndex("projects_folio_idx").on(table.folio).where(sql`${table.folio} <> ''`),
  ]
);

// One window/door. Fields useful for an outliner list (code, designation, location, qty,
// dimensions, brand/system/color) are normalized columns; everything else that's still
// actively evolving in shape (the split/leaf tree, the assembly marco, and the remaining
// per-component scalars) is kept as one JSON blob in `data` -- matches how PersistedProject
// already shaped this in lib/persistence.ts, just moved server-side.
export const components = sqliteTable(
  "components",
  {
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
    // Las cuatro columnas siguientes existen por la misma razón que las de arriba: la lista de
    // componentes tiene que decir qué vidrio, qué tipología, en qué estado y por cuánto va cada
    // componente, y resolverlo desde `data` obligaría a cargar el árbol completo de todos ellos
    // solo para pintar la lista. Las escribe quien edita el componente, con el vidrio elegido y
    // el cálculo real de lib/calc.ts -- no son estimaciones.
    glassIndex: integer("glass_index").notNull().default(7),
    typology: text("typology").notNull().default(""),
    /** "pendiente" | "ok" | "alertas". Ver ComponentConfigState en types/project.ts. */
    configState: text("config_state").notNull().default("pendiente"),
    /** Precio de venta por pieza, en pesos redondeados. */
    unitPrice: integer("unit_price").notNull().default(0),
    /** Subtotal (precio por pieza × cantidad), en pesos redondeados. */
    total: integer("total").notNull().default(0),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    // Toda lectura de componentes es "los de este proyecto, en orden".
    index("components_project_position_idx").on(table.projectId, table.position),
  ]
);

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

// Puntos de restauración de un proyecto: el proyecto completo congelado en un momento dado.
//
// `snapshot` es el MISMO formato que el archivo .luftproj (ver lib/projectFile.ts), no un formato
// aparte. Esa decisión es la que hace que restaurar un punto y abrir un archivo sean el mismo camino
// de código: el lector que valida un archivo de origen desconocido valida también esto, y no hay dos
// definiciones de "un proyecto guardado" que se puedan desincronizar.
//
// Se crean a mano ("Crear punto de restauración") y también solas antes de cada operación que
// reemplaza el contenido de un proyecto -- importar sobre uno existente y restaurar otro punto --,
// porque ahí es donde se pierde trabajo y donde después se quiere volver atrás.
export const projectVersions = sqliteTable(
  "project_versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Nombre que le dio quien lo creó. Vacío en los automáticos, que se describen por `reason`. */
    label: text("label").notNull().default(""),
    /** "manual" | "antes-de-importar" | "antes-de-restaurar". Por qué existe este punto. */
    reason: text("reason").notNull().default("manual"),
    componentCount: integer("component_count").notNull().default(0),
    total: integer("total").notNull().default(0),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("project_versions_project_idx").on(table.projectId, table.createdAt)]
);

// Cierre de obra: lo que pasó DE VERDAD con un proyecto, frente a lo que se cotizó.
//
// Es la pieza que faltaba para poder comparar costo real contra costo estimado y lo cotizado contra
// lo fabricado. Nada de esto se puede inferir de la configuración: alguien tiene que capturarlo al
// terminar la obra, y hasta que lo capture la plataforma dice que no lo sabe en vez de estimarlo.
//
// `quotedTotal` y `quotedPieces` se congelan al cerrar y no se recalculan después: la comparación
// tiene que ser contra lo que se cotizó entonces, no contra lo que diría el catálogo de hoy.
//
// Una fila por proyecto (la clave primaria es el proyecto): un proyecto se cierra una vez, y volver a
// capturarlo corrige la cifra en lugar de acumular cierres.
export const projectOutcomes = sqliteTable("project_outcomes", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  quotedTotal: integer("quoted_total").notNull().default(0),
  quotedPieces: integer("quoted_pieces").notNull().default(0),
  /** Costo real de fabricar e instalar, en pesos. */
  actualCost: integer("actual_cost").notNull().default(0),
  /** Lo que realmente se cobró, en pesos. Puede diferir de lo cotizado por ajustes de obra. */
  actualRevenue: integer("actual_revenue").notNull().default(0),
  piecesBuilt: integer("pieces_built").notNull().default(0),
  notes: text("notes").notNull().default(""),
  closedAt: text("closed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Bitácora estadística para las recomendaciones de cotización (ver lib/learning.ts).
//
// SIN DATOS PERSONALES, y no como recomendación sino como propiedad de la tabla: no hay columna
// donde pudieran caber. No guarda `projectId` ni `componentId` ni nada que apunte al expediente
// del cliente -- solo qué tipología, qué sistema, qué medidas y qué importes se usaron. Es lo que
// permite ofrecer "borrar el historial de mejora" sin tocar los proyectos, y que apagar la
// recopilación no deje datos personales dispersos en otra tabla.
//
// `payload` es JSON y lo arma un filtro de campos permitidos, no un volcado del componente: ver
// sanitizeLearningPayload en lib/learning.ts.
//
// `createdAt` es epoch en milisegundos (entero) y no texto ISO como en las demás tablas porque
// cada lectura sobre él es una comparación de ventana temporal, nunca un valor que se muestre.
export const quoteLearningEvents = sqliteTable(
  "quote_learning_events",
  {
    id: text("id").primaryKey(),
    /** Qué ocurrió: "componente_guardado", "componente_duplicado", "proyecto_creado"... */
    kind: text("kind").notNull(),
    payload: text("payload").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    // Sirve a las estadísticas, que siempre leen "los eventos de este tipo, más recientes que X".
    index("quote_learning_events_kind_created_idx").on(table.kind, table.createdAt),
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
