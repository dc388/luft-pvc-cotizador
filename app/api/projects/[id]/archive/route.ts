import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { getProject, setProjectArchived } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

// Archivar y desarchivar por la misma ruta con `{ archived: boolean }`, y no dos rutas: es la misma
// operación en dos sentidos, y "Deshacer" tras archivar es exactamente esta llamada con `false`.
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as { archived?: unknown };
    const db = getDb();
    await setProjectArchived(db, id, payload.archived !== false);
    const project = await getProject(db, id);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
