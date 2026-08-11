import { env } from "cloudflare:workers";
import { applyBriefPatch, parseBriefPatch } from "@/lib/assistantBrief";
import { loadBrief, newSessionToken, readSessionToken, sanitizeBrief, saveBrief, sessionCookie } from "@/lib/assistantSession";
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
    // El brief vive en el servidor, indexado por un token opaco en cookie: recargar la página ya
    // no borra la conversación. Lo que manda el navegador solo se usa para arrancar la sesión.
    const db = getDb();
    const existingToken = readSessionToken(request);
    const token = existingToken || newSessionToken();
    const stored = existingToken ? await loadBrief(db, token) : sanitizeBrief(body.brief);
    // Patch parcial sobre el estado acumulado: un campo que el mensaje no menciona no se toca.
    const brief = applyBriefPatch(stored, parseBriefPatch(message));
    const answer = await answerPublicAssistant(message, body.context, history(body.history), runModel, brief);
    await saveBrief(db, token, brief);

    return Response.json({ ...answer, brief }, {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"),
      },
    });
  } catch (error) {
    console.error("public-assistant", toRouteErrorMessage(error));
    return Response.json({ error: "LUFT Asesor no pudo responder en este momento. Intenta de nuevo." }, { status: 500 });
  }
}
