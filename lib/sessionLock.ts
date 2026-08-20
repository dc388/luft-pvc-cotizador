/**
 * Protección contra sobrescrituras cuando el mismo componente está abierto en más de una pestaña.
 *
 * El problema real: el editor autoguarda cada 400 ms el ESTADO COMPLETO del componente, no un
 * cambio. Dos pestañas con el mismo componente abierto se pisan la una a la otra en cada pulsación,
 * y gana la última que guarde -- sin aviso y sin forma de recuperar lo perdido.
 *
 * Cómo se resuelve: cada pestaña anuncia por `localStorage` qué componente tiene abierto y renueva
 * el anuncio periódicamente. Al abrir un componente que otra pestaña anunció hace poco, esta pestaña
 * NO autoguarda y lo dice; quien esté aquí decide tomar el control (y entonces la otra deja de
 * guardar) o ir a la otra pestaña.
 *
 * Por qué `localStorage` y no un bloqueo en el servidor: el servidor no sabe cuándo se cierra una
 * pestaña, así que un bloqueo suyo se quedaría colgado hasta caducar y dejaría el componente
 * inservible tras un cierre inesperado. El anuncio con caducidad corta se limpia solo.
 *
 * Alcance honesto: esto cubre pestañas del MISMO navegador, que es el caso real y frecuente (dos
 * pestañas abiertas por descuido). Dos personas en dos computadoras distintas no se ven entre sí
 * por este camino; para eso hace falta control de concurrencia en el servidor, que exige antes la
 * autenticación por usuario que sigue pendiente (ver PROCESO_POST_COTIZACION.md).
 */

import { newId } from "@/lib/uuid";


const KEY = "luft-pvc-cotizador:open-components:v1";
/** Cada cuánto una pestaña renueva su anuncio. */
export const HEARTBEAT_MS = 4000;
/** Un anuncio más viejo que esto se considera de una pestaña que ya se cerró. */
const STALE_MS = 12_000;

type Claim = { tabId: string; at: number };
type Claims = Record<string, Claim>;

function read(): Claims {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Claims) : {};
  } catch {
    return {};
  }
}

function write(claims: Claims): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(claims));
  } catch {
    // Navegación privada o almacenamiento deshabilitado: sin anuncio no hay detección, y el editor
    // se comporta como antes de que esto existiera. Es una degradación aceptable.
  }
}

/** Quita los anuncios caducados. Es la limpieza que hace que un cierre inesperado no deje bloqueado
 *  un componente para siempre. */
function prune(claims: Claims, now: number): Claims {
  const alive: Claims = {};
  for (const [key, claim] of Object.entries(claims)) {
    if (claim && typeof claim.at === "number" && now - claim.at < STALE_MS) alive[key] = claim;
  }
  return alive;
}

export function newTabId(): string {
  return newId();
}

// ---------- Suscripción ----------

// Los anuncios son estado de un sistema externo (localStorage, compartido entre pestañas), así que se
// leen con useSyncExternalStore y no con estado más un efecto que lo rellene. Eso evita el render
// extra en cada latido y, sobre todo, hace que la pestaña reaccione en el momento en que otra toma el
// control, no en el siguiente latido.
//
// Se vigila por dos vías porque una sola no basta: el evento `storage` avisa de lo que hacen OTRAS
// pestañas al instante, y el intervalo cubre la caducidad de un anuncio cuya pestaña se cerró sin
// avisar (nadie escribe nada en ese caso, así que no hay evento que escuchar).
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToClaims(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && timer === null) {
    window.addEventListener("storage", onStorage);
    timer = setInterval(notify, HEARTBEAT_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === KEY) notify();
}

/** Avisa a los suscriptores de que los anuncios cambiaron desde esta misma pestaña. */
export function announceClaimChange(): void {
  notify();
}

/** Anuncia (o renueva) que esta pestaña tiene abierto este componente. */
export function claimComponent(tabId: string, key: string): void {
  const now = Date.now();
  const claims = prune(read(), now);
  claims[key] = { tabId, at: now };
  write(claims);
}

export function releaseComponent(tabId: string, key: string): void {
  const claims = prune(read(), Date.now());
  if (claims[key]?.tabId === tabId) delete claims[key];
  write(claims);
}

/** `true` cuando OTRA pestaña anunció este componente hace poco. */
export function isClaimedByAnotherTab(tabId: string, key: string): boolean {
  const claim = prune(read(), Date.now())[key];
  return !!claim && claim.tabId !== tabId;
}

/** Toma el control: el anuncio pasa a esta pestaña, y la otra lo detecta en su siguiente latido. */
export function takeOverComponent(tabId: string, key: string): void {
  claimComponent(tabId, key);
}

export function componentKey(projectId: string, componentId: string): string {
  return `${projectId}/${componentId}`;
}
