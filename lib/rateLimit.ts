import { and, eq, gte, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { rateLimitHits } from "@/db/schema";

// Anti-abuso de las rutas públicas (app/api/public-quote). A diferencia de las rutas internas,
// éstas quedan expuestas a internet abierto sin autenticación, así que necesitan un límite por
// cliente para que nadie pueda llenar la tabla de componentes con cotizaciones basura.
//
// Dos capas, cada una para un tipo de abuso distinto:
//   1. enforceRateLimit  -- exacta, respaldada en D1, para lo que ESCRIBE (guardar cotización).
//   2. checkBurst        -- aproximada, en memoria del isolate, para lo que solo CALCULA.
// Ver el comentario de checkBurst sobre por qué la segunda no usa la base de datos.

type Db = DrizzleD1Database<Record<string, unknown>>;

export type RateRule = { limit: number; windowSec: number };

// Límite al guardar una cotización. Un cliente real manda una o dos; una familia cotizando
// varias ventanas de su casa cabe de sobra en 20 al día.
export const SUBMIT_RULES: RateRule[] = [
  { limit: 5, windowSec: 60 * 60 },
  { limit: 20, windowSec: 24 * 60 * 60 },
];

// El chat sí consume inferencia de IA. Permite una conversación normal, pero evita que una
// sola conexión convierta el endpoint público en un servicio gratuito de generación de texto.
export const ASSISTANT_RULES: RateRule[] = [
  { limit: 20, windowSec: 10 * 60 },
  { limit: 100, windowSec: 24 * 60 * 60 },
];

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

// Cloudflare pone la IP real del cliente en CF-Connecting-IP y la reescribe en cada request,
// así que no es falsificable desde el navegador (a diferencia de X-Forwarded-For, que solo se
// usa como respaldo para entornos de desarrollo donde no hay proxy de Cloudflare enfrente).
export function clientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf;
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// Cuenta los intentos recientes del mismo `${scope}:${ip}` y decide si cabe uno más. Solo los
// intentos ACEPTADOS se registran: un rechazo no alarga el castigo, que es lo que convertiría
// una ventana deslizante en una prohibición indefinida para quien siga reintentando.
//
// Falla en abierto a propósito: si D1 no responde, deja pasar la petición en vez de perder un
// cliente real por un problema de infraestructura. La ruta que la llama escribe en la misma
// base de datos justo después, así que una D1 caída falla ahí de todos modos, con un mensaje
// mucho más claro que un 429 falso.
export async function enforceRateLimit(db: Db, scope: string, ip: string, rules: RateRule[]): Promise<RateLimitResult> {
  const bucket = `${scope}:${ip}`;
  const now = Date.now();
  const maxWindowMs = Math.max(...rules.map((r) => r.windowSec)) * 1000;

  try {
    const rows = await db
      .select({ createdAt: rateLimitHits.createdAt })
      .from(rateLimitHits)
      .where(and(eq(rateLimitHits.bucket, bucket), gte(rateLimitHits.createdAt, now - maxWindowMs)));
    const stamps = rows.map((r) => r.createdAt);

    for (const rule of rules) {
      const windowStart = now - rule.windowSec * 1000;
      const inWindow = stamps.filter((t) => t >= windowStart);
      if (inWindow.length >= rule.limit) {
        // El primer hueco se libera cuando el intento más viejo de la ventana sale de ella.
        const oldest = Math.min(...inWindow);
        const retryAfterSec = Math.max(1, Math.ceil((oldest + rule.windowSec * 1000 - now) / 1000));
        return { allowed: false, retryAfterSec };
      }
    }

    await db.insert(rateLimitHits).values({ id: crypto.randomUUID(), bucket, createdAt: now });
    // Barrido global de lo ya expirado: sin esto la tabla solo crecería, porque un bucket que
    // nunca vuelve no tiene quién limpie sus filas.
    await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, now - maxWindowMs));
    return { allowed: true };
  } catch (error) {
    console.error("rateLimit", error);
    return { allowed: true };
  }
}

// Freno de ráfaga para la ruta de precio, que se llama en cada cambio de configuración del
// wizard y no escribe nada. Registrarla en D1 costaría una escritura por cada tecla que mueve
// una medida -- más carga que el abuso que evitaría -- así que vive en memoria del isolate.
//
// Es aproximado por diseño: Cloudflare corre varios isolates y el estado no se comparte entre
// ellos, así que el límite real es "por isolate". Sirve para frenar un script apuntando a un
// solo punto, no como garantía exacta; el volumen de verdad lo absorbe la protección de
// Cloudflare, y la ruta no toca la base de datos ni guarda nada.
const BURST_LIMIT = 60;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_MAX_KEYS = 5000;
const burstHits = new Map<string, number[]>();
const assistantBurstHits = new Map<string, number[]>();

export function checkBurst(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - BURST_WINDOW_MS;

  if (burstHits.size > BURST_MAX_KEYS) {
    for (const [key, stamps] of burstHits) {
      if (stamps.every((t) => t < windowStart)) burstHits.delete(key);
    }
    // Si tras la poda sigue lleno, es un ataque distribuido y no un desbordamiento natural:
    // se descarta todo antes que dejar crecer el mapa sin límite dentro del isolate.
    if (burstHits.size > BURST_MAX_KEYS) burstHits.clear();
  }

  const recent = (burstHits.get(ip) ?? []).filter((t) => t >= windowStart);
  if (recent.length >= BURST_LIMIT) {
    burstHits.set(ip, recent);
    return false;
  }
  recent.push(now);
  burstHits.set(ip, recent);
  return true;
}

export function checkAssistantBurst(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const recent = (assistantBurstHits.get(ip) ?? []).filter((stamp) => stamp >= windowStart);
  if (recent.length >= 8) {
    assistantBurstHits.set(ip, recent);
    return false;
  }
  recent.push(now);
  assistantBurstHits.set(ip, recent);
  if (assistantBurstHits.size > BURST_MAX_KEYS) assistantBurstHits.clear();
  return true;
}

// Respuesta única para los dos límites, con Retry-After para que un cliente honesto (o un
// navegador) sepa cuándo reintentar. El mensaje es para un cliente final, no para un técnico.
export function tooManyRequests(retryAfterSec: number): Response {
  return Response.json(
    { error: "Recibimos demasiadas solicitudes desde tu conexión. Espera un momento e intenta de nuevo." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
