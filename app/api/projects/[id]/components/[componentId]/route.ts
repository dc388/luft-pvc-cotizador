import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { deleteComponent, getComponent, updateComponent } from "@/lib/projectRepo";
import type { ComponentPatch } from "@/types/project";

type Params = { params: Promise<{ id: string; componentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, componentId } = await params;
    const db = getDb();
    const component = await getComponent(db, id, componentId);
    if (!component) return Response.json({ error: "Componente no encontrado." }, { status: 404 });
    return Response.json({ component });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, componentId } = await params;
    const patch = (await request.json()) as ComponentPatch;
    const db = getDb();
    const component = await updateComponent(db, id, componentId, patch);
    if (!component) return Response.json({ error: "Componente no encontrado." }, { status: 404 });
    return Response.json({ component });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, componentId } = await params;
    const db = getDb();
    await deleteComponent(db, id, componentId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
