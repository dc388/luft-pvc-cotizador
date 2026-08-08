import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { createProject, getMostRecentProject } from "@/lib/projectRepo";

// GET: the most recently touched project (this app opens straight into "your last work",
// not a project picker -- a picker is a reasonable future addition once there's more than
// one project in real use).
export async function GET() {
  try {
    const db = getDb();
    const project = await getMostRecentProject(db);
    return Response.json({ project });
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
