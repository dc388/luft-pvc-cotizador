import type { DrizzleD1Database } from "drizzle-orm/d1";
import { buildId } from "@/lib/buildVersion";
import { parseProjectFile, serializeProject } from "@/lib/projectFile";
import { importProjectFile } from "@/lib/projectImport";
import {
  getProject,
  getProjectComponents,
  getProjectVersionSnapshot,
  saveProjectVersion,
} from "@/lib/projectRepo";
import type { ProjectRecord, ProjectVersionReason, ProjectVersionRow } from "@/types/project";

type Db = DrizzleD1Database<Record<string, unknown>>;

/**
 * Puntos de restauración de un proyecto.
 *
 * Un punto es el proyecto entero serializado con el MISMO formato que un archivo .luftproj, y
 * restaurarlo es literalmente importarlo sobre sí mismo. Eso es lo que hace que no haya dos
 * definiciones de "un proyecto guardado" ni dos lectores que se puedan desincronizar: el validador que
 * desconfía de un archivo de origen desconocido valida también esto.
 *
 * Antes de restaurar se guarda un punto de lo que había. Sin eso, restaurar sería tan destructivo como
 * lo que intenta remediar.
 */

export async function createProjectVersion(
  db: Db,
  projectId: string,
  options: { label?: string; reason?: ProjectVersionReason } = {}
): Promise<ProjectVersionRow | null> {
  const project = await getProject(db, projectId);
  if (!project) return null;
  const componentRecords = await getProjectComponents(db, projectId);
  const file = serializeProject(project, componentRecords, { exportedBy: buildId() });
  return saveProjectVersion(db, projectId, JSON.stringify(file), {
    label: options.label,
    reason: options.reason ?? "manual",
    componentCount: componentRecords.length,
    total: componentRecords.reduce((sum, component) => sum + component.total, 0),
  });
}

export type RestoreOutcome =
  | { ok: true; project: ProjectRecord; warnings: string[] }
  | { ok: false; error: string };

export async function restoreProjectVersion(db: Db, projectId: string, versionId: string): Promise<RestoreOutcome> {
  const snapshot = await getProjectVersionSnapshot(db, projectId, versionId);
  if (!snapshot) return { ok: false, error: "Ese punto de restauración no existe." };

  const parsed = parseProjectFile(snapshot);
  if (!parsed.ok) return { ok: false, error: `El punto de restauración no se pudo leer: ${parsed.error}` };

  // Lo que hay ahora se guarda antes de sustituirlo: restaurar por error tiene que poder deshacerse.
  await createProjectVersion(db, projectId, { reason: "antes-de-restaurar" });

  // El id de origen se fuerza al proyecto actual para que la importación reemplace ESTE y no cree una
  // copia: el snapshot se escribió con el id de entonces, que puede no coincidir si el proyecto se
  // duplicó o se importó de otra instalación.
  const outcome = await importProjectFile(db, { ...parsed.value, sourceProjectId: projectId }, { mode: "replace" });
  return { ok: true, project: outcome.project, warnings: parsed.warnings };
}
