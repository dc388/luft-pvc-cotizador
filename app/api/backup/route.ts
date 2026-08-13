import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { buildId } from "@/lib/buildVersion";
import { parseBackupFile, serializeBackup, serializeProject } from "@/lib/projectFile";
import { importProjectFile } from "@/lib/projectImport";
import { getProject, getProjectComponents, listProjectSummaries } from "@/lib/projectRepo";

const MAX_FILE_BYTES = 32 * 1024 * 1024;

/**
 * Copia de seguridad: todos los proyectos vivos en un archivo.
 *
 * Los archivados entran (siguen siendo trabajo del negocio); la papelera no (ya se decidió
 * borrarlos, y una copia que los resucita al restaurar no es lo que nadie espera).
 *
 * Cada proyecto se serializa con el mismo `serializeProject` que la exportación individual, así que
 * la copia no es un formato aparte que se pueda desincronizar: es una lista de archivos de proyecto.
 */
export async function GET() {
  try {
    const db = getDb();
    const summaries = await listProjectSummaries(db, "all");
    const files = [];
    for (const summary of summaries) {
      const project = await getProject(db, summary.id);
      if (!project) continue;
      const components = await getProjectComponents(db, summary.id);
      files.push(serializeProject(project, components, { exportedBy: buildId() }));
    }
    const backup = serializeBackup(files, { exportedBy: buildId() });
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="respaldo_luft_${stamp}.luftbak"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

/**
 * Restaura una copia de seguridad.
 *
 * Restaurar AGREGA, no reemplaza la base: cada proyecto de la copia entra en modo "copy", así que un
 * proyecto que existe aquí y también en la copia acaba con dos versiones, no con la de la copia
 * encima. Es deliberado -- restaurar un respaldo viejo no debe poder borrar el trabajo de esta
 * semana. Reemplazar un proyecto concreto sigue siendo posible desde la importación individual.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { file?: unknown };
    if (typeof payload.file !== "string" || !payload.file.trim()) {
      return Response.json({ error: "No llegó ninguna copia de seguridad." }, { status: 400 });
    }
    if (payload.file.length > MAX_FILE_BYTES) {
      return Response.json({ error: "La copia de seguridad es demasiado grande." }, { status: 413 });
    }

    const parsed = parseBackupFile(payload.file);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

    const db = getDb();
    const restored: string[] = [];
    const failed: string[] = [];
    for (const file of parsed.value.projects) {
      try {
        const outcome = await importProjectFile(db, file, { mode: "copy" });
        restored.push(outcome.project.name);
      } catch (error) {
        // Un proyecto que falla no detiene la restauración de los demás: con un respaldo en la mano
        // lo que se quiere es recuperar todo lo recuperable, y saber qué no se pudo.
        failed.push(`${file.project.name}: ${toRouteErrorMessage(error)}`);
      }
    }

    return Response.json({
      restored: restored.length,
      failed,
      warnings: parsed.warnings,
      projects: await listProjectSummaries(db, "all"),
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
