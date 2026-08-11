import assert from "node:assert/strict";
import test from "node:test";
import { PRICE_CTA, priceStatusLabel, sizeRejection, type PriceStatus } from "@/components/cotizar/priceStatus";
import { buildPublicCatalog, findStyle } from "@/lib/publicCatalog";
import { parseConfig, parseProjectConfigs, priceConfig, PublicQuoteError } from "@/lib/publicQuote";
import { matchBriefToStyle } from "@/lib/briefMatch";
import { catalog as internalCatalog } from "@/data/catalog";

// Los cinco casos obligatorios del brief de corrección de precios, más las invariantes que
// impiden que "estimado" vuelva a colarse como relleno de un precio ausente.

const catalog = buildPublicCatalog();
const hinged1 = catalog.styles.find((s) => s.id === "alu-puerta-abatible-1")!;
const hinged2 = catalog.styles.find((s) => s.id === "alu-puerta-abatible-2")!;

/** Ninguna etiqueta de precio de cara al cliente puede sugerir que la cifra es inventada. */
function assertNotApproximate(label: string) {
  assert.doesNotMatch(label, /estimad|aproximad|desde|~/i, `"${label}" insinúa un precio aproximado`);
}

test("CASO 1 — puerta abatible de 1 hoja sin medidas: pide calcular, no dice estimado", () => {
  const label = priceStatusLabel({ kind: "missing-data" });
  assert.equal(label, "Calcular precio");
  assert.equal(label, PRICE_CTA);
  assertNotApproximate(label);
  assert.ok(hinged1, "el estilo debe existir en el catálogo público");
});

test("CASO 2 — puerta abatible de 2 hojas sin medidas: mismo estado, sin cifra", () => {
  const label = priceStatusLabel({ kind: "missing-data" });
  assert.equal(label, "Calcular precio");
  assert.doesNotMatch(label, /\d/, "sin medidas no puede aparecer ningún número");
  assert.ok(hinged2);
});

test("CASO 3 — puerta abatible con medidas completas: precio del motor real", () => {
  const price = priceConfig({
    styleId: hinged1.id,
    widthMm: 1200,
    heightMm: 2400,
    qty: 1,
    colorId: "negro",
    glassId: "Cristal templado claro 6 mm",
    extras: { instalacion: true },
  });
  assert.ok(price.total > 0, "el motor debe devolver un importe");
  assert.equal(price.total, Math.round(price.total), "el importe llega redondeado en pesos");

  // El precio depende de la configuración: una puerta más grande no puede costar lo mismo.
  const bigger = priceConfig({
    styleId: hinged1.id,
    widthMm: 1200,
    heightMm: 2600,
    qty: 1,
    colorId: "negro",
    glassId: "Cristal templado claro 6 mm",
    extras: { instalacion: true },
  });
  assert.ok(bigger.total > price.total, "más alto debe costar más: el precio sale de la medida, no de una tabla fija");

  const label = priceStatusLabel({ kind: "available", total: price.total });
  assert.match(label, /\$/, "con datos completos se muestra el importe");
  assertNotApproximate(label);
});

test("CASO 4 — error de cálculo: se declara, nunca se sustituye por una cifra", () => {
  const label = priceStatusLabel({ kind: "error" });
  assert.equal(label, "No disponible");
  assert.doesNotMatch(label, /\d/, "un fallo no puede rendir un número");
  assertNotApproximate(label);

  // Un motivo conocido se explica en vez de dejar un "No disponible" sin causa.
  const reason = sizeRejection(hinged1, 4000, 2400, catalog.minMm);
  assert.ok(reason, "4000 mm excede el máximo de la puerta abatible");
  assert.equal(priceStatusLabel({ kind: "error", reason }), reason);
});

test("CASO 5 — con las medidas que ya conoce LUFT Asesor se cotiza sin volver a preguntar", () => {
  const match = matchBriefToStyle(
    { widthMm: 1200, heightMm: 2400, accessRequired: true, colorWord: "negro" },
    catalog
  );
  assert.ok(match, "el brief con medidas debe resolver un estilo");
  const price = priceConfig({
    styleId: match.best.style.id,
    widthMm: 1200,
    heightMm: 2400,
    qty: 1,
    colorId: "negro",
    glassId: "Cristal templado claro 6 mm",
    extras: { instalacion: true },
  });
  assert.ok(price.total > 0, "el precio se obtiene con los datos ya reunidos por el asesor");
});

test("el estado de cálculo no adelanta ninguna cifra", () => {
  const label = priceStatusLabel({ kind: "calculating" });
  assert.equal(label, "Calculando…");
  assert.doesNotMatch(label, /\d/);
});

test("ninguna etiqueta de PriceStatus insinúa un precio aproximado", () => {
  const all: PriceStatus[] = [
    { kind: "missing-data" },
    { kind: "calculating" },
    { kind: "available", total: 15000 },
    { kind: "error" },
  ];
  for (const status of all) assertNotApproximate(priceStatusLabel(status));
});

test("sizeRejection coincide con el rechazo real del servidor", () => {
  const payload = (widthMm: number) => ({
    styleId: hinged1.id,
    widthMm,
    heightMm: 2400,
    qty: 1,
    colorId: "negro",
    glassId: "Cristal templado claro 6 mm",
    extras: { instalacion: true },
  });

  // Dentro de límites: ni el filtro local ni el del servidor rechazan.
  assert.equal(sizeRejection(hinged1, 1200, 2400, catalog.minMm), null);
  assert.doesNotThrow(() => parseConfig(payload(1200)));

  // Fuera de límites: los dos rechazan. Si divergieran, el filtro local dejaría pasar al lote
  // un elemento que el servidor tumba, y con él el precio de todas las demás tarjetas.
  assert.ok(sizeRejection(hinged1, hinged1.maxW + 1, 2400, catalog.minMm));
  assert.throws(() => parseConfig(payload(hinged1.maxW + 1)), PublicQuoteError);
  assert.ok(sizeRejection(hinged1, catalog.minMm - 1, 2400, catalog.minMm));
  assert.throws(() => parseConfig(payload(catalog.minMm - 1)), PublicQuoteError);
});

test("el motor rechaza el lote completo al primer elemento inválido", () => {
  // Esto es lo que justifica el pre-filtro del cliente: un estilo fuera de rango dentro del
  // lote deja sin precio a todos los demás, no solo a sí mismo.
  const ok = { styleId: hinged1.id, widthMm: 1200, heightMm: 2400, qty: 1, colorId: "negro", glassId: "Cristal templado claro 6 mm", extras: { instalacion: true } };
  const tooWide = { ...ok, widthMm: hinged1.maxW + 1 };
  assert.throws(() => parseProjectConfigs([ok, tooWide]), PublicQuoteError);
});

test("cada estilo público resuelve un sistema real del catálogo interno", () => {
  for (const style of catalog.styles) {
    const def = findStyle(style.id);
    assert.ok(def, `${style.id} debe resolverse`);
    const system = internalCatalog[def.brand][def.systemIndex];
    assert.ok(system, `${style.id} apunta a un sistema inexistente`);
    // `estimated` es exactamente la procedencia de tarifas del sistema, ni más ni menos.
    assert.equal(style.estimated, system.sourced !== true, `${style.id}: estimated debe reflejar sourced`);
  }
});

test("las puertas abatibles apuntan al perfil de puerta real, no a una corredera", () => {
  for (const id of [hinged1.id, hinged2.id]) {
    const def = findStyle(id)!;
    const system = internalCatalog[def.brand][def.systemIndex];
    assert.equal(system.category, "Puerta");
    assert.deepEqual(system.rails, [0], "una puerta abatible no lleva rieles");
  }
});
