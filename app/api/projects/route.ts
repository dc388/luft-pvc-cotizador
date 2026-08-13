import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { createProject, getMostRecentProject, listProjectSummaries, type ProjectScope } from "@/lib/projectRepo";
import type { ProjectDraft } from "@/types/project";

function scopeFromRequest(request: Request): ProjectScope {
  const scope = new URL(request.url).searchParams.get("scope");
  return scope === "active" || scope === "archived" || scope === "trash" ? scope : "all";
}

// GET: el proyecto más reciente (con el que la app abre) MÁS la lista completa de proyectos para el
// explorador. Van juntos en una sola respuesta a propósito: el arranque necesita las dos cosas, y
// separarlas costaría un segundo viaje en el camino crítico.
//
// Sin la lista, cada cotización del cotizador público quedaba escrita en la base pero inalcanzable
// desde la interfaz: la app abría siempre la más reciente y las anteriores no tenían ninguna
// pantalla desde la que llegar.
//
// `?scope=trash` pide la papelera, que nunca viene mezclada con lo demás.
export async function GET(request: Request) {
  try {
    const db = getDb();
    const scope = scopeFromRequest(request);
    if (scope === "trash") {
      return Response.json({ projects: await listProjectSummaries(db, "trash") });
    }
    const [project, projects] = await Promise.all([getMostRecentProject(db), listProjectSummaries(db, scope)]);
    return Response.json({ project, projects });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

/** Alta de proyecto. Solo el nombre es obligatorio; el resto de la ficha se completa después. */
export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Partial<ProjectDraft>;
    const db = getDb();
    const project = await createProject(db, {
      name: typeof payload.name === "string" ? payload.name : "",
      requester: payload.requester,
      currency: payload.currency,
      pricingListId: payload.pricingListId,
      notes: payload.notes,
      estimatedDate: payload.estimatedDate,
      createdBy: payload.createdBy,
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
