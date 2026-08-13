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

/**
 * Guarda el componente.
 *
 * `expectedUpdatedAt` es opcional y, cuando viene, es una comprobación de concurrencia: si el
 * componente cambió en el servidor después de esa fecha, NO se sobrescribe y se responde 409 con la
 * versión que hay guardada. Es lo que impide que dos personas en dos computadoras distintas se pisen
 * el trabajo -- el autoguardado envía el estado completo, así que sin esto la última escritura gana en
 * silencio.
 *
 * `force: true` guarda de todos modos, y existe porque quien edita tiene que poder resolver el
 * conflicto a favor de su versión después de haberlo visto.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, componentId } = await params;
    const payload = (await request.json()) as ComponentPatch & { expectedUpdatedAt?: unknown; force?: unknown };
    const { expectedUpdatedAt, force, ...patch } = payload;
    const db = getDb();

    const expected = force === true || typeof expectedUpdatedAt !== "string" ? undefined : expectedUpdatedAt;
    const result = await updateComponent(db, id, componentId, patch, expected);

    if (result.status === "missing") return Response.json({ error: "Componente no encontrado." }, { status: 404 });
    if (result.status === "conflict") {
      return Response.json(
        {
          error: "Alguien más guardó este componente desde otra sesión. Revisa antes de sobrescribir.",
          conflict: true,
          component: result.component,
        },
        { status: 409 }
      );
    }
    return Response.json({ component: result.component });
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
