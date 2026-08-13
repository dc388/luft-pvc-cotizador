import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { deleteProject, getProject, purgeProject, updateProjectMeta } from "@/lib/projectRepo";
import type { ProjectMetaPatch } from "@/types/project";

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

// Un solo PATCH para todo lo editable del proyecto (nombre, etapa, ficha del solicitante,
// preferencias comerciales, componente abierto). El filtrado campo por campo vive en
// updateProjectMeta, que es el único punto de escritura: así la fecha de modificación y el espejo
// del nombre del cliente no se pueden olvidar en un camino.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as ProjectMetaPatch;
    const db = getDb();
    const project = await updateProjectMeta(db, id, payload);
    if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

// Borrar manda a la papelera. `?purge=1` elimina definitivamente, y es un parámetro explícito a
// propósito: nadie debe poder borrar sin vuelta atrás por omisión.
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const purge = new URL(request.url).searchParams.get("purge") === "1";
    const db = getDb();
    if (purge) {
      await purgeProject(db, id);
      return Response.json({ ok: true, purged: true });
    }
    await deleteProject(db, id);
    return Response.json({ ok: true, purged: false });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
