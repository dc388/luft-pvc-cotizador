import assert from "node:assert/strict";
import test from "node:test";
import { availabilityLabel, SIZE_CTA, sizeRejection, type AvailabilityStatus } from "@/components/cotizar/availability";
import { buildPublicCatalog, findStyle } from "@/lib/publicCatalog";
import { checkConfig, checkConfigs, parseConfig, parseProjectConfigs, priceConfig, PublicQuoteError } from "@/lib/publicQuote";
import { matchBriefToStyle } from "@/lib/briefMatch";
import { catalog as internalCatalog } from "@/data/catalog";

// La regla nueva: el motor sigue calculando el precio, y ese precio NO llega al cliente mientras
// configura. Lo que estas pruebas fijan es la frontera -- lo que la interfaz puede decir y lo que
// el servidor puede devolver.

const catalog = buildPublicCatalog();
const hinged1 = catalog.styles.find((s) => s.id === "alu-puerta-abatible-1")!;
const hinged2 = catalog.styles.find((s) => s.id === "alu-puerta-abatible-2")!;
const payload = (styleId: string, widthMm: number, heightMm: number) => ({
  styleId,
  widthMm,
  heightMm,
  qty: 1,
  colorId: "negro",
  glassId: "Cristal templado claro 6 mm",
  extras: { instalacion: true },
});

/** Ninguna etiqueta de cara al cliente puede contener dinero, ni real ni insinuado. */
function assertNoMoney(label: string) {
  assert.doesNotMatch(label, /\$|mxn|peso|precio|costo|total|estimad|aproximad|desde|~/i, `“${label}” habla de dinero`);
}

test("ninguna etiqueta de disponibilidad menciona dinero", () => {
  const all: AvailabilityStatus[] = [
    { kind: "missing-data" },
    { kind: "checking" },
    { kind: "available" },
    { kind: "unavailable" },
    { kind: "unavailable", reason: sizeRejection(hinged1, 4000, 2400, catalog.minMm)! },
  ];
  for (const status of all) assertNoMoney(availabilityLabel(status));
});

test("sin medidas se pide la medida, no un precio", () => {
  const label = availabilityLabel({ kind: "missing-data" });
  assert.equal(label, SIZE_CTA);
  assert.doesNotMatch(label, /\d/, "sin medidas no puede aparecer ningún número");
  assert.ok(hinged1 && hinged2, "los estilos de puerta abatible deben existir en el catálogo público");
});

test("con medidas completas la respuesta es disponibilidad, no importe", () => {
  const available = checkConfig(payload(hinged1.id, 1200, 2400));
  assert.deepEqual(available, { available: true }, "la respuesta no puede traer ningún campo extra: ahí se colaría el precio");
  assert.equal(availabilityLabel({ kind: "available" }), "Disponible en tu medida");
  // Ni el objeto serializado completo puede contener una cifra de dinero.
  assert.doesNotMatch(JSON.stringify(available), /\d/);
});

test("el motor sigue calculando por dentro y el precio sigue dependiendo de la medida", () => {
  // Esto es lo que NO se rompió: el cálculo interno es el mismo de siempre. Solo dejó de viajar.
  const price = priceConfig(parseConfig(payload(hinged1.id, 1200, 2400)));
  const bigger = priceConfig(parseConfig(payload(hinged1.id, 1200, 2600)));
  assert.ok(price.total > 0, "el motor debe devolver un importe");
  assert.equal(price.total, Math.round(price.total), "el importe llega redondeado en pesos");
  assert.ok(bigger.total > price.total, "más alto debe costar más: el precio sale de la medida, no de una tabla fija");
});

test("una medida imposible se declara con su motivo, nunca se disfraza de disponible", () => {
  const rejected = checkConfig(payload(hinged1.id, hinged1.maxW + 1, 2400));
  assert.equal(rejected.available, false);
  assert.ok(rejected.available === false && rejected.reason.length > 0, "un rechazo tiene que explicarse");
  assertNoMoney(rejected.available === false ? rejected.reason : "");

  // Y el motivo que calcula la interfaz coincide con el del servidor: si divergieran, la tarjeta
  // diría "disponible" sobre algo que el servidor tumba.
  assert.ok(sizeRejection(hinged1, hinged1.maxW + 1, 2400, catalog.minMm));
  assert.equal(sizeRejection(hinged1, 1200, 2400, catalog.minMm), null);
  assert.ok(sizeRejection(hinged1, catalog.minMm - 1, 2400, catalog.minMm));
  assert.throws(() => parseConfig(payload(hinged1.id, catalog.minMm - 1, 2400)), PublicQuoteError);
});

test("un elemento inválido no tumba la disponibilidad de los demás", () => {
  // El lote de PRECIOS sí falla completo al primer inválido (parseProjectConfigs lanza), y por eso
  // la comprobación de disponibilidad se resuelve elemento por elemento: la pantalla de estilos
  // pregunta por siete a la vez y uno fuera de rango dejaría a los otros seis sin respuesta.
  const ok = payload(hinged1.id, 1200, 2400);
  const tooWide = payload(hinged1.id, hinged1.maxW + 1, 2400);
  assert.throws(() => parseProjectConfigs([ok, tooWide]), PublicQuoteError);

  const checks = checkConfigs([ok, tooWide, payload(hinged2.id, 1400, 2400)]);
  assert.equal(checks.length, 3);
  assert.equal(checks[0].available, true);
  assert.equal(checks[1].available, false);
  assert.equal(checks[2].available, true);
  assert.doesNotMatch(JSON.stringify(checks), /\$|\bMXN\b/i, "la respuesta del lote no puede llevar importes");
});

test("con las medidas que ya conoce LUFT Asesor la configuración queda cotizable sin volver a preguntar", () => {
  const match = matchBriefToStyle(
    { widthMm: 1200, heightMm: 2400, accessRequired: true, colorWord: "negro" },
    catalog
  );
  assert.ok(match, "el brief con medidas debe resolver un estilo");
  assert.equal(checkConfig(payload(match.best.style.id, 1200, 2400)).available, true);
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
