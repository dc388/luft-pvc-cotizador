import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { duplicateProject } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

/** Duplica el proyecto entero. El folio nuevo, las fechas nuevas y la independencia de los
 *  componentes las garantiza duplicateProject; aquí solo se acepta el nombre de la copia. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as { name?: unknown };
    const db = getDb();
    const project = await duplicateProject(db, id, typeof payload.name === "string" ? payload.name : undefined);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
