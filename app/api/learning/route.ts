import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { clearLearningHistory, readLearningStats, recordLearningEvent } from "@/lib/learning";
import { buildTemplates, isLearningEventKind } from "@/lib/learningRules";

/**
 * El historial de mejora continua.
 *
 * GET devuelve las estadísticas y las plantillas derivadas de ellas. POST registra un evento. DELETE
 * borra el historial completo, que es el "poder borrar el historial" que pide §9 y que solo puede
 * ofrecerse porque esta tabla no guarda un solo dato personal ni referencia a ningún proyecto (ver
 * lib/learning.ts).
 *
 * La recopilación se puede apagar, y se apaga en el cliente: si está apagada, no se llama a POST y no
 * se escribe nada. Es la única forma en que "desactivado" significa de verdad que no se guardó --
 * apagarlo del lado del servidor dejaría al navegador enviando datos y confiando en que alguien los
 * tira.
 */
export async function GET(request: Request) {
  try {
    const windowDays = Number(new URL(request.url).searchParams.get("windowDays"));
    const db = getDb();
    const stats = await readLearningStats(db, {
      windowDays: Number.isFinite(windowDays) && windowDays > 0 ? Math.min(windowDays, 3650) : undefined,
    });
    return Response.json({ stats, templates: buildTemplates(stats) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { kind?: unknown; payload?: unknown };
    if (!isLearningEventKind(payload.kind)) {
      return Response.json({ error: "Tipo de evento no reconocido." }, { status: 400 });
    }
    const db = getDb();
    await recordLearningEvent(db, payload.kind, payload.payload);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = getDb();
    const { deleted } = await clearLearningHistory(db);
    return Response.json({ ok: true, deleted });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
