import { desc, gte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { quoteLearningEvents } from "@/db/schema";
import { sanitizeEvent, summarize, type LearningEventKind, type LearningStats } from "@/lib/learningRules";
import { newId } from "@/lib/uuid";

/**
 * El acceso a la bitácora estadística de la mejora continua: escribir un evento, leer las
 * estadísticas y borrar el historial.
 *
 * Las reglas (qué campos se permiten, cómo se resume, qué se recomienda) viven en
 * lib/learningRules.ts y no aquí. Este archivo solo consulta, y por eso solo lo importa el servidor.
 *
 * SIN DATOS PERSONALES: lo garantiza `sanitizeEvent`, que es una lista de campos PERMITIDOS. No hay
 * ninguna columna en esta tabla donde pudiera caber un nombre, un teléfono o el id de un proyecto, y
 * eso es lo que hace posible ofrecer "borrar el historial de mejora" sin tocar ningún proyecto.
 */

type Db = DrizzleD1Database<Record<string, unknown>>;

export async function recordLearningEvent(db: Db, kind: LearningEventKind, payload: unknown): Promise<void> {
  await db.insert(quoteLearningEvents).values({
    id: newId(),
    kind,
    payload: JSON.stringify(sanitizeEvent(kind, payload)),
    createdAt: Date.now(),
  });
}

/** Borra todo el historial estadístico. No toca ningún proyecto: por eso esta tabla no guarda
 *  referencias a ellos. */
export async function clearLearningHistory(db: Db): Promise<{ deleted: number }> {
  const [before] = await db.select({ count: sql<number>`count(*)` }).from(quoteLearningEvents);
  await db.delete(quoteLearningEvents);
  return { deleted: Number(before?.count ?? 0) };
}

/** Ventana por omisión: un año. Suficiente para ver la estacionalidad del negocio sin arrastrar
 *  precios y prácticas de hace tres años como si siguieran vigentes. */
const DEFAULT_WINDOW_DAYS = 365;
const MAX_EVENTS = 5000;

export async function readLearningStats(db: Db, options: { windowDays?: number } = {}): Promise<LearningStats> {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const rows = await db
    .select()
    .from(quoteLearningEvents)
    .where(gte(quoteLearningEvents.createdAt, Date.now() - windowDays * 24 * 60 * 60 * 1000))
    .orderBy(desc(quoteLearningEvents.createdAt))
    .limit(MAX_EVENTS);

  return summarize(
    rows.map((row) => {
      let payload: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(row.payload);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
      } catch {
        // Un evento ilegible se cuenta como evento sin datos en vez de tumbar las estadísticas.
      }
      return { kind: row.kind, payload, createdAt: row.createdAt };
    })
  );
}
