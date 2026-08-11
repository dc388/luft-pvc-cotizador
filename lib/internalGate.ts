// Candado de la app interna para el Worker desplegado.
//
// El Worker sirve TODAS las rutas: el cotizador público (/cotizar) y también la app interna (/)
// y su CRUD de proyectos (/api/projects/**), que no tiene autenticación propia y expone nombre,
// teléfono, correo y dirección de cada cliente -- además de permitir borrar proyectos. Publicar
// el cotizador sin este filtro publicaría todo eso con él.
//
// Vive en el punto de entrada del Worker (worker/index.ts) y no como middleware de Next: es el
// único lugar por el que pasa cada petición, así que no hay ruta que lo esquive.
//
// DECISIÓN: la lista es de lo PÚBLICO, no de lo protegido. Cualquier ruta nueva queda protegida
// por omisión; para exponerla hay que agregarla aquí a propósito. Al revés, una pantalla interna
// nueva quedaría abierta sin que nadie lo note.
//
// Esto NO sustituye la autenticación real por usuario que sigue pendiente (ver
// PROCESO_POST_COTIZACION.md, fase 1): es una sola contraseña compartida, sin usuarios ni
// permisos ni bitácora. Resuelve exactamente un problema: que la base de clientes no quede
// abierta a internet.

const COOKIE_NAME = "luft_internal";
// El mensaje firmado es constante: la cookie guarda un HMAC, nunca la contraseña. Sin el secreto
// no se puede fabricar una cookie válida.
const TOKEN_MESSAGE = "luft-internal-v1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const LOGIN_PATH = "/acceso";

// Rutas públicas por diseño: el cotizador, los endpoints con prefijo `public-`, el descubridor
// de versión y el optimizador de imágenes (que sirve al cotizador).
//
// `/api/public-` cubre la familia completa (public-quote, public-quote/submit,
// public-assistant...). Se generalizó tras un fallo real: la lista decía `/api/public-quote` y
// dejó al asistente del cotizador devolviendo 401 en producción. La convención de nombre es
// ahora el contrato -- una ruta que deba ser pública se llama `public-*`.
//
// `/cotizacion/` es la cotización definitiva del cliente y se agrega aquí a propósito, rompiendo
// la convención de nombre `public-*`: es una URL que el cliente guarda y reenvía, y "cotizacion"
// es lo que tiene que decir. Su credencial no es la contraseña interna sino el token opaco de la
// propia ruta (ver lib/quoteRepo.ts): sin ese token no hay nada que leer, y el folio consecutivo
// deliberadamente NO abre el documento.
const PUBLIC_PREFIXES = ["/cotizar", "/cotizacion/", "/api/public-", "/api/version", "/_vinext/", LOGIN_PATH];
const PUBLIC_EXACT = new Set(["/favicon.svg", "/favicon.ico", "/robots.txt", "/manifest.webmanifest"]);
// Los estáticos siempre pasan: si se filtraran, el propio cotizador público se quedaría sin su
// JavaScript y sus estilos.
const ASSET_EXT = /\.(?:js|mjs|cjs|css|map|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|wasm|txt)$/i;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (ASSET_EXT.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix));
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function expectedToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(TOKEN_MESSAGE)));
}

// Comparación de tiempo constante: un `===` sobre estas cadenas se corta en el primer byte
// distinto y filtra, por diferencia de tiempo, cuánto prefijo se acertó.
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function wantsHtml(request: Request): boolean {
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

function loginPage(url: URL, error: string): Response {
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acceso · LUFT PVC</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#2f2b41;
 background:radial-gradient(1100px 700px at 8% -8%,#ffd7ec,transparent 58%),
 radial-gradient(900px 620px at 96% 4%,#cfe3ff,transparent 56%),
 linear-gradient(168deg,#f8f5ff,#eff6ff 48%,#fff5fa)}
form{width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px;padding:26px;
 border:1px solid rgba(122,110,170,.18);border-radius:26px;background:rgba(255,255,255,.62);
 backdrop-filter:blur(20px) saturate(170%);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 18px 42px -22px rgba(88,74,140,.4)}
h1{margin:0;font-size:21px;letter-spacing:-.02em}
p{margin:0;font-size:13px;color:#6d6889;line-height:1.5}
input{height:52px;border-radius:16px;border:1px solid rgba(122,110,170,.24);padding:0 15px;
 font-size:16px;background:rgba(255,255,255,.75);color:inherit}
button{height:52px;border:0;border-radius:999px;font-size:16px;font-weight:600;color:#fff;
 background:linear-gradient(140deg,#8b7cf0,#6f5ee0);cursor:pointer}
.err{color:#8a2b3c;background:rgba(255,214,224,.7);border:1px solid rgba(190,80,110,.3);
 border-radius:14px;padding:11px 13px;font-size:13px}
@media (prefers-color-scheme:dark){
 body{color:#ecebf7;background:radial-gradient(1100px 700px at 8% -8%,#3d2b50,transparent 58%),
  radial-gradient(900px 620px at 96% 4%,#223851,transparent 56%),
  linear-gradient(168deg,#181527,#141a2b 48%,#1e1527)}
 form{background:rgba(62,58,92,.6);border-color:rgba(255,255,255,.13);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 18px 42px -22px #000}
 input{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14);color:inherit}
 p{color:#a9a4c6}
}
</style></head><body>
<form method="post" action="${LOGIN_PATH}">
<h1>LUFT PVC</h1>
<p>Esta es el área interna. El cotizador para clientes está en <a href="/cotizar">/cotizar</a>.</p>
${error ? `<div class="err">${error}</div>` : ""}
<input type="hidden" name="next" value="${safeNext.replace(/"/g, "&quot;")}">
<input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" autofocus required>
<button type="submit">Entrar</button>
</form></body></html>`,
    { status: error ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

/**
 * Devuelve `null` cuando la petición puede continuar hacia la app, o la Response con que se le
 * responde (formulario, redirección o 401). Falla cerrado: si no hay contraseña configurada, lo
 * interno no se sirve -- preferimos una app interna inaccesible a una abierta por descuido.
 */
export async function guardInternal(request: Request, password: string | undefined): Promise<Response | null> {
  const url = new URL(request.url);
  const secret = (password ?? "").trim();

  if (url.pathname === LOGIN_PATH) {
    if (!secret) return new Response("Falta configurar INTERNAL_PASSWORD en el Worker.", { status: 503 });
    if (request.method === "POST") {
      const form = await request.formData();
      const attempt = String(form.get("password") ?? "");
      const rawNext = String(form.get("next") ?? "/");
      const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
      if (!sameSecret(attempt, secret)) return loginPage(url, "Contraseña incorrecta.");
      const token = await expectedToken(secret);
      // Secure solo bajo https: en desarrollo local se sirve por http y el navegador
      // descartaría la cookie.
      const flags = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${COOKIE_MAX_AGE}`];
      if (url.protocol === "https:") flags.push("Secure");
      return new Response(null, {
        status: 303,
        headers: { Location: next, "Set-Cookie": `${COOKIE_NAME}=${token}; ${flags.join("; ")}` },
      });
    }
    return loginPage(url, "");
  }

  if (isPublicPath(url.pathname)) return null;

  if (!secret) {
    return new Response("El área interna no está disponible: falta configurar INTERNAL_PASSWORD.", { status: 503 });
  }
  if (sameSecret(readCookie(request, COOKIE_NAME), await expectedToken(secret))) return null;

  if (wantsHtml(request)) {
    const target = `${LOGIN_PATH}?next=${encodeURIComponent(url.pathname + url.search)}`;
    return new Response(null, { status: 302, headers: { Location: target, "cache-control": "no-store" } });
  }
  return Response.json({ error: "No autorizado." }, { status: 401 });
}
