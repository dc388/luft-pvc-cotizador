import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { createProject, getMostRecentProject, listProjectSummaries } from "@/lib/projectRepo";

// GET: el proyecto más reciente (con el que la app abre) MÁS la lista completa de carpetas para
// el selector del tab Proyecto. Van juntos en una sola respuesta a propósito: el arranque
// necesita las dos cosas, y separarlas costaría un segundo viaje en el camino crítico.
//
// Sin la lista, cada cotización del cotizador público quedaba escrita en la base pero
// inalcanzable desde la interfaz: la app abría siempre la más reciente y las anteriores no
// tenían ninguna pantalla desde la que llegar.
export async function GET() {
  try {
    const db = getDb();
    const [project, projects] = await Promise.all([getMostRecentProject(db), listProjectSummaries(db)]);
    return Response.json({ project, projects });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { name?: string };
    const db = getDb();
    const project = await createProject(db, payload.name?.trim() || undefined);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
