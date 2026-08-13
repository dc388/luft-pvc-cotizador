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

// ---------------------------------------------------------------------------------------------
// CATÁLOGOS DE PROVEEDOR (herrajes)
//
// MACO no es una marca de perfiles: es el FABRICANTE DE HERRAJES cuyos mecanismos se montan en
// los sistemas de PVC de la marca Aluplast. Por eso nada de esto vive en `Brand` (types/domain.ts)
// ni en data/families.ts, que son perfiles: marco, hoja y junquillo. Un renglón de estas tablas es
// una manilla, un compás o un cerradero -- no un metro de perfil.
//
// La separación en tres tablas (fuente / artículo / precio) es lo que permite que llegue la
// revisión siguiente sin destruir la anterior: el artículo es estable (el SKU 100528 es la misma
// manilla en 2022 y en 2026), la fuente es el archivo que se importó, y el precio es la
// intersección de ambos. Guardar el precio en el artículo obligaría a sobrescribirlo en cada
// lista nueva y la cotización de 2022 dejaría de ser reproducible.
// ---------------------------------------------------------------------------------------------

// Una revisión importada: el archivo concreto del que salieron los precios. `fileHash` es la
// llave real de idempotencia -- reimportar el mismo libro encuentra su propia fila y no duplica
// nada, aunque el archivo haya cambiado de carpeta o de nombre.
//
// `active` y `historical` son dos columnas y no un solo estado a propósito: "es la lista de 2022"
// (historical) y "es la lista con la que se cotiza hoy" (active) son afirmaciones distintas, y
// ABR_22 entra siendo la primera y NO la segunda. Ser la única revisión disponible no la vuelve
// vigente: activarla es una decisión comercial explícita, no un efecto secundario de importarla.
export const supplierCatalogSources = sqliteTable(
  "supplier_catalog_sources",
  {
    id: text("id").primaryKey(),
    /** Qué clase de fuente es. Hoy solo "lista-precios"; los manuales van en su propia tabla. */
    sourceType: text("source_type").notNull().default("lista-precios"),
    /** Fabricante del herraje. "MACO" para esta lista. */
    supplier: text("supplier").notNull(),
    /** Marca de perfiles con la que estos herrajes son compatibles. "Aluplast" para esta lista. */
    brand: text("brand").notNull(),
    fileName: text("file_name").notNull(),
    fileHash: text("file_hash").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    /** Fecha de modificación del archivo origen, ISO. Es del archivo, no de la importación. */
    fileModifiedAt: text("file_modified_at").notNull().default(""),
    /** Etiqueta de revisión tal como la declara el propio archivo: "ABR_22". */
    revision: text("revision").notNull(),
    /** Desde cuándo rigen estos precios, ISO corto: "2022-05-01". */
    effectiveDate: text("effective_date").notNull(),
    currency: text("currency").notNull().default("EUR"),
    /** Condición comercial de la lista: "EXWORK Veracruz/México". */
    terms: text("terms").notNull().default(""),
    /** 1 = es la revisión con la que se cotiza. Ver la nota de arriba: ABR_22 entra en 0. */
    active: integer("active").notNull().default(0),
    /** 1 = lista histórica, conservada para trazabilidad. */
    historical: integer("historical").notNull().default(1),
    importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    // Idempotencia apoyada en el índice y no solo en el SELECT previo: dos importaciones
    // simultáneas del mismo libro llegarían las dos a "no existe".
    uniqueIndex("supplier_sources_hash_idx").on(table.fileHash),
    // Una sola fila por proveedor+tipo+revisión: reimportar ABR_22 desde una copia del archivo
    // con otro hash choca aquí en vez de crear una segunda revisión ABR_22 fantasma.
    uniqueIndex("supplier_sources_revision_idx").on(table.supplier, table.sourceType, table.revision),
    index("supplier_sources_brand_idx").on(table.brand, table.supplier),
  ]
);

// El artículo en sí, estable entre revisiones. No lleva precio: ver la nota de la sección.
//
// `sku` es TEXTO y no un entero aunque la lista traiga códigos como 100528. Dos razones: el mismo
// archivo mezcla códigos numéricos con códigos como "X11092", y un SKU con ceros a la izquierda
// ("0012") perdería los ceros al pasar por un entero -- y entonces dejaría de ser el código que
// el proveedor imprime en su caja.
export const supplierHardwareItems = sqliteTable(
  "supplier_hardware_items",
  {
    id: text("id").primaryKey(),
    supplier: text("supplier").notNull(),
    brand: text("brand").notNull(),
    sku: text("sku").notNull(),
    /** Segundo código del proveedor ("clave alterna"). Vacío cuando la lista no lo trae. */
    altKey: text("alt_key").notNull().default(""),
    /** Descripción original del proveedor. Se normalizan espacios y Unicode, NO se reescribe. */
    description: text("description").notNull(),
    /** Unidad comercial tal como viene ("pz"). */
    unit: text("unit").notNull().default(""),
    /** Presentación tal como viene ("pz", "caja"...). */
    presentation: text("presentation").notNull().default(""),
    /** Piezas por presentación. Texto para no inventar precisión donde el archivo no la da. */
    qtyPerPresentation: text("qty_per_presentation").notNull().default(""),
    /** Vacío salvo que la lista lo declare. NO se infiere de palabras de la descripción. */
    category: text("category").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("supplier_items_sku_idx").on(table.supplier, table.sku),
    index("supplier_items_alt_idx").on(table.supplier, table.altKey),
    index("supplier_items_brand_idx").on(table.brand, table.supplier),
  ]
);

// El precio de un artículo EN una revisión. Una revisión nueva agrega filas; nunca sobrescribe
// las viejas, así que el precio de 2022 sigue siendo consultable después de importar 2026.
//
// El precio NO se guarda en un REAL: el libro trae 11.379999999999999 donde el proveedor
// imprime 11.38, y un binario flotante conserva justamente esa basura. `unitPrice` es el decimal
// canónico en texto y es la FUENTE DE VERDAD; `unitPriceMinor`+`priceScale` son el mismo número
// como entero exacto (1138 con escala 2) para poder sumar y comparar sin volver a flotante.
export const supplierHardwarePrices = sqliteTable(
  "supplier_hardware_prices",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => supplierHardwareItems.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => supplierCatalogSources.id, { onDelete: "cascade" }),
    /** Decimal canónico en texto: "11.38". Fuente de verdad del precio. */
    unitPrice: text("unit_price").notNull(),
    /** El mismo precio como entero exacto: 1138. */
    unitPriceMinor: integer("unit_price_minor").notNull(),
    /** Decimales de `unitPriceMinor`: 2 para 1138 => 11.38. */
    priceScale: integer("price_scale").notNull().default(2),
    currency: text("currency").notNull().default("EUR"),
    effectiveDate: text("effective_date").notNull(),
    terms: text("terms").notNull().default(""),
    /** Fila del Excel de la que salió, para poder volver al origen y auditar el dato. */
    sourceRow: integer("source_row").notNull().default(0),
    importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    // Un solo precio por artículo y revisión. Es lo que hace idempotente la reimportación y lo
    // que impide que la misma lista deje dos precios distintos para el mismo SKU.
    uniqueIndex("supplier_prices_item_source_idx").on(table.itemId, table.sourceId),
    index("supplier_prices_source_idx").on(table.sourceId),
  ]
);

// Metadatos de un manual técnico del proveedor. Los binarios NO viven aquí: D1 no es un
// almacén de archivos y este proyecto todavía no tiene bucket privado (R2), así que se guarda
// la ubicación y el hash y el archivo se queda fuera del repositorio. `extractedText` solo se
// llena cuando el texto se pudo extraer de verdad.
//
// A la fecha de esta migración la carpeta de manuales MACO está vacía: la tabla existe para que
// importarlos después no requiera otra migración, no porque haya algo que guardar hoy.
export const supplierHardwareDocs = sqliteTable(
  "supplier_hardware_docs",
  {
    id: text("id").primaryKey(),
    supplier: text("supplier").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull().default(""),
    fileHash: text("file_hash").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    revision: text("revision").notNull().default(""),
    /** Ruta o llave de almacenamiento privado. Nunca una URL pública. */
    location: text("location").notNull().default(""),
    /** "pendiente" | "extraido" | "no-extraible". */
    extractionStatus: text("extraction_status").notNull().default("pendiente"),
    /** Texto extraído completo, cuando fue posible. Vacío si no. */
    extractedText: text("extracted_text").notNull().default(""),
    /** Página/ubicación de procedencia de lo extraído, para poder citar la fuente. */
    extractedLocation: text("extracted_location").notNull().default(""),
    importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("supplier_docs_hash_idx").on(table.supplier, table.fileHash),
    index("supplier_docs_brand_idx").on(table.brand, table.supplier),
  ]
);

// La lista de materiales que la lista de precios NO trae: qué SKU y cuántos lleva una
// configuración concreta de Aluplast. Es lo único que podría convertir un precio de proveedor en
// un costo de ventana, y por eso cada fila EXIGE de dónde salió (`docId` o `sourceRef` más
// `sourceLocation`) y en qué estado de verificación está.
//
// Nace y se queda VACÍA. Sin manual que lo pruebe no hay relación que escribir: deducir "esto es
// para corredera de 2 hojas" de las palabras de una descripción sería inventar una lista de
// materiales, y una cotización basada en eso sería falsa con apariencia de exacta. Ver
// lib/maco/costing.ts, que solo usa filas `verified`.
export const supplierHardwareMappings = sqliteTable(
  "supplier_hardware_mappings",
  {
    id: text("id").primaryKey(),
    /** Marca de perfiles: "Aluplast". */
    brand: text("brand").notNull(),
    /** Nombre del sistema tal como aparece en data/catalog.ts, p. ej. "CORREDERA 60MM". */
    system: text("system").notNull(),
    /** Tipo de apertura (WingType) al que aplica. Vacío = aplica a todo el sistema. */
    wingType: text("wing_type").notNull().default(""),
    /** Condición de medidas que debe cumplirse, si el manual la impone. Vacío = sin condición. */
    sizeCondition: text("size_condition").notNull().default(""),
    supplier: text("supplier").notNull(),
    sku: text("sku").notNull(),
    /** Piezas que lleva la configuración. Texto exacto por la misma razón que los precios. */
    qty: text("qty").notNull(),
    /** Documento que prueba la relación. Null solo si la prueba es `sourceRef`. */
    docId: text("doc_id").references(() => supplierHardwareDocs.id, { onDelete: "set null" }),
    /** Referencia documental cuando no hay archivo cargado (ficha, correo del proveedor...). */
    sourceRef: text("source_ref").notNull().default(""),
    /** Página o ubicación exacta dentro de la fuente. */
    sourceLocation: text("source_location").notNull().default(""),
    /** "verified" | "tentativo". Solo `verified` puede costear. */
    verification: text("verification").notNull().default("tentativo"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("supplier_mappings_unique_idx").on(
      table.brand,
      table.system,
      table.wingType,
      table.sizeCondition,
      table.supplier,
      table.sku
    ),
    index("supplier_mappings_lookup_idx").on(table.brand, table.system, table.verification),
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
