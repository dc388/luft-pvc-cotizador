import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { getProject, transferComponents } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

/** Mueve o copia componentes a otro proyecto. Es una sola ruta porque es una sola operación con dos
 *  variantes, y las dos necesitan exactamente los mismos datos. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as {
      componentIds?: unknown;
      toProjectId?: unknown;
      mode?: unknown;
    };

    const componentIds = Array.isArray(payload.componentIds)
      ? payload.componentIds.filter((value): value is string => typeof value === "string")
      : [];
    if (componentIds.length === 0) {
      return Response.json({ error: "No se indicó ningún componente." }, { status: 400 });
    }
    if (typeof payload.toProjectId !== "string" || !payload.toProjectId) {
      return Response.json({ error: "No se indicó el proyecto de destino." }, { status: 400 });
    }

    const mode = payload.mode === "copy" ? "copy" : "move";
    const db = getDb();
    const { moved } = await transferComponents(db, id, componentIds, payload.toProjectId, mode);

    // Se devuelven los dos proyectos porque los dos cambiaron: el de origen perdió componentes (y
    // quizá el que tenía abierto) y el destino los ganó. Que el cliente los reconstruya por su
    // cuenta sería otra ronda de peticiones y una ventana en la que la lista miente.
    const [source, target] = await Promise.all([getProject(db, id), getProject(db, payload.toProjectId)]);
    if (!source || !target) {
      return Response.json({ error: "Uno de los proyectos dejó de existir durante la operación." }, { status: 404 });
    }
    return Response.json({ moved, mode, project: source, targetProject: target });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("destino no existe") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
