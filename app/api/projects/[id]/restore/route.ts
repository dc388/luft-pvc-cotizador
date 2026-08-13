import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { restoreProject } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

/** Saca un proyecto de la papelera. Es lo que hace real el "Deshacer" que se ofrece al borrar. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const project = await restoreProject(db, id);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
