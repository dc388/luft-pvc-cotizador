import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register(new URL("./cloudflare-workers-loader.mjs", import.meta.url));

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
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
  assert.doesNotMatch(html, /Deceuninck/i);

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
        extras: { instalacion: true, persianaExterior: false, mosquitero: false },
      }),
    }),
    env,
    ctx,
  );
  assert.equal(apiResponse.status, 400);
  assert.match((await apiResponse.json()).error, /Elige un estilo de la lista/i);
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
    extras: { instalacion: true, persianaExterior: false, mosquitero: false },
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
    extras: { instalacion: true, persianaExterior: false, mosquitero: false },
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
