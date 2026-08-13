import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { components, projectOutcomes, projects, projectVersions } from "@/db/schema";
import { defaultComponentData } from "@/lib/componentDefaults";
import { INITIAL_PROJECT_STATUS, isProjectOrigin, isProjectStatus } from "@/lib/projectStatus";
import { emptyRequester, mergeRequester, normalizeRequester } from "@/lib/requester";
import type {
  ComponentConfigState,
  ComponentData,
  ComponentPatch,
  ComponentRecord,
  ComponentSummary,
  ProjectDraft,
  ProjectMeta,
  ProjectMetaPatch,
  ProjectOrigin,
  ProjectOutcome,
  ProjectRecord,
  ProjectSummary,
  ProjectVersionReason,
  ProjectVersionRow,
  Requester,
} from "@/types/project";

type Db = DrizzleD1Database<Record<string, unknown>>;

type ComponentRow = typeof components.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;

/** Semilla de un componente nuevo: todo lo que no es id/posición/fechas. */
type ComponentSeed = {
  code: string;
  designation: string;
  location: string;
  qty: number;
  widthMm: number;
  heightMm: number;
  brand: string;
  systemIndex: number;
  colorIndex: number;
  glassIndex?: number;
  typology?: string;
  configState?: ComponentConfigState;
  unitPrice?: number;
  total?: number;
  data: ComponentData;
};

function nowIso(): string {
  return new Date().toISOString();
}

function configState(value: string): ComponentConfigState {
  return value === "ok" || value === "alertas" ? value : "pendiente";
}

function toSummary(row: ComponentRow): ComponentSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    position: row.position,
    code: row.code,
    designation: row.designation,
    location: row.location,
    qty: row.qty,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    brand: row.brand as ComponentSummary["brand"],
    systemIndex: row.systemIndex,
    colorIndex: row.colorIndex,
    glassIndex: row.glassIndex,
    typology: row.typology,
    configState: configState(row.configState),
    unitPrice: row.unitPrice,
    total: row.total,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRecord(row: ComponentRow): ComponentRecord {
  return { ...toSummary(row), data: JSON.parse(row.data) as ComponentData };
}

/** La ficha del solicitante de una fila, completando a los proyectos guardados antes de que la
 * ficha existiera: su cliente vivía en la columna `client` y de ahí sale el nombre. */
function readRequester(row: ProjectRow): Requester {
  return normalizeRequester(safeJson(row.requester), {
    now: row.createdAt,
    fallbackName: row.client,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Una ficha ilegible no puede tumbar la lista de proyectos: se lee como ficha vacía y el
    // resto del proyecto (nombre, componentes, importes) sigue estando disponible.
    return {};
  }
}

function projectOrigin(row: ProjectRow): ProjectOrigin {
  if (isProjectOrigin(row.origin)) return row.origin;
  // Reserva para filas anteriores a la columna: una cotización del cotizador público entró desde
  // fuera de esta pantalla, así que es importada.
  return row.source === "web" ? "imported" : "platform";
}

function projectMetaFromRow(row: ProjectRow): ProjectMeta {
  return {
    id: row.id,
    name: row.name,
    folio: row.folio,
    origin: projectOrigin(row),
    source: row.source === "web" ? "web" : "interno",
    status: isProjectStatus(row.status) ? row.status : INITIAL_PROJECT_STATUS,
    requester: readRequester(row),
    currency: row.currency || "MXN",
    pricingListId: row.pricingListId,
    notes: row.notes,
    estimatedDate: row.estimatedDate,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    importedAt: row.importedAt,
    originalCreatedAt: row.originalCreatedAt,
    archivedAt: row.archivedAt,
    deletedAt: row.deletedAt,
    duplicatedFromId: row.duplicatedFromId,
    schemaVersion: row.schemaVersion,
  };
}

async function projectRecord(db: Db, row: ProjectRow): Promise<ProjectRecord> {
  const rows = await db
    .select()
    .from(components)
    .where(eq(components.projectId, row.id))
    .orderBy(components.position);
  return {
    ...projectMetaFromRow(row),
    activeComponentId: row.activeComponentId,
    client: row.client,
    components: rows.map(toSummary),
  };
}

// ---------- Folio del proyecto ----------

// Mismo reparto que en lib/quoteRepo.ts: el folio se reserva ESCRIBIENDO, no leyendo. Dos altas
// simultáneas calculan el mismo consecutivo y la segunda choca contra projects_folio_idx, así que
// vuelve a leer el máximo y reintenta. Si se agotan los intentos, el alta falla en vez de entregar
// un folio repetido.
const FOLIO_ATTEMPTS = 5;

/** Folio de los proyectos creados en la plataforma: LP-AAAA-NNNN.
 *
 *  Prefijo distinto del LUFT-AAAA-NNNNNN de las cotizaciones a propósito: son dos consecutivos de
 *  cosas distintas (un proyecto de trabajo y un documento entregado al cliente), y compartir
 *  formato haría creer que LP-2026-0007 y LUFT-2026-000007 tienen algo que ver. */
export function formatProjectFolio(year: number, seq: number): string {
  return `LP-${year}-${String(seq).padStart(4, "0")}`;
}

async function nextProjectSeq(db: Db, year: number): Promise<number> {
  const prefix = `LP-${year}-`;
  const rows = await db
    .select({ folio: projects.folio })
    .from(projects)
    .where(sql`${projects.folio} like ${`${prefix}%`}`);
  const max = rows.reduce((highest, row) => {
    const seq = Number(row.folio.slice(prefix.length));
    return Number.isFinite(seq) ? Math.max(highest, seq) : highest;
  }, 0);
  return max + 1;
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  return /UNIQUE|constraint/i.test(`${message}\n${cause}`);
}

/** Inserta el proyecto reservando su folio, reintentando solo si el consecutivo choca. */
async function insertProjectReservingFolio(
  db: Db,
  values: Omit<typeof projects.$inferInsert, "folio">
): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < FOLIO_ATTEMPTS; attempt++) {
    const folio = formatProjectFolio(year, (await nextProjectSeq(db, year)) + attempt);
    try {
      await db.insert(projects).values({ ...values, folio });
      return folio;
    } catch (error) {
      // Cualquier fallo que no sea el choque de consecutivo debe propagarse: reintentarlo cinco
      // veces solo retrasaría el mismo error.
      if (!isUniqueViolation(error) || attempt === FOLIO_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error("No se pudo reservar un folio único para el proyecto.");
}

// ---------- Lectura ----------

/** Qué proyectos entran en la lista. La papelera nunca se mezcla con lo demás. */
export type ProjectScope = "active" | "archived" | "all" | "trash";

function scopeFilter(scope: ProjectScope) {
  if (scope === "trash") return isNotNull(projects.deletedAt);
  if (scope === "archived") return and(isNull(projects.deletedAt), isNotNull(projects.archivedAt));
  if (scope === "active") return and(isNull(projects.deletedAt), isNull(projects.archivedAt));
  return isNull(projects.deletedAt);
}

// La lista del explorador de proyectos. Se resuelve en dos consultas (proyectos + una agregación
// agrupada) en vez de una por proyecto: con una cotización web por cliente, la lista crece con el
// negocio y un N+1 aquí se notaría antes que en cualquier otra pantalla.
//
// Se ordena por fecha de creación, no de modificación: es una bandeja de cotizaciones que llegan, y
// ordenar por `updatedAt` hacía que el proyecto que acabas de abandonar saltara al tope (salir de un
// proyecto guarda lo pendiente, y eso lo toca). La lista debe quedarse quieta mientras la recorres.
// El explorador reordena en el cliente cuando se le pide otro criterio, sobre la lista ya resuelta.
// `getMostRecentProject` sigue usando `updatedAt`: con esa la app abre en "tu último trabajo", que
// es otra pregunta.
export async function listProjectSummaries(db: Db, scope: ProjectScope = "all"): Promise<ProjectSummary[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(scopeFilter(scope))
    .orderBy(sql`${projects.createdAt} desc`);
  if (rows.length === 0) return [];

  const totals = await db
    .select({
      projectId: components.projectId,
      componentCount: sql<number>`count(*)`,
      pieceCount: sql<number>`coalesce(sum(${components.qty}), 0)`,
      total: sql<number>`coalesce(sum(${components.total}), 0)`,
    })
    .from(components)
    .groupBy(components.projectId);
  const byProject = new Map(totals.map((row) => [row.projectId, row]));

  return rows.map((row) => {
    const { requester, notes, ...rest } = projectMetaFromRow(row);
    const aggregate = byProject.get(row.id);
    // La ficha completa y las notas NO viajan en la lista: son el payload que el resumen evita. De la
    // ficha se sacan solo los cuatro campos por los que el explorador busca y filtra.
    void notes;
    return {
      ...rest,
      client: requester.fullName || row.client,
      company: requester.company,
      phone: requester.phone,
      email: requester.email,
      componentCount: Number(aggregate?.componentCount ?? 0),
      pieceCount: Number(aggregate?.pieceCount ?? 0),
      total: Number(aggregate?.total ?? 0),
    };
  });
}

/** El proyecto con el que abre la app: el último trabajado que sigue vivo y sin archivar.
 *
 *  Si no queda ninguno sin archivar se devuelve el último archivado antes que `null`: quien llama
 *  crea un proyecto nuevo cuando esto devuelve `null` (ver bootstrap en lib/persistence.ts), y con
 *  todos los proyectos archivados eso sembraría un proyecto vacío en cada carga. */
export async function getMostRecentProject(db: Db): Promise<ProjectRecord | null> {
  for (const scope of ["active", "all"] as const) {
    const [row] = await db
      .select()
      .from(projects)
      .where(scopeFilter(scope))
      .orderBy(sql`${projects.updatedAt} desc`)
      .limit(1);
    if (row) return projectRecord(db, row);
  }
  return null;
}

export async function getProject(db: Db, projectId: string): Promise<ProjectRecord | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!row) return null;
  return projectRecord(db, row);
}

/** Si el folio ya está tomado. Lo consulta la importación antes de reutilizar el folio de un
 *  archivo: dos proyectos no pueden compartirlo (projects_folio_idx). */
export async function findProjectIdByFolio(db: Db, folio: string): Promise<string | null> {
  if (!folio) return null;
  const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.folio, folio)).limit(1);
  return row?.id ?? null;
}

/** Los componentes completos de un proyecto (con árbol y marco), en orden. Lo usan la exportación
 * y el duplicado, que necesitan la configuración entera y no el resumen. */
export async function getProjectComponents(db: Db, projectId: string): Promise<ComponentRecord[]> {
  const rows = await db
    .select()
    .from(components)
    .where(eq(components.projectId, projectId))
    .orderBy(components.position);
  return rows.map(toRecord);
}

// ---------- Alta ----------

function componentSeedValues(seed: ComponentSeed) {
  return {
    code: seed.code,
    designation: seed.designation,
    location: seed.location,
    qty: seed.qty,
    widthMm: seed.widthMm,
    heightMm: seed.heightMm,
    brand: seed.brand,
    systemIndex: seed.systemIndex,
    colorIndex: seed.colorIndex,
    glassIndex: seed.glassIndex ?? seed.data.glassIndex ?? 7,
    typology: seed.typology ?? "",
    configState: seed.configState ?? "pendiente",
    unitPrice: seed.unitPrice ?? 0,
    total: seed.total ?? 0,
    // JSON.stringify aquí es también lo que garantiza que dos componentes sembrados desde el mismo
    // objeto `data` (duplicar, mover con copia) queden en filas independientes y no compartan
    // ninguna referencia mutable, que es el riesgo real al duplicar proyectos.
    data: JSON.stringify(seed.data),
  };
}

async function nextPosition(db: Db, projectId: string): Promise<number> {
  const rows = await db
    .select({ position: components.position })
    .from(components)
    .where(eq(components.projectId, projectId));
  return rows.reduce((max, r) => Math.max(max, r.position), -1) + 1;
}

function draftRequester(draft: ProjectDraft, now: string): Requester {
  return normalizeRequester(draft.requester ?? {}, { now });
}

/** Proyecto nuevo creado en la plataforma, con su primera ventana genérica lista para editar. */
export async function createProject(db: Db, draft: ProjectDraft = { name: "" }): Promise<ProjectRecord> {
  const projectId = crypto.randomUUID();
  const componentId = crypto.randomUUID();
  const now = nowIso();
  const requester = draftRequester(draft, now);

  await insertProjectReservingFolio(db, {
    id: projectId,
    name: draft.name?.trim() || "Proyecto sin nombre",
    activeComponentId: componentId,
    source: "interno",
    origin: "platform",
    status: INITIAL_PROJECT_STATUS,
    client: requester.fullName,
    requester: JSON.stringify(requester),
    notes: draft.notes?.trim() ?? "",
    currency: draft.currency?.trim() || "MXN",
    pricingListId: draft.pricingListId?.trim() ?? "",
    estimatedDate: draft.estimatedDate?.trim() ?? "",
    createdBy: draft.createdBy?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });

  await db.insert(components).values({
    id: componentId,
    projectId,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...componentSeedValues({
      code: "001",
      designation: "V01",
      location: "",
      qty: 1,
      widthMm: 4000,
      heightMm: 2200,
      brand: "Aluplast",
      systemIndex: 0,
      colorIndex: 1,
      data: defaultComponentData(),
    }),
  });

  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  return projectRecord(db, row);
}

/** Origen de un proyecto que se crea vacío porque ya trae sus propios componentes. */
export type EmptyProjectOrigin = {
  source?: ProjectRecord["source"];
  origin?: ProjectOrigin;
  folio?: string;
  client?: string;
  requester?: Partial<Requester>;
  status?: ProjectRecord["status"];
  notes?: string;
  currency?: string;
  importedAt?: string | null;
  originalCreatedAt?: string | null;
  createdAt?: string;
  duplicatedFromId?: string | null;
};

// Crea un proyecto vacío para flujos que ya traen todos sus componentes: el cotizador público, la
// importación de un archivo y el duplicado. Evita sembrar la ventana genérica que createProject()
// necesita en el editor.
//
// Sobre el folio hay tres casos y los tres importan:
//   - `folio` con valor: se respeta tal cual (el que traía el archivo importado). Un proyecto
//     importado no debe perder el folio con el que se lo conoce.
//   - `folio: ""`: se deja vacío a propósito porque quien llama lo va a etiquetar después. Es el
//     caso del cotizador público, donde el folio real no se conoce hasta reservar la cotización
//     (ver labelProjectWithFolio). Reservar uno aquí para sobrescribirlo dejaría huecos en el
//     consecutivo de la plataforma.
//   - `folio` ausente: se reserva uno nuevo (duplicados, y cualquier alta futura).
export async function createEmptyProject(
  db: Db,
  name: string,
  origin: EmptyProjectOrigin = {}
): Promise<ProjectRecord> {
  const id = crypto.randomUUID();
  const now = nowIso();
  const createdAt = origin.createdAt ?? now;
  // normalizeRequester y no mergeRequester: si la ficha llega de un archivo o de un duplicado, trae
  // su propia fecha de registro y hay que conservarla -- cuándo se registró al solicitante no es lo
  // mismo que cuándo entró el proyecto aquí.
  const requester = origin.requester
    ? normalizeRequester(origin.requester, { now, createdAt, updatedAt: now })
    : emptyRequester(createdAt);
  const values = {
    id,
    name,
    activeComponentId: null,
    source: origin.source ?? "interno",
    origin: origin.origin ?? "platform",
    status: origin.status ?? INITIAL_PROJECT_STATUS,
    client: origin.client ?? requester.fullName,
    requester: JSON.stringify(requester),
    notes: origin.notes ?? "",
    currency: origin.currency || "MXN",
    createdAt,
    updatedAt: now,
    importedAt: origin.importedAt ?? null,
    originalCreatedAt: origin.originalCreatedAt ?? null,
    duplicatedFromId: origin.duplicatedFromId ?? null,
    schemaVersion: 1,
  } satisfies Omit<typeof projects.$inferInsert, "folio">;

  if (origin.folio === undefined) {
    await insertProjectReservingFolio(db, values);
  } else {
    await db.insert(projects).values({ ...values, folio: origin.folio });
  }

  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return projectRecord(db, row);
}

// Etiqueta un proyecto con el folio de la cotización que lo originó. Es un paso aparte de
// createEmptyProject porque el folio se reserva escribiendo la cotización (ver lib/quoteRepo.ts), y
// el proyecto tiene que existir antes para poder guardar su id en el expediente.
export async function labelProjectWithFolio(db: Db, projectId: string, folio: string, name: string): Promise<void> {
  await db
    .update(projects)
    .set({ name, folio, updatedAt: nowIso() })
    .where(eq(projects.id, projectId));
}

export async function getOrCreateProjectByName(db: Db, name: string): Promise<ProjectRecord> {
  const [existing] = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
  if (existing) return projectRecord(db, existing);
  return createEmptyProject(db, name);
}

// ---------- Metadatos ----------

/** Un único punto de escritura para el nombre, la etapa, la ficha del solicitante y las
 * preferencias comerciales. Todo lo demás (renombrar, cambiar etapa) pasa por aquí para que la
 * fecha de modificación y el espejo de `client` no se puedan olvidar en un camino. */
export async function updateProjectMeta(
  db: Db,
  projectId: string,
  patch: ProjectMetaPatch
): Promise<ProjectRecord | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!row) return null;
  const now = nowIso();
  const changes: Partial<typeof projects.$inferInsert> = { updatedAt: now };

  if (typeof patch.name === "string" && patch.name.trim()) changes.name = patch.name.trim();
  if (patch.status && isProjectStatus(patch.status)) changes.status = patch.status;
  if (typeof patch.currency === "string" && patch.currency.trim()) changes.currency = patch.currency.trim();
  if (typeof patch.pricingListId === "string") changes.pricingListId = patch.pricingListId.trim();
  if (typeof patch.notes === "string") changes.notes = patch.notes;
  if (typeof patch.estimatedDate === "string") changes.estimatedDate = patch.estimatedDate.trim();
  if (typeof patch.activeComponentId === "string") changes.activeComponentId = patch.activeComponentId;
  if (patch.requester) {
    const requester = mergeRequester(readRequester(row), patch.requester, now);
    changes.requester = JSON.stringify(requester);
    // `client` se mantiene como espejo del nombre para no romper lo que ya lo leía.
    changes.client = requester.fullName;
  }

  await db.update(projects).set(changes).where(eq(projects.id, projectId));
  return getProject(db, projectId);
}

export async function renameProject(db: Db, projectId: string, name: string): Promise<void> {
  await updateProjectMeta(db, projectId, { name });
}

export async function setActiveComponent(db: Db, projectId: string, componentId: string): Promise<void> {
  await db
    .update(projects)
    .set({ activeComponentId: componentId, updatedAt: nowIso() })
    .where(eq(projects.id, projectId));
}

/** Archivar es reversible y no toca la etapa comercial: ver lib/projectStatus.ts. */
export async function setProjectArchived(db: Db, projectId: string, archived: boolean): Promise<void> {
  await db
    .update(projects)
    .set({ archivedAt: archived ? nowIso() : null, updatedAt: nowIso() })
    .where(eq(projects.id, projectId));
}

// ---------- Papelera ----------

// Borrar marca, no elimina. Es lo que hace que "Deshacer" pueda deshacer de verdad y que un clic
// accidental no se lleve una cotización con veinte componentes. La eliminación definitiva es
// purgeProject y es explícita.
export async function deleteProject(db: Db, projectId: string): Promise<void> {
  const now = nowIso();
  await db.update(projects).set({ deletedAt: now, updatedAt: now }).where(eq(projects.id, projectId));
}

export async function restoreProject(db: Db, projectId: string): Promise<ProjectRecord | null> {
  await db.update(projects).set({ deletedAt: null, updatedAt: nowIso() }).where(eq(projects.id, projectId));
  return getProject(db, projectId);
}

/** Eliminación definitiva. Los componentes caen con el proyecto por la clave foránea en cascada. */
export async function purgeProject(db: Db, projectId: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, projectId));
}

// ---------- Duplicado ----------

/**
 * Copia un proyecto entero: metadatos, ficha del solicitante y todos sus componentes.
 *
 * El duplicado nace con folio nuevo (lo reserva createEmptyProject), con sus propias fechas de
 * creación y modificación, y guardando de qué proyecto salió en `duplicatedFromId` -- que es la
 * relación opcional con el original que pide §6, y es solo eso: una referencia para poder
 * rastrearlo, no un vínculo que sincronice nada.
 *
 * Los componentes se copian a filas nuevas con ids nuevos, y su configuración pasa por
 * JSON.stringify: ni un solo objeto queda compartido entre el original y la copia, así que editar
 * uno no puede tocar al otro.
 */
export async function duplicateProject(db: Db, projectId: string, name?: string): Promise<ProjectRecord | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!row) return null;
  const sourceComponents = await getProjectComponents(db, projectId);
  const now = nowIso();

  const copy = await createEmptyProject(db, name?.trim() || `${row.name} (copia)`, {
    source: row.source === "web" ? "web" : "interno",
    origin: projectOrigin(row),
    client: row.client,
    requester: readRequester(row),
    status: isProjectStatus(row.status) ? row.status : INITIAL_PROJECT_STATUS,
    notes: row.notes,
    currency: row.currency,
    createdAt: now,
    originalCreatedAt: row.originalCreatedAt,
    importedAt: row.importedAt,
    duplicatedFromId: row.id,
  });

  let firstComponentId = "";
  for (const [index, source] of sourceComponents.entries()) {
    const id = crypto.randomUUID();
    if (!firstComponentId) firstComponentId = id;
    await db.insert(components).values({
      id,
      projectId: copy.id,
      position: index,
      createdAt: now,
      updatedAt: now,
      ...componentSeedValues(source),
    });
  }
  if (firstComponentId) await setActiveComponent(db, copy.id, firstComponentId);

  return getProject(db, copy.id);
}

// ---------- Componentes ----------

export async function getComponent(db: Db, projectId: string, componentId: string): Promise<ComponentRecord | null> {
  const [row] = await db
    .select()
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.id, componentId)));
  return row ? toRecord(row) : null;
}

export async function createComponent(
  db: Db,
  projectId: string,
  opts?: { duplicateFromId?: string }
): Promise<ComponentRecord> {
  const now = nowIso();
  const position = await nextPosition(db, projectId);
  const id = crypto.randomUUID();

  let seed: ComponentSeed;
  if (opts?.duplicateFromId) {
    const source = await getComponent(db, projectId, opts.duplicateFromId);
    if (!source) throw new Error("El componente a duplicar no existe.");
    seed = { ...source, designation: `${source.designation} (copia)` };
  } else {
    const data = defaultComponentData();
    seed = {
      code: String(position + 1).padStart(3, "0"),
      designation: `V${String(position + 1).padStart(2, "0")}`,
      location: "",
      qty: 1,
      widthMm: 4000,
      heightMm: 2200,
      brand: "Aluplast",
      systemIndex: 0,
      colorIndex: 1,
      data,
    };
  }

  await db.insert(components).values({
    id,
    projectId,
    position,
    createdAt: now,
    updatedAt: now,
    ...componentSeedValues(seed),
  });
  await touchProject(db, projectId, now);

  const [row] = await db
    .select()
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.id, id)));
  return toRecord(row);
}

export async function createComponentWithData(db: Db, projectId: string, seed: ComponentSeed): Promise<ComponentRecord> {
  const now = nowIso();
  const position = await nextPosition(db, projectId);
  const id = crypto.randomUUID();

  await db.insert(components).values({
    id,
    projectId,
    position,
    createdAt: now,
    updatedAt: now,
    ...componentSeedValues(seed),
  });
  await touchProject(db, projectId, now);

  const [row] = await db
    .select()
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.id, id)));
  return toRecord(row);
}

/** Lo que devuelve updateComponent. `conflict` significa que alguien más guardó ese componente
 *  después de la versión que trae quien escribe: no se sobrescribe nada y se devuelve lo que hay en
 *  el servidor para que se pueda decidir. */
export type UpdateComponentResult =
  | { status: "ok"; component: ComponentRecord }
  | { status: "missing" }
  | { status: "conflict"; component: ComponentRecord };

export async function updateComponent(
  db: Db,
  projectId: string,
  componentId: string,
  patch: ComponentPatch,
  /**
   * Fecha de modificación que quien escribe cree que tiene el componente.
   *
   * Es control de concurrencia optimista, y resuelve el caso que el aviso entre pestañas no puede
   * cubrir: dos personas en dos computadoras distintas editando el mismo componente. El autoguardado
   * envía el ESTADO COMPLETO, así que sin esta comprobación la última escritura gana y se lleva por
   * delante el trabajo de la otra sin que nadie se entere.
   *
   * Se compara contra `updatedAt` en vez de llevar un contador de versión aparte porque ya existe, ya
   * cambia en cada escritura y ya viaja al cliente en cada respuesta.
   *
   * Si no se envía, no se comprueba: los flujos del servidor que reescriben un componente a propósito
   * (importar, restaurar, mover) no tienen ninguna versión previa que declarar.
   */
  expectedUpdatedAt?: string
): Promise<UpdateComponentResult> {
  const existing = await getComponent(db, projectId, componentId);
  if (!existing) return { status: "missing" };
  if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
    return { status: "conflict", component: existing };
  }
  const now = nowIso();

  const nextData = patch.data ? { ...existing.data, ...patch.data } : existing.data;
  await db
    .update(components)
    .set({
      code: patch.code ?? existing.code,
      designation: patch.designation ?? existing.designation,
      location: patch.location ?? existing.location,
      qty: patch.qty ?? existing.qty,
      widthMm: patch.widthMm ?? existing.widthMm,
      heightMm: patch.heightMm ?? existing.heightMm,
      brand: patch.brand ?? existing.brand,
      systemIndex: patch.systemIndex ?? existing.systemIndex,
      colorIndex: patch.colorIndex ?? existing.colorIndex,
      glassIndex: patch.glassIndex ?? nextData.glassIndex ?? existing.glassIndex,
      typology: patch.typology ?? existing.typology,
      configState: patch.configState ? configState(patch.configState) : existing.configState,
      unitPrice: patch.unitPrice ?? existing.unitPrice,
      total: patch.total ?? existing.total,
      data: JSON.stringify(nextData),
      updatedAt: now,
    })
    .where(and(eq(components.projectId, projectId), eq(components.id, componentId)));
  await touchProject(db, projectId, now);

  const saved = await getComponent(db, projectId, componentId);
  return saved ? { status: "ok", component: saved } : { status: "missing" };
}

export async function deleteComponent(db: Db, projectId: string, componentId: string): Promise<void> {
  await db.delete(components).where(and(eq(components.projectId, projectId), eq(components.id, componentId)));
  await touchProject(db, projectId, nowIso());
}

/**
 * Mueve o copia componentes a otro proyecto.
 *
 * En modo "move" se reescribe el `projectId` de las filas, así que el componente conserva su
 * identidad y su fecha de creación: es el mismo componente en otro proyecto, no uno nuevo. En modo
 * "copy" se insertan filas nuevas con ids nuevos y la configuración reserializada, sin compartir
 * ninguna referencia con el original.
 *
 * Las posiciones se renumeran al final en el proyecto de origen para que no queden huecos, y las
 * nuevas se anexan al final del destino.
 */
export async function transferComponents(
  db: Db,
  fromProjectId: string,
  componentIds: string[],
  toProjectId: string,
  mode: "move" | "copy"
): Promise<{ moved: number }> {
  if (componentIds.length === 0) return { moved: 0 };
  if (mode === "move" && fromProjectId === toProjectId) return { moved: 0 };

  const [target] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, toProjectId));
  if (!target) throw new Error("El proyecto de destino no existe.");

  const rows = await db
    .select()
    .from(components)
    .where(and(eq(components.projectId, fromProjectId), inArray(components.id, componentIds)))
    .orderBy(components.position);
  if (rows.length === 0) return { moved: 0 };

  const now = nowIso();
  let position = await nextPosition(db, toProjectId);

  for (const row of rows) {
    if (mode === "copy") {
      await db.insert(components).values({
        id: crypto.randomUUID(),
        projectId: toProjectId,
        position: position++,
        createdAt: now,
        updatedAt: now,
        ...componentSeedValues(toRecord(row)),
      });
    } else {
      await db
        .update(components)
        .set({ projectId: toProjectId, position: position++, updatedAt: now })
        .where(eq(components.id, row.id));
    }
  }

  if (mode === "move") {
    await resequenceComponents(db, fromProjectId);
    // Si el proyecto de origen se queda sin el componente que tenía abierto, se abre el primero
    // que le quede: dejar apuntando a uno que ya vive en otro proyecto haría que abrirlo fallara.
    const [source] = await db.select().from(projects).where(eq(projects.id, fromProjectId));
    if (source) {
      const remaining = await db
        .select({ id: components.id })
        .from(components)
        .where(eq(components.projectId, fromProjectId))
        .orderBy(components.position)
        .limit(1);
      if (!source.activeComponentId || componentIds.includes(source.activeComponentId)) {
        await db
          .update(projects)
          .set({ activeComponentId: remaining[0]?.id ?? null, updatedAt: now })
          .where(eq(projects.id, fromProjectId));
      }
    }
  }

  await touchProject(db, fromProjectId, now);
  await touchProject(db, toProjectId, now);
  return { moved: rows.length };
}

/** Renumera las posiciones de 0..n-1 conservando el orden actual. */
async function resequenceComponents(db: Db, projectId: string): Promise<void> {
  const rows = await db
    .select({ id: components.id })
    .from(components)
    .where(eq(components.projectId, projectId))
    .orderBy(components.position);
  for (const [index, row] of rows.entries()) {
    await db.update(components).set({ position: index }).where(eq(components.id, row.id));
  }
}

async function touchProject(db: Db, projectId: string, now: string): Promise<void> {
  await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));
}

// ---------- Puntos de restauración ----------

function versionReason(value: string): ProjectVersionReason {
  return value === "antes-de-importar" || value === "antes-de-restaurar" ? value : "manual";
}

/** Cuántos puntos se conservan por proyecto. Los más viejos se van al crear uno nuevo: cada punto
 *  guarda el proyecto entero, así que sin tope la base crecería sin límite por proyecto. */
const MAX_VERSIONS_PER_PROJECT = 20;

/** Guarda el proyecto entero como punto de restauración. `snapshot` lo produce quien llama, porque
 *  serializarlo requiere el formato de archivo y este módulo no debe depender de él. */
export async function saveProjectVersion(
  db: Db,
  projectId: string,
  snapshot: string,
  meta: { label?: string; reason?: ProjectVersionReason; componentCount: number; total: number }
): Promise<ProjectVersionRow> {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  await db.insert(projectVersions).values({
    id,
    projectId,
    label: meta.label?.trim().slice(0, 120) ?? "",
    reason: meta.reason ?? "manual",
    componentCount: meta.componentCount,
    total: meta.total,
    snapshot,
    createdAt,
  });

  const rows = await db
    .select({ id: projectVersions.id })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(sql`${projectVersions.createdAt} desc`);
  const extra = rows.slice(MAX_VERSIONS_PER_PROJECT).map((row) => row.id);
  if (extra.length > 0) await db.delete(projectVersions).where(inArray(projectVersions.id, extra));

  return {
    id,
    projectId,
    label: meta.label?.trim().slice(0, 120) ?? "",
    reason: meta.reason ?? "manual",
    componentCount: meta.componentCount,
    total: meta.total,
    createdAt,
  };
}

/** La lista de puntos, sin arrastrar los snapshots: es lo que se pinta, y cada snapshot es el proyecto
 *  completo. */
export async function listProjectVersions(db: Db, projectId: string): Promise<ProjectVersionRow[]> {
  const rows = await db
    .select({
      id: projectVersions.id,
      projectId: projectVersions.projectId,
      label: projectVersions.label,
      reason: projectVersions.reason,
      componentCount: projectVersions.componentCount,
      total: projectVersions.total,
      createdAt: projectVersions.createdAt,
    })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(sql`${projectVersions.createdAt} desc`);
  return rows.map((row) => ({ ...row, reason: versionReason(row.reason) }));
}

export async function getProjectVersionSnapshot(db: Db, projectId: string, versionId: string): Promise<string | null> {
  const [row] = await db
    .select({ snapshot: projectVersions.snapshot })
    .from(projectVersions)
    .where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.id, versionId)))
    .limit(1);
  return row?.snapshot ?? null;
}

// ---------- Cierre de obra ----------

export async function getProjectOutcome(db: Db, projectId: string): Promise<ProjectOutcome | null> {
  const [row] = await db.select().from(projectOutcomes).where(eq(projectOutcomes.projectId, projectId)).limit(1);
  return row ?? null;
}

/**
 * Registra (o corrige) el cierre de obra.
 *
 * `quotedTotal` y `quotedPieces` se toman de lo que el proyecto tiene cotizado EN ESTE MOMENTO y se
 * congelan la primera vez: la comparación tiene que ser contra lo que se cotizó, no contra lo que
 * diría el catálogo el día que alguien vuelva a mirar la cifra. Al corregir un cierre ya existente se
 * conservan las cifras congeladas y la fecha de cierre original.
 */
export async function saveProjectOutcome(
  db: Db,
  projectId: string,
  input: { actualCost: number; actualRevenue: number; piecesBuilt: number; notes: string }
): Promise<ProjectOutcome | null> {
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  const [totals] = await db
    .select({
      pieceCount: sql<number>`coalesce(sum(${components.qty}), 0)`,
      total: sql<number>`coalesce(sum(${components.total}), 0)`,
    })
    .from(components)
    .where(eq(components.projectId, projectId));

  const now = nowIso();
  const existing = await getProjectOutcome(db, projectId);
  const clean = {
    actualCost: Math.max(0, Math.round(input.actualCost)),
    actualRevenue: Math.max(0, Math.round(input.actualRevenue)),
    piecesBuilt: Math.max(0, Math.round(input.piecesBuilt)),
    notes: input.notes.slice(0, 2000),
  };

  if (existing) {
    await db.update(projectOutcomes).set({ ...clean, updatedAt: now }).where(eq(projectOutcomes.projectId, projectId));
  } else {
    await db.insert(projectOutcomes).values({
      projectId,
      quotedTotal: Number(totals?.total ?? 0),
      quotedPieces: Number(totals?.pieceCount ?? 0),
      ...clean,
      closedAt: now,
      updatedAt: now,
    });
  }
  await touchProject(db, projectId, now);
  return getProjectOutcome(db, projectId);
}

export async function deleteProjectOutcome(db: Db, projectId: string): Promise<void> {
  await db.delete(projectOutcomes).where(eq(projectOutcomes.projectId, projectId));
}
