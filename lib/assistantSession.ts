import { and, eq, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { assistantSessions } from "@/db/schema";
import type { AssistantBrief } from "@/lib/assistantBrief";

// Persistencia del brief de LUFT Asesor (§90). Recargar la página ya no borra la conversación.
//
// El identificador es un token opaco de 32 bytes en cookie, no un id consecutivo: el brief
// guarda ubicación y preferencias del cliente, así que un id adivinable dejaría leer las
// sesiones de otros. Y como el contenido no es confiable ni al escribirlo ni al leerlo, se
// valida campo por campo en las dos direcciones.

type Db = DrizzleD1Database<Record<string, unknown>>;

const COOKIE_NAME = "luft_brief";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function readSessionToken(request: Request): string {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === COOKIE_NAME) {
      const value = rest.join("=");
      // Solo hex de 64 caracteres: cualquier otra cosa no la emitimos nosotros.
      return /^[a-f0-9]{64}$/.test(value) ? value : "";
    }
  }
  return "";
}

export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sessionCookie(token: string, secure: boolean): string {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${COOKIE_MAX_AGE}`];
  if (secure) flags.push("Secure");
  return `${COOKIE_NAME}=${token}; ${flags.join("; ")}`;
}

/**
 * Valida un brief venido de cualquier fuente no confiable (la base o el navegador). Devuelve
 * solo los campos con forma correcta; lo demás se descarta en silencio en vez de propagarse.
 */
export function sanitizeBrief(value: unknown): AssistantBrief {
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

/** Lee el brief guardado. Falla en abierto con un brief vacío: perder memoria es preferible a
 *  romper la conversación si la base no responde. */
export async function loadBrief(db: Db, token: string): Promise<AssistantBrief> {
  if (!token) return {};
  try {
    const [row] = await db.select({ brief: assistantSessions.brief }).from(assistantSessions).where(eq(assistantSessions.token, token)).limit(1);
    if (!row) return {};
    return sanitizeBrief(JSON.parse(row.brief));
  } catch {
    return {};
  }
}

export async function saveBrief(db: Db, token: string, brief: AssistantBrief): Promise<void> {
  const now = Date.now();
  const payload = JSON.stringify(brief).slice(0, 4000);
  try {
    const [existing] = await db.select({ token: assistantSessions.token }).from(assistantSessions).where(eq(assistantSessions.token, token)).limit(1);
    if (existing) {
      await db.update(assistantSessions).set({ brief: payload, updatedAt: now }).where(eq(assistantSessions.token, token));
    } else {
      await db.insert(assistantSessions).values({ token, brief: payload, createdAt: now, updatedAt: now });
      // Barrido de sesiones abandonadas, en la escritura: sin esto la tabla solo crecería.
      await db.delete(assistantSessions).where(and(lt(assistantSessions.updatedAt, now - SESSION_TTL_MS)));
    }
  } catch {
    // Guardar es best-effort: si falla, el asistente sigue respondiendo con el brief en memoria.
  }
}
