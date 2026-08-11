import { env } from "cloudflare:workers";
import { applyBriefPatch, parseBriefPatch, type AssistantBrief } from "@/lib/assistantBrief";
import { getDb } from "@/db";
import { toRouteErrorMessage } from "@/lib/apiError";
import { answerPublicAssistant, type PublicAssistantHistoryMessage, type PublicAssistantModelRunner } from "@/lib/publicAssistantModel";
import { ASSISTANT_RULES, checkAssistantBurst, clientIp, enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";

type AiBinding = { run(model: string, input: Record<string, unknown>): Promise<unknown> };

function history(value: unknown): PublicAssistantHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
    const text = typeof item.text === "string" ? item.text.trim().slice(0, 500) : "";
    return role && text ? [{ role, text }] : [];
  });
}

// El brief llega del navegador, se fusiona con lo que trae el mensaje nuevo y se devuelve
// actualizado. Se valida campo por campo: nada de confiar en el JSON del cliente tal cual.
function incomingBrief(value: unknown): AssistantBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const mm = (input: unknown): number | undefined =>
    Number.isInteger(input) && (input as number) >= 1 && (input as number) <= 20_000 ? (input as number) : undefined;
  const word = (input: unknown, max = 40): string | undefined =>
    typeof input === "string" && input.trim() ? input.trim().slice(0, max) : undefined;
  const goal = raw.openingGoal === "maximum" || raw.openingGoal === "view" || raw.openingGoal === "balanced" ? raw.openingGoal : undefined;
  const leaves = raw.movingLeaves === "center" || raw.movingLeaves === "left" || raw.movingLeaves === "right" || raw.movingLeaves === "all" ? raw.movingLeaves : undefined;
  const provenance: Record<string, "confirmed" | "inferred"> = {};
  if (raw.provenance && typeof raw.provenance === "object" && !Array.isArray(raw.provenance)) {
    for (const [key, mark] of Object.entries(raw.provenance as Record<string, unknown>).slice(0, 40)) {
      if (mark === "confirmed" || mark === "inferred") provenance[key.slice(0, 40)] = mark;
    }
  }
  return {
    widthMm: mm(raw.widthMm),
    heightMm: mm(raw.heightMm),
    location: word(raw.location),
    accessRequired: typeof raw.accessRequired === "boolean" ? raw.accessRequired : undefined,
    openingGoal: goal,
    leafCount: Number.isInteger(raw.leafCount) && (raw.leafCount as number) >= 1 && (raw.leafCount as number) <= 12 ? (raw.leafCount as number) : undefined,
    movingLeaves: leaves,
    colorWord: word(raw.colorWord),
    priorities: Array.isArray(raw.priorities)
      ? raw.priorities.filter((item): item is string => typeof item === "string").slice(0, 12).map((item) => item.slice(0, 30))
      : undefined,
    provenance,
  };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 60_000) return Response.json({ error: "El mensaje es demasiado grande." }, { status: 413 });

  try {
    const ip = clientIp(request);
    if (!checkAssistantBurst(ip)) return tooManyRequests(60);
    const limit = await enforceRateLimit(getDb(), "public-assistant", ip, ASSISTANT_RULES);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSec);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    if (!message) return Response.json({ error: "Escribe una pregunta para LUFT Asesor." }, { status: 400 });

    const ai = (env as unknown as { AI?: AiBinding }).AI;
    const runModel: PublicAssistantModelRunner | undefined = ai
      ? (model, input) => ai.run(model, input)
      : undefined;
    // Patch parcial sobre el estado acumulado: un campo que el mensaje no menciona no se toca.
    const brief = applyBriefPatch(incomingBrief(body.brief), parseBriefPatch(message));
    const answer = await answerPublicAssistant(message, body.context, history(body.history), runModel, brief);
    return Response.json({ ...answer, brief }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("public-assistant", toRouteErrorMessage(error));
    return Response.json({ error: "LUFT Asesor no pudo responder en este momento. Intenta de nuevo." }, { status: 500 });
  }
}
