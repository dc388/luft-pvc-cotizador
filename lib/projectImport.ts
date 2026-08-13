import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { components, projects } from "@/db/schema";
import type { ProjectFile } from "@/lib/projectFile";
import {
  createComponentWithData,
  createEmptyProject,
  findProjectIdByFolio,
  getProject,
  setActiveComponent,
} from "@/lib/projectRepo";
import type { ProjectRecord } from "@/types/project";

type Db = DrizzleD1Database<Record<string, unknown>>;

/** Qué hacer cuando el archivo corresponde a un proyecto que ya existe aquí. */
export type ImportMode = "copy" | "replace";

export type ImportOutcome = {
  project: ProjectRecord;
  /** Qué se hizo realmente, que no siempre es lo que se pidió: pedir "reemplazar" un proyecto que
   *  aquí no existe se resuelve creándolo, no fallando. */
  applied: "created" | "replaced";
  /** El proyecto que el archivo dice que ya existe aquí, si existe. La interfaz lo usa para
   *  preguntar antes de reemplazar. */
  conflictedWith: string | null;
};

/**
 * Detecta si un archivo corresponde a un proyecto que ya está aquí.
 *
 * Se busca por el id de origen que el archivo trae y, si no, por folio: un proyecto exportado y
 * reimportado en la misma plataforma coincide por id, y uno que llega de otra instalación coincide
 * por folio si alguien ya lo importó antes. Las dos son señales de "esto ya lo tienes", que es lo
 * que hay que preguntar antes de sobrescribir nada.
 */
export async function findImportConflict(db: Db, file: ProjectFile): Promise<string | null> {
  if (file.sourceProjectId) {
    const existing = await getProject(db, file.sourceProjectId);
    if (existing) return existing.id;
  }
  return findProjectIdByFolio(db, file.project.folio);
}

/**
 * Guarda un archivo ya validado como proyecto.
 *
 * En modo "copy" nace un proyecto nuevo. Conserva el folio del archivo si está libre, porque es
 * como se conoce a ese proyecto; si ya está tomado se reserva uno nuevo, porque el folio es único.
 *
 * En modo "replace" se sobrescribe el proyecto en conflicto conservando su id: se reemplazan sus
 * metadatos y TODOS sus componentes. La fecha de creación original no se pierde -- se guarda la que
 * declara el archivo -- y `importedAt` marca cuándo entró esta versión.
 */
export async function importProjectFile(
  db: Db,
  file: ProjectFile,
  options: { mode: ImportMode }
): Promise<ImportOutcome> {
  const now = new Date().toISOString();
  const conflictId = await findImportConflict(db, file);
  const originalCreatedAt = file.project.originalCreatedAt ?? file.project.createdAt;

  if (options.mode === "replace" && conflictId) {
    await db
      .update(projects)
      .set({
        name: file.project.name,
        folio: file.project.folio,
        origin: "imported",
        status: file.project.status,
        client: file.project.requester.fullName,
        requester: JSON.stringify(file.project.requester),
        notes: file.project.notes,
        currency: file.project.currency,
        pricingListId: file.project.pricingListId,
        estimatedDate: file.project.estimatedDate,
        createdBy: file.project.createdBy,
        importedAt: now,
        originalCreatedAt,
        // Reemplazar es traer de vuelta: si el proyecto estaba archivado o en la papelera, la
        // versión importada vuelve a estar activa. Dejarlo archivado escondería lo que se acaba
        // de importar.
        archivedAt: null,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(projects.id, conflictId));

    // Los componentes se reemplazan enteros y no se intenta emparejarlos uno a uno: el archivo es
    // la versión buena del proyecto, y un emparejamiento por posición o por designación dejaría
    // mezclas imposibles de explicar (mitad del archivo, mitad de lo que había).
    await db.delete(components).where(eq(components.projectId, conflictId));
    const project = await insertFileComponents(db, conflictId, file);
    return { project, applied: "replaced", conflictedWith: conflictId };
  }

  const folioTaken = file.project.folio ? await findProjectIdByFolio(db, file.project.folio) : null;
  const created = await createEmptyProject(db, importedName(file, conflictId !== null), {
    source: "interno",
    origin: "imported",
    // `undefined` pide folio nuevo; una cadena lo fija. Ver createEmptyProject.
    folio: file.project.folio && !folioTaken ? file.project.folio : undefined,
    client: file.project.requester.fullName,
    requester: file.project.requester,
    status: file.project.status,
    notes: file.project.notes,
    currency: file.project.currency,
    createdAt: now,
    importedAt: now,
    originalCreatedAt,
  });

  const project = await insertFileComponents(db, created.id, file);
  return { project, applied: "created", conflictedWith: conflictId };
}

/** Un proyecto importado que ya existía aquí se distingue por el nombre, para que la lista no
 *  muestre dos filas idénticas y haya que abrirlas para saber cuál es cuál. */
function importedName(file: ProjectFile, isDuplicate: boolean): string {
  const base = file.project.name || "Proyecto importado";
  return isDuplicate ? `${base} (importado)` : base;
}

async function insertFileComponents(db: Db, projectId: string, file: ProjectFile): Promise<ProjectRecord> {
  let firstComponentId = "";
  for (const component of file.components) {
    const created = await createComponentWithData(db, projectId, {
      code: component.code,
      designation: component.designation,
      location: component.location,
      qty: component.qty,
      widthMm: component.widthMm,
      heightMm: component.heightMm,
      brand: component.brand,
      systemIndex: component.systemIndex,
      colorIndex: component.colorIndex,
      glassIndex: component.glassIndex,
      typology: component.typology,
      configState: component.configState,
      unitPrice: component.unitPrice,
      total: component.total,
      data: component.data,
    });
    if (!firstComponentId) firstComponentId = created.id;
  }
  if (firstComponentId) await setActiveComponent(db, projectId, firstComponentId);

  const project = await getProject(db, projectId);
  if (!project) throw new Error("El proyecto importado no se pudo leer después de guardarlo.");
  return project;
}
