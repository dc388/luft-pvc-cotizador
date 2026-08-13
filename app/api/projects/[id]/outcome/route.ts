import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { recordLearningEvent } from "@/lib/learning";
import { deleteProjectOutcome, getProjectOutcome, saveProjectOutcome } from "@/lib/projectRepo";

type Params = { params: Promise<{ id: string }> };

/**
 * Cierre de obra: lo que costó y se cobró de verdad, frente a lo cotizado.
 *
 * Es el único origen posible de "costo real vs. estimado" y "cotizado vs. fabricado": no se puede
 * inferir de la configuración, alguien tiene que capturarlo al terminar. Mientras no exista, la
 * plataforma dice que no lo sabe en vez de estimarlo.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return Response.json({ outcome: await getProjectOutcome(getDb(), id) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

function positive(value: unknown): number {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = getDb();

    const outcome = await saveProjectOutcome(db, id, {
      actualCost: positive(payload.actualCost),
      actualRevenue: positive(payload.actualRevenue),
      piecesBuilt: positive(payload.piecesBuilt),
      notes: typeof payload.notes === "string" ? payload.notes : "",
    });
    if (!outcome) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });

    // A las estadísticas de mejora solo van las DESVIACIONES, en porcentaje, y nunca los importes del
    // cliente ni nada que lo identifique: qué tanto se desvió el costo de lo estimado, qué margen real
    // quedó y cuántas piezas se fabricaron frente a las cotizadas. Es lo que permite avisar "tus
    // costos suelen quedar un 12% por encima de lo estimado" sin guardar de quién era la obra.
    if (outcome.quotedTotal > 0 && outcome.actualCost > 0) {
      try {
        await recordLearningEvent(db, "obra_cerrada", {
          costDeviationPct: Math.round(((outcome.actualCost - outcome.quotedTotal) / outcome.quotedTotal) * 1000) / 10,
          realMarginPct:
            outcome.actualRevenue > 0
              ? Math.round(((outcome.actualRevenue - outcome.actualCost) / outcome.actualRevenue) * 1000) / 10
              : 0,
          piecesDeviationPct:
            outcome.quotedPieces > 0
              ? Math.round(((outcome.piecesBuilt - outcome.quotedPieces) / outcome.quotedPieces) * 1000) / 10
              : 0,
        });
      } catch {
        // La estadística es un subproducto: no puede hacer fallar el registro del cierre.
      }
    }

    return Response.json({ outcome });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteProjectOutcome(getDb(), id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
