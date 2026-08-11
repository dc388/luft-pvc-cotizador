import assert from "node:assert/strict";
import test from "node:test";
import { matchBriefToStyle } from "@/lib/briefMatch";
import { buildPublicCatalog } from "@/lib/publicCatalog";
import { sanitizeBrief } from "@/lib/assistantSession";
import type { AssistantBrief } from "@/lib/assistantBrief";

const catalog = buildPublicCatalog();

test("sin medidas no propone nada: no hay con qué descartar por límites", () => {
  assert.equal(matchBriefToStyle({ accessRequired: true }, catalog), null);
});

test("con acceso requerido propone un estilo de la categoría puerta", () => {
  const brief: AssistantBrief = { widthMm: 2000, heightMm: 2200, accessRequired: true };
  const match = matchBriefToStyle(brief, catalog);
  assert.ok(match, "debe encontrar una opción");
  assert.equal(match.best.style.productId, "puerta");
});

test("sin acceso propone ventana", () => {
  const match = matchBriefToStyle({ widthMm: 1500, heightMm: 1200, accessRequired: false }, catalog);
  assert.ok(match);
  assert.equal(match.best.style.productId, "ventana");
});

test("respeta la cantidad de hojas pedida cuando el catálogo la ofrece", () => {
  const match = matchBriefToStyle({ widthMm: 3000, heightMm: 1500, accessRequired: false, leafCount: 3 }, catalog);
  assert.ok(match);
  assert.equal(match.best.style.panels, 3, "pidió 3 hojas y existe esa división");
});

test("nunca propone un estilo que no soporte la medida", () => {
  const brief: AssistantBrief = { widthMm: 4000, heightMm: 2400, accessRequired: false };
  const match = matchBriefToStyle(brief, catalog);
  assert.ok(match);
  assert.ok(brief.widthMm! <= match.best.style.maxW, "el ancho debe caber en el estilo elegido");
  assert.ok(brief.heightMm! <= match.best.style.maxH, "el alto debe caber");
  for (const alt of match.alternatives) {
    assert.ok(brief.widthMm! <= alt.style.maxW && brief.heightMm! <= alt.style.maxH, `la alternativa ${alt.style.name} también debe caber`);
  }
});

test("cada hoja resultante respeta el mínimo fabricable", () => {
  const match = matchBriefToStyle({ widthMm: 900, heightMm: 1200, accessRequired: false }, catalog);
  assert.ok(match);
  assert.ok(match.best.style.panels * catalog.minMm <= 900, "no debe proponer más hojas de las que caben");
});

test("un vano imposible devuelve null y no un estilo inventado", () => {
  assert.equal(matchBriefToStyle({ widthMm: 19_000, heightMm: 8000, accessRequired: true }, catalog), null);
});

test("prioridad de máxima apertura favorece más hojas móviles que la de vista", () => {
  const size = { widthMm: 3600, heightMm: 2200, accessRequired: false };
  const abrir = matchBriefToStyle({ ...size, openingGoal: "maximum" }, catalog);
  const vista = matchBriefToStyle({ ...size, openingGoal: "view" }, catalog);
  assert.ok(abrir && vista);
  const movables = (m: typeof abrir) => m!.best.style.wings.filter((w) => w !== "fixed" && w !== "inactive" && w !== "sliding-fixed").length;
  assert.ok(movables(abrir) >= movables(vista), "abrir al máximo no puede tener menos hojas móviles que priorizar vista");
});

test("el porcentaje de apertura es un entero plausible, no falsa precisión (§226)", () => {
  const match = matchBriefToStyle({ widthMm: 3600, heightMm: 2200, accessRequired: true, openingGoal: "maximum" }, catalog);
  assert.ok(match);
  assert.ok(Number.isInteger(match.best.openingPercent));
  assert.ok(match.best.openingPercent >= 0 && match.best.openingPercent <= 100);
});

test("explica por qué propone ese estilo (§219)", () => {
  const match = matchBriefToStyle({ widthMm: 2000, heightMm: 2200, accessRequired: true }, catalog);
  assert.ok(match);
  assert.ok(match.best.reason.length > 10, "debe traer una explicación en lenguaje del cliente");
});

test("avisa cuando no puede dar las hojas pedidas en vez de callarlo", () => {
  const match = matchBriefToStyle({ widthMm: 1000, heightMm: 2200, accessRequired: true, leafCount: 6 }, catalog);
  assert.ok(match);
  assert.ok(match.notes.length > 0, "debe declarar que no pudo cumplir las 6 hojas");
});

test("sanitizeBrief descarta basura y conserva lo válido", () => {
  const dirty = {
    widthMm: 4500,
    heightMm: -3,
    location: "  jardín  ",
    accessRequired: "si",
    openingGoal: "cualquiera",
    leafCount: 99,
    priorities: ["view", 42, "minimal_frame"],
    provenance: { widthMm: "confirmed", heightMm: "hackeado" },
    extra: "no debe pasar",
  };
  const clean = sanitizeBrief(dirty);
  assert.equal(clean.widthMm, 4500);
  assert.equal(clean.heightMm, undefined, "una medida negativa se descarta");
  assert.equal(clean.location, "jardín");
  assert.equal(clean.accessRequired, undefined, "un string no es booleano");
  assert.equal(clean.openingGoal, undefined, "un valor fuera del enum se descarta");
  assert.equal(clean.leafCount, undefined, "99 hojas está fuera de rango");
  assert.deepEqual(clean.priorities, ["view", "minimal_frame"]);
  assert.deepEqual(clean.provenance, { widthMm: "confirmed" });
  assert.equal((clean as Record<string, unknown>).extra, undefined, "no debe copiar campos desconocidos");
});
