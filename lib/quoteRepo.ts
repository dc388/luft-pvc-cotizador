import { and, eq, like, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { customers, projects, quoteEvents, quotes } from "@/db/schema";
import { INITIAL_QUOTE_STATUS, type QuoteStatus } from "@/lib/quoteStatus";
import type { QuoteCustomerInput } from "@/lib/quoteDocument";
import type { QuoteEventRow, QuoteListRow, QuoteSnapshot } from "@/types/quote";

type Db = DrizzleD1Database<Record<string, unknown>>;

// Expediente comercial: el cliente, sus cotizaciones y la bitácora de cada una.
//
// Vive aparte de lib/projectRepo.ts porque son dos capas distintas sobre la misma base: aquel
// administra lo que se fabrica (proyectos y componentes), éste administra la oportunidad
// comercial. Una cotización apunta a su carpeta de trabajo con `projectId`, pero sobrevive si la
// carpeta se borra.

/** Solo los dígitos. Es la llave con la que se reconoce a un cliente que vuelve: "993 221 1158",
 *  "+52 9932211158" y "9932211158" son la misma persona, y guardarlos como tres clientes distintos
 *  es exactamente el duplicado que hay que evitar.
 *  Los dígitos se toman por la derecha: el mismo número con y sin lada de país (52) debe coincidir. */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Devuelve el cliente existente o crea uno nuevo. Se busca primero por teléfono (la llave fuerte)
 * y después por correo, porque el mismo cliente puede cambiar de número pero rara vez de correo.
 *
 * Los datos NUEVOS se escriben encima cuando traen contenido: si en la segunda cotización ya
 * escribió su correo o su dirección, el expediente debe quedarse con el dato más completo. Nunca
 * se borra un dato existente con una cadena vacía.
 */
export async function upsertCustomer(db: Db, input: QuoteCustomerInput): Promise<{ id: string; created: boolean }> {
  const key = phoneKey(input.phone);
  const email = input.email.trim().toLowerCase();

  const byPhone = key ? await db.select().from(customers).where(eq(customers.phoneKey, key)).limit(1) : [];
  const existing = byPhone[0]
    ?? (email ? (await db.select().from(customers).where(eq(customers.email, email)).limit(1))[0] : undefined);

  const now = nowIso();
  if (existing) {
    await db
      .update(customers)
      .set({
        name: input.name || existing.name,
        phone: input.phone || existing.phone,
        email: email || existing.email,
        company: input.company || existing.company,
        city: input.city || existing.city,
        postalCode: input.postalCode || existing.postalCode,
        address: input.address || existing.address,
        updatedAt: now,
      })
      .where(eq(customers.id, existing.id));
    return { id: existing.id, created: false };
  }

  const id = crypto.randomUUID();
  await db.insert(customers).values({
    id,
    name: input.name,
    phoneKey: key,
    phone: input.phone,
    email,
    company: input.company,
    city: input.city,
    postalCode: input.postalCode,
    address: input.address,
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

// Cuántas veces se reintenta el consecutivo. El folio se reserva escribiendo, no leyendo: dos
// envíos simultáneos calculan el mismo número y el segundo choca contra el índice único
// (quotes_folio_seq_idx), así que vuelve a leer el máximo y reintenta. Cinco intentos cubren
// holgadamente la concurrencia real de un cotizador; si se agotan, el envío falla en vez de
// entregar un folio repetido.
const FOLIO_ATTEMPTS = 5;

export function formatFolio(year: number, seq: number): string {
  return `LUFT-${year}-${String(seq).padStart(6, "0")}`;
}

// El consecutivo se calcula contra LAS DOS tablas, no solo contra `quotes`.
//
// Un folio ya estampado en un proyecto está consumido igual que uno guardado en una cotización:
// `projects.folio` lleva índice único parcial, así que reemitirlo hace fallar el etiquetado. Mirando
// solo `max(quotes.folioSeq)` eso pasaba en dos escenarios reales:
//   - se borra una cotización y el contador RETROCEDE, mientras el proyecto conserva su folio;
//   - una importación trae el folio dentro del archivo (ver lib/projectImport.ts).
// En ambos, el siguiente envío chocaba y el cliente veía "no pudimos guardar tu cotización".
async function nextSeq(db: Db, year: number): Promise<number> {
  const prefix = `LUFT-${year}-`;
  const [fromQuotes] = await db
    .select({ max: sql<number>`coalesce(max(${quotes.folioSeq}), 0)` })
    .from(quotes)
    .where(eq(quotes.folioYear, year));
  const [fromProjects] = await db
    .select({
      max: sql<number>`coalesce(max(cast(substr(${projects.folio}, ${prefix.length + 1}) as integer)), 0)`,
    })
    .from(projects)
    .where(sql`${projects.folio} like ${`${prefix}%`}`);
  return Math.max(Number(fromQuotes?.max ?? 0), Number(fromProjects?.max ?? 0)) + 1;
}

export type CreateQuoteInput = {
  customerId: string;
  projectId: string | null;
  projectName: string;
  notes: string;
  itemCount: number;
  pieceCount: number;
  total: number;
  /** Recibe el folio ya reservado y devuelve el documento congelado. El snapshot lleva el folio
   *  dentro (encabezado y códigos de renglón), así que no se puede armar antes de tenerlo. */
  snapshotFor: (folio: string, issuedAt: string) => QuoteSnapshot;
  /** Estampa el folio en la carpeta de trabajo. Se ejecuta DENTRO del reintento y ANTES de insertar
   *  la cotización, a propósito: es la escritura que puede chocar contra el índice único parcial de
   *  `projects.folio`, y si choca aquí todavía no existe ninguna cotización que quede huérfana.
   *  Opcional: quien no tenga carpeta que etiquetar lo omite. */
  reserveFolioOnProject?: (folio: string) => Promise<void>;
};

export type CreatedQuote = { id: string; folio: string; token: string; snapshot: QuoteSnapshot };

export async function createQuote(db: Db, input: CreateQuoteInput): Promise<CreatedQuote> {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < FOLIO_ATTEMPTS; attempt++) {
    const seq = (await nextSeq(db, year)) + attempt;
    const folio = formatFolio(year, seq);
    const id = crypto.randomUUID();
    // Dos UUID concatenados: la URL del documento es la única credencial que lo abre, así que
    // se le da margen de sobra contra la fuerza bruta. No es un dato que el cliente teclee.
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const issuedAt = nowIso();
    const snapshot = input.snapshotFor(folio, issuedAt);

    try {
      // PRIMERO la carpeta. Si el folio ya lo tiene otro proyecto, esto lanza y el reintento pasa al
      // siguiente consecutivo sin haber creado nada: ni cotización huérfana, ni folio quemado, ni el
      // "no pudimos guardar tu cotización" que veía el cliente al terminar el embudo.
      if (input.reserveFolioOnProject) await input.reserveFolioOnProject(folio);
      await db.insert(quotes).values({
        id,
        folio,
        folioYear: year,
        folioSeq: seq,
        token,
        customerId: input.customerId,
        projectId: input.projectId,
        projectName: input.projectName,
        notes: input.notes,
        status: INITIAL_QUOTE_STATUS,
        itemCount: input.itemCount,
        pieceCount: input.pieceCount,
        total: input.total,
        snapshot: JSON.stringify(snapshot),
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
      await db.insert(quoteEvents).values({
        id: crypto.randomUUID(),
        quoteId: id,
        status: INITIAL_QUOTE_STATUS,
        note: "Cotización generada desde el cotizador público.",
        createdAt: issuedAt,
      });
      return { id, folio, token, snapshot };
    } catch (error) {
      // Solo el choque de consecutivo se reintenta. Cualquier otro fallo de escritura debe
      // propagarse: reintentarlo cinco veces solo retrasaría el mismo error.
      const message = error instanceof Error ? error.message : "";
      if (!/UNIQUE|constraint/i.test(message) || attempt === FOLIO_ATTEMPTS - 1) throw error;
    }
  }

  throw new Error("No se pudo reservar un folio único para la cotización.");
}

function toRow(
  quote: typeof quotes.$inferSelect,
  customer: typeof customers.$inferSelect,
  customerQuoteCount: number
): QuoteListRow {
  return {
    id: quote.id,
    folio: quote.folio,
    token: quote.token,
    status: quote.status as QuoteStatus,
    projectId: quote.projectId,
    projectName: quote.projectName,
    notes: quote.notes,
    itemCount: quote.itemCount,
    pieceCount: quote.pieceCount,
    total: quote.total,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      company: customer.company,
      city: customer.city,
      postalCode: customer.postalCode,
      address: customer.address,
    },
    customerQuoteCount,
  };
}

export type QuoteSearch = {
  /** Texto libre: nombre, teléfono, correo, folio, empresa o proyecto. */
  q?: string;
  status?: QuoteStatus;
  /** Fechas ISO (solo día). `from` incluye el día completo; `to` también. */
  from?: string;
  to?: string;
  limit?: number;
};

/** La libreta de clientes del panel interno. Una consulta con join más un conteo agrupado, no
 *  una consulta por cotización: la lista crece con el negocio y un N+1 aquí se notaría antes que
 *  en cualquier otra pantalla. */
export async function listQuotes(db: Db, search: QuoteSearch = {}): Promise<QuoteListRow[]> {
  const filters = [];
  const term = search.q?.trim();
  if (term) {
    const pattern = `%${term.toLowerCase()}%`;
    // El teléfono se busca también por dígitos: quien pega "993 221 1158" del WhatsApp debe
    // encontrar al cliente guardado como "9932211158".
    const digits = term.replace(/\D/g, "");
    const clauses = [
      like(sql`lower(${customers.name})`, pattern),
      like(sql`lower(${customers.email})`, pattern),
      like(sql`lower(${customers.company})`, pattern),
      like(sql`lower(${customers.city})`, pattern),
      like(sql`lower(${quotes.folio})`, pattern),
      like(sql`lower(${quotes.projectName})`, pattern),
    ];
    if (digits.length >= 3) clauses.push(like(customers.phoneKey, `%${digits.length > 10 ? digits.slice(-10) : digits}%`));
    filters.push(or(...clauses));
  }
  if (search.status) filters.push(eq(quotes.status, search.status));
  // `createdAt` es ISO completo, así que el día final se compara contra su límite superior.
  if (search.from) filters.push(sql`${quotes.createdAt} >= ${search.from}`);
  if (search.to) filters.push(sql`${quotes.createdAt} <= ${`${search.to}T23:59:59.999Z`}`);

  const rows = await db
    .select({ quote: quotes, customer: customers })
    .from(quotes)
    .innerJoin(customers, eq(quotes.customerId, customers.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(sql`${quotes.createdAt} desc`)
    .limit(Math.min(Math.max(search.limit ?? 200, 1), 500));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ customerId: quotes.customerId, total: sql<number>`count(*)` })
    .from(quotes)
    .groupBy(quotes.customerId);
  const byCustomer = new Map(counts.map((entry) => [entry.customerId, Number(entry.total)]));

  return rows.map((row) => toRow(row.quote, row.customer, byCustomer.get(row.customer.id) ?? 1));
}

export async function getQuoteByToken(db: Db, token: string): Promise<{ folio: string; snapshot: string; status: QuoteStatus } | null> {
  // Sin longitud mínima cualquier cadena corta se convertiría en una consulta a la base.
  if (!/^[a-f0-9]{32,80}$/i.test(token)) return null;
  const [row] = await db.select().from(quotes).where(eq(quotes.token, token)).limit(1);
  return row ? { folio: row.folio, snapshot: row.snapshot, status: row.status as QuoteStatus } : null;
}

/** Devuelve el importe de la cotización movida (o `null` si no existe) y no solo un booleano: quien
 *  llama registra el resultado comercial en las estadísticas de mejora y necesita el importe, que es
 *  el único dato no personal que tiene sentido guardar de una cotización cerrada. */
export async function setQuoteStatus(
  db: Db,
  quoteId: string,
  status: QuoteStatus,
  note = ""
): Promise<{ total: number } | null> {
  const now = nowIso();
  const [existing] = await db.select({ id: quotes.id, total: quotes.total }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!existing) return null;
  await db.update(quotes).set({ status, updatedAt: now }).where(eq(quotes.id, quoteId));
  await db.insert(quoteEvents).values({ id: crypto.randomUUID(), quoteId, status, note, createdAt: now });
  return { total: existing.total };
}

export async function listQuoteEvents(db: Db, quoteId: string): Promise<QuoteEventRow[]> {
  const rows = await db
    .select()
    .from(quoteEvents)
    .where(eq(quoteEvents.quoteId, quoteId))
    .orderBy(sql`${quoteEvents.createdAt} desc`);
  return rows.map((row) => ({
    id: row.id,
    status: row.status as QuoteStatus,
    note: row.note,
    createdAt: row.createdAt,
  }));
}
