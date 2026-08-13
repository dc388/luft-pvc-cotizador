import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { createProjectVersion, restoreProjectVersion } from "@/lib/projectHistory";
import { listProjectVersions } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

/** Los puntos de restauración del proyecto, del más reciente al más viejo. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return Response.json({ versions: await listProjectVersions(getDb(), id) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

/**
 * Crea un punto (`{ label }`) o restaura uno (`{ restore: "<id>" }`).
 *
 * Las dos comparten ruta porque son las dos caras de lo mismo y ninguna necesita datos de la otra.
 * Restaurar guarda antes un punto de lo que había: ver lib/projectHistory.ts.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as { label?: unknown; restore?: unknown };
    const db = getDb();

    if (typeof payload.restore === "string" && payload.restore) {
      const outcome = await restoreProjectVersion(db, id, payload.restore);
      if (!outcome.ok) return Response.json({ error: outcome.error }, { status: 400 });
      return Response.json({
        project: outcome.project,
        warnings: outcome.warnings,
        versions: await listProjectVersions(db, id),
      });
    }

    const version = await createProjectVersion(db, id, {
      label: typeof payload.label === "string" ? payload.label : undefined,
      reason: "manual",
    });
    if (!version) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ version, versions: await listProjectVersions(db, id) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
