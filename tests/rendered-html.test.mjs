import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register(new URL("./cloudflare-workers-loader.mjs", import.meta.url));

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

// La app interna vive detrás del candado de lib/internalGate.ts, así que pedir "/" sin
// credenciales devuelve 503 ("falta configurar INTERNAL_PASSWORD") y nunca llega a renderizar.
// Estas pruebas usan una contraseña de prueba propia -- nada de la real -- y fabrican la cookie
// igual que el candado: un HMAC del mensaje constante, nunca la contraseña en claro.
const TEST_INTERNAL_PASSWORD = "contrasena-de-prueba";

async function internalCookie(password) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("luft-internal-v1"));
  const token = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `luft_internal=${token}`;
}

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", cookie: await internalCookie(TEST_INTERNAL_PASSWORD) },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      INTERNAL_PASSWORD: TEST_INTERNAL_PASSWORD,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("el candado interno no deja pasar sin cookie válida", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-gate`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    INTERNAL_PASSWORD: TEST_INTERNAL_PASSWORD,
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  // Sin cookie: la app interna redirige al formulario, no se sirve.
  const anonymous = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );
  assert.equal(anonymous.status, 302);

  // Con una cookie firmada con otra contraseña tampoco pasa.
  const forged = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", cookie: await internalCookie("otra-contrasena") },
    }),
    env,
    ctx,
  );
  assert.equal(forged.status, 302);

  // El CRUD de proyectos, que expone datos de clientes, responde 401 y no un formulario.
  const api = await worker.fetch(new Request("http://localhost/api/projects"), env, ctx);
  assert.equal(api.status, 401);
});

// NOTA: el selector de carpetas no se puede afirmar desde aquí. El HTML que rinde el servidor
// abre en el tab "Diseño", y el bloque de Carpetas vive en el tab "Proyecto", que solo existe
// tras la hidratación. Una aserción sobre este HTML pasaría o fallaría por el tab activo, no por
// el selector, así que la lista se verifica contra el API (GET /api/projects) y en el navegador.

test("exposes a non-cacheable deployment version for open clients", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-version`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/version"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(typeof payload.version, "string");
  assert.ok(payload.version.length > 0);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
});

test("public quote exposes only Aluplast and rejects removed Deceuninck styles", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-public-catalog`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
  const ctx = {
    waitUntil() {},
    passThroughOnException() {},
  };

  const pageResponse = await worker.fetch(
    new Request("http://localhost/cotizar", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );
  const html = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.match(html, /Aluplast/i);
  assert.match(html, /Puerta abatible de 1 hoja/i);
  assert.match(html, /Puerta abatible de 2 hojas/i);
  assert.match(html, /LUFT Asesor/i);
  assert.doesNotMatch(html, /Puerta corrediza/i);
  assert.doesNotMatch(html, /Deceuninck/i);
  assert.doesNotMatch(html, /Persiana exterior|Mosquitero/i);

  const apiResponse = await worker.fetch(
    new Request("http://localhost/api/public-quote", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({
        styleId: "dec-fija",
        widthMm: 1200,
        heightMm: 1200,
        qty: 1,
        colorId: "M3",
        glassId: "Cristal recocido claro 6 mm",
        extras: { instalacion: true },
      }),
    }),
    env,
    ctx,
  );
  assert.equal(apiResponse.status, 400);
  assert.match((await apiResponse.json()).error, /Elige un estilo de la lista/i);
});

test("public assistant keeps confidential pricing fields out of the rendered client payload", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-public-assistant-security`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/cotizar", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /LUFT Asesor/i);
  assert.doesNotMatch(html, /PUBLIC_GROSS_MARGIN|costo directo|utilidad estimada/i);
  assert.doesNotMatch(html, /Hablar con un asesor/i);
});

test("public quote prices the existing Aluplast hinged-door typologies", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-hinged-doors`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const quote = async (styleId, widthMm, ip) => {
    const response = await worker.fetch(
      new Request("http://localhost/api/public-quote", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({
          styleId,
          widthMm,
          heightMm: 2200,
          qty: 1,
          colorId: "bl",
          glassId: "Cristal templado claro 6 mm",
          extras: { instalacion: true },
        }),
      }),
      env,
      ctx,
    );
    assert.equal(response.status, 200);
    return response.json();
  };

  const single = await quote("alu-puerta-abatible-1", 1000, "203.0.113.40");
  const double = await quote("alu-puerta-abatible-2", 1800, "203.0.113.41");
  assert.ok(single.price.total > 0);
  assert.ok(double.price.total > single.price.total);
  assert.equal(single.price.estimated, true);
  assert.equal(double.price.estimated, true);
});

test("public quote ignores removed curtain and mosquito-screen fields from old clients", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-removed-extras`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const base = {
    styleId: "alu-corrediza-2",
    widthMm: 1800,
    heightMm: 1200,
    qty: 1,
    colorId: "bl",
    glassId: "Cristal recocido claro 6 mm",
  };

  const quote = async (extras, ip) => {
    const response = await worker.fetch(
      new Request("http://localhost/api/public-quote", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ ...base, extras }),
      }),
      env,
      ctx,
    );
    assert.equal(response.status, 200);
    return response.json();
  };

  const clean = await quote({ instalacion: true }, "203.0.113.30");
  const legacy = await quote(
    { instalacion: true, persianaExterior: true, mosquitero: true },
    "203.0.113.31",
  );
  assert.deepEqual(legacy.price, clean.price);
  assert.equal(legacy.price.hasQuoteOnRequestItems, false);
});

test("public quote prices multiple window configurations as one project", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-multi-item`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const base = {
    widthMm: 1200,
    heightMm: 1200,
    colorId: "bl",
    glassId: "Cristal recocido claro 6 mm",
    extras: { instalacion: true },
  };

  const response = await worker.fetch(
    new Request("http://localhost/api/public-quote", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
      body: JSON.stringify({
        items: [
          { ...base, styleId: "alu-fija", qty: 1 },
          { ...base, styleId: "alu-corrediza-2", widthMm: 1800, qty: 2 },
        ],
      }),
    }),
    env,
    ctx,
  );
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.itemPrices.length, 2);
  assert.equal(json.price.total, json.itemPrices[0].total + json.itemPrices[1].total);
  assert.equal(json.price.deposit + json.price.remaining, json.price.total);
});

test("public quote rejects abusive project payload sizes", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-multi-item-limit`);
  const { default: worker } = await import(workerUrl.href);
  const config = {
    styleId: "alu-fija",
    widthMm: 1200,
    heightMm: 1200,
    qty: 1,
    colorId: "bl",
    glassId: "Cristal recocido claro 6 mm",
    extras: { instalacion: true },
  };
  const response = await worker.fetch(
    new Request("http://localhost/api/public-quote", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.21" },
      body: JSON.stringify({ items: Array.from({ length: 101 }, () => config) }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /hasta 100 configuraciones/i);
});
