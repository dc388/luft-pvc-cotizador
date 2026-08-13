"use client";

import { createLocalStore } from "@/lib/localStore";
import type { LearningEventKind, LearningStats, QuoteTemplate } from "@/lib/learningRules";

/**
 * El lado cliente de la mejora continua: el interruptor y el envío de eventos.
 *
 * El interruptor vive aquí y no en el servidor a propósito. Con la decisión del lado del cliente,
 * "desactivado" significa que la petición NO SE HACE y por tanto no hay nada escrito en ningún lado.
 * Si la decisión viviera en el servidor, el navegador seguiría enviando los datos y habría que
 * confiar en que alguien los descarta -- que es una promesa distinta y peor.
 *
 * Arranca activado. Lo que se registra no incluye un solo dato de ningún cliente (ver la lista blanca
 * en lib/learning.ts): son las medidas, los sistemas y los importes del propio negocio, y con el
 * interruptor apagado la plataforma no puede sugerir nada porque no sabe nada. La pantalla dice qué se
 * guarda y qué no, y apagarlo es un clic. Para invertirlo a "arranca apagado" basta cambiar el valor
 * de reserva de `isLearningEnabled`.
 */

const KEY = "luft-pvc-cotizador:learning-enabled:v2";

/** El interruptor es estado externo (localStorage), así que se expone como almacén para leerlo con
 *  useSyncExternalStore: sin efecto que lo cargue al montar, y apagarlo en una pestaña se refleja en
 *  las demás. Ver lib/localStore.ts.
 *
 *  El valor de reserva es `true` (arranca activado, ver el comentario de arriba). La clave lleva v2
 *  porque el valor guardado pasó de la cadena "1"/"0" a JSON. */
export const learningStore = createLocalStore<boolean>(KEY, true, (raw) => raw === true);

/** Fuera de React (por ejemplo al registrar un evento desde un manejador) el valor se consulta así.
 *  En servidor devuelve `false`: allí no hay preferencia que leer ni evento que enviar. */
export function isLearningEnabled(): boolean {
  return typeof window === "undefined" ? false : learningStore.getSnapshot();
}

export function setLearningEnabled(enabled: boolean): void {
  learningStore.set(enabled);
}

/** Envía un evento si el registro está activado. Nunca lanza: un fallo aquí no puede interrumpir lo
 *  que se estaba haciendo, que es cotizar. */
export function recordEvent(kind: LearningEventKind, payload: Record<string, string | number | boolean>): void {
  if (!isLearningEnabled()) return;
  void fetch("/api/learning", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, payload }),
  }).catch(() => {
    // Sin conexión no hay estadística de este componente. Es una pérdida aceptable: son datos
    // agregados, no el trabajo de nadie.
  });
}

export async function fetchLearning(): Promise<{ stats: LearningStats; templates: QuoteTemplate[] } | null> {
  try {
    const response = await fetch("/api/learning");
    if (!response.ok) return null;
    return (await response.json()) as { stats: LearningStats; templates: QuoteTemplate[] };
  } catch {
    return null;
  }
}

export async function clearLearning(): Promise<number> {
  const response = await fetch("/api/learning", { method: "DELETE" });
  const payload = (await response.json().catch(() => ({}))) as { deleted?: number; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "No se pudo borrar el historial.");
  return payload.deleted ?? 0;
}
