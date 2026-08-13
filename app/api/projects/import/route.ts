import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { createProjectVersion } from "@/lib/projectHistory";
import { parseProjectFile } from "@/lib/projectFile";
import { findImportConflict, importProjectFile, type ImportMode } from "@/lib/projectImport";

/** Tope del texto aceptado. Un proyecto real con cien componentes ronda unos cientos de kilobytes;
 *  este techo evita que un archivo enorme ocupe la memoria del Worker antes de validarse. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Importa un proyecto desde un archivo.
 *
 * El contenido llega como texto y se valida en `parseProjectFile` antes de tocar la base: un archivo
 * inválido devuelve 400 con un mensaje que se puede leer, no un 500 ni una importación a medias.
 *
 * `mode` decide qué hacer si el proyecto ya existe aquí:
 *   - "copy" (por omisión): entra como proyecto nuevo. Nunca pierde nada de lo que ya había.
 *   - "replace": sobrescribe el que ya existe conservando su id.
 *
 * `probe: true` no escribe nada: solo dice si hay conflicto, para poder preguntar antes de decidir.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      file?: unknown;
      mode?: unknown;
      probe?: unknown;
    };

    if (typeof payload.file !== "string" || !payload.file.trim()) {
      return Response.json({ error: "No llegó ningún archivo que importar." }, { status: 400 });
    }
    if (payload.file.length > MAX_FILE_BYTES) {
      return Response.json({ error: "El archivo es demasiado grande para importarse." }, { status: 413 });
    }

    const parsed = parseProjectFile(payload.file);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

    const db = getDb();

    if (payload.probe === true) {
      const conflictedWith = await findImportConflict(db, parsed.value);
      return Response.json({
        probe: true,
        conflictedWith,
        warnings: parsed.warnings,
        migratedFrom: parsed.migratedFrom,
        name: parsed.value.project.name,
        folio: parsed.value.project.folio,
        componentCount: parsed.value.components.length,
      });
    }

    const mode: ImportMode = payload.mode === "replace" ? "replace" : "copy";

    // Reemplazar sustituye los datos y TODOS los componentes de un proyecto que ya existe, así que
    // antes se guarda un punto de restauración de lo que había. Es la diferencia entre una operación
    // destructiva y una reversible.
    if (mode === "replace") {
      const conflictedWith = await findImportConflict(db, parsed.value);
      if (conflictedWith) {
        await createProjectVersion(db, conflictedWith, { reason: "antes-de-importar" });
      }
    }

    const outcome = await importProjectFile(db, parsed.value, { mode });

    return Response.json(
      {
        project: outcome.project,
        applied: outcome.applied,
        conflictedWith: outcome.conflictedWith,
        warnings: parsed.warnings,
        migratedFrom: parsed.migratedFrom,
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
