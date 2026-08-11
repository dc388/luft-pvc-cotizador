import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { listQuoteEvents, setQuoteStatus } from "@/lib/quoteRepo";
import { isQuoteStatus } from "@/lib/quoteStatus";

// Etapa e historial de una cotización. Ruta interna (ver app/api/quotes/route.ts).

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json({ events: await listQuoteEvents(getDb(), id) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: unknown; note?: unknown };
    if (!isQuoteStatus(body.status)) return Response.json({ error: "Etapa no válida." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    // El cambio se escribe en la cotización Y en su bitácora: la etapa anterior no se pierde.
    const updated = await setQuoteStatus(getDb(), id, body.status, note);
    if (!updated) return Response.json({ error: "Esa cotización no existe." }, { status: 404 });
    return Response.json({ ok: true, events: await listQuoteEvents(getDb(), id) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
