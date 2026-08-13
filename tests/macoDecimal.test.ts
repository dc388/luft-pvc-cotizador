import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SCALE, canonicalDecimal, formatExact, multiplyExact } from "@/lib/maco/decimal";

// El caso que motiva todo el módulo: el .xlsx de MACO guarda literalmente 11.379999999999999
// donde el proveedor imprime 11.38, y hay 152 celdas así en la revisión ABR_22.
test("recupera el decimal impreso a partir de la basura de coma flotante del Excel", () => {
  const cases: [string, string, number, number][] = [
    ["11.379999999999999", "11.38", 1138, 2],
    ["0.15000000000000002", "0.15", 15, 2],
    ["190.29999999999998", "190.3", 1903, 1],
    ["104.46000000000001", "104.46", 10446, 2],
    ["5.1899999999999995", "5.19", 519, 2],
    ["118.80000000000001", "118.8", 1188, 1],
    ["30.060000000000002", "30.06", 3006, 2],
  ];
  for (const [raw, text, minor, scale] of cases) {
    const exact = canonicalDecimal(raw);
    assert.ok(exact, `no se pudo interpretar ${raw}`);
    assert.equal(exact.text, text, `texto de ${raw}`);
    assert.equal(exact.minor, minor, `entero de ${raw}`);
    assert.equal(exact.scale, scale, `escala de ${raw}`);
  }
});

test("un decimal ya limpio se conserva sin pasar por coma flotante", () => {
  assert.deepEqual(canonicalDecimal("15.94"), { text: "15.94", minor: 1594, scale: 2 });
  assert.deepEqual(canonicalDecimal("0.11"), { text: "0.11", minor: 11, scale: 2 });
  assert.deepEqual(canonicalDecimal("428.65"), { text: "428.65", minor: 42865, scale: 2 });
});

test("quita el relleno de la hoja de cálculo pero no cambia el número", () => {
  // Así escribe la hoja de cálculo un entero: "1.0". El `.0` es formato, no precisión.
  assert.deepEqual(canonicalDecimal("1.0"), { text: "1", minor: 1, scale: 0 });
  assert.deepEqual(canonicalDecimal("100528.0"), { text: "100528", minor: 100528, scale: 0 });
  assert.deepEqual(canonicalDecimal("19.000"), { text: "19", minor: 19, scale: 0 });
  assert.deepEqual(canonicalDecimal("12.050"), { text: "12.05", minor: 1205, scale: 2 });
});

test("los dos ceros posibles colapsan en uno", () => {
  assert.deepEqual(canonicalDecimal("0"), { text: "0", minor: 0, scale: 0 });
  assert.deepEqual(canonicalDecimal("0.00"), { text: "0", minor: 0, scale: 0 });
  assert.deepEqual(canonicalDecimal("-0.0"), { text: "0", minor: 0, scale: 0 });
});

test("distingue precios que de verdad son distintos y no los colapsa", () => {
  // El margen para absorber ruido de coma flotante no debe tragarse una diferencia real.
  assert.equal(canonicalDecimal("11.38")?.minor, 1138);
  assert.equal(canonicalDecimal("11.39")?.minor, 1139);
  assert.equal(canonicalDecimal("0.000001")?.text, "0.000001");
  assert.notEqual(canonicalDecimal("0.000001")?.minor, canonicalDecimal("0.000002")?.minor);
});

test("rechaza lo que no puede afirmar en vez de truncar dinero", () => {
  assert.equal(canonicalDecimal(""), null);
  assert.equal(canonicalDecimal("   "), null);
  assert.equal(canonicalDecimal("consultar"), null);
  assert.equal(canonicalDecimal("11,38"), null, "la coma decimal no se adivina");
  assert.equal(canonicalDecimal("$11.38"), null);
  assert.equal(canonicalDecimal("NaN"), null);
  assert.equal(canonicalDecimal("Infinity"), null);
  // Más precisión que MAX_SCALE: no se redondea a escondidas.
  assert.equal(canonicalDecimal("0.12345678", MAX_SCALE), null);
});

test("acepta notación científica reduciéndola a decimal", () => {
  assert.deepEqual(canonicalDecimal("1.5e-2"), { text: "0.015", minor: 15, scale: 3 });
  assert.deepEqual(canonicalDecimal("2E2"), { text: "200", minor: 200, scale: 0 });
});

test("formatExact devuelve el decimal legible desde el entero exacto", () => {
  assert.equal(formatExact(1138, 2), "11.38");
  assert.equal(formatExact(1903, 1), "190.3");
  assert.equal(formatExact(15, 2), "0.15");
  assert.equal(formatExact(19, 0), "19");
  assert.equal(formatExact(-1138, 2), "-11.38");
});

test("ida y vuelta: texto -> exacto -> texto", () => {
  for (const raw of ["11.379999999999999", "0.15000000000000002", "190.29999999999998", "19", "428.65"]) {
    const exact = canonicalDecimal(raw);
    assert.ok(exact);
    assert.equal(formatExact(exact.minor, exact.scale), exact.text);
  }
});

test("multiplyExact parte del entero y no arrastra el error original", () => {
  // 11.38 EUR x 4 piezas x 21.8 MXN/EUR = 992.336
  assert.ok(Math.abs(multiplyExact(1138, 2, 4, 21.8) - 992.336) < 1e-9);
  assert.equal(multiplyExact(1138, 2, 1, 1), 11.38);
  assert.equal(multiplyExact(19, 0, 2, 1), 38);
});
