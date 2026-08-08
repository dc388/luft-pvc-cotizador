import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { createComponent } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as { duplicateFromId?: string };
    const db = getDb();
    const component = await createComponent(db, id, { duplicateFromId: payload.duplicateFromId });
    return Response.json({ component }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
