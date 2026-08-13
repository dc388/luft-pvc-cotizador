import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { recordLearningEvent } from "@/lib/learning";
import { listQuoteEvents, setQuoteStatus } from "@/lib/quoteRepo";
import { isQuoteRejectionReason, isQuoteStatus, quoteRejectionReasonLabel } from "@/lib/quoteStatus";

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
    const body = (await request.json().catch(() => ({}))) as { status?: unknown; note?: unknown; reason?: unknown };
    if (!isQuoteStatus(body.status)) return Response.json({ error: "Etapa no válida." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const reason = isQuoteRejectionReason(body.reason) ? body.reason : null;
    const db = getDb();
    // El cambio se escribe en la cotización Y en su bitácora: la etapa anterior no se pierde.
    const updated = await setQuoteStatus(db, id, body.status, reason ? [quoteRejectionReasonLabel(reason), note].filter(Boolean).join(" · ") : note);
    if (!updated) return Response.json({ error: "Esa cotización no existe." }, { status: 404 });

    // Cerrar una cotización es el único momento en que se sabe si se ganó o se perdió, y es el dato
    // que más falta le hace al sistema de mejora. Se registra el resultado, el importe y -- solo si
    // se eligió de la lista cerrada -- el motivo. La nota libre NO viaja a las estadísticas: puede
    // contener datos personales y esa tabla no los admite (ver lib/learning.ts).
    if (body.status === "finalizado" || body.status === "cancelado") {
      try {
        await recordLearningEvent(db, "cotizacion_resuelta", {
          outcome: body.status === "finalizado" ? "aceptada" : "rechazada",
          total: updated.total,
          ...(reason ? { reason: quoteRejectionReasonLabel(reason) } : {}),
        });
      } catch {
        // Registrar la estadística no puede hacer fallar el cambio de etapa: la etapa es el dato del
        // negocio, la estadística es un subproducto.
      }
    }

    return Response.json({ ok: true, events: await listQuoteEvents(db, id) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
