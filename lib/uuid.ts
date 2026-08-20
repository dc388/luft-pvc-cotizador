/**
 * UUID v4 que también funciona fuera de contexto seguro.
 *
 * `crypto.randomUUID` sólo existe en orígenes seguros (https o localhost). Abriendo la aplicación
 * por la IP de la red -- `http://192.168.1.80:5173`, una tablet del taller, otra computadora de la
 * oficina -- la función no existe y el editor se caía al construir el árbol inicial con
 * `TypeError: crypto.randomUUID is not a function`, antes de dibujar nada.
 *
 * El respaldo se hace con `getRandomValues`, que sí está disponible en cualquier origen, y NUNCA
 * con `Math.random()`: por aquí también salen los tokens con los que se sirve una cotización
 * definitiva (ver lib/quoteRepo.ts), y un token adivinable dejaría ver la cotización de un cliente
 * a cualquiera. Si no hubiera fuente de aleatoriedad criptográfica, es mejor fallar de golpe que
 * emitir un identificador débil sin que nadie se entere.
 */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  if (typeof c?.getRandomValues !== "function") {
    throw new Error("Sin fuente de aleatoriedad criptográfica: no se puede generar un identificador.");
  }
  const b = c.getRandomValues(new Uint8Array(16));
  // Versión 4 y variante RFC 4122, en los bits que la norma reserva para eso.
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return [
    h.slice(0, 4).join(""),
    h.slice(4, 6).join(""),
    h.slice(6, 8).join(""),
    h.slice(8, 10).join(""),
    h.slice(10, 16).join(""),
  ].join("-");
}
