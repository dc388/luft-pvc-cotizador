import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { deleteProject, getProject, renameProject, setActiveComponent } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const project = await getProject(db, id);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as { name?: string; activeComponentId?: string };
    const db = getDb();
    if (typeof payload.name === "string" && payload.name.trim()) await renameProject(db, id, payload.name.trim());
    if (typeof payload.activeComponentId === "string") await setActiveComponent(db, id, payload.activeComponentId);
    const project = await getProject(db, id);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    await deleteProject(db, id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
