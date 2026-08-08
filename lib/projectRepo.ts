import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { components, projects } from "@/db/schema";
import { defaultComponentData } from "@/lib/componentDefaults";
import type { ComponentData, ComponentPatch, ComponentRecord, ComponentSummary, ProjectRecord } from "@/types/project";

type Db = DrizzleD1Database<Record<string, unknown>>;

type ComponentRow = typeof components.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRecord(row: ComponentRow): ComponentRecord {
  return { ...toSummary(row), data: JSON.parse(row.data) as ComponentData };
}

async function nextPosition(db: Db, projectId: string): Promise<number> {
  const rows = await db
    .select({ position: components.position })
    .from(components)
    .where(eq(components.projectId, projectId));
  return rows.reduce((max, r) => Math.max(max, r.position), -1) + 1;
}

async function projectRecord(db: Db, row: ProjectRow): Promise<ProjectRecord> {
  const rows = await db
    .select()
    .from(components)
    .where(eq(components.projectId, row.id))
    .orderBy(components.position);
  return {
    id: row.id,
    name: row.name,
    activeComponentId: row.activeComponentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    components: rows.map(toSummary),
  };
}

export async function getMostRecentProject(db: Db): Promise<ProjectRecord | null> {
  const [row] = await db.select().from(projects).orderBy(sql`${projects.updatedAt} desc`).limit(1);
  if (!row) return null;
  return projectRecord(db, row);
}

export async function createProject(db: Db, name = "Proyecto sin nombre"): Promise<ProjectRecord> {
  const projectId = crypto.randomUUID();
  const componentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const data = defaultComponentData();

  await db.insert(projects).values({ id: projectId, name, activeComponentId: componentId, createdAt: now, updatedAt: now });
  await db.insert(components).values({
    id: componentId,
    projectId,
    position: 0,
    code: "001",
    designation: "V01",
    location: "",
    qty: 1,
    widthMm: 4000,
    heightMm: 2200,
    brand: "Aluplast",
    systemIndex: 0,
    colorIndex: 1,
    data: JSON.stringify(data),
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  return projectRecord(db, row);
}

export async function getProject(db: Db, projectId: string): Promise<ProjectRecord | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!row) return null;
  return projectRecord(db, row);
}

export async function renameProject(db: Db, projectId: string, name: string): Promise<void> {
  await db.update(projects).set({ name, updatedAt: new Date().toISOString() }).where(eq(projects.id, projectId));
}

export async function setActiveComponent(db: Db, projectId: string, componentId: string): Promise<void> {
  await db
    .update(projects)
    .set({ activeComponentId: componentId, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId));
}

export async function deleteProject(db: Db, projectId: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, projectId));
}

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
  const now = new Date().toISOString();
  const position = await nextPosition(db, projectId);
  const id = crypto.randomUUID();

  let seed: {
    code: string; designation: string; location: string; qty: number;
    widthMm: number; heightMm: number; brand: string; systemIndex: number; colorIndex: number;
    data: ComponentData;
  };

  if (opts?.duplicateFromId) {
    const source = await getComponent(db, projectId, opts.duplicateFromId);
    if (!source) throw new Error("El componente a duplicar no existe.");
    seed = {
      code: source.code,
      designation: `${source.designation} (copia)`,
      location: source.location,
      qty: source.qty,
      widthMm: source.widthMm,
      heightMm: source.heightMm,
      brand: source.brand,
      systemIndex: source.systemIndex,
      colorIndex: source.colorIndex,
      data: source.data,
    };
  } else {
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
      data: defaultComponentData(),
    };
  }

  await db.insert(components).values({
    id,
    projectId,
    position,
    code: seed.code,
    designation: seed.designation,
    location: seed.location,
    qty: seed.qty,
    widthMm: seed.widthMm,
    heightMm: seed.heightMm,
    brand: seed.brand,
    systemIndex: seed.systemIndex,
    colorIndex: seed.colorIndex,
    data: JSON.stringify(seed.data),
    createdAt: now,
    updatedAt: now,
  });
  await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));

  const [row] = await db
    .select()
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.id, id)));
  return toRecord(row);
}

export async function updateComponent(
  db: Db,
  projectId: string,
  componentId: string,
  patch: ComponentPatch
): Promise<ComponentRecord | null> {
  const existing = await getComponent(db, projectId, componentId);
  if (!existing) return null;
  const now = new Date().toISOString();

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
      data: JSON.stringify(nextData),
      updatedAt: now,
    })
    .where(and(eq(components.projectId, projectId), eq(components.id, componentId)));
  await db.update(projects).set({ updatedAt: now }).where(eq(projects.id, projectId));

  return getComponent(db, projectId, componentId);
}

export async function deleteComponent(db: Db, projectId: string, componentId: string): Promise<void> {
  await db.delete(components).where(and(eq(components.projectId, projectId), eq(components.id, componentId)));
  await db.update(projects).set({ updatedAt: new Date().toISOString() }).where(eq(projects.id, projectId));
}
